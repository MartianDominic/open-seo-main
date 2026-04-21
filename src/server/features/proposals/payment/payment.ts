/**
 * Proposal payment service using Stripe.
 * Phase 30-06: Payment (Stripe)
 *
 * Handles the payment workflow:
 * 1. Create Stripe checkout session after signing
 * 2. Handle webhook events for payment completion
 * 3. Update proposal and payment records
 */

import Stripe from "stripe";
import { eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { db } from "@/db/index";
import { proposalPayments, proposals } from "@/db/proposal-schema";
import { createLogger } from "@/server/lib/logger";
import { triggerOnboarding } from "../onboarding";

const log = createLogger({ module: "PaymentService" });

// Lazy-initialized Stripe client
let stripeClient: Stripe | null = null;

/**
 * Gets or creates the Stripe client singleton.
 * Throws if STRIPE_SECRET_KEY is not configured.
 */
export function getStripeClient(): Stripe {
  if (!process.env.STRIPE_SECRET_KEY) {
    throw new Error("STRIPE_SECRET_KEY environment variable is required");
  }

  if (!stripeClient) {
    stripeClient = new Stripe(process.env.STRIPE_SECRET_KEY);
  }

  return stripeClient;
}

/**
 * Input parameters for creating a payment checkout session.
 */
export interface CreatePaymentCheckoutParams {
  proposalId: string;
  customerEmail: string;
  setupFeeCents: number;
  monthlyFeeCents?: number;
  successUrl: string;
  cancelUrl: string;
}

/**
 * Result of creating a checkout session.
 */
export interface CreatePaymentCheckoutResult {
  checkoutUrl: string;
  sessionId: string;
}

/**
 * Creates a Stripe Checkout session for proposal payment.
 *
 * Supports:
 * - One-time setup fee (payment mode)
 * - Monthly subscription (subscription mode)
 * - Combined setup fee + monthly subscription
 *
 * Uses Lithuanian locale for checkout page.
 * Stores payment record with pending status.
 *
 * @param params - Checkout parameters
 * @returns Checkout URL to redirect customer
 * @throws Error if Stripe is not configured
 *
 * @example
 * const result = await createPaymentCheckout({
 *   proposalId: "proposal-123",
 *   customerEmail: "customer@example.com",
 *   setupFeeCents: 200000, // 2000 EUR
 *   monthlyFeeCents: 100000, // 1000 EUR/month
 *   successUrl: "https://app.example.com/p/token/payment/success",
 *   cancelUrl: "https://app.example.com/p/token",
 * });
 * // Redirect to result.checkoutUrl
 */
export async function createPaymentCheckout(
  params: CreatePaymentCheckoutParams
): Promise<CreatePaymentCheckoutResult> {
  const {
    proposalId,
    customerEmail,
    setupFeeCents,
    monthlyFeeCents,
    successUrl,
    cancelUrl,
  } = params;

  log.info("Creating payment checkout", { proposalId, setupFeeCents, monthlyFeeCents });

  const stripe = getStripeClient();

  // Build line items using inline type
  const lineItems: Array<{
    price_data: {
      currency: string;
      product_data: { name: string; description?: string };
      unit_amount: number;
      recurring?: { interval: "month" | "year" | "week" | "day" };
    };
    quantity: number;
  }> = [];

  // Setup fee (one-time)
  if (setupFeeCents > 0) {
    lineItems.push({
      price_data: {
        currency: "eur",
        product_data: {
          name: "SEO Idiegimo mokestis",
          description: "Vienkartinis idiegimo mokestis",
        },
        unit_amount: setupFeeCents,
      },
      quantity: 1,
    });
  }

  // Monthly fee (subscription)
  if (monthlyFeeCents && monthlyFeeCents > 0) {
    lineItems.push({
      price_data: {
        currency: "eur",
        product_data: {
          name: "SEO Menesinis mokestis",
          description: "Menesinis SEO paslaugu mokestis",
        },
        unit_amount: monthlyFeeCents,
        recurring: {
          interval: "month",
        },
      },
      quantity: 1,
    });
  }

  // Determine mode based on whether subscription is included
  const mode: "payment" | "subscription" =
    monthlyFeeCents && monthlyFeeCents > 0 ? "subscription" : "payment";

  // Create Stripe checkout session
  const session = await stripe.checkout.sessions.create({
    payment_method_types: ["card"],
    mode,
    line_items: lineItems,
    customer_email: customerEmail,
    success_url: successUrl,
    cancel_url: cancelUrl,
    metadata: {
      proposalId,
    },
    locale: "lt", // Lithuanian
  });

  // Store payment record in database
  const paymentId = nanoid();
  const totalAmountCents = setupFeeCents + (monthlyFeeCents ?? 0);

  await db.insert(proposalPayments).values({
    id: paymentId,
    proposalId,
    provider: "stripe",
    stripeSessionId: session.id,
    amountCents: totalAmountCents,
    currency: "EUR",
    status: "pending",
  }).returning();

  log.info("Payment checkout created", {
    proposalId,
    sessionId: session.id,
    mode,
    amountCents: totalAmountCents,
  });

  return {
    checkoutUrl: session.url!,
    sessionId: session.id,
  };
}

/**
 * Verifies Stripe webhook signature and returns parsed event.
 *
 * @param payload - Raw request body
 * @param signature - Stripe-Signature header value
 * @returns Parsed Stripe event
 * @throws Error if signature is invalid
 */
export function verifyWebhookSignature(
  payload: string,
  signature: string
): Stripe.Event {
  const stripe = getStripeClient();
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!webhookSecret) {
    throw new Error("STRIPE_WEBHOOK_SECRET environment variable is required");
  }

  return stripe.webhooks.constructEvent(payload, signature, webhookSecret);
}

/**
 * Handles Stripe webhook events.
 *
 * Supported events:
 * - checkout.session.completed: Payment successful, update records
 * - invoice.paid: Subscription renewal (logged)
 * - customer.subscription.deleted: Subscription cancelled (logged)
 *
 * @param event - Stripe event object
 */
export async function handleStripeWebhook(event: Stripe.Event): Promise<void> {
  log.info("Handling Stripe webhook", { type: event.type });

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      await handleCheckoutCompleted(session);
      break;
    }

    case "invoice.paid": {
      const invoice = event.data.object as Stripe.Invoice;
      log.info("Invoice paid", {
        invoiceId: invoice.id,
        amountPaid: invoice.amount_paid,
      });
      break;
    }

    case "customer.subscription.deleted": {
      const subscription = event.data.object as Stripe.Subscription;
      log.info("Subscription cancelled", {
        subscriptionId: subscription.id,
      });
      break;
    }

    default:
      log.info("Unhandled webhook event", { type: event.type });
  }
}

/**
 * Handles checkout.session.completed webhook event.
 * Updates payment record and proposal status.
 */
async function handleCheckoutCompleted(
  session: Stripe.Checkout.Session
): Promise<void> {
  const proposalId = session.metadata?.proposalId;

  if (!proposalId) {
    log.warn("No proposalId in session metadata", { sessionId: session.id });
    return;
  }

  log.info("Processing checkout completion", {
    proposalId,
    sessionId: session.id,
    paymentIntent: session.payment_intent,
    subscription: session.subscription,
  });

  const now = new Date();

  // Update payment record
  await db
    .update(proposalPayments)
    .set({
      stripePaymentIntentId: session.payment_intent as string | null,
      stripeSubscriptionId: session.subscription as string | null,
      status: "completed",
      paidAt: now,
    })
    .where(eq(proposalPayments.stripeSessionId, session.id))
    .returning();

  // Update proposal status to paid
  await db
    .update(proposals)
    .set({
      status: "paid",
      paidAt: now,
      updatedAt: now,
    })
    .where(eq(proposals.id, proposalId))
    .returning();

  log.info("Payment completed and proposal updated", {
    proposalId,
    sessionId: session.id,
  });

  // Trigger auto-onboarding (Phase 30-07)
  try {
    const onboardingResult = await triggerOnboarding(proposalId);
    log.info("Onboarding triggered successfully", {
      proposalId,
      clientId: onboardingResult.clientId,
      projectId: onboardingResult.projectId,
    });
  } catch (error) {
    // Log but don't fail the webhook - onboarding can be retried manually
    log.error(
      "Onboarding failed",
      error instanceof Error ? error : new Error(String(error)),
      { proposalId }
    );
  }
}

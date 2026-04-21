/**
 * Follow-up email templates for automation.
 * Phase 30-08: Pipeline & Automation
 *
 * Lithuanian email templates for:
 * - Proposal reminder (not viewed after 3 days)
 * - Any questions (viewed but no action after 5 days)
 */

import { createLogger } from "@/server/lib/logger";

const log = createLogger({ module: "automation-email" });

const LOOPS_TRANSACTIONAL_URL = "https://app.loops.so/api/v1/transactional";

/**
 * Email content structure.
 */
export interface EmailContent {
  subject: string;
  body: string;
}

/**
 * Follow-up email parameters.
 */
export interface FollowUpEmailParams {
  to: string;
  template: "proposal_reminder" | "any_questions";
  companyName: string;
  proposalUrl: string;
  recipientName?: string;
}

/**
 * Template parameters for email generation.
 */
export interface TemplateParams {
  template: "proposal_reminder" | "any_questions";
  companyName: string;
  proposalUrl: string;
  recipientName?: string;
}

/**
 * Generate follow-up email content based on template.
 */
export function generateFollowUpEmail(params: TemplateParams): EmailContent {
  const { template, companyName, proposalUrl, recipientName } = params;
  const greeting = recipientName ? `Sveiki, ${recipientName}!` : "Sveiki!";

  switch (template) {
    case "proposal_reminder":
      return generateProposalReminderEmail({
        greeting,
        companyName,
        proposalUrl,
      });

    case "any_questions":
      return generateAnyQuestionsEmail({
        greeting,
        companyName,
        proposalUrl,
      });

    default:
      throw new Error(`Unknown email template: ${template}`);
  }
}

/**
 * Generate "not viewed" reminder email (Lithuanian).
 * Sent 3 days after proposal was sent but not viewed.
 */
function generateProposalReminderEmail(params: {
  greeting: string;
  companyName: string;
  proposalUrl: string;
}): EmailContent {
  const { greeting, companyName, proposalUrl } = params;

  return {
    subject: `Priminimas: SEO pasiulymas laukia jusu perziuros`,
    body: `${greeting}

Norejome priminti, kad parengeme SEO pasiulyma jusu imonei ${companyName}.

Pasiulyme rasite:
- Dabartines situacijos analize
- Galimybiu sarasaa
- Investiciju graza (ROI) skaiciuokle
- Kainos ir paslaugu apimti

Perziureti pasiulyma:
${proposalUrl}

Pasiulymas galioja 30 dienu nuo issiuntimo.

Jei turite klausimu, tiesiog atsakykite i si laiska.

Pagarbiai,
Jusu SEO komanda`,
  };
}

/**
 * Generate "any questions" email (Lithuanian).
 * Sent 5 days after proposal was viewed but no action taken.
 */
function generateAnyQuestionsEmail(params: {
  greeting: string;
  companyName: string;
  proposalUrl: string;
}): EmailContent {
  const { greeting, companyName, proposalUrl } = params;

  return {
    subject: `Ar turite klausimu del SEO pasiulymo?`,
    body: `${greeting}

Matome, kad perziurejote musu SEO pasiulyma ${companyName} imonei.

Norime paklausti - ar viskas aišku? Gal kyla klausimu?

Dazniausiai klausiama apie:
- Rezultatu terminus
- Paslaugu apimti
- Kainos sudeti
- Ataskaitų daznuma

Perziureti pasiulyma dar karta:
${proposalUrl}

Mielai organizuotume trumpa skambuti aptarti detales. Tiesiog atsakykite i si laiska su jums patogiu laiku.

Pagarbiai,
Jusu SEO komanda`,
  };
}

/**
 * Send follow-up email via Loops transactional API.
 */
export async function sendFollowUpEmail(
  params: FollowUpEmailParams
): Promise<boolean> {
  const { to, template, companyName, proposalUrl, recipientName } = params;

  const apiKey = process.env.LOOPS_API_KEY;

  if (!apiKey) {
    log.warn("LOOPS_API_KEY not configured, skipping follow-up email", {
      to,
      template,
    });
    return false;
  }

  const email = generateFollowUpEmail({
    template,
    companyName,
    proposalUrl,
    recipientName,
  });

  log.info("Sending follow-up email", {
    to,
    template,
    subject: email.subject,
  });

  try {
    const response = await fetch(LOOPS_TRANSACTIONAL_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        transactionalId: `proposal-${template}`,
        email: to,
        addToAudience: false,
        dataVariables: {
          subject: email.subject,
          body: email.body,
          companyName,
          proposalUrl,
          recipientName: recipientName ?? "",
        },
      }),
    });

    if (!response.ok) {
      const errorPayload = await response.json().catch(() => null);
      log.error("Follow-up email send failed", undefined, {
        status: response.status,
        to,
        template,
        errorPayload,
      });
      return false;
    }

    log.info("Follow-up email sent successfully", { to, template });
    return true;
  } catch (error) {
    log.error(
      "Follow-up email send error",
      error instanceof Error ? error : new Error(String(error)),
      { to, template }
    );
    return false;
  }
}

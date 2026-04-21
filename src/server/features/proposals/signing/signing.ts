/**
 * Proposal signing service using Dokobit.
 * Phase 30-05: E-Signature (Dokobit)
 *
 * Handles the signing workflow:
 * 1. Generate contract PDF from proposal
 * 2. Initiate signing via Smart-ID or Mobile-ID
 * 3. Poll for completion
 * 4. Store signed PDF and update records
 */

import { createHash } from "crypto";
import { eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { db } from "@/db/index";
import { proposalSignatures, proposals } from "@/db/proposal-schema";
import { createDokobitClient } from "@/server/lib/dokobit";
import type { SigningStatus } from "@/server/lib/dokobit";
import { ProposalService } from "../services/ProposalService";
import { generateContractPdf, calculateDocumentHash } from "./pdf";
import { putTextToR2 } from "@/server/lib/r2";
import { createLogger } from "@/server/lib/logger";

const log = createLogger({ module: "SigningService" });

/**
 * Input parameters for initiating proposal signing.
 */
export interface InitiateSigningInput {
  proposalId: string;
  method: "smart_id" | "mobile_id";
  personalCode: string;
  phoneNumber?: string;
  signerName: string;
  country?: "LT" | "EE" | "LV";
}

/**
 * Result of initiating a signing session.
 */
export interface InitiateSigningResult {
  sessionId: string;
  verificationCode: string;
  signatureId: string;
}

/**
 * Validates a Lithuanian personal code format.
 * Must be exactly 11 digits.
 *
 * @param personalCode - Personal identification code
 * @returns true if valid format
 */
export function validatePersonalCode(personalCode: string): boolean {
  if (!personalCode || personalCode.length !== 11) {
    return false;
  }
  return /^\d{11}$/.test(personalCode);
}

/**
 * Hashes personal code with salt for GDPR-compliant storage.
 * Uses SHA256 with application salt.
 *
 * @param personalCode - Raw personal identification code
 * @returns SHA256 hash as hex string
 */
export function hashPersonalCode(personalCode: string): string {
  const salt = process.env.PERSONAL_CODE_SALT ?? "";
  return createHash("sha256")
    .update(personalCode + salt)
    .digest("hex");
}

/**
 * Initiates e-signature process for a proposal.
 *
 * Steps:
 * 1. Verify proposal exists and is in "accepted" status
 * 2. Generate contract PDF
 * 3. Calculate document hash for signing
 * 4. Initiate signing via Dokobit (Smart-ID or Mobile-ID)
 * 5. Store signature record in database
 *
 * @param input - Signing parameters
 * @returns Session info with verification code
 * @throws Error if proposal not found or not in accepted status
 *
 * @example
 * const result = await initiateProposalSigning({
 *   proposalId: "proposal-123",
 *   method: "smart_id",
 *   personalCode: "38501010001",
 *   signerName: "Jonas Jonaitis",
 * });
 * // result.verificationCode = "1234" (show to user)
 */
export async function initiateProposalSigning(
  input: InitiateSigningInput
): Promise<InitiateSigningResult> {
  const { proposalId, method, personalCode, phoneNumber, signerName, country = "LT" } = input;

  log.info("Initiating proposal signing", { proposalId, method });

  // 1. Verify proposal exists and is accepted
  const proposal = await ProposalService.findById(proposalId);

  if (!proposal) {
    throw new Error("Proposal not found");
  }

  if (proposal.status !== "accepted") {
    throw new Error("Proposal must be accepted before signing");
  }

  // 2. Generate contract PDF
  const pdfBuffer = await generateContractPdf(proposal);

  // 3. Calculate document hash
  const documentHash = calculateDocumentHash(pdfBuffer);

  // 4. Initiate signing via Dokobit
  const dokobit = createDokobitClient();
  const documentName = `SEO Sutartis - ${proposal.id}`;

  const session =
    method === "smart_id"
      ? await dokobit.initiateSmartIdSigning({
          personalCode,
          country,
          documentHash,
          documentName,
        })
      : await dokobit.initiateMobileIdSigning({
          personalCode,
          phoneNumber: phoneNumber!,
          country,
          documentHash,
          documentName,
        });

  // 5. Store signature record
  const signatureId = nanoid();
  const personalCodeHash = hashPersonalCode(personalCode);

  await db.insert(proposalSignatures).values({
    id: signatureId,
    proposalId,
    signerName,
    signerPersonalCodeHash: personalCodeHash,
    signingMethod: method,
    dokobitSessionId: session.sessionId,
  }).returning();

  log.info("Signing session initiated", {
    proposalId,
    signatureId,
    sessionId: session.sessionId,
  });

  return {
    sessionId: session.sessionId,
    verificationCode: session.verificationCode,
    signatureId,
  };
}

/**
 * Checks the status of a signing session.
 *
 * When completed:
 * - Downloads signed PDF from Dokobit
 * - Uploads to R2 storage
 * - Updates signature record with PDF URL
 * - Updates proposal status to "signed"
 *
 * @param proposalId - Proposal ID
 * @param sessionId - Dokobit session ID
 * @returns Current signing status
 */
export async function checkSigningStatus(
  proposalId: string,
  sessionId: string
): Promise<SigningStatus> {
  const dokobit = createDokobitClient();
  const status = await dokobit.getSigningStatus(sessionId);

  log.info("Checking signing status", { proposalId, sessionId, status: status.status });

  if (status.status === "completed") {
    await handleSigningCompletion(proposalId, sessionId);
  }

  return status;
}

/**
 * Handles successful signing completion.
 * Downloads signed PDF, stores it, and updates records.
 */
async function handleSigningCompletion(
  proposalId: string,
  sessionId: string
): Promise<void> {
  log.info("Handling signing completion", { proposalId, sessionId });

  const dokobit = createDokobitClient();

  // Download signed PDF
  const signedPdf = await dokobit.downloadSignedDocument(sessionId);

  // Upload to R2 storage
  const storageKey = `proposals/${proposalId}/signed-contract.pdf`;
  await putTextToR2(storageKey, signedPdf.toString("base64"));

  const signedPdfUrl = `/api/proposals/${proposalId}/signed-pdf`;

  // Update signature record
  await db
    .update(proposalSignatures)
    .set({
      signedPdfUrl,
      signedAt: new Date(),
    })
    .where(eq(proposalSignatures.dokobitSessionId, sessionId))
    .returning();

  // Update proposal status to signed
  await db
    .update(proposals)
    .set({
      status: "signed",
      signedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(proposals.id, proposalId))
    .returning();

  log.info("Signing completed and recorded", {
    proposalId,
    sessionId,
    signedPdfUrl,
  });
}

import { getRequiredEnvValue } from "@/server/lib/runtime-env";
import { createLogger } from "@/server/lib/logger";

const log = createLogger({ module: "loops" });

const LOOPS_TRANSACTIONAL_URL = "https://app.loops.so/api/v1/transactional";

async function getHostedAuthEmailConfig() {
  return {
    apiKey: await getRequiredEnvValue("LOOPS_API_KEY"),
    verificationTemplateId: await getRequiredEnvValue(
      "LOOPS_TRANSACTIONAL_VERIFY_EMAIL_ID",
    ),
    passwordResetTemplateId: await getRequiredEnvValue(
      "LOOPS_TRANSACTIONAL_RESET_PASSWORD_ID",
    ),
  };
}

async function sendLoopsTransactionalEmail({
  apiKey,
  email,
  transactionalId,
  dataVariables,
}: {
  apiKey: string;
  email: string;
  transactionalId: string;
  dataVariables: Record<string, string>;
}) {
  const response = await fetch(LOOPS_TRANSACTIONAL_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      transactionalId,
      email,
      addToAudience: false,
      dataVariables,
    }),
  });

  if (response.ok) {
    return;
  }

  const errorPayload = await response.json().catch(() => null);
  log.error("Transactional email error", undefined, {
    status: response.status,
    email,
    transactionalId,
    errorPayload,
  });

  throw new Error(
    `Failed to send Loops transactional email (${response.status})`,
  );
}

export async function sendHostedVerificationEmail({
  email,
  confirmationUrl,
}: {
  email: string;
  confirmationUrl: string;
}) {
  const config = await getHostedAuthEmailConfig();
  await sendLoopsTransactionalEmail({
    apiKey: config.apiKey,
    email,
    transactionalId: config.verificationTemplateId,
    dataVariables: {
      appName: "OpenSEO",
      confirmationUrl,
    },
  });
}

export async function sendHostedPasswordResetEmail({
  email,
  resetUrl,
}: {
  email: string;
  resetUrl: string;
}) {
  const config = await getHostedAuthEmailConfig();
  await sendLoopsTransactionalEmail({
    apiKey: config.apiKey,
    email,
    transactionalId: config.passwordResetTemplateId,
    dataVariables: {
      appName: "OpenSEO",
      resetUrl,
    },
  });
}

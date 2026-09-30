import { Resend } from "resend";

const DEFAULT_FROM = "Bemblo <onboarding@resend.dev>";

function fromAddress() {
  return process.env.BEMBLO_EMAIL_FROM?.trim() || DEFAULT_FROM;
}

function getResend() {
  const apiKey = process.env.RESEND_API_KEY?.trim();

  if (!apiKey) {
    throw new Error("RESEND_API_KEY is not configured.");
  }

  return new Resend(apiKey);
}

export async function sendVerificationEmail({
  to,
  verifyUrl,
}: {
  to: string;
  verifyUrl: string;
}) {
  const resend = getResend();

  const result = await resend.emails.send({
    from: fromAddress(),
    to,
    subject: "Verify your Bemblo email",
    text: [
      "Verify your Bemblo email address.",
      "",
      `Open this link to verify your email: ${verifyUrl}`,
      "",
      "This verification link expires after 24 hours.",
      "",
      "If you did not create a Bemblo account, you can ignore this email.",
    ].join("\n"),
  });

  if (result.error) {
    throw new Error(result.error.message);
  }

  return result.data;
}

export async function sendPasswordResetEmail({
  to,
  resetUrl,
}: {
  to: string;
  resetUrl: string;
}) {
  const resend = getResend();

  const result = await resend.emails.send({
    from: fromAddress(),
    to,
    subject: "Reset your Bemblo password",
    text: [
      "A password reset was requested for your Bemblo account.",
      "",
      `Open this link to reset your password: ${resetUrl}`,
      "",
      "This reset link expires after 1 hour.",
      "",
      "If you did not request a password reset, you can ignore this email.",
    ].join("\n"),
  });

  if (result.error) {
    throw new Error(result.error.message);
  }

  return result.data;
}

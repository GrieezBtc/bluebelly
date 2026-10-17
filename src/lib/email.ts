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

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function emailLayout({
  title,
  intro,
  buttonText,
  buttonUrl,
  fallbackLabel,
  expiryText,
}: {
  title: string;
  intro: string;
  buttonText: string;
  buttonUrl: string;
  fallbackLabel: string;
  expiryText: string;
}) {
  const safeTitle = escapeHtml(title);
  const safeIntro = escapeHtml(intro);
  const safeButtonText = escapeHtml(buttonText);
  const safeButtonUrl = escapeHtml(buttonUrl);
  const safeFallbackLabel = escapeHtml(fallbackLabel);
  const safeExpiryText = escapeHtml(expiryText);

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${safeTitle} - Bemblo</title>
</head>
<body style="margin:0;padding:0;background:#f5f3ff;font-family:Arial,Helvetica,sans-serif;color:#171329;">
  <div style="width:100%;padding:32px 12px;box-sizing:border-box;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:600px;margin:0 auto;background:#ffffff;border-radius:20px;overflow:hidden;border:1px solid #e7e1ff;">
      <tr>
        <td style="background:#6d45f5;padding:28px 32px;text-align:center;">
          <img
  src="https://bemblo.name.ng/bemblo-bimi.svg"
  alt="Bemblo"
  width="72"
  height="72"
  style="display:block;width:72px;height:72px;margin:0 auto 16px;border:0;border-radius:20px;"
/>
          <div style="margin-top:12px;color:#ffffff;font-size:25px;font-weight:800;">
            bemblo
          </div>
        </td>
      </tr>

      <tr>
        <td style="padding:38px 32px 28px;">
          <h1 style="margin:0 0 16px;font-size:28px;line-height:1.25;color:#171329;">
            ${safeTitle}
          </h1>

          <p style="margin:0 0 28px;font-size:16px;line-height:1.7;color:#5e5873;">
            ${safeIntro}
          </p>

          <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:0 auto 28px;">
            <tr>
              <td style="border-radius:12px;background:#6d45f5;">
                <a href="${safeButtonUrl}" style="display:inline-block;padding:15px 28px;border-radius:12px;background:#6d45f5;color:#ffffff;text-decoration:none;font-size:16px;font-weight:700;">
                  ${safeButtonText}
                </a>
              </td>
            </tr>
          </table>

          <div style="padding:18px;background:#f7f5ff;border-radius:12px;">
            <p style="margin:0 0 8px;font-size:13px;line-height:1.5;color:#6d6680;">
              ${safeFallbackLabel}
            </p>
            <p style="margin:0;font-size:13px;line-height:1.6;word-break:break-all;">
              <a href="${safeButtonUrl}" style="color:#6d45f5;text-decoration:none;">
                ${safeButtonUrl}
              </a>
            </p>
          </div>

          <p style="margin:24px 0 0;font-size:14px;line-height:1.6;color:#77718a;">
            ${safeExpiryText}
          </p>

          <p style="margin:18px 0 0;font-size:14px;line-height:1.6;color:#77718a;">
            If you did not request this, you can safely ignore this email.
          </p>
        </td>
      </tr>

      <tr>
        <td style="padding:24px 32px;background:#faf9fe;border-top:1px solid #eeeaf8;text-align:center;">
          <p style="margin:0 0 8px;font-size:14px;color:#77718a;">
            Bemblo — Talk. Share. Connect.
          </p>
          <p style="margin:0;font-size:12px;color:#a09aad;">
            This is an automated email. Please do not reply.
          </p>
        </td>
      </tr>
    </table>
  </div>
</body>
</html>`;
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
    html: emailLayout({
      title: "Verify your email address",
      intro:
        "Welcome to Bemblo. Please verify your email address to keep your account secure and recoverable.",
      buttonText: "Verify Email Address",
      buttonUrl: verifyUrl,
      fallbackLabel: "Or copy this verification link:",
      expiryText: "This verification link expires after 24 hours.",
    }),
    text: [
      "Verify your Bemblo email address.",
      "",
      `Open this link to verify your email: ${verifyUrl}`,
      "",
      "This verification link expires after 24 hours.",
      "",
      "If you did not create a Bemblo account, you can ignore this email.",
      "",
      "Bemblo — Talk. Share. Connect.",
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
    html: emailLayout({
      title: "Reset your password",
      intro:
        "A password reset was requested for your Bemblo account.",
      buttonText: "Reset Password",
      buttonUrl: resetUrl,
      fallbackLabel: "Or copy this password reset link:",
      expiryText: "This reset link expires after 1 hour.",
    }),
    text: [
      "A password reset was requested for your Bemblo account.",
      "",
      `Open this link to reset your password: ${resetUrl}`,
      "",
      "This reset link expires after 1 hour.",
      "",
      "If you did not request a password reset, you can ignore this email.",
      "",
      "Bemblo — Talk. Share. Connect.",
    ].join("\n"),
  });

  if (result.error) {
    throw new Error(result.error.message);
  }

  return result.data;
}

export async function sendNotificationEmail({
  to,
  title,
  body,
  url,
}: {
  to: string;
  title: string;
  body: string;
  url: string;
}) {
  const resend = getResend();
  const result = await resend.emails.send({
    from: fromAddress(),
    to,
    subject: title,
    html: emailLayout({
      title,
      intro: body,
      buttonText: "Open Bemblo",
      buttonUrl: url,
      fallbackLabel: "Or copy this link:",
      expiryText: "You can turn email notifications off anytime in Settings > Notifications.",
    }),
    text: [title, "", body, "", `Open Bemblo: ${url}`, "", "Turn these emails off in Settings > Notifications."].join("\n"),
  });
  if (result.error) throw new Error(result.error.message);
  return result.data;
}

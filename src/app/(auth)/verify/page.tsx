import { VerifyEmailPanel } from "@/components/auth/forms";

export const metadata = { title: "Verify your email" };

export default function VerifyPage() {
  return (
    <div>
      <h1 className="h1">Email verification</h1>
      <p className="body-sm pt-1 pb-6">Confirming the email on your account keeps your account recoverable.</p>
      <VerifyEmailPanel />
    </div>
  );
}

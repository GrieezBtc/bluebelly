import { ForgotPasswordForm } from "@/components/auth/forms";

export const metadata = { title: "Reset password" };

export default function ForgotPasswordPage() {
  return (
    <div>
      <h1 className="h1">Reset your password</h1>
      <p className="body-sm pt-1 pb-6">
        Enter the email on your BlueBelly account and we will send you a link to choose a new password.
      </p>
      <ForgotPasswordForm />
    </div>
  );
}

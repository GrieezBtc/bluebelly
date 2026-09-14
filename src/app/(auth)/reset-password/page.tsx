import { ResetPasswordForm } from "@/components/auth/forms";

export const metadata = { title: "Choose a new password" };

export default function ResetPasswordPage() {
  return (
    <div>
      <h1 className="h1">Choose a new password</h1>
      <p className="body-sm pt-1 pb-6">For your safety, all other devices will be signed out.</p>
      <ResetPasswordForm />
    </div>
  );
}

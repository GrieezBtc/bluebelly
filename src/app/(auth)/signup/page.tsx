import { SignupForm } from "@/components/auth/forms";

export const metadata = { title: "Create account" };

export default function SignupPage() {
  return (
    <div>
      <h1 className="h1">Create your BlueBelly account</h1>
      <p className="body-sm pt-1 pb-6">Pick a username people can find, and a password that keeps your account safe.</p>
      <SignupForm />
    </div>
  );
}

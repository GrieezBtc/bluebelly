import { LoginForm } from "@/components/auth/forms";

export const metadata = { title: "Log in" };

export default function LoginPage() {
  return (
    <div>
      <h1 className="h1">Welcome back</h1>
      <p className="body-sm pt-1 pb-6">Log in to your conversations and Moments.</p>
      <LoginForm />
    </div>
  );
}

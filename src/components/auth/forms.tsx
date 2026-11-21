"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/icons";
import { Field, InfoBanner, Spinner, useToast } from "@/components/ui";
import { DemoButton } from "@/components/auth/demo-button";
import { api } from "@/lib/client";
import { passwordStrength, USERNAME_RULES, validateUsername } from "@/lib/utils";

function FormError({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <div className="banner banner-danger" role="alert">
      <Icon name="alert" size={18} className="shrink-0" />
      <span>{message}</span>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Log in
 * ------------------------------------------------------------------ */
export function LoginForm() {
  const router = useRouter();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api.post("/api/auth/login", { email: identifier, password });
      router.replace("/home");
      router.refresh();
    } catch (err) {
      const error = err as Error & { code?: string };
      if (error.code === "email_not_verified") {
        setError("Your email is not verified yet. Check your inbox and verify it before logging in.");
      } else {
        setError(error.message || "We could not sign you in.");
      }
      setBusy(false);
    }
  }

  return (
    <form className="flex flex-col gap-4" onSubmit={submit} noValidate>
      <FormError message={error} />
      <Field label="Email or username" htmlFor="login-identifier">
        <input
          id="login-identifier"
          className="input"
          autoComplete="username"
          inputMode="email"
          required
          value={identifier}
          onChange={(event) => setIdentifier(event.target.value)}
          placeholder="you@example.com or @yourname"
        />
      </Field>
      <Field label="Password" htmlFor="login-password">
        <div className="input-affix">
          <input
            id="login-password"
            type={showPassword ? "text" : "password"}
            autoComplete="current-password"
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Your password"
          />
          <button
            type="button"
            className="btn-icon"
            style={{ width: 36, minHeight: 36 }}
            onClick={() => setShowPassword((value) => !value)}
            aria-label={showPassword ? "Hide password" : "Show password"}
          >
            <Icon name={showPassword ? "eye-off" : "eye"} size={18} />
          </button>
        </div>
      </Field>
      <div className="flex items-center justify-between">
        <Link href="/forgot-password" className="text-sm font-semibold text-brand">
          Forgot password?
        </Link>
      </div>
      <button type="submit" className="btn btn-primary btn-lg btn-block" disabled={busy || !identifier || !password}>
        {busy ? <Spinner /> : null}
        Log in
      </button>
      <p className="body-sm text-center">
        New to BlueBelly?{" "}
        <Link href="/signup" className="font-semibold text-brand">
          Create an account
        </Link>
      </p>
    </form>
  );
}

/* ------------------------------------------------------------------ *
 * Sign up
 * ------------------------------------------------------------------ */
export function SignupForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [usernameNote, setUsernameNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const strength = useMemo(() => passwordStrength(password), [password]);

  useEffect(() => {
    if (username.length < USERNAME_RULES.min) {
      setUsernameNote(null);
      return;
    }
    const timer = window.setTimeout(async () => {
      try {
        const result = await api.post<{ available: boolean; message: string }>("/api/auth/check-username", { username });
        setUsernameNote(result.message);
      } catch {
        setUsernameNote(null);
      }
    }, 420);
    return () => window.clearTimeout(timer);
  }, [username]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const check = validateUsername(username);
    if (!check.ok) {
      setError(check.message);
      return;
    }
    if (!agreed) {
      setError("Please accept the Terms and Community guidelines to continue.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await api.post("/api/auth/signup", { name, username, email, password });
      router.replace("/verify-required");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "We could not create your account.");
      setBusy(false);
    }
  }

  return (
    <form className="flex flex-col gap-4" onSubmit={submit} noValidate>
      <FormError message={error} />
      <Field label="Name" hint="This is what people see on your profile." htmlFor="signup-name">
        <input
          id="signup-name"
          className="input"
          autoComplete="name"
          required
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Ada Lovelace"
        />
      </Field>
      <Field
        label="Username"
        hint={usernameNote ?? "Lowercase letters, numbers, dots and underscores. 3–20 characters."}
        htmlFor="signup-username"
      >
        <div className="input-affix">
          <span className="input-affix__prefix">@</span>
          <input
            id="signup-username"
            autoComplete="username"
            required
            value={username}
            onChange={(event) => setUsername(event.target.value.toLowerCase())}
            placeholder="yourname"
          />
        </div>
      </Field>
      <Field label="Email" hint="Used for login, security alerts and account recovery." htmlFor="signup-email">
        <input
          id="signup-email"
          className="input"
          type="email"
          inputMode="email"
          autoComplete="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="you@example.com"
        />
      </Field>
      <Field
        label="Password"
        hint={
          password
            ? `Strength: ${strength.label}${strength.message ? ` — ${strength.message}` : ""}`
            : "At least 8 characters. Longer is better."
        }
        htmlFor="signup-password"
      >
        <input
          id="signup-password"
          className="input"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          placeholder="Create a password"
        />
      </Field>
      {password ? (
        <div className="flex gap-1" aria-hidden="true">
          {[0, 1, 2, 3].map((index) => (
            <span
              key={index}
              className="h-1.5 flex-1 rounded-full"
              style={{ background: index < strength.score ? "var(--brand)" : "var(--surface-3)" }}
            />
          ))}
        </div>
      ) : null}
      <label className="flex items-start gap-3 text-sm">
        <input type="checkbox" className="mt-1 h-4 w-4" checked={agreed} onChange={(event) => setAgreed(event.target.checked)} />
        <span className="body-sm">
          I agree to the{" "}
          <Link href="/legal/terms" className="font-semibold text-brand">
            Terms
          </Link>{" "}
          and{" "}
          <Link href="/legal/guidelines" className="font-semibold text-brand">
            Community guidelines
          </Link>
          .
        </span>
      </label>
      <button type="submit" className="btn btn-primary btn-lg btn-block" disabled={busy}>
        {busy ? <Spinner /> : null}
        Create account
      </button>
      <p className="body-sm text-center">
        Already have an account?{" "}
        <Link href="/login" className="font-semibold text-brand">
          Log in
        </Link>
      </p>
    </form>
  );
}

/* ------------------------------------------------------------------ *
 * Forgot password
 * ------------------------------------------------------------------ */
export function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const result = await api.post<{ message: string; previewUrl?: string }>("/api/auth/forgot", { email });
      setMessage(result.message);
      setPreviewUrl(result.previewUrl ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "We could not start the reset.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="flex flex-col gap-4" onSubmit={submit} noValidate>
      <FormError message={error} />
      {message ? (
        <InfoBanner tone="brand" icon="mail" title="Check your email">
          <p>{message}</p>
          {previewUrl ? (
            <p className="pt-2">
              No mail provider is configured in this environment, so use this secure link instead:{" "}
              <Link href={previewUrl.replace(/^https?:\/\/[^/]+/, "")} className="font-semibold text-brand">
                reset your password
              </Link>
            </p>
          ) : null}
        </InfoBanner>
      ) : (
        <>
          <Field label="Email" hint="We will send a reset link that works for 1 hour." htmlFor="forgot-email">
            <input
              id="forgot-email"
              className="input"
              type="email"
              inputMode="email"
              autoComplete="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@example.com"
            />
          </Field>
          <button type="submit" className="btn btn-primary btn-lg btn-block" disabled={busy || !email}>
            {busy ? <Spinner /> : null}
            Send reset link
          </button>
        </>
      )}
      <div className="flex flex-col gap-2 text-sm">
        <Link href="/login" className="font-semibold text-brand">
          Back to log in
        </Link>
        <Link href="/support" className="body-sm">
          Locked out of your email too? Contact BlueBelly Support for account recovery.
        </Link>
      </div>
    </form>
  );
}

/* ------------------------------------------------------------------ *
 * Reset password
 * ------------------------------------------------------------------ */
export function ResetPasswordForm() {
  const router = useRouter();
  const { show } = useToast();
  const [token, setToken] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setToken(params.get("token") ?? "");
  }, []);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (password !== confirm) {
      setError("Those passwords do not match.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const result = await api.post<{ message: string }>("/api/auth/reset", { token, password });
      show({ title: "Password updated", description: result.message, tone: "success" });
      router.replace("/login");
    } catch (err) {
      setError(err instanceof Error ? err.message : "We could not reset your password.");
      setBusy(false);
    }
  }

  return (
    <form className="flex flex-col gap-4" onSubmit={submit} noValidate>
      <FormError message={error} />
      {!token ? (
        <InfoBanner tone="warn" icon="alert" title="Missing reset link">
          <p>
            Open the link from your reset email, or{" "}
            <Link href="/forgot-password" className="font-semibold text-brand">
              request a new one
            </Link>
            .
          </p>
        </InfoBanner>
      ) : null}
      <Field label="New password" hint="At least 8 characters." htmlFor="reset-password">
        <input
          id="reset-password"
          className="input"
          type="password"
          autoComplete="new-password"
          minLength={8}
          required
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />
      </Field>
      <Field label="Repeat password" htmlFor="reset-confirm">
        <input
          id="reset-confirm"
          className="input"
          type="password"
          autoComplete="new-password"
          required
          value={confirm}
          onChange={(event) => setConfirm(event.target.value)}
        />
      </Field>
      <button type="submit" className="btn btn-primary btn-lg btn-block" disabled={busy || !token || password.length < 8}>
        {busy ? <Spinner /> : null}
        Update password
      </button>
    </form>
  );
}

/* ------------------------------------------------------------------ *
 * Email verification
 * ------------------------------------------------------------------ */
export function VerifyEmailPanel() {
  const [state, setState] = useState<"pending" | "done" | "failed">("pending");
  const [message, setMessage] = useState("Verifying your email…");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get("token");
    if (!token) {
      setState("failed");
      setMessage("This verification link is incomplete. Request a new email from Settings → Account.");
      return;
    }
    api
      .post<{ message: string }>("/api/auth/verify", { token })
      .then((result) => {
        setState("done");
        setMessage(result.message);
      })
      .catch((error: Error) => {
        setState("failed");
        setMessage(error.message);
      });
  }, []);

  return (
    <div className="flex flex-col gap-4">
      <InfoBanner tone={state === "failed" ? "danger" : state === "done" ? "brand" : "info"} icon={state === "failed" ? "alert" : "shield-check"}>
        <p>{message}</p>
      </InfoBanner>
      <Link href={state === "done" ? "/login" : "/login"} className="btn btn-primary btn-block">
        {state === "done" ? "Email verified — log in" : "Back to login"}
      </Link>
    </div>
  );
}

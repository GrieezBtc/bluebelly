"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { BrandMark, Icon } from "@/components/icons";
import { Avatar, Field, InfoBanner, Spinner, useToast } from "@/components/ui";
import { api } from "@/lib/client";
import { ACCENTS, USERNAME_RULES, validateUsername } from "@/lib/utils";
import { MESSAGE_PERMISSION_COPY, PRIVACY_SWITCH_COPY } from "@/lib/privacy";
import type { MessagePermission, ProfilePrivacy } from "@/db/schema";

type Initial = {
  name: string;
  username: string;
  bio: string;
  avatarUrl: string | null;
  accent: string;
  profilePrivacy: ProfilePrivacy;
  messagePermission: MessagePermission;
};

export function ProfileSetup({ initial }: { initial: Initial }) {
  const router = useRouter();
  const { show } = useToast();
  const [step, setStep] = useState(0);
  const [name, setName] = useState(initial.name);
  const [username, setUsername] = useState(initial.username);
  const [bio, setBio] = useState(initial.bio);
  const [avatarUrl, setAvatarUrl] = useState(initial.avatarUrl);
  const [accent, setAccent] = useState(initial.accent);
  const [privacy, setPrivacy] = useState<ProfilePrivacy>(initial.profilePrivacy);
  const [permission, setPermission] = useState<MessagePermission>(initial.messagePermission);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function uploadPhoto(file: File) {
    const form = new FormData();
    form.append("file", file);
    form.append("scope", "profile");
    try {
      const result = await api.upload<{ url: string }>("/api/upload", form);
      setAvatarUrl(result.url);
      show({ title: "Photo added", tone: "success" });
    } catch (err) {
      show({ title: "Upload failed", description: err instanceof Error ? err.message : "Try another photo.", tone: "error" });
    }
  }

  async function finish() {
    const check = validateUsername(username);
    if (!check.ok) {
      setError(check.message);
      setStep(0);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await api.patch("/api/me", {
        name,
        username: check.value,
        bio,
        avatarUrl,
        accent,
        profilePrivacy: privacy,
        messagePermission: permission,
        onboardingComplete: true,
      });
      show({ title: "Profile ready", description: "Welcome to BlueBelly.", tone: "success" });
      router.replace("/home");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "We could not save your profile.");
      setBusy(false);
    }
  }

  const steps = ["Your profile", "Privacy", "Messaging"];

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="flex items-center justify-between pb-4">
        <BrandMark size={28} />
        <span className="caption numeric">
          Step {step + 1} of {steps.length}
        </span>
      </header>

      <div className="flex gap-1.5 pb-5" aria-hidden="true">
        {steps.map((label, index) => (
          <span
            key={label}
            className="h-1.5 flex-1 rounded-full"
            style={{ background: index <= step ? "var(--brand)" : "var(--surface-3)" }}
          />
        ))}
      </div>

      <main className="flex-1">
        {step === 0 ? (
          <div className="flex flex-col gap-4">
            <div>
              <h1 className="h1">Set up your profile</h1>
              <p className="body-sm pt-1">People find you by your name and username. You can change both later.</p>
            </div>
            <div className="flex items-center gap-4">
              <Avatar user={{ name: name || "New member", avatarUrl, accent }} size="xl" />
              <div className="flex flex-col gap-2">
                <label className="btn btn-secondary btn-sm cursor-pointer">
                  <Icon name="camera" size={16} />
                  {avatarUrl ? "Replace photo" : "Add photo"}
                  <input
                    type="file"
                    accept="image/*"
                    className="sr-only"
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      if (file) void uploadPhoto(file);
                    }}
                  />
                </label>
                {avatarUrl ? (
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => setAvatarUrl(null)}>
                    Remove
                  </button>
                ) : (
                  <span className="caption">Or pick a colour for your initials.</span>
                )}
              </div>
            </div>
            {!avatarUrl ? (
              <div className="flex gap-2" role="radiogroup" aria-label="Avatar colour">
                {ACCENTS.map((option) => (
                  <button
                    key={option}
                    type="button"
                    role="radio"
                    aria-checked={accent === option}
                    aria-label={`${option} avatar colour`}
                    className={`avatar avatar-sm accent-${option}`}
                    style={{ outline: accent === option ? "2px solid var(--ink)" : "none", outlineOffset: 2 }}
                    onClick={() => setAccent(option)}
                  />
                ))}
              </div>
            ) : null}
            <Field label="Name" htmlFor="setup-name">
              <input id="setup-name" className="input" value={name} onChange={(event) => setName(event.target.value)} />
            </Field>
            <Field label="Username" hint={`Lowercase letters, numbers, dots and underscores. ${USERNAME_RULES.min}–${USERNAME_RULES.max} characters.`} htmlFor="setup-username">
              <div className="input-affix">
                <span className="input-affix__prefix">@</span>
                <input
                  id="setup-username"
                  value={username}
                  onChange={(event) => setUsername(event.target.value.toLowerCase())}
                />
              </div>
            </Field>
            <Field label="Bio" hint={`${bio.length}/200 characters`} htmlFor="setup-bio">
              <textarea
                id="setup-bio"
                className="textarea"
                maxLength={200}
                value={bio}
                onChange={(event) => setBio(event.target.value)}
                placeholder="A short line about you."
              />
            </Field>
          </div>
        ) : null}

        {step === 1 ? (
          <div className="flex flex-col gap-4">
            <div>
              <h1 className="h1">Who can see your profile?</h1>
              <p className="body-sm pt-1">
                This controls your profile and Public / Followers Moments. It is separate from who can message you.
              </p>
            </div>
            <div className="flex flex-col gap-2">
              {(["public", "private"] as ProfilePrivacy[]).map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => setPrivacy(option)}
                  aria-pressed={privacy === option}
                  className={`card card-pad text-left ${privacy === option ? "border-brand" : ""}`}
                  style={privacy === option ? { background: "var(--brand-soft)" } : undefined}
                >
                  <span className="flex items-center gap-2">
                    <Icon name={option === "public" ? "globe" : "lock"} size={18} />
                    <span className="font-semibold">{option === "public" ? "Public" : "Private"}</span>
                    {privacy === option ? <Icon name="check" size={16} className="ml-auto text-brand" /> : null}
                  </span>
                  <span className="body-sm block pt-1">
                    {option === "public"
                      ? "Anyone can view your profile and Public Moments, and follow you instantly."
                      : "Only approved followers can see your follower-only content. Follow requests need your approval."}
                  </span>
                </button>
              ))}
            </div>
            <InfoBanner tone="info" icon="info" title={`How switching works (${privacy === "private" ? "going Private" : "going Public"})`}>
              <ul className="list-disc space-y-1 pl-4">
                {(privacy === "private" ? PRIVACY_SWITCH_COPY.toPrivate : PRIVACY_SWITCH_COPY.toPublic).map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            </InfoBanner>
          </div>
        ) : null}

        {step === 2 ? (
          <div className="flex flex-col gap-4">
            <div>
              <h1 className="h1">Who can message you?</h1>
              <p className="body-sm pt-1">
                Messaging permissions are independent from profile privacy. Strangers can still be routed into Message Requests
                instead of your inbox.
              </p>
            </div>
            <div className="flex flex-col gap-2">
              {(Object.keys(MESSAGE_PERMISSION_COPY) as MessagePermission[]).map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => setPermission(option)}
                  aria-pressed={permission === option}
                  className={`card card-pad text-left ${permission === option ? "border-brand" : ""}`}
                  style={permission === option ? { background: "var(--brand-soft)" } : undefined}
                >
                  <span className="flex items-center gap-2 font-semibold">
                    {MESSAGE_PERMISSION_COPY[option].label}
                    {permission === option ? <Icon name="check" size={16} className="ml-auto text-brand" /> : null}
                  </span>
                  <span className="body-sm block pt-1">{MESSAGE_PERMISSION_COPY[option].description}</span>
                </button>
              ))}
            </div>
            <InfoBanner tone="brand" icon="lock" title="Your privacy is enforced by BlueBelly's servers">
              <p>
                Audience rules, messaging permissions and message expiration are applied on our side, so they hold in any BlueBelly
                app — browser, Android or iOS.
              </p>
            </InfoBanner>
          </div>
        ) : null}

        {error ? (
          <p className="field-error pt-4" role="alert">
            {error}
          </p>
        ) : null}
      </main>

      <footer className="flex gap-2 pt-6">
        {step > 0 ? (
          <button type="button" className="btn btn-secondary" onClick={() => setStep((value) => value - 1)}>
            Back
          </button>
        ) : null}
        {step < steps.length - 1 ? (
          <button
            type="button"
            className="btn btn-primary flex-1"
            onClick={() => setStep((value) => value + 1)}
            disabled={step === 0 && (!name.trim() || !username.trim())}
          >
            Continue
          </button>
        ) : (
          <button type="button" className="btn btn-primary flex-1" onClick={finish} disabled={busy}>
            {busy ? <Spinner /> : <Icon name="check" size={18} />}
            Enter BlueBelly
          </button>
        )}
      </footer>
    </div>
  );
}

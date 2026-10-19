"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/icons";
import { PageHeader } from "@/components/app-shell";
import {
  Avatar,
  Badge,
  ConfirmDialog,
  EmptyState,
  Field,
  InfoBanner,
  LoadingRows,
  Segmented,
  Spinner,
  Switch,
  useToast,
} from "@/components/ui";
import { api, useQuery } from "@/lib/client";
import { useSession } from "@/components/providers";
import { ACCENTS, USERNAME_RULES } from "@/lib/utils";
import { MESSAGE_PERMISSION_COPY, PRIVACY_SWITCH_COPY } from "@/lib/privacy";
import { disablePushOnDevice, enablePushOnDevice } from "@/lib/push-client";
import { NOTIFICATION_PREF_COPY } from "@/lib/content";
import type { MessagePermission, NotificationPrefs, UserSummary } from "@/lib/types";

type Tab = "profile" | "account" | "privacy" | "messaging" | "notifications" | "content";

const TAB_LABELS: { value: Tab; label: string }[] = [
  { value: "account", label: "Account & app" },
  { value: "privacy", label: "Privacy" },
  { value: "messaging", label: "Messaging" },
  { value: "notifications", label: "Notifications" },
  { value: "content", label: "Content" },
];

function SettingsInner() {
  const { user, setUser, refresh, signOut } = useSession();
  const router = useRouter();
  const { show } = useToast();
  const [tab, setTab] = useState<Tab>("account");
  const [busy, setBusy] = useState(false);
  const [resendBusy, setResendBusy] = useState(false);
  const [name, setName] = useState(user?.name ?? "");
  const [username, setUsername] = useState(user?.username ?? "");
  const [bio, setBio] = useState(user?.bio ?? "");
  const [phone, setPhone] = useState(user?.phone ?? "");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(user?.avatarUrl ?? null);
  const [accent, setAccent] = useState(user?.accent ?? "violet");
  const [privacyExplanation, setPrivacyExplanation] = useState<string[] | null>(null);
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [confirmBlockedOpen, setConfirmBlockedOpen] = useState<UserSummary | null>(null);

  const blocked = useQuery<{ users: UserSummary[] }>(tab === "privacy" ? "/api/users?kind=blocked" : null);
  const muted = useQuery<{ users: UserSummary[] }>(tab === "privacy" ? "/api/users?kind=muted" : null);
  const pending = useQuery<{ users: UserSummary[] }>(tab === "privacy" ? "/api/users?kind=pending" : null);
  const theme = useState(() => (typeof window === "undefined" ? "system" : window.localStorage.getItem("bemblo-theme") ?? "system"))[0];
  const [themeValue, setThemeValue] = useState(theme);

  useEffect(() => {
    const param = new URLSearchParams(window.location.search).get("tab");
    if (param === "profile" || (param && TAB_LABELS.some((item) => item.value === param))) setTab(param as Tab);
  }, []);

  useEffect(() => {
    if (!user) return;
    setName(user.name);
    setUsername(user.username);
    setBio(user.bio);
    setPhone(user.phone ?? "");
    setAvatarUrl(user.avatarUrl);
    setAccent(user.accent);
  }, [user]);

  if (!user) return <LoadingRows rows={3} />;

  async function patch(payload: Record<string, unknown>, success: string) {
    setBusy(true);
    try {
      const result = await api.patch<{ user: typeof user; privacyExplanation: string[] | null }>("/api/me", payload);
      setUser(result.user);
      setPrivacyExplanation(result.privacyExplanation);
      show({ title: success, tone: "success" });
      router.refresh();
    } catch (error) {
      show({ title: "Could not save", description: error instanceof Error ? error.message : undefined, tone: "error" });
    } finally {
      setBusy(false);
    }
  }

  async function resendVerification() {
    setResendBusy(true);
    try {
      const result = await api.post<{
        delivered: boolean;
        alreadyVerified?: boolean;
        message: string;
        previewUrl?: string;
      }>("/api/auth/resend-verification");

      if (result.previewUrl) {
        show({
          title: "Verification link created",
          description: result.previewUrl,
          tone: "success",
        });
      } else {
        show({
          title: "Verification email requested",
          description: result.message,
          tone: "success",
        });
      }

      await refresh();
    } catch (error) {
      show({
        title: "Could not resend verification",
        description: error instanceof Error ? error.message : undefined,
        tone: "error",
      });
    } finally {
      setResendBusy(false);
    }
  }

  async function uploadAvatar(file: File) {
    const form = new FormData();
    form.append("file", file);
    form.append("scope", "profile");
    try {
      const result = await api.upload<{ url: string }>("/api/upload", form);
      setAvatarUrl(result.url);
      await patch({ avatarUrl: result.url }, "Profile photo updated");
    } catch (error) {
      show({ title: "Upload failed", description: error instanceof Error ? error.message : undefined, tone: "error" });
    }
  }

  async function enablePush() {
    const result = await enablePushOnDevice();
    if (result.ok) {
      show({ title: "Push notifications on", description: "This device will now get pop-up alerts for messages, comments, likes and follows.", tone: "success" });
      void patch({ notificationPrefs: { push: true } }, "Preferences saved");
      return;
    }
    const copy = {
      unsupported: "This browser does not support push. On iPhone, add Bemblo to your Home Screen first.",
      denied: "Notifications are blocked. Allow them for Bemblo in your browser or phone settings, then try again.",
      not_configured: "Push is not configured on the server yet.",
      error: result.message ?? "Something went wrong. Please try again.",
    }[result.reason];
    show({ title: "Push not enabled", description: copy, tone: "info" });
  }

  return (
    <div className="page px-4">
      <PageHeader
        title={tab === "profile" ? "Edit profile" : "Settings"}
        subtitle={`@${user.username}`}
        backHref={tab === "profile" ? `/profile/${user.username}` : `/profile/${user.username}?menu=1`}
      />

      {tab !== "profile" ? (
      <div className="pb-4">
        <div className="scroll-x" role="tablist" aria-label="Settings sections">
          {TAB_LABELS.map((item) => (
            <button
              key={item.value}
              type="button"
              role="tab"
              aria-selected={tab === item.value}
              className="chip"
              data-active={tab === item.value}
              onClick={() => setTab(item.value)}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>
      ) : null}

      {tab === "profile" ? (
        <div className="flex flex-col gap-4">
          <section className="card card-pad flex flex-col gap-4">
            <h2 className="h3">Profile</h2>
            <div className="flex items-start gap-4">
              <Avatar user={{ name, avatarUrl, accent }} size="xl" />
              <div className="min-w-0 flex-1 flex flex-col gap-2">
                <label className="btn btn-secondary btn-sm w-full max-w-full cursor-pointer">
                  <Icon name="camera" size={16} /> Change photo
                  <input
                    type="file"
                    accept="image/*"
                    className="sr-only"
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      if (file) void uploadAvatar(file);
                    }}
                  />
                </label>
                {avatarUrl ? (
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    onClick={() => {
                      setAvatarUrl(null);
                      void patch({ avatarUrl: null }, "Profile photo removed");
                    }}
                  >
                    Remove photo
                  </button>
                ) : (
                  <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Avatar colour">
                    {ACCENTS.map((option) => (
                      <button
                        key={option}
                        type="button"
                        role="radio"
                        aria-checked={accent === option}
                        aria-label={`${option} colour`}
                        className={`avatar avatar-sm accent-${option}`}
                        style={{ outline: accent === option ? "2px solid var(--ink)" : "none", outlineOffset: 2 }}
                        onClick={() => setAccent(option)}
                      />
                    ))}
                  </div>
                )}
              </div>
            </div>

            <Field label="Name" htmlFor="settings-name">
              <input id="settings-name" className="input" value={name} onChange={(event) => setName(event.target.value)} />
            </Field>
            <Field label="Username" hint={`Lowercase letters, numbers, dots and underscores (${USERNAME_RULES.min}–${USERNAME_RULES.max}).`} htmlFor="settings-username">
              <div className="input-affix">
                <span className="input-affix__prefix">@</span>
                <input id="settings-username" value={username} onChange={(event) => setUsername(event.target.value.toLowerCase())} />
              </div>
            </Field>
            <Field label="Bio" hint={`${bio.length}/200 characters`} htmlFor="settings-bio">
              <textarea
                id="settings-bio"
                className="textarea"
                maxLength={200}
                value={bio}
                onChange={(event) => setBio(event.target.value)}
              />
            </Field>
            <button
              type="button"
              className="btn btn-primary"
              disabled={busy}
              onClick={() => patch({ name, username, bio, avatarUrl, accent }, "Profile updated")}
            >
              {busy ? <Spinner /> : <Icon name="check" size={16} />} Save profile
            </button>
          </section>

        </div>
      ) : null}

      {tab === "account" ? (
        <div className="flex flex-col gap-4">
          <section className="card card-pad flex flex-col gap-3">
            <h2 className="h3">Login &amp; contact</h2>
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold">Email</p>
                <p className="body-sm">{user.email}</p>
              </div>

              {user.emailVerifiedAt ? (
                <Badge tone="followers" icon="check">
                  Verified
                </Badge>
              ) : (
                <Badge tone="danger" icon="alert">
                  Not verified
                </Badge>
              )}
            </div>

            {!user.emailVerifiedAt ? (
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  disabled={resendBusy}
                  onClick={resendVerification}
                >
                  {resendBusy ? <Spinner /> : <Icon name="mail" size={16} />}
                  Resend verification
                </button>
                <p className="text-xs text-muted">
                  The verification link expires after 24 hours.
                </p>
              </div>
            ) : null}
            <Field label="Phone (optional)" hint="Used for account recovery and security alerts only." htmlFor="settings-phone">
              <input id="settings-phone" className="input" value={phone} onChange={(event) => setPhone(event.target.value)} />
            </Field>
            <div className="flex flex-wrap gap-2">
              <button type="button" className="btn btn-secondary btn-sm" disabled={busy} onClick={() => patch({ phone }, "Phone updated")}>
                Save phone
              </button>
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => setPasswordOpen((value) => !value)}>
                <Icon name="key" size={16} /> Change password
              </button>
            </div>
            {passwordOpen ? (
              <div className="flex flex-col gap-3 border-t border-line pt-3">
                <Field label="Current password" htmlFor="current-password">
                  <input
                    id="current-password"
                    type="password"
                    className="input"
                    value={currentPassword}
                    onChange={(event) => setCurrentPassword(event.target.value)}
                  />
                </Field>
                <Field label="New password" hint="At least 8 characters." htmlFor="new-password">
                  <input
                    id="new-password"
                    type="password"
                    className="input"
                    value={newPassword}
                    onChange={(event) => setNewPassword(event.target.value)}
                  />
                </Field>
                <button
                  type="button"
                  className="btn btn-primary"
                  disabled={busy || newPassword.length < 8 || !currentPassword}
                  onClick={async () => {
                    try {
                      const result = await api.put<{ message?: string; error?: string }>("/api/me", {
                        currentPassword,
                        newPassword,
                      });
                      if (result.error) throw new Error(result.error);
                      show({ title: "Password updated", description: result.message, tone: "success" });
                      setPasswordOpen(false);
                      setCurrentPassword("");
                      setNewPassword("");
                    } catch (error) {
                      show({ title: "Could not update", description: error instanceof Error ? error.message : undefined, tone: "error" });
                    }
                  }}
                >
                  Update password
                </button>
              </div>
            ) : null}
          </section>

          <section className="card card-pad flex flex-col gap-3">
            <h2 className="h3">Security &amp; sessions</h2>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={async () => {
                const result = await api.post<{ message: string }>("/api/me", { action: "sign-out-other-devices" });
                show({ title: result.message, tone: "success" });
              }}
            >
              <Icon name="shield" size={16} /> Sign out other devices
            </button>
            <button type="button" className="btn btn-secondary" onClick={() => void signOut()}>
              <Icon name="logout" size={16} /> Log out on this device
            </button>
          </section>

          <section className="card card-pad flex flex-col gap-3">
            <h2 className="h3">Appearance &amp; app</h2>
            <div>
              <p className="field-label pb-1">Theme</p>
              <Segmented
                label="Theme"
                value={themeValue as "system" | "light" | "dark"}
                onChange={(value) => {
                  setThemeValue(value);
                  window.localStorage.setItem("bemblo-theme", value);
                  const root = document.documentElement;
                  if (value === "dark") root.classList.add("dark");
                  else if (value === "light") root.classList.remove("dark");
                  else {
                    root.classList.toggle("dark", window.matchMedia("(prefers-color-scheme: dark)").matches);
                  }
                }}
                options={[
                  { value: "system", label: "System" },
                  { value: "light", label: "Light" },
                  { value: "dark", label: "Dark" },
                ]}
              />
            </div>
            <button type="button" className="btn btn-secondary" onClick={enablePush}>
              <Icon name="bell" size={16} /> Enable push notifications
            </button>
            <p className="caption">
              Installing Bemblo from your browser menu adds it to your home screen with a full-screen layout and an offline shell.
            </p>
          </section>

          <section className="card card-pad flex flex-col gap-3" style={{ borderColor: "var(--coral)" }}>
            <h2 className="h3 text-coral">Danger zone</h2>
            <p className="body-sm">
              Deleting your account removes your profile, Moments, conversations and temporary media. This cannot be undone.
            </p>
            <button type="button" className="btn btn-danger" onClick={() => setDeleteOpen(true)}>
              <Icon name="trash" size={16} /> Delete account
            </button>
          </section>
        </div>
      ) : null}

      {tab === "privacy" ? (
        <div className="flex flex-col gap-4">
          <section className="card card-pad flex flex-col gap-3">
            <h2 className="h3">Profile visibility</h2>
            <p className="body-sm">
              This controls your profile and which audiences can reach your Moments. It is separate from messaging permissions.
            </p>
            <div className="flex flex-col gap-2">
              {(["public", "private"] as const).map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => patch({ profilePrivacy: option }, "Privacy updated")}
                  aria-pressed={user.profilePrivacy === option}
                  className={`card-flat p-3 text-left ${user.profilePrivacy === option ? "border-brand" : ""}`}
                  style={user.profilePrivacy === option ? { background: "var(--brand-soft)" } : undefined}
                  disabled={busy}
                >
                  <span className="flex items-center gap-2 font-semibold">
                    <Icon name={option === "public" ? "globe" : "lock"} size={18} />
                    {option === "public" ? "Public" : "Private"}
                    {user.profilePrivacy === option ? <Icon name="check" size={16} className="ml-auto text-brand" /> : null}
                  </span>
                  <span className="body-sm block pt-1">
                    {option === "public"
                      ? "Anyone can view your profile and Public Moments and follow you instantly."
                      : "Only approved followers can view your follower-only Moments. Requests need your approval."}
                  </span>
                </button>
              ))}
            </div>
            <InfoBanner tone="info" icon="info" title="What happens when you switch">
              <ul className="list-disc space-y-1 pl-4">
                {(user.profilePrivacy === "private" ? PRIVACY_SWITCH_COPY.toPrivate : PRIVACY_SWITCH_COPY.toPublic).map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            </InfoBanner>
            {privacyExplanation ? (
              <InfoBanner tone="brand" icon="shield-check" title="Just now">
                <ul className="list-disc space-y-1 pl-4">
                  {privacyExplanation.map((line) => (
                    <li key={line}>{line}</li>
                  ))}
                </ul>
              </InfoBanner>
            ) : null}
          </section>

          <section className="card p-0">
            <div className="section-title px-4 pt-4">
              <h2 className="h3">Follower requests</h2>
              <Badge tone="private">{(pending.data?.users ?? []).length} waiting</Badge>
            </div>
            {(pending.data?.users ?? []).length === 0 ? (
              <p className="body-sm px-4 pb-4">No pending requests. When your profile is Private, new requests appear here.</p>
            ) : (
              <ul className="divide-y divide-[color:var(--line)]">
                {(pending.data?.users ?? []).map((person) => (
                  <li key={person.id} className="flex items-center gap-2 px-3 py-2.5">
                    <Avatar user={person} size="sm" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold">{person.name}</span>
                      <span className="caption">@{person.username}</span>
                    </span>
                    <button
                      type="button"
                      className="btn btn-primary btn-sm"
                      onClick={async () => {
                        await api.post(`/api/users/${person.username}/actions`, { action: "accept" });
                        show({ title: `Approved @${person.username}`, tone: "success" });
                        pending.reload();
                        void refresh();
                      }}
                    >
                      Approve
                    </button>
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      onClick={async () => {
                        await api.post(`/api/users/${person.username}/actions`, { action: "decline" });
                        show({ title: "Request declined", tone: "info" });
                        pending.reload();
                      }}
                    >
                      Decline
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="card p-0">
            <div className="section-title px-4 pt-4">
              <h2 className="h3">Blocked accounts</h2>
              <Link href={`/profile/${user.username}?tab=followers`} className="text-xs font-semibold text-brand">
                Manage followers
              </Link>
            </div>
            {(blocked.data?.users ?? []).length === 0 ? (
              <p className="body-sm px-4 pb-4">You have not blocked anyone. Blocking is always reversible.</p>
            ) : (
              <ul className="divide-y divide-[color:var(--line)]">
                {(blocked.data?.users ?? []).map((person) => (
                  <li key={person.id} className="flex items-center gap-2 px-3 py-2.5">
                    <Avatar user={person} size="sm" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold">{person.name}</span>
                      <span className="caption">@{person.username}</span>
                    </span>
                    <button type="button" className="btn btn-secondary btn-sm" onClick={() => setConfirmBlockedOpen(person)}>
                      Unblock
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="card p-0">
            <div className="section-title px-4 pt-4">
              <h2 className="h3">Muted accounts</h2>
            </div>
            {(muted.data?.users ?? []).length === 0 ? (
              <p className="body-sm px-4 pb-4">No muted accounts. Muting hides their Moments without unfollowing.</p>
            ) : (
              <ul className="divide-y divide-[color:var(--line)]">
                {(muted.data?.users ?? []).map((person) => (
                  <li key={person.id} className="flex items-center gap-2 px-3 py-2.5">
                    <Avatar user={person} size="sm" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold">{person.name}</span>
                      <span className="caption">@{person.username}</span>
                    </span>
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={async () => {
                        await api.post(`/api/users/${person.username}/actions`, { action: "unmute" });
                        show({ title: `Unmuted @${person.username}`, tone: "success" });
                        muted.reload();
                      }}
                    >
                      Unmute
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      ) : null}

      {tab === "messaging" ? (
        <div className="flex flex-col gap-4">
          <section className="card card-pad flex flex-col gap-3">
            <h2 className="h3">Who can message me?</h2>
            <p className="body-sm">
              Messaging permissions work independently from profile privacy and Moment audiences. Changing one never changes the
              others.
            </p>
            <div className="flex flex-col gap-2">
              {(Object.keys(MESSAGE_PERMISSION_COPY) as MessagePermission[]).map((option) => (
                <button
                  key={option}
                  type="button"
                  disabled={busy}
                  onClick={() => patch({ messagePermission: option }, "Messaging permission updated")}
                  aria-pressed={user.messagePermission === option}
                  className={`card-flat p-3 text-left ${user.messagePermission === option ? "border-brand" : ""}`}
                  style={user.messagePermission === option ? { background: "var(--brand-soft)" } : undefined}
                >
                  <span className="flex items-center gap-2 font-semibold">
                    {MESSAGE_PERMISSION_COPY[option].label}
                    {user.messagePermission === option ? <Icon name="check" size={16} className="ml-auto text-brand" /> : null}
                  </span>
                  <span className="body-sm block pt-1">{MESSAGE_PERMISSION_COPY[option].description}</span>
                </button>
              ))}
            </div>
          </section>

          <section className="card card-pad flex flex-col gap-3">
            <h2 className="h3">Message expiry</h2>
            <div className="flex flex-col gap-2">
              <div className="card-flat p-3">
                <p className="text-sm font-semibold">1-to-1 chats</p>
                <p className="body-sm">New chats start at 24 hours after the other person views a message. Either person can switch disappearing messages off, or choose Instant, 24 hours, 7 days or 30 days, from the chat info panel at any time.</p>
              </div>
              <div className="card-flat p-3">
                <p className="text-sm font-semibold">Group chats</p>
                <p className="body-sm">New groups start at 7 days after sending. Group admins can turn disappearing messages off, or choose 24 hours, 7 days or 30 days, from the group info panel at any time.</p>
              </div>
            </div>
            <InfoBanner tone="warn" icon="alert" title="What expiry can and cannot do">
              <p>
                Expiry is enforced by Bemblo&apos;s servers and attachments are deleted with the message. Expiring messages cannot
                prevent screenshots, screen recording or photographing a screen.
              </p>
            </InfoBanner>
            <Link href="/messages?tab=requests" className="btn btn-secondary">
              <Icon name="request" size={16} /> Review message requests
            </Link>
          </section>
        </div>
      ) : null}

      {tab === "notifications" ? (
        <div className="flex flex-col gap-4">
          <section className="card p-0">
            <div className="section-title px-4 pt-4">
              <h2 className="h3">Notification preferences</h2>
            </div>
            <ul className="divide-y divide-[color:var(--line)]">
              {NOTIFICATION_PREF_COPY.map((pref) => (
                <li key={pref.id} className="flex items-center gap-3 px-4 py-3">
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold">{pref.label}</span>
                    <span className="caption block">{pref.blurb}</span>
                  </span>
                  <Switch
                    label={pref.label}
                    checked={Boolean(user.notificationPrefs[pref.id as keyof NotificationPrefs])}
                    onChange={(next) => {
                      if (pref.id === "push") {
                        if (next) {
                          void enablePush();
                          return;
                        }
                        void disablePushOnDevice();
                      }
                      return patch(
                        { notificationPrefs: { ...user.notificationPrefs, [pref.id]: next } },
                        next ? `${pref.label} on` : `${pref.label} off`,
                      );
                    }}
                  />
                </li>
              ))}
            </ul>
          </section>
          <InfoBanner tone="info" icon="bell" title="Browser support varies">
            <p>
              Push notifications depend on your browser and operating system. Where push is unavailable, Bemblo still shows in-app
              notification badges.
            </p>
          </InfoBanner>
          <button type="button" className="btn btn-primary" onClick={enablePush}>
            <Icon name="bell" size={16} /> Enable push on this device
          </button>
        </div>
      ) : null}

      {tab === "content" ? (
        <div className="flex flex-col gap-4">
          <section className="card card-pad flex flex-col gap-3">
            <h2 className="h3">Sensitive content preferences</h2>
            <p className="body-sm">Applies to Moment photos and videos that our review team has flagged as sensitive.</p>
            {(
              [
                { value: "show", label: "Show normally", blurb: "Display everything without warning screens." },
                { value: "warn", label: "Warn me first", blurb: "Sensitive media is hidden behind a tap-to-view cover." },
                { value: "hide", label: "Hide completely", blurb: "Sensitive media never appears in your feeds." },
              ] as const
            ).map((option) => (
              <button
                key={option.value}
                type="button"
                disabled={busy}
                onClick={() => patch({ sensitiveContent: option.value }, "Content preference updated")}
                aria-pressed={user.sensitiveContent === option.value}
                className={`card-flat p-3 text-left ${user.sensitiveContent === option.value ? "border-brand" : ""}`}
                style={user.sensitiveContent === option.value ? { background: "var(--brand-soft)" } : undefined}
              >
                <span className="flex items-center gap-2 font-semibold">
                  {option.label}
                  {user.sensitiveContent === option.value ? <Icon name="check" size={16} className="ml-auto text-brand" /> : null}
                </span>
                <span className="body-sm block pt-1">{option.blurb}</span>
              </button>
            ))}
          </section>
          <section className="card card-pad">
            <h2 className="h3">Muted words and accounts</h2>
            <p className="body-sm pt-1">
              Muted accounts are managed in{" "}
              <button type="button" className="font-semibold text-brand" onClick={() => setTab("privacy")}>
                Privacy settings
              </button>
              . Muting keeps follows and messages intact while hiding Moments from your feed.
            </p>
          </section>
        </div>
      ) : null}

      <ConfirmDialog
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        title="Delete your Bemblo account?"
        description="Your profile, Moments, conversations and temporary media will be permanently removed."
        confirmLabel="Delete my account"
        tone="danger"
        confirmPhrase={user.username}
        details={
          <ul className="body-sm list-disc space-y-1 pl-4">
            <li>Moments, messages and conversation history are deleted.</li>
            <li>Temporary media in storage is cleaned up.</li>
            <li>Followers and following relationships are removed.</li>
            <li>You can create a new account later, but this data cannot be recovered.</li>
          </ul>
        }
        onConfirm={async () => {
          try {
            const result = await api.del<{ message: string }>(`/api/me?confirm=${encodeURIComponent(user.username)}`);
            show({ title: "Account deleted", description: result.message, tone: "success" });
            await signOut();
          } catch (error) {
            show({ title: "Could not delete account", description: error instanceof Error ? error.message : undefined, tone: "error" });
          }
        }}
      />

      <ConfirmDialog
        open={confirmBlockedOpen !== null}
        onClose={() => setConfirmBlockedOpen(null)}
        title={confirmBlockedOpen ? `Unblock @${confirmBlockedOpen.username}?` : "Unblock"}
        description="They will be able to find your profile again, subject to your messaging permissions."
        confirmLabel="Unblock"
        onConfirm={async () => {
          if (!confirmBlockedOpen) return;
          await api.post(`/api/users/${confirmBlockedOpen.username}/actions`, { action: "unblock" });
          show({ title: `Unblocked @${confirmBlockedOpen.username}`, tone: "success" });
          blocked.reload();
        }}
      />

      {tab === "privacy" && (blocked.data?.users ?? []).length === 0 && (muted.data?.users ?? []).length === 0 ? (
        <div className="pt-2">
          <EmptyState
            icon="shield-check"
            title="No blocked or muted accounts"
            description="You are in full control — blocking and muting are always reversible and never announced to the other person."
          />
        </div>
      ) : null}

      <div className="h-6" />
    </div>
  );
}

export default function SettingsPage() {
  return (
    <Suspense fallback={<LoadingRows rows={3} />}>
      <SettingsInner />
    </Suspense>
  );
}

"use client";

import { Fragment, useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Icon, type IconName } from "@/components/icons";
import { Avatar, EmptyState, ErrorState, Field, InfoBanner, LoadingRows, Spinner, useToast } from "@/components/ui";
import { MomentCard } from "@/components/moments/moment-card";
import { api, useQuery } from "@/lib/client";
import { useSession } from "@/components/providers";
import { cn } from "@/lib/utils";
import { AUDIENCE_COPY } from "@/lib/privacy";
import type { FeedPage, MomentAudience, MomentView, UserSummary } from "@/lib/types";

export function FeedList({
  query,
  empty,
  onCount,
  inlineAfter = 3,
  inline,
}: {
  query: string;
  empty: { title: string; description?: string; icon?: IconName; action?: React.ReactNode };
  onCount?: (count: number) => void;
  /** Optional block (e.g. people suggestions) shown after this many Moments. */
  inlineAfter?: number;
  inline?: React.ReactNode;
}) {
  const [cursor, setCursor] = useState<string | null>(null);
  const [extra, setExtra] = useState<MomentView[]>([]);
  const [loadingMore, setLoadingMore] = useState(false);
  const [done, setDone] = useState(false);
  const sentinel = useRef<HTMLDivElement>(null);
  const base = useQuery<FeedPage>(cursor ? null : query);

  useEffect(() => {
    setCursor(null);
    setExtra([]);
    setDone(false);
  }, [query]);

  const items = [...(base.data?.items ?? []), ...extra];

  useEffect(() => {
    onCount?.(items.length);
  }, [items.length, onCount]);

  const loadMore = useCallback(async () => {
    const next = cursor ?? base.data?.nextCursor;
    if (!next || loadingMore || done) return;
    setLoadingMore(true);
    try {
      const page = await api.get<FeedPage>(`${query}${query.includes("?") ? "&" : "?"}cursor=${encodeURIComponent(next)}`);
      setExtra((current) => {
        const seen = new Set(current.map((item) => item.id));
        return [...current, ...page.items.filter((item) => !seen.has(item.id))];
      });
      setCursor(page.nextCursor);
      if (!page.nextCursor) setDone(true);
    } catch (error) {
      console.error(error);
    } finally {
      setLoadingMore(false);
    }
  }, [cursor, base.data?.nextCursor, loadingMore, done, query]);

  useEffect(() => {
    const node = sentinel.current;
    if (!node) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) void loadMore();
      },
      { rootMargin: "600px 0px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [loadMore]);

  if (base.loading && items.length === 0) return <LoadingRows rows={2} />;

  if (base.error && items.length === 0) {
    return (
      <ErrorState
        title="Moments could not load"
        description={base.error}
        onRetry={base.reload}
      />
    );
  }

  if (items.length === 0) {
    return <EmptyState icon={empty.icon ?? "moments"} title={empty.title} description={empty.description} action={empty.action} />;
  }

  return (
    <div className="flex flex-col gap-3">
      {items.map((moment, index) => (
        <Fragment key={moment.id}>
          <MomentCard
            moment={moment}
            priority={index < 2}
            onChanged={(patch) => {
              if (patch) return;
              base.reload();
              setExtra([]);
              setCursor(null);
              setDone(false);
            }}
          />
          {inline && index === Math.min(inlineAfter, items.length) - 1 ? inline : null}
        </Fragment>
      ))}
      <div ref={sentinel} className="h-6" aria-hidden="true" />
      {loadingMore ? (
        <p className="flex items-center justify-center gap-2 py-3 caption">
          <Spinner /> Loading more Moments
        </p>
      ) : null}
      {!base.data?.nextCursor && done && items.length > 6 ? <p className="pb-4 text-center caption">You are all caught up.</p> : null}
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Composer
 * ------------------------------------------------------------------ */

export function Composer({
  onPublished,
  redirectTo = "/home",
  compact,
  variant = "default",
}: {
  onPublished?: () => void;
  redirectTo?: string;
  compact?: boolean;
  variant?: "default" | "create";
}) {
  const router = useRouter();
  const { show } = useToast();
  const { user } = useSession();
  const [kind, setKind] = useState<"text" | "photo" | "video">("text");
  const [body, setBody] = useState("");
  const [audience, setAudience] = useState<MomentAudience | null>(null);
  const [audienceOpen, setAudienceOpen] = useState(false);
  const [media, setMedia] = useState<{ url: string; kind: string } | null>(null);
  const [uploading, setUploading] = useState(false);
  const [publishError, setPublishError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (audience === null && user) setAudience(user.profilePrivacy === "private" ? "followers" : "public");
  }, [user, audience]);

  async function pickFile(file: File) {
    setUploading(true);
    setPublishError(null);
    const form = new FormData();
    form.append("file", file);
    form.append("scope", "moment");
    try {
      const result = await api.upload<{ url: string; kind: string }>("/api/upload", form);
      setMedia({ url: result.url, kind: result.kind });
      setKind(result.kind === "video" ? "video" : "photo");
    } catch (error) {
      setPublishError(error instanceof Error ? error.message : "Upload failed. Try a smaller file.");
    } finally {
      setUploading(false);
    }
  }

  async function publish(event: React.FormEvent) {
    event.preventDefault();
    if (!audience) {
      setPublishError("Choose who can see this Moment before publishing.");
      return;
    }
    if (kind === "text" && !body.trim()) {
      setPublishError("Write something to share.");
      return;
    }
    if (kind !== "text" && !media) {
      setPublishError("Add your photo or video first.");
      return;
    }
    setBusy(true);
    setPublishError(null);
    try {
      await api.post<{ id: number }>("/api/moments", {
        kind,
        body: body.trim(),
        audience,
        mediaUrl: media?.url ?? null,
      });
      show({
        title: "Moment shared",
        description: `Visible to ${AUDIENCE_COPY[audience].label}. It stays until you delete it.`,
        tone: "success",
      });
      setBody("");
      setMedia(null);
      setKind("text");
      onPublished?.();
      if (redirectTo) router.push(redirectTo);
      router.refresh();
    } catch (error) {
      setPublishError(error instanceof Error ? error.message : "We could not publish your Moment.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className={cn("flex flex-col gap-4", variant === "create" && "create-composer")} onSubmit={publish}>
      {variant === "create" ? (
        <div className="create-composer__header">
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => router.push("/home")}>
            Cancel
          </button>
          <h1 className="text-base font-semibold">Create a Moment</h1>
          <button type="submit" className="btn btn-primary btn-sm" disabled={busy || uploading}>
            {busy ? <Spinner /> : null}
            Publish
          </button>
        </div>
      ) : (
        <div className="flex items-center gap-3">
          <Avatar user={user ?? { name: "You" }} size="md" />
          <div className="min-w-0">
            <p className="font-semibold">{user?.name ?? "You"}</p>
            <p className="caption">Sharing as @{user?.username ?? "you"}</p>
          </div>
        </div>
      )}

      <div
        className={cn("scroll-x", variant === "create" && "create-composer__types")}
        role="tablist"
        aria-label="Moment type"
      >
        {(
          [
            { value: "text", label: "Text", icon: "edit" as IconName },
            { value: "photo", label: "Photo", icon: "image" as IconName },
            { value: "video", label: "Video", icon: "video" as IconName },
          ] as const
        ).map((option) => (
          <button
            key={option.value}
            type="button"
            role="tab"
            aria-selected={kind === option.value}
            className="chip"
            data-active={kind === option.value}
            onClick={() => setKind(option.value)}
          >
            <Icon name={option.icon} size={15} /> {option.label}
          </button>
        ))}
      </div>

      {variant === "create" ? (
        <div className="create-composer__editor">
          <Avatar user={user ?? { name: "You" }} size="md" />
          <textarea
            id="moment-body"
            className="create-composer__textarea"
            rows={compact ? 3 : 7}
            maxLength={2000}
            value={body}
            onChange={(event) => setBody(event.target.value)}
            placeholder={kind === "text" ? "What is on your mind?" : "Add a caption…"}
          />
        </div>
      ) : (
        <Field label={kind === "text" ? "What is on your mind?" : "Caption (optional)"} htmlFor="moment-body">
          <textarea
            id="moment-body"
            className="textarea"
            rows={compact ? 3 : 5}
            maxLength={2000}
            value={body}
            onChange={(event) => setBody(event.target.value)}
            placeholder={kind === "text" ? "Share a thought with your audience…" : "Add a caption…"}
          />
        </Field>
      )}

      {kind !== "text" ? (
        <div className="flex flex-col gap-3">
          {media ? (
            <div className="card overflow-hidden p-0">
              {media.kind === "video" ? (
                <video src={media.url} controls playsInline className="max-h-72 w-full object-cover" />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={media.url} alt="Selected media preview" className="max-h-72 w-full object-cover" />
              )}
              <div className="flex items-center justify-between gap-2 px-3 py-2">
                <span className="caption">Ready to publish</span>
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => setMedia(null)}>
                  <Icon name="trash" size={15} /> Remove
                </button>
              </div>
            </div>
          ) : (
            <label className="card card-pad flex cursor-pointer flex-col items-center gap-2 text-center">
              <span className="empty-state__icon">
                <Icon name={kind === "video" ? "video" : "image"} size={24} />
              </span>
              <span className="font-semibold">
                {uploading ? "Uploading…" : `Choose a ${kind === "video" ? "video" : "photo"}`}
              </span>
              <span className="caption">Up to 25 MB. Photos and videos are served from our own storage.</span>
              <input
                type="file"
                accept={kind === "video" ? "video/*" : "image/*"}
                className="sr-only"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) void pickFile(file);
                }}
                disabled={uploading}
              />
            </label>
          )}
        </div>
      ) : null}

      {variant === "create" ? (
        <section aria-labelledby="audience-heading" className="create-composer__audience">
          <button
            type="button"
            className="create-composer__audience-trigger"
            aria-expanded={audienceOpen}
            aria-controls="create-audience-options"
            onClick={() => setAudienceOpen((open) => !open)}
          >
            <span className="flex min-w-0 items-center gap-3">
              <span className="empty-state__icon">
                <Icon
                  name={audience ? AUDIENCE_COPY[audience].icon as IconName : "globe"}
                  size={18}
                />
              </span>
              <span className="min-w-0 text-left">
                <span className="caption block">Audience</span>
                <span className="block font-semibold">
                  {audience ? AUDIENCE_COPY[audience].label : "Choose who can see this"}
                </span>
              </span>
            </span>
            <Icon name="chevron-down" size={18} className={cn("transition-transform", audienceOpen && "rotate-180")} />
          </button>

          {audienceOpen ? (
            <div id="create-audience-options" className="create-composer__audience-options">
              {(Object.keys(AUDIENCE_COPY) as MomentAudience[]).map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => {
                    setAudience(option);
                    setAudienceOpen(false);
                  }}
                  aria-pressed={audience === option}
                  className={cn(
                    "card card-pad text-left",
                    audience === option && "border-brand",
                  )}
                  style={audience === option ? { background: "var(--brand-soft)" } : undefined}
                >
                  <span className="flex items-center gap-2 font-semibold">
                    <Icon name={AUDIENCE_COPY[option].icon as IconName} size={18} />
                    {AUDIENCE_COPY[option].label}
                    {audience === option ? (
                      <Icon name="check" size={16} className="ml-auto text-brand" />
                    ) : null}
                  </span>
                  <span className="body-sm block pt-1">
                    {AUDIENCE_COPY[option].description}
                  </span>
                  {audience === option && user?.profilePrivacy === "private" ? (
                    <span className="caption block pt-1">
                      Your profile is Private, so Public Moments are still limited to approved followers.
                    </span>
                  ) : null}
                </button>
              ))}
            </div>
          ) : null}
        </section>
      ) : (
        <section aria-labelledby="audience-heading" className="flex flex-col gap-2">
          <div className="section-title">
            <h2 className="field-label" id="audience-heading">
              Who can see this?
            </h2>
            <span className="caption">Required before publishing</span>
          </div>
          <div className="flex flex-col gap-2">
            {(Object.keys(AUDIENCE_COPY) as MomentAudience[]).map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => setAudience(option)}
                aria-pressed={audience === option}
                className={cn("card card-pad text-left", audience === option && "border-brand")}
                style={audience === option ? { background: "var(--brand-soft)" } : undefined}
              >
                <span className="flex items-center gap-2 font-semibold">
                  <Icon name={AUDIENCE_COPY[option].icon as IconName} size={18} />
                  {AUDIENCE_COPY[option].label}
                  {audience === option ? (
                    <Icon name="check" size={16} className="ml-auto text-brand" />
                  ) : null}
                </span>
                <span className="body-sm block pt-1">
                  {AUDIENCE_COPY[option].description}
                </span>
                {audience === option && user?.profilePrivacy === "private" ? (
                  <span className="caption block pt-1">
                    Your profile is Private, so Public Moments are still limited to approved followers.
                  </span>
                ) : null}
              </button>
            ))}
          </div>
        </section>
      )}

      {publishError ? (
        <div className="banner banner-danger" role="alert">
          <Icon name="alert" size={18} className="shrink-0" />
          <span>{publishError}</span>
        </div>
      ) : null}

      {variant !== "create" ? (
        <InfoBanner tone="info" icon="info">
          Moments never expire on their own. Unlike messages, they stay available until you delete them.
        </InfoBanner>
      ) : null}

      {variant !== "create" ? (
        <button type="submit" className="btn btn-primary btn-lg btn-block" disabled={busy || uploading}>
          {busy ? <Spinner /> : <Icon name="send" size={18} />}
          {audience ? `Publish as ${AUDIENCE_COPY[audience].label}` : "Publish"}
        </button>
      ) : null}
    </form>
  );
}

export function SuggestionsRail() {
  const { data, loading, reload } = useQuery<{ users: UserSummary[] }>("/api/users?kind=suggestions");
  const [busy, setBusy] = useState<string | null>(null);
  const { show } = useToast();

  async function follow(username: string, action: "follow" | "unfollow") {
    setBusy(username);
    try {
      const result = await api.post<{ message: string }>(`/api/users/${username}/actions`, { action });
      show({ title: result.message, tone: "success" });
      reload();
    } catch (error) {
      show({ title: "Action failed", description: error instanceof Error ? error.message : undefined, tone: "error" });
    } finally {
      setBusy(null);
    }
  }

  if (loading) {
    return (
      <div className="card card-pad flex flex-col gap-3" aria-busy="true">
        {[0, 1, 2].map((index) => (
          <div key={index} className="skeleton h-10 w-full" />
        ))}
      </div>
    );
  }
  const users = data?.users ?? [];
  if (users.length === 0) return null;

  return (
    <section className="card p-0" aria-labelledby="suggestions-heading">
      <div className="section-title px-4 pt-4">
        <h2 className="h3" id="suggestions-heading">
          People to follow
        </h2>
        <Link href="/search" className="text-xs font-semibold text-brand">
          Find more
        </Link>
      </div>
      <ul className="divide-y divide-[color:var(--line)]">
        {users.map((user) => (
          <li key={user.id} className="flex items-center gap-2 px-3 py-2.5">
            <Link href={`/profile/${user.username}`} className="flex min-w-0 flex-1 items-center gap-3">
              <Avatar user={user} size="sm" />
              <span className="min-w-0">
                <span className="block truncate text-sm font-semibold">{user.name}</span>
                <span className="caption block truncate">@{user.username}</span>
              </span>
            </Link>
            <button
              type="button"
              className={cn("btn btn-sm", user.isFollowing ? "btn-secondary" : "btn-primary")}
              disabled={busy === user.username}
              onClick={() => follow(user.username, user.isFollowing ? "unfollow" : "follow")}
            >
              {busy === user.username ? <Spinner /> : null}
              {user.isFollowing ? "Following" : "Follow"}
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Horizontal "Suggested for you" strip, like the people carousels on other social apps. */
/** "Follow Bemblo" card: shown on Home until the viewer follows the official account. */
export function OfficialFollowCard() {
  const { data } = useQuery<{ users: UserSummary[] }>("/api/users?kind=official");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const { show } = useToast();
  const official = data?.users?.[0];
  if (!official || done) return null;

  async function follow(person: UserSummary) {
    setBusy(true);
    try {
      await api.post(`/api/users/${person.username}/actions`, { action: "follow" });
      show({ title: `You are following ${person.name}`, description: "You will see announcements and updates in your feed.", tone: "success" });
      setDone(true);
    } catch (error) {
      show({ title: "Action failed", description: error instanceof Error ? error.message : undefined, tone: "error" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="card card-pad flex items-center gap-3" aria-label="Follow the official Bemblo account">
      <Avatar user={official} size="md" />
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-1 text-sm font-semibold">
          <Link href={`/profile/${official.username}`} className="truncate hover:underline">
            {official.name}
          </Link>
          <Icon name="shield-check" size={14} className="shrink-0 text-brand" />
        </p>
        <p className="caption">Follow for announcements and what is coming next on Bemblo.</p>
      </div>
      <button type="button" className="btn btn-primary btn-sm" disabled={busy} onClick={() => void follow(official)}>
        Follow
      </button>
    </section>
  );
}

export function SuggestionsStrip() {
  const { data, loading } = useQuery<{ users: UserSummary[] }>("/api/users?kind=suggestions");
  const [busy, setBusy] = useState<string | null>(null);
  const [followed, setFollowed] = useState<Record<string, boolean>>({});
  const { show } = useToast();

  async function toggle(person: UserSummary, isFollowing: boolean) {
    setBusy(person.username);
    try {
      const result = await api.post<{ message: string }>(`/api/users/${person.username}/actions`, {
        action: isFollowing ? "unfollow" : "follow",
      });
      setFollowed((current) => ({ ...current, [person.username]: !isFollowing }));
      show({ title: result.message, tone: "success" });
    } catch (error) {
      show({ title: "Action failed", description: error instanceof Error ? error.message : undefined, tone: "error" });
    } finally {
      setBusy(null);
    }
  }

  if (loading) {
    return (
      <div className="flex gap-3 overflow-hidden" aria-busy="true">
        {[0, 1, 2].map((index) => (
          <div key={index} className="skeleton h-40 w-36 shrink-0 rounded-xl" />
        ))}
      </div>
    );
  }
  const users = data?.users ?? [];
  if (users.length === 0) return null;

  return (
    <section aria-labelledby="suggested-heading">
      <div className="section-title">
        <h2 className="h3" id="suggested-heading">
          Suggested for you
        </h2>
        <Link href="/search" className="text-xs font-semibold text-brand">
          See all
        </Link>
      </div>
      <ul className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-2 snap-x">
        {users.map((person) => {
          const isFollowing = followed[person.username] ?? person.isFollowing;
          return (
            <li key={person.id} className="card card-pad flex w-36 shrink-0 snap-start flex-col items-center gap-2 text-center">
              <Link href={`/profile/${person.username}`} className="flex min-w-0 flex-col items-center gap-2">
                <Avatar user={person} size="lg" />
                <span className="w-full min-w-0">
                  <span className="block truncate text-sm font-semibold">{person.name}</span>
                  <span className="caption block truncate">@{person.username}</span>
                </span>
              </Link>
              <button
                type="button"
                className={cn("btn btn-sm btn-block", isFollowing ? "btn-secondary" : "btn-primary")}
                disabled={busy === person.username}
                onClick={() => toggle(person, isFollowing)}
              >
                {busy === person.username ? <Spinner /> : null}
                {isFollowing ? "Following" : "Follow"}
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

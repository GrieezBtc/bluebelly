"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/icons";
import {
  AudienceBadge,
  Avatar,
  ConfirmDialog,
  EmptyState,
  Field,
  MomentMedia,
  Overlay,
  ReportDialog,
  Spinner,
  TimeAgo,
  useToast,
} from "@/components/ui";
import { api, useCopyToClipboard, useQuery } from "@/lib/client";
import { useSession } from "@/components/providers";
import { cn } from "@/lib/utils";
import { AUDIENCE_COPY, EXPIRY_COPY } from "@/lib/privacy";
import type { CommentView, ConversationSummary, MomentAudience, MomentView } from "@/lib/types";
import type { IconName } from "@/components/icons";

export function MomentCard({
  moment,
  onChanged,
  priority,
}: {
  moment: MomentView;
  onChanged?: (patch?: Partial<MomentView>) => void;
  priority?: boolean;
}) {
  const { user } = useSession();
  const router = useRouter();
  const { show } = useToast();
  const copy = useCopyToClipboard();
  const [liked, setLiked] = useState(moment.likedByMe);
  const [likeCount, setLikeCount] = useState(moment.likeCount);
  const [commentCount, setCommentCount] = useState(moment.commentCount);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [optionsOpen, setOptionsOpen] = useState(false);
  const [audienceOpen, setAudienceOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [overflow, setOverflow] = useState(false);

  useEffect(() => {
    setLiked(moment.likedByMe);
    setLikeCount(moment.likeCount);
    setCommentCount(moment.commentCount);
  }, [moment]);

  async function toggleLike() {
    const next = !liked;
    setLiked(next);
    setLikeCount((value) => Math.max(0, value + (next ? 1 : -1)));
    try {
      const result = await api.post<{ likeCount: number; likedByMe: boolean }>(`/api/moments/${moment.id}/engagement`, {
        action: next ? "like" : "unlike",
      });
      setLikeCount(result.likeCount);
      setLiked(result.likedByMe);
      onChanged?.({ likeCount: result.likeCount, likedByMe: result.likedByMe });
    } catch (error) {
      setLiked(!next);
      setLikeCount((value) => Math.max(0, value + (next ? -1 : 1)));
      show({ title: "Could not save your like", description: error instanceof Error ? error.message : undefined, tone: "error" });
    }
  }

  async function shareLink() {
    const ok = await copy(shareUrl(moment));
    show({
      title: ok ? "Link copied" : "Copy unavailable",
      description: ok ? "Anyone who can see this Moment can open the link." : "Your browser blocked clipboard access.",
      tone: ok ? "success" : "error",
    });
    try {
      await api.post(`/api/moments/${moment.id}/engagement`, { action: "share" });
    } catch {
      /* share count is best effort */
    }
  }

  async function changeAudience(next: MomentAudience) {
    setBusy(true);
    try {
      const result = await api.patch<{ message: string }>(`/api/moments/${moment.id}`, { audience: next });
      show({ title: "Audience updated", description: result.message, tone: "success" });
      onChanged?.({ audience: next, effectiveAudience: next, audienceLocked: next === "only_me" });
      setAudienceOpen(false);
    } catch (error) {
      show({ title: "Could not update", description: error instanceof Error ? error.message : undefined, tone: "error" });
    } finally {
      setBusy(false);
    }
  }

  const audienceToShow = moment.effectiveAudience === "hidden" ? null : moment.effectiveAudience;
  const truncated = moment.body.length > 420 && !overflow;
  const shownBody = truncated ? `${moment.body.slice(0, 420)}…` : moment.body;

  return (
    <article className="card overflow-hidden p-0">
      <header className="flex items-center gap-3 px-3.5 py-3">
        <Link href={`/profile/${moment.author.username}`} aria-label={`${moment.author.name} profile`}>
          <Avatar user={moment.author} size="md" />
        </Link>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <Link href={`/profile/${moment.author.username}`} className="truncate font-semibold hover:underline">
              {moment.author.name}
            </Link>
            {moment.author.verified ? <Icon name="shield-check" size={14} className="shrink-0 text-brand" /> : null}
            {audienceToShow && audienceToShow !== "public" ? <AudienceBadge audience={audienceToShow} /> : null}
          </div>
          <p className="caption truncate">
            @{moment.author.username} · <TimeAgo iso={moment.createdAt} />
          </p>
        </div>
        <button
          type="button"
          className="btn-icon"
          aria-label="Moment options"
          onClick={() => setOptionsOpen(true)}
        >
          <Icon name="more" size={20} />
        </button>
      </header>

      {moment.body ? (
        <div className="px-3.5 pb-3">
          <p className="whitespace-pre-wrap text-[0.9375rem] leading-relaxed">{shownBody}</p>
          {moment.body.length > 420 ? (
            <button type="button" className="pt-1 text-sm font-semibold text-brand" onClick={() => setOverflow((v) => !v)}>
              {overflow ? "Show less" : "Read more"}
            </button>
          ) : null}
        </div>
      ) : null}

      <MomentMedia moment={moment} priority={priority} />

      <div className="flex items-center gap-1 px-2.5 py-2">
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          onClick={toggleLike}
          aria-pressed={liked}
          aria-label={liked ? "Unlike this Moment" : "Like this Moment"}
        >
          <Icon name="heart" size={20} filled={liked} className={liked ? "text-coral" : undefined} />
          <span className="numeric">{likeCount}</span>
        </button>
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => setCommentsOpen(true)} aria-label="View comments">
          <Icon name="comment" size={20} />
          <span className="numeric">{commentCount}</span>
        </button>
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => setShareOpen(true)} aria-label="Share this Moment">
          <Icon name="share" size={20} />
          <span className="numeric">{moment.shareCount}</span>
        </button>
        <span className="caption ml-auto pr-2 hidden sm:block">Moments stay until you delete them</span>
      </div>

      <CommentsSheet
        open={commentsOpen}
        onClose={() => setCommentsOpen(false)}
        momentId={moment.id}
        onCountChange={(count) => {
          setCommentCount(count);
          onChanged?.({ commentCount: count });
        }}
      />

      <ShareSheet
        open={shareOpen}
        onClose={() => setShareOpen(false)}
        moment={moment}
        onCopy={shareLink}
        onSent={() => show({ title: "Moment sent", tone: "success" })}
      />

      <Overlay open={optionsOpen} onClose={() => setOptionsOpen(false)} title="Moment options">
        <div className="flex flex-col gap-1">
          {moment.isMine ? (
            <>
              <button
                type="button"
                className="list-row rounded-md"
                onClick={() => {
                  setOptionsOpen(false);
                  setAudienceOpen(true);
                }}
              >
                <Icon name="users" size={20} />
                <span className="flex-1 text-left text-sm font-semibold">
                  Change audience
                  <span className="block font-normal text-ink-3">
                    Currently {AUDIENCE_COPY[moment.audience].label}
                    {moment.audience === "only_me" ? " · permanent until you change it" : ""}
                  </span>
                </span>
              </button>
              <button
                type="button"
                className="list-row rounded-md"
                onClick={async () => {
                  await shareLink();
                  setOptionsOpen(false);
                }}
              >
                <Icon name="link" size={20} />
                <span className="flex-1 text-left text-sm font-semibold">Copy link</span>
              </button>
              <button
                type="button"
                className="list-row rounded-md"
                onClick={() => {
                  setOptionsOpen(false);
                  setDeleteOpen(true);
                }}
              >
                <Icon name="trash" size={20} />
                <span className="flex-1 text-left text-sm font-semibold text-coral">Delete Moment</span>
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                className="list-row rounded-md"
                onClick={async () => {
                  await shareLink();
                  setOptionsOpen(false);
                }}
              >
                <Icon name="link" size={20} />
                <span className="flex-1 text-left text-sm font-semibold">Copy link</span>
              </button>
              <button
                type="button"
                className="list-row rounded-md"
                onClick={() => {
                  setOptionsOpen(false);
                  setReportOpen(true);
                }}
              >
                <Icon name="flag" size={20} />
                <span className="flex-1 text-left text-sm font-semibold">Report Moment</span>
              </button>
              <a className="list-row rounded-md" href={`/profile/${moment.author.username}`}>
                <Icon name="user" size={20} />
                <span className="flex-1 text-left text-sm font-semibold">View @{moment.author.username}</span>
              </a>
            </>
          )}
        </div>
      </Overlay>

      <Overlay
        open={audienceOpen}
        onClose={() => setAudienceOpen(false)}
        title="Who can see this Moment?"
        description="Only Me stays Only Me until you change it here."
      >
        <div className="flex flex-col gap-2">
          {(Object.keys(AUDIENCE_COPY) as MomentAudience[]).map((option) => (
            <button
              key={option}
              type="button"
              className={cn("card card-pad text-left", moment.audience === option && "border-brand")}
              style={moment.audience === option ? { background: "var(--brand-soft)" } : undefined}
              disabled={busy}
              onClick={() => changeAudience(option)}
            >
              <span className="flex items-center gap-2 font-semibold">
                <Icon name={AUDIENCE_COPY[option].icon as IconName} size={18} />
                {AUDIENCE_COPY[option].label}
                {moment.audience === option ? <Icon name="check" size={16} className="ml-auto text-brand" /> : null}
              </span>
              <span className="body-sm block pt-1">{AUDIENCE_COPY[option].description}</span>
            </button>
          ))}
        </div>
      </Overlay>

      <ReportDialog
        open={reportOpen}
        onClose={() => setReportOpen(false)}
        target={{ type: "moment", id: moment.id, label: `Moment by @${moment.author.username}` }}
      />

      <ConfirmDialog
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        title="Delete this Moment?"
        description="This cannot be undone. Moments do not disappear on their own — deleting is permanent."
        confirmLabel="Delete Moment"
        tone="danger"
        onConfirm={async () => {
          try {
            await api.del(`/api/moments/${moment.id}`);
            show({ title: "Moment deleted", tone: "success" });
            onChanged?.();
            router.refresh();
          } catch (error) {
            show({ title: "Could not delete", description: error instanceof Error ? error.message : undefined, tone: "error" });
          }
        }}
      />

      {moment.isMine && moment.audience === "only_me" ? (
        <p className="caption flex items-center gap-1.5 border-t border-line px-3.5 py-2">
          <Icon name="lock" size={12} /> Only you can see this. Profile privacy changes never make it public.
        </p>
      ) : null}

      {user ? null : <span className="sr-only">Sign in to interact</span>}
    </article>
  );
}

function CommentsSheet({
  open,
  onClose,
  momentId,
  onCountChange,
}: {
  open: boolean;
  onClose: () => void;
  momentId: number;
  onCountChange?: (count: number) => void;
}) {
  const { show } = useToast();
  const { user } = useSession();
  const { data, error, loading, setData } = useQuery<{ comments: CommentView[] }>(
    open ? `/api/moments/${momentId}/engagement` : null,
  );
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [replyTo, setReplyTo] = useState<CommentView | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (open) window.setTimeout(() => inputRef.current?.focus(), 180);
  }, [open]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!draft.trim()) return;
    setBusy(true);
    const optimistic: CommentView = {
      id: -Date.now(),
      body: draft.trim(),
      createdAt: new Date().toISOString(),
      isMine: true,
      replyTo: replyTo
        ? { id: replyTo.id, authorName: replyTo.author.name, authorUsername: replyTo.author.username, snippet: replyTo.body.slice(0, 80) }
        : null,
      author: {
        id: user?.id ?? 0,
        username: user?.username ?? "",
        name: user?.name ?? "You",
        bio: "",
        avatarUrl: user?.avatarUrl ?? null,
        accent: user?.accent ?? "violet",
        verified: user?.verified ?? false,
        profilePrivacy: user?.profilePrivacy ?? "public",
      },
    };
    setData((current) => ({ comments: [...(current?.comments ?? []), optimistic] }));
    const value = draft.trim();
    const parentId = replyTo && replyTo.id > 0 ? replyTo.id : undefined;
    setDraft("");
    setReplyTo(null);
    try {
      const result = await api.post<{ comment: CommentView; commentCount: number }>(
        `/api/moments/${momentId}/engagement`,
        { action: "comment", body: value, parentId },
      );
      setData((current) => ({
        comments: (current?.comments ?? []).map((item) => (item.id === optimistic.id ? result.comment : item)),
      }));
      onCountChange?.(result.commentCount);
    } catch (err) {
      setData((current) => ({ comments: (current?.comments ?? []).filter((item) => item.id !== optimistic.id) }));
      setDraft(value);
      show({ title: "Comment not sent", description: err instanceof Error ? err.message : undefined, tone: "error" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Overlay open={open} onClose={onClose} title="Comments" description="Comments stay with the Moment">
      <div className="flex flex-col gap-3">
        {loading ? (
          <div className="flex flex-col gap-2" aria-busy="true">
            {[0, 1].map((index) => (
              <div key={index} className="skeleton h-12 w-full" />
            ))}
          </div>
        ) : error ? (
          <p className="body-sm">{error}</p>
        ) : (data?.comments ?? []).length === 0 ? (
          <EmptyState icon="comment" title="No comments yet" description="Be the first to reply. Keep it kind." />
        ) : (
          <ul className="flex flex-col divide-y divide-[color:var(--line)]">
            {data?.comments.map((comment) => (
              <li key={comment.id} className="flex gap-3 py-3">
                <Avatar user={comment.author} size="sm" />
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-1.5 text-sm font-semibold">
                    <Link href={`/profile/${comment.author.username}`} className="hover:underline">
                      {comment.author.name}
                    </Link>
                    <TimeAgo iso={comment.createdAt} className="caption font-normal" />
                  </p>
                  {comment.replyTo ? (
                    <p className="caption flex items-center gap-1">
                      <Icon name="reply" size={12} />
                      Replying to <span className="font-semibold">{comment.replyTo.authorName}</span>
                    </p>
                  ) : null}
                  <p className="body-sm whitespace-pre-wrap">{comment.body}</p>
                  {comment.id > 0 ? (
                    <button
                      type="button"
                      className="caption mt-0.5 font-semibold hover:underline"
                      onClick={() => {
                        setReplyTo(comment);
                        inputRef.current?.focus();
                      }}
                    >
                      Reply
                    </button>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}
        {replyTo ? (
          <div className="flex items-center gap-2 rounded-md bg-[color:var(--surface-2,transparent)] px-1 text-sm">
            <Icon name="reply" size={14} />
            <p className="min-w-0 flex-1 truncate">
              Replying to <span className="font-semibold">{replyTo.author.name}</span>
            </p>
            <button type="button" className="btn-icon" aria-label="Cancel reply" onClick={() => setReplyTo(null)}>
              <Icon name="x" size={14} />
            </button>
          </div>
        ) : null}
        <form className="sticky bottom-0 flex items-end gap-2 bg-surface pt-2" onSubmit={submit}>
          <Field label="Add a comment" htmlFor={`comment-${momentId}`}>
            <textarea
              id={`comment-${momentId}`}
              ref={inputRef}
              className="textarea"
              rows={1}
              maxLength={600}
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              placeholder={replyTo ? `Reply to ${replyTo.author.name}…` : "Write a comment…"}
              style={{ minHeight: 48 }}
            />
          </Field>
          <button type="submit" className="btn btn-primary" disabled={busy || !draft.trim()} aria-label="Send comment">
            {busy ? <Spinner /> : <Icon name="send" size={18} />}
          </button>
        </form>
      </div>
    </Overlay>
  );
}

/** Public link for a Moment: /moment/p/<code> (falls back to the in-app link for very old Moments). */
function shareUrl(moment: MomentView) {
  return moment.shareCode
    ? `${window.location.origin}/moment/p/${moment.shareCode}`
    : `${window.location.origin}/moments/${moment.id}`;
}

function ShareSheet({
  open,
  onClose,
  moment,
  onCopy,
  onSent,
}: {
  open: boolean;
  onClose: () => void;
  moment: MomentView;
  onCopy: () => Promise<void>;
  onSent: () => void;
}) {
  const { show } = useToast();
  const { data, loading } = useQuery<{ conversations: ConversationSummary[] }>(open ? "/api/conversations?tab=inbox" : null);
  const [busyId, setBusyId] = useState<number | null>(null);

  async function send(conversationId: number) {
    setBusyId(conversationId);
    try {
      await api.post(`/api/conversations/${conversationId}`, {
        kind: "text",
        body: `Take a look at this Moment: ${shareUrl(moment)}`,
      });
      onSent();
      onClose();
    } catch (error) {
      show({ title: "Could not send", description: error instanceof Error ? error.message : undefined, tone: "error" });
    } finally {
      setBusyId(null);
    }
  }

  return (
    <Overlay open={open} onClose={onClose} title="Share Moment" description="Links open for anyone allowed to see it">
      <div className="flex flex-col gap-3">
        <button type="button" className="btn btn-secondary btn-block" onClick={onCopy}>
          <Icon name="link" size={18} /> Copy link
        </button>
        <div>
          <p className="eyebrow pb-1">Send in a message</p>
          {loading ? (
            <div className="skeleton h-14 w-full" />
          ) : (data?.conversations ?? []).length === 0 ? (
            <p className="body-sm">No conversations yet. Start one from Messages.</p>
          ) : (
            <ul className="flex flex-col">
              {(data?.conversations ?? []).slice(0, 6).map((conversation) => (
                <li key={conversation.id}>
                  <button
                    type="button"
                    className="list-row rounded-md"
                    onClick={() => send(conversation.id)}
                    disabled={busyId === conversation.id}
                  >
                    <Avatar user={{ name: conversation.title, avatarUrl: conversation.imageUrl }} size="sm" />
                    <span className="min-w-0 flex-1 text-left">
                      <span className="block truncate text-sm font-semibold">{conversation.title}</span>
                      <span className="caption">{conversation.expiryLabel}</span>
                    </span>
                    {busyId === conversation.id ? <Spinner /> : <Icon name="send" size={16} />}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        <p className="caption">{EXPIRY_COPY.honestNote}</p>
      </div>
    </Overlay>
  );
}

export function MomentOptionsButton({ items, label }: { items: { label: string; icon: IconName; onSelect: () => void }[]; label: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className="btn-icon" aria-label={label} onClick={() => setOpen(true)}>
        <Icon name="more" size={20} />
      </button>
      <Overlay open={open} onClose={() => setOpen(false)} title={label}>
        <div className="flex flex-col gap-1">
          {items.map((item) => (
            <button
              key={item.label}
              type="button"
              className="list-row rounded-md"
              onClick={() => {
                setOpen(false);
                item.onSelect();
              }}
            >
              <Icon name={item.icon} size={20} />
              <span className="flex-1 text-left text-sm font-semibold">{item.label}</span>
            </button>
          ))}
        </div>
      </Overlay>
    </>
  );
}

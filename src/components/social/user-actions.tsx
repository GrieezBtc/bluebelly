"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Icon, type IconName } from "@/components/icons";
import { ConfirmDialog, Overlay, ReportDialog, Spinner, useToast } from "@/components/ui";
import { api } from "@/lib/client";
import { cn } from "@/lib/utils";
import type { RelationState, UserSummary } from "@/lib/types";

export function useUserActions(onChanged?: () => void) {
  const { show } = useToast();
  const [busy, setBusy] = useState<string | null>(null);

  async function run(username: string, action: string, successFallback: string) {
    setBusy(action);
    try {
      const result = await api.post<{ relation: RelationState; message: string }>(
        `/api/users/${username}/actions`,
        { action },
      );
      show({ title: result.message || successFallback, tone: "success" });
      onChanged?.();
      return result.relation;
    } catch (error) {
      show({
        title: "Action failed",
        description: error instanceof Error ? error.message : "Please try again.",
        tone: "error",
      });
      return null;
    } finally {
      setBusy(null);
    }
  }

  return { run, busy };
}

export function FollowButton({
  user,
  relation,
  onChanged,
  size = "sm",
  block,
}: {
  user: { username: string; name: string };
  relation: RelationState;
  onChanged?: () => void;
  size?: "sm" | "md";
  block?: boolean;
}) {
  const { run, busy } = useUserActions(onChanged);
  const [local, setLocal] = useState(relation);

  if (local === "self") return null;

  const map: Record<Exclude<RelationState, "self">, { label: string; action: string; variant: string; icon: IconName }> = {
    follow: { label: "Follow", action: "follow", variant: "btn-primary", icon: "user-plus" },
    requested: { label: "Requested", action: "unfollow", variant: "btn-secondary", icon: "clock" },
    following: { label: "Following", action: "unfollow", variant: "btn-secondary", icon: "check" },
    follow_back: { label: "Follow back", action: "follow", variant: "btn-primary", icon: "user-plus" },
    blocked: { label: "Unblock", action: "unblock", variant: "btn-secondary", icon: "ban" },
  };
  const config = map[local as Exclude<RelationState, "self">];

  return (
    <button
      type="button"
      className={cn("btn", config.variant, size === "sm" && "btn-sm", block && "btn-block")}
      disabled={busy !== null}
      onClick={async () => {
        const next = await run(user.username, config.action, "Done");
        if (next) setLocal(next);
      }}
      aria-label={`${config.label} @${user.username}`}
    >
      {busy ? <Spinner /> : <Icon name={config.icon} size={16} />}
      {config.label}
    </button>
  );
}

export function MessageButton({
  user,
  allowed,
  hint,
  size = "sm",
  block,
}: {
  user: { username: string; name: string };
  allowed: boolean;
  hint?: string;
  size?: "sm" | "md";
  block?: boolean;
}) {
  const router = useRouter();
  const { show } = useToast();
  const [busy, setBusy] = useState(false);

  async function open() {
    setBusy(true);
    try {
      const result = await api.post<{ conversationId: number; request?: boolean }>("/api/conversations", {
        kind: "direct",
        username: user.username,
      });
      if (result.request) {
        show({
          title: "Message request sent",
          description: `${user.name} will see it in Message Requests.`,
          tone: "info",
        });
      }
      router.push(`/messages/${result.conversationId}`);
    } catch (error) {
      show({
        title: "Cannot start that chat",
        description: error instanceof Error ? error.message : hint ?? "Try again later.",
        tone: "error",
      });
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      className={cn("btn btn-secondary", size === "sm" && "btn-sm", block && "btn-block")}
      onClick={open}
      disabled={busy || !allowed}
      title={allowed ? hint : hint}
      aria-label={`Message @${user.username}`}
    >
      {busy ? <Spinner /> : <Icon name="chat" size={16} />}
      Message
    </button>
  );
}

export function UserOptionsMenu({
  user,
  relation,
  onChanged,
  extraItems,
}: {
  user: { username: string; name: string; id?: number };
  relation: RelationState;
  onChanged?: () => void;
  extraItems?: { label: string; icon: IconName; onSelect: () => void; danger?: boolean }[];
}) {
  const { run, busy } = useUserActions(onChanged);
  const [open, setOpen] = useState(false);
  const [report, setReport] = useState(false);
  const [confirmBlock, setConfirmBlock] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const blocked = relation === "blocked";

  return (
    <>
      <button type="button" className="btn-icon" aria-label={`More options for @${user.username}`} onClick={() => setOpen(true)}>
        <Icon name="more" size={20} />
      </button>

      <Overlay open={open} onClose={() => setOpen(false)} title={`@${user.username}`} description="Safety and relationship controls">
        <div className="flex flex-col gap-1">
          {extraItems?.map((item) => (
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
              <span className={cn("flex-1 text-left text-sm font-semibold", item.danger && "text-coral")}>{item.label}</span>
            </button>
          ))}
          {relation === "following" ? (
            <button
              type="button"
              className="list-row rounded-md"
              onClick={async () => {
                await run(user.username, "unfollow", "Unfollowed");
                setOpen(false);
              }}
            >
              <Icon name="user" size={20} />
              <span className="flex-1 text-left text-sm font-semibold">Unfollow</span>
            </button>
          ) : null}
          <button
            type="button"
            className="list-row rounded-md"
            onClick={async () => {
              await run(user.username, "mute", "Muted");
              setOpen(false);
            }}
            disabled={busy !== null}
          >
            <Icon name="mute" size={20} />
            <span className="flex-1 text-left text-sm font-semibold">Mute their Moments</span>
          </button>
          <button
            type="button"
            className="list-row rounded-md"
            onClick={async () => {
              await run(user.username, "remove_follower", "Follower removed");
              setOpen(false);
            }}
            disabled={busy !== null}
          >
            <Icon name="x" size={20} />
            <span className="flex-1 text-left text-sm font-semibold">Remove as follower</span>
          </button>
          <button
            type="button"
            className="list-row rounded-md"
            onClick={() => {
              setOpen(false);
              setReport(true);
            }}
          >
            <Icon name="flag" size={20} />
            <span className="flex-1 text-left text-sm font-semibold">Report account</span>
          </button>
          <button
            type="button"
            className="list-row rounded-md"
            onClick={() => {
              setOpen(false);
              setConfirmBlock(true);
            }}
          >
            <Icon name="ban" size={20} />
            <span className={cn("flex-1 text-left text-sm font-semibold", blocked ? "text-mint" : "text-coral")}>
              {blocked ? `Unblock @${user.username}` : `Block @${user.username}`}
            </span>
          </button>
        </div>
      </Overlay>

      <ReportDialog
        open={report}
        onClose={() => setReport(false)}
        target={{ type: "user", id: user.id, label: `@${user.username}` }}
      />

      <ConfirmDialog
        open={confirmBlock}
        onClose={() => setConfirmBlock(false)}
        title={blocked ? `Unblock @${user.username}?` : `Block @${user.username}?`}
        description={
          blocked
            ? "They will be able to find your profile and message you again, subject to your messaging permissions."
            : "Blocking is private. They cannot find your profile, follow you or message you, and you will not see their content."
        }
        confirmLabel={blocked ? "Unblock" : "Block"}
        tone={blocked ? "primary" : "danger"}
        onConfirm={async () => {
          await run(user.username, blocked ? "unblock" : "block", blocked ? "Unblocked" : "Blocked");
        }}
        details={
          blocked ? null : (
            <ul className="body-sm list-disc space-y-1 pl-4">
              <li>You will not see their profile, Moments or messages.</li>
              <li>They will not be told that you blocked them.</li>
              <li>Any existing conversation is removed from both sides.</li>
              <li>You can unblock them at any time from Settings → Blocked accounts.</li>
            </ul>
          )
        }
      />

      <ConfirmDialog
        open={confirmRemove}
        onClose={() => setConfirmRemove(false)}
        title="Remove this follower?"
        description={`@${user.username} will stop seeing your follower-only Moments.`}
        confirmLabel="Remove follower"
        tone="danger"
        onConfirm={async () => {
          await run(user.username, "remove_follower", "Follower removed");
        }}
      />
    </>
  );
}

export function UserResultRow({ user, onChanged }: { user: UserSummary & { relation?: RelationState }; onChanged?: () => void }) {
  const relation: RelationState = user.relation ?? (user.isFollowing ? "following" : user.requested ? "requested" : "follow");
  return (
    <div className="list-row">
      <Link href={`/profile/${user.username}`} className="flex min-w-0 flex-1 items-center gap-3">
        <span className={cn("avatar avatar-md", `accent-${user.accent}`)} aria-hidden="true">
          {user.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={user.avatarUrl} alt="" loading="lazy" />
          ) : (
            user.name.slice(0, 2).toUpperCase()
          )}
        </span>
        <span className="min-w-0">
          <span className="flex items-center gap-1">
            <span className="truncate font-semibold">{user.name}</span>
            {user.verified ? <Icon name="shield-check" size={14} className="text-brand" /> : null}
          </span>
          <span className="caption block truncate">
            @{user.username}
            {user.followsYou ? " · follows you" : ""}
          </span>
          {user.messageHint ? <span className="caption block truncate">{user.messageHint}</span> : null}
        </span>
      </Link>
      <FollowButton user={user} relation={relation} onChanged={onChanged} />
    </div>
  );
}

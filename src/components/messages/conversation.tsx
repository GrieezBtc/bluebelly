"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/icons";
import {
  Avatar,
  Badge,
  ConfirmDialog,
  EmptyState,
  ErrorState,
  Field,
  InfoBanner,
  LoadingRows,
  Overlay,
  ReportDialog,
  Spinner,
  useToast,
} from "@/components/ui";
import { api, useCopyToClipboard } from "@/lib/client";
import { useSession } from "@/components/providers";
import { cn, formatClock, timeLeftLabel } from "@/lib/utils";
import { EXPIRY_COPY } from "@/lib/privacy";
import type { ConversationDetail, MessageView } from "@/lib/types";

export function ConversationView({ conversationId }: { conversationId: number }) {
  const router = useRouter();
  const { user } = useSession();
  const { show } = useToast();
  const copy = useCopyToClipboard();
  const [detail, setDetail] = useState<ConversationDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [failedDraft, setFailedDraft] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [recording, setRecording] = useState(false);
  const [recorderSupported, setRecorderSupported] = useState(true);
  const [infoOpen, setInfoOpen] = useState(false);
  const [optionsOpen, setOptionsOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [leaveOpen, setLeaveOpen] = useState(false);
  const [renameOpen, setRenameOpen] = useState(false);
  const [renameValue, setRenameValue] = useState("");
  const [addMemberOpen, setAddMemberOpen] = useState(false);
  const [addMemberValue, setAddMemberValue] = useState("");
  const [messageMenu, setMessageMenu] = useState<MessageView | null>(null);
  const [editTarget, setEditTarget] = useState<MessageView | null>(null);
  const [editValue, setEditValue] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<MessageView | null>(null);
  const [removeTarget, setRemoveTarget] = useState<{ username: string; name: string } | null>(null);
  const [replyingTo, setReplyingTo] = useState<MessageView | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const bottomRef = useRef<HTMLDivElement>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const load = useCallback(
    async (silent?: boolean) => {
      if (!silent) setLoading(true);
      try {
        const result = await api.get<ConversationDetail>(`/api/conversations/${conversationId}`);
        setDetail(result);
        setError(null);
        await api.post(`/api/conversations/${conversationId}`, { action: "read" }).catch(() => undefined);
      } catch (err) {
        if (!silent) setError(err instanceof Error ? err.message : "This conversation could not be opened.");
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [conversationId],
  );

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const interval = window.setInterval(() => void load(true), 12000);
    return () => window.clearInterval(interval);
  }, [load]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [detail?.messages.length]);

  useEffect(() => {
    if (typeof MediaRecorder === "undefined" || !navigator.mediaDevices?.getUserMedia) setRecorderSupported(false);
  }, []);

  const otherMember = useMemo(() => detail?.conversation.members.find((m) => m.id !== user?.id) ?? null, [detail, user?.id]);

  async function send(kind: MessageView["kind"], body: string, mediaUrl?: string, durationSec?: number) {
    if (sending) return;
    setSending(true);
    setFailedDraft(null);
    try {
      const result = await api.post<{ message: MessageView }>(`/api/conversations/${conversationId}`, {
        kind,
        body,
        mediaUrl,
        durationSec,
        replyToId: replyingTo?.id,
      });
      setReplyingTo(null);
      setDetail((current) => (current ? { ...current, messages: [...current.messages, result.message] } : current));
      setDraft("");
    } catch (err) {
      setFailedDraft(body);
      show({
        title: "Message not sent",
        description: err instanceof Error ? err.message : "Check your connection and try again.",
        tone: "error",
      });
    } finally {
      setSending(false);
    }
  }

  async function uploadAndSend(file: File) {
    setUploading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("scope", "message");
      const uploaded = await api.upload<{ url: string; kind: string }>("/api/upload", form);
      await send(uploaded.kind === "video" ? "video" : "image", "", uploaded.url);
    } catch (err) {
      show({
        title: "Upload failed",
        description: err instanceof Error ? err.message : "Try a smaller file.",
        tone: "error",
      });
    } finally {
      setUploading(false);
    }
  }

  async function toggleRecording() {
    if (recording) {
      recorderRef.current?.stop();
      setRecording(false);
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      chunksRef.current = [];
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };
      recorder.onstop = async () => {
        stream.getTracks().forEach((track) => track.stop());
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || "audio/webm" });
        if (blob.size < 800) {
          show({ title: "Voice note too short", tone: "info" });
          return;
        }
        setUploading(true);
        try {
          const form = new FormData();
          form.append("file", new File([blob], "voice.webm", { type: blob.type }));
          form.append("scope", "message");
          const uploaded = await api.upload<{ url: string }>("/api/upload", form);
          await send("voice", "", uploaded.url, Math.max(1, Math.round(blob.size / 4000)));
        } catch (err) {
          show({ title: "Voice note failed", description: err instanceof Error ? err.message : undefined, tone: "error" });
        } finally {
          setUploading(false);
        }
      };
      recorder.start();
      recorderRef.current = recorder;
      setRecording(true);
    } catch {
      setRecorderSupported(false);
      show({
        title: "Microphone unavailable",
        description: "Allow microphone access in your browser to send voice notes.",
        tone: "error",
      });
    }
  }

  async function conversationAction(
    action:
      | "accept"
      | "decline"
      | "leave"
      | "mute"
      | "unmute"
      | "rename"
      | "add-member"
      | "promote"
      | "remove-member"
      | "mute-members"
      | "unmute-members"
      | "invite",
    value?: string,
  ) {
    try {
      const result = await api.patch<{ message: string; invitePath?: string }>(
        `/api/conversations/${conversationId}`,
        { action, value },
      );
      if (result.invitePath) {
        const inviteUrl = `${window.location.origin}${result.invitePath}`;
        const copied = await copy(inviteUrl);
        show({
          title: copied ? "Invitation link copied" : "Invitation link ready",
          description: copied ? undefined : inviteUrl,
          tone: copied ? "success" : "info",
        });
      } else {
        show({ title: result.message, tone: "success" });
      }
      if (action === "decline" || action === "leave") {
        router.push("/messages");
      } else {
        void load(true);
      }
    } catch (err) {
      show({ title: "Action failed", description: err instanceof Error ? err.message : undefined, tone: "error" });
    }
    setOptionsOpen(false);
  }

  if (loading && !detail) {
    return (
      <div className="page px-4">
        <LoadingRows rows={1} />
      </div>
    );
  }

  if (error && !detail) {
    return (
      <div className="page px-4">
        <ErrorState title="Conversation unavailable" description={error} onRetry={() => void load()} />
        <div className="flex justify-center">
          <Link href="/messages" className="btn btn-secondary btn-sm">
            Back to Messages
          </Link>
        </div>
      </div>
    );
  }

  if (!detail) return null;
  const { conversation, messages } = detail;
  const isRequest = conversation.state === "requested";
  const currentMember = conversation.members.find((member) => member.id === user?.id);
  async function saveEdit() {
    if (!editTarget) return;
    const target = editTarget;
    const text = editValue.trim();
    if (text.length === 0) return;
    setEditTarget(null);
    try {
      await api.patch(`/api/conversations/${conversationId}/messages/${target.id}`, { body: text });
      show({ title: "Message edited", tone: "success" });
    } catch (err) {
      show({ title: err instanceof Error ? err.message : "Could not edit that message.", tone: "error" });
    }
    await load(true);
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    const target = deleteTarget;
    try {
      await api.del(`/api/conversations/${conversationId}/messages/${target.id}`);
      show({ title: "Message deleted", tone: "success" });
    } catch (err) {
      show({ title: err instanceof Error ? err.message : "Could not delete that message.", tone: "error" });
    }
    setDeleteTarget(null);
    await load(true);
  }

  const isGroupAdmin = conversation.kind === "group" && currentMember?.role === "admin";
  const groupSendBlocked = conversation.kind === "group" && conversation.membersMuted && !isGroupAdmin;

  return (
    <div className="flex h-[calc(100dvh-var(--nav-height))] min-h-0 flex-col overflow-hidden md:h-dvh">
      <header className="sticky-top z-10 flex shrink-0 items-center gap-2 px-2 py-2">
        <button type="button" className="btn-icon md:hidden" onClick={() => router.push("/messages")} aria-label="Back to Messages">
          <Icon name="chevron-left" size={22} />
        </button>
        <button type="button" className="flex min-w-0 flex-1 items-center gap-3 rounded-md px-1 py-1 text-left" onClick={() => setInfoOpen(true)}>
          <Avatar user={{ name: conversation.title, avatarUrl: conversation.imageUrl }} size="md" />
          <span className="min-w-0">
            <span className="flex items-center gap-1.5">
              <span className="truncate font-semibold">{conversation.title}</span>
              {conversation.kind === "group" ? <Badge tone="public">Group</Badge> : null}
            </span>
            <span className="caption block truncate">
              {conversation.kind === "group"
                ? `${conversation.members.length} members · ${conversation.expiryLabel}`
                : conversation.expiryLabel}
            </span>
          </span>
        </button>
        <button type="button" className="btn-icon" onClick={() => setOptionsOpen(true)} aria-label="Conversation options">
          <Icon name="more" size={20} />
        </button>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-2 md:px-6">
        {isRequest ? (
          <div className="py-3">
            <InfoBanner tone="brand" icon="request" title="Message request">
              <p className="pb-2">
                {otherMember ? `@${otherMember.username} is not in your contacts yet.` : "This sender is not in your contacts yet."}{" "}
                Accept to move it to your inbox, or decline without them knowing.
              </p>
              <div className="flex flex-wrap gap-2">
                <button type="button" className="btn btn-primary btn-sm" onClick={() => conversationAction("accept")}>
                  Accept
                </button>
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => conversationAction("decline")}>
                  Decline
                </button>
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => setReportOpen(true)}>
                  Report
                </button>
              </div>
            </InfoBanner>
          </div>
        ) : (
          <div className="py-3">
            <InfoBanner tone="info" icon="clock">
              <p>
                <strong>{conversation.expiryExplanation}</strong>
              </p>
              <p className="pt-1">{EXPIRY_COPY.honestNote}</p>
            </InfoBanner>
          </div>
        )}

        <p className="caption py-3 text-center">
          Messages older than the expiry window are removed from this thread automatically — nothing is left behind.
        </p>

        {messages.length === 0 ? (
          <EmptyState
            icon="chat"
            title="No messages yet"
            description={
              conversation.kind === "group"
                ? "Say hello to the group. Everything here disappears 7 days after sending."
                : "Send the first message. It disappears 24 hours after it is viewed."
            }
          />
        ) : (
          <ol className="flex flex-col gap-2 py-2" aria-label="Message history">
            {messages.map((message) => (
              <MessageBubble
                key={message.id}
                message={message}
                showSender={conversation.kind === "group"}
                now={now}
                onOpenMenu={() => setMessageMenu(message)}
              />
            ))}
          </ol>
        )}
        <div ref={bottomRef} />
      </div>

      {failedDraft ? (
        <div className="mx-3 mb-2 flex items-center justify-between gap-2 rounded-md border border-line bg-surface px-3 py-2">
          <span className="body-sm">
            <Icon name="alert" size={14} className="mr-1 inline text-coral" /> Failed to send
          </span>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            disabled={groupSendBlocked}
            onClick={() => send("text", failedDraft)}
          >
            Retry
          </button>
        </div>
      ) : null}

      {groupSendBlocked ? (
        <div className="mx-3 mb-2 rounded-md border border-line bg-surface px-3 py-2 text-center body-sm">
          Only admins can send messages while this group is muted.
        </div>
      ) : null}
      {replyingTo ? (
        <div className="flex shrink-0 items-center gap-2 border-t border-[color:var(--line)] bg-surface px-4 py-2">
          <Icon name="reply" size={16} />
          <div className="min-w-0 flex-1 border-l-2 border-[color:var(--line)] pl-2">
            <p className="truncate text-xs font-semibold">Replying to {replyingTo.isMine ? "yourself" : (replyingTo.sender?.name ?? "message")}</p>
            <p className="caption truncate">{replyingTo.kind === "text" ? replyingTo.body : replyingTo.kind === "voice" ? "Voice message" : replyingTo.kind === "image" ? "Photo" : "Video"}</p>
          </div>
          <button type="button" className="btn-icon" aria-label="Cancel reply" onClick={() => setReplyingTo(null)}>
            <Icon name="x" size={16} />
          </button>
        </div>
      ) : null}
      <form
        className="chat-input safe-bottom z-10 shrink-0"
        onSubmit={(event) => {
          event.preventDefault();
          if (groupSendBlocked) return;
          if (draft.trim()) void send("text", draft.trim());
        }}
      >
        <label
          className={cn("btn-icon", groupSendBlocked && "pointer-events-none opacity-50")}
          aria-label="Attach a photo or video"
        >
          {uploading ? <Spinner /> : <Icon name="image" size={22} />}
          <input
            type="file"
            accept="image/*,video/*"
            className="sr-only"
            disabled={groupSendBlocked}
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void uploadAndSend(file);
            }}
          />
        </label>
        <label className="sr-only" htmlFor={`message-${conversationId}`}>
          Write a message
        </label>
        <textarea
          id={`message-${conversationId}`}
          className="textarea flex-1"
          rows={1}
          value={draft}
          placeholder={groupSendBlocked ? "Messaging is disabled for members" : "Write a message…"}
          disabled={groupSendBlocked}
          onChange={(event) => setDraft(event.target.value)}
        />
        {draft.trim() ? (
          <button type="submit" className="btn btn-primary" disabled={sending || groupSendBlocked} aria-label="Send message">
            {sending ? <Spinner /> : <Icon name="send" size={18} />}
          </button>
        ) : (
          <button
            type="button"
            className={cn("btn", recording ? "btn-danger" : "btn-secondary")}
            onClick={toggleRecording}
            disabled={!recorderSupported || uploading || groupSendBlocked}
            aria-label={recording ? "Stop recording" : "Record a voice message"}
            title={recorderSupported ? undefined : "Voice notes are not supported in this browser"}
          >
            <Icon name={recording ? "pause" : "mic"} size={18} />
          </button>
        )}
      </form>

      <Overlay open={infoOpen} onClose={() => setInfoOpen(false)} title={conversation.title} description={conversation.expiryLabel}>
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-3">
            <Avatar user={{ name: conversation.title, avatarUrl: conversation.imageUrl }} size="lg" />
            <div>
              <p className="font-semibold">{conversation.title}</p>
              <p className="caption">
                {conversation.kind === "group" ? `${conversation.members.length} members` : "1-to-1 conversation"}
              </p>
            </div>
          </div>
          <InfoBanner tone="info" icon="clock" title="Expiration">
            <p>{conversation.expiryExplanation}</p>
          </InfoBanner>
          {conversation.kind === "group" ? (
            <div>
              <p className="eyebrow pb-1">Members</p>
              <ul className="flex flex-col divide-y divide-[color:var(--line)]">
                {conversation.members.map((member) => (
                  <li key={member.id} className="flex items-center gap-3 py-2">
                    <Avatar user={member} size="sm" />
                    <Link href={`/profile/${member.username}`} className="min-w-0 flex-1" onClick={() => setInfoOpen(false)}>
                      <span className="block truncate text-sm font-semibold">{member.name}</span>
                      <span className="caption">
                        @{member.username}
                        {member.role === "admin" ? " · admin" : ""}
                        {member.state === "requested" ? " · request pending" : ""}
                      </span>
                    </Link>
                    {isGroupAdmin && member.id !== user?.id && member.role !== "admin" && member.state === "active" ? (
                      <button type="button" className="btn btn-ghost btn-sm" onClick={() => void conversationAction("promote", member.username)}>
                        Make admin
                      </button>
                    ) : null}
                    {isGroupAdmin && member.id !== user?.id ? (
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm text-coral"
                        onClick={() => setRemoveTarget({ username: member.username, name: member.name })}
                      >
                        Remove
                      </button>
                    ) : null}
                  </li>
                ))}
              </ul>
            </div>
          ) : otherMember ? (
            <Link href={`/profile/${otherMember.username}`} className="btn btn-secondary btn-block" onClick={() => setInfoOpen(false)}>
              <Icon name="user" size={18} /> View profile
            </Link>
          ) : null}
          <p className="caption">{EXPIRY_COPY.honestNote}</p>
        </div>
      </Overlay>

      <Overlay open={optionsOpen} onClose={() => setOptionsOpen(false)} title="Conversation options">
        <div className="flex flex-col gap-1">
          <button type="button" className="list-row rounded-md" onClick={() => conversationAction("mute")}>
            <Icon name="mute" size={20} />
            <span className="flex-1 text-left text-sm font-semibold">Mute notifications</span>
          </button>
          {conversation.kind === "group" ? (
            <>
              {isGroupAdmin ? (
                <>
                  <button type="button" className="list-row rounded-md" onClick={() => { setOptionsOpen(false); setAddMemberOpen(true); }}>
                    <Icon name="user-plus" size={20} />
                    <span className="flex-1 text-left text-sm font-semibold">Add members</span>
                  </button>
                  <button type="button" className="list-row rounded-md" onClick={() => void conversationAction("invite")}>
                    <Icon name="link" size={20} />
                    <span className="flex-1 text-left text-sm font-semibold">Copy invitation link</span>
                  </button>
                  <button type="button" className="list-row rounded-md" onClick={() => void conversationAction(conversation.membersMuted ? "unmute-members" : "mute-members")}>
                    <Icon name="mute" size={20} />
                    <span className="flex-1 text-left text-sm font-semibold">{conversation.membersMuted ? "Unmute members" : "Mute members"}</span>
                  </button>
                  <button type="button" className="list-row rounded-md" onClick={() => { setRenameValue(conversation.title); setOptionsOpen(false); setRenameOpen(true); }}>
                    <Icon name="edit" size={20} />
                    <span className="flex-1 text-left text-sm font-semibold">Rename group</span>
                  </button>
                </>
              ) : null}
              <button
                type="button"
                className="list-row rounded-md"
                onClick={() => {
                  setOptionsOpen(false);
                  setLeaveOpen(true);
                }}
              >
                <Icon name="logout" size={20} />
                <span className="flex-1 text-left text-sm font-semibold text-coral">Leave group</span>
              </button>
            </>
          ) : null}
          <button
            type="button"
            className="list-row rounded-md"
            onClick={() => {
              setOptionsOpen(false);
              setReportOpen(true);
            }}
          >
            <Icon name="flag" size={20} />
            <span className="flex-1 text-left text-sm font-semibold">Report conversation</span>
          </button>
          <Link href="/support" className="list-row rounded-md">
            <Icon name="help" size={20} />
            <span className="flex-1 text-left text-sm font-semibold">Get help from Support</span>
          </Link>
        </div>
      </Overlay>

      <Overlay open={addMemberOpen} onClose={() => setAddMemberOpen(false)} title="Add a member" variant="dialog">
        <Field label="Username" htmlFor="add-group-member">
          <input id="add-group-member" className="input" value={addMemberValue} onChange={(event) => setAddMemberValue(event.target.value)} placeholder="username" />
        </Field>
        <div className="flex justify-end gap-2 pt-4">
          <button type="button" className="btn btn-secondary" onClick={() => setAddMemberOpen(false)}>Cancel</button>
          <button type="button" className="btn btn-primary" disabled={addMemberValue.trim().length < 1} onClick={() => void conversationAction("add-member", addMemberValue.trim())}>Add member</button>
        </div>
      </Overlay>

      <Overlay open={renameOpen} onClose={() => setRenameOpen(false)} title="Rename group" variant="dialog">
        <Field label="Group name" htmlFor="rename-group">
          <input id="rename-group" className="input" value={renameValue} onChange={(event) => setRenameValue(event.target.value)} />
        </Field>
        <div className="flex justify-end gap-2 pt-4">
          <button type="button" className="btn btn-secondary" onClick={() => setRenameOpen(false)}>
            Cancel
          </button>
          <button
            type="button"
            className="btn btn-primary"
            disabled={renameValue.trim().length < 2}
            onClick={() => {
              setRenameOpen(false);
              void conversationAction("rename", renameValue.trim());
            }}
          >
            Save
          </button>
        </div>
      </Overlay>

      <Overlay open={Boolean(messageMenu)} onClose={() => setMessageMenu(null)} title="Message options">
        <div className="flex flex-col gap-1">
          {messageMenu ? (
            <button
              type="button"
              className="list-row rounded-md"
              onClick={() => {
                setReplyingTo(messageMenu);
                setMessageMenu(null);
              }}
            >
              <Icon name="reply" size={20} />
              <span className="flex-1 text-left text-sm font-semibold">Reply</span>
            </button>
          ) : null}
          {messageMenu?.canEdit ? (
            <button
              type="button"
              className="list-row rounded-md"
              onClick={() => {
                setEditValue(messageMenu.body);
                setEditTarget(messageMenu);
                setMessageMenu(null);
              }}
            >
              <Icon name="edit" size={20} />
              <span className="flex-1 text-left text-sm font-semibold">Edit message</span>
            </button>
          ) : null}
          {messageMenu?.canDelete ? (
            <button
              type="button"
              className="list-row rounded-md"
              onClick={() => {
                setDeleteTarget(messageMenu);
                setMessageMenu(null);
              }}
            >
              <Icon name="trash" size={20} />
              <span className="flex-1 text-left text-sm font-semibold text-coral">
                {messageMenu.isMine ? "Delete message" : "Delete as admin"}
              </span>
            </button>
          ) : null}
          {messageMenu?.body ? (
            <button
              type="button"
              className="list-row rounded-md"
              onClick={async () => {
                const ok = await copy(messageMenu.body);
                show({ title: ok ? "Message copied" : "Copy unavailable", tone: ok ? "success" : "error" });
                setMessageMenu(null);
              }}
            >
              <Icon name="link" size={20} />
              <span className="flex-1 text-left text-sm font-semibold">Copy text</span>
            </button>
          ) : null}
          {messageMenu && !messageMenu.isMine ? (
            <button
              type="button"
              className="list-row rounded-md"
              onClick={() => {
                setReportOpen(true);
                setMessageMenu(null);
              }}
            >
              <Icon name="flag" size={20} />
              <span className="flex-1 text-left text-sm font-semibold">Report message</span>
            </button>
          ) : null}
          {messageMenu?.expiresAt ? (
            <p className="caption px-3 py-2">
              This message disappears {messageMenu.expiresLabel ?? "soon"}. Expiring messages cannot stop screenshots or screen
              recording — please share thoughtfully.
            </p>
          ) : (
            <p className="caption px-3 py-2">{EXPIRY_COPY.maxRetention}</p>
          )}
        </div>
      </Overlay>

      <Overlay open={Boolean(editTarget)} onClose={() => setEditTarget(null)} title="Edit message" variant="dialog">
        <Field label="Message" htmlFor="edit-message">
          <textarea
            id="edit-message"
            className="input min-h-24"
            maxLength={4000}
            value={editValue}
            onChange={(event) => setEditValue(event.target.value)}
          />
        </Field>
        <div className="flex justify-end gap-2 pt-4">
          <button type="button" className="btn btn-secondary" onClick={() => setEditTarget(null)}>
            Cancel
          </button>
          <button
            type="button"
            className="btn btn-primary"
            disabled={editValue.trim().length === 0 || editValue.trim() === editTarget?.body}
            onClick={() => void saveEdit()}
          >
            Save
          </button>
        </div>
      </Overlay>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        title="Delete this message?"
        description={
          deleteTarget?.isMine
            ? "It will be removed for everyone in this conversation. This cannot be undone."
            : `You are removing ${deleteTarget?.sender?.name ?? "this member"}'s message for everyone as a group admin. This cannot be undone.`
        }
        confirmLabel="Delete"
        tone="danger"
        onConfirm={() => confirmDelete()}
      />

      <ReportDialog
        open={reportOpen}
        onClose={() => setReportOpen(false)}
        target={{
          type: messageMenu ? "message" : "user",
          id: messageMenu?.id ?? otherMember?.id,
          label: messageMenu ? "this message" : `@${otherMember?.username ?? conversation.title}`,
        }}
      />

      <ConfirmDialog
        open={Boolean(removeTarget)}
        onClose={() => setRemoveTarget(null)}
        title={`Remove ${removeTarget?.name ?? "this member"}?`}
        description="They will no longer see or send messages in this group, and the old invite link will not bring them back. An admin can add them again later."
        confirmLabel="Remove"
        tone="danger"
        onConfirm={async () => {
          const target = removeTarget;
          setRemoveTarget(null);
          if (target) await conversationAction("remove-member", target.username);
        }}
      />

      <ConfirmDialog
        open={leaveOpen}
        onClose={() => setLeaveOpen(false)}
        title="Leave this group?"
        description="You will stop receiving messages from this group. The group itself continues for everyone else."
        confirmLabel="Leave group"
        tone="danger"
        onConfirm={() => conversationAction("leave")}
      />
    </div>
  );
}

function MessageBubble({
  message,
  showSender,
  now,
  onOpenMenu,
}: {
  message: MessageView;
  showSender: boolean;
  now: number;
  onOpenMenu: () => void;
}) {
  if (message.isSystem) {
    return (
      <li className="flex justify-center">
        <p className="bubble bubble-system">{message.body}</p>
      </li>
    );
  }

  if (message.deleted) {
    return (
      <li className={cn("flex items-end gap-2", message.isMine ? "justify-end" : "justify-start")}>
        <p className="bubble bubble-system italic">
          {message.deletedBy === "admin"
            ? "A group admin deleted this message"
            : message.isMine
              ? "You deleted this message"
              : `${message.sender?.name ?? "Someone"} deleted this message`}
        </p>
      </li>
    );
  }

  const countdown = message.expiresAt ? timeLeftLabel(message.expiresAt) : null;
  const expiredSoon = message.expiresAt ? new Date(message.expiresAt).getTime() - now < 60 * 60 * 1000 : false;

  return (
    <li className={cn("flex items-end gap-2", message.isMine ? "justify-end" : "justify-start")}>
      {!message.isMine && showSender ? <Avatar user={message.sender ?? { name: "?" }} size="xs" /> : null}
      <div className={cn("bubble", message.isMine ? "bubble-mine" : "bubble-theirs")}>
        {showSender && !message.isMine && message.sender ? (
          <p className="pb-0.5 text-xs font-semibold opacity-90">{message.sender.name}</p>
        ) : null}

        {message.replyTo ? (
          <div className="mb-1 rounded-sm border-l-2 border-current bg-black/10 px-2 py-1 text-xs opacity-90">
            <p className="font-semibold">{message.replyTo.senderName}</p>
            <p className={cn("line-clamp-2", message.replyTo.deleted && "italic")}>{message.replyTo.preview}</p>
          </div>
        ) : null}

        {message.kind === "text" ? <p className="whitespace-pre-wrap">{message.body}</p> : null}

        {message.kind === "image" && message.mediaUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={message.mediaUrl} alt="Shared photo" className="max-h-72 w-full max-w-xs rounded-sm object-cover" loading="lazy" />
        ) : null}

        {message.kind === "video" && message.mediaUrl ? (
          <video src={message.mediaUrl} controls playsInline preload="metadata" className="max-h-72 w-full max-w-xs rounded-sm" />
        ) : null}

        {message.kind === "voice" && message.mediaUrl ? (
          <div className="flex items-center gap-2">
            <Icon name="mic" size={16} />
            <audio src={message.mediaUrl} controls preload="none" className="h-9 max-w-[190px]" />
            {message.durationSec ? <span className="text-xs numeric">{message.durationSec}s</span> : null}
          </div>
        ) : null}

        <div className="bubble-meta">
          <span>{formatClock(message.createdAt)}</span>
          {message.editedAt ? <span className="italic">edited</span> : null}
          {message.isMine ? (
            <span className="flex items-center gap-1" title={message.status === "viewed" ? "Seen" : "Sent"}>
              <Icon name={message.status === "viewed" ? "check-double" : "check"} size={13} />
              {message.status === "viewed" ? "seen" : "sent"}
            </span>
          ) : null}
          <button
            type="button"
            className="ml-1 opacity-70 hover:opacity-100"
            aria-label="Message options"
            onClick={onOpenMenu}
          >
            <Icon name="more" size={13} />
          </button>
        </div>
        <span className={cn("expiry-note", message.isMine && "expiry-note-mine", expiredSoon && "text-coral")}>
          <Icon name="clock" size={11} />
          {message.notViewedYet ? EXPIRY_COPY.directNotViewed : countdown ?? EXPIRY_COPY.group}
        </span>
      </div>
    </li>
  );
}

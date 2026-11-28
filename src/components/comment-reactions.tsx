"use client";

import { useEffect, useRef, useState } from "react";
import { useToast } from "@/components/ui";
import { api } from "@/lib/client";
import { COMMENT_REACTIONS, commentReactionInfo, type CommentReaction } from "@/lib/reactions";
import { cn } from "@/lib/utils";
import type { CommentView } from "@/lib/types";

type Summary = CommentView["reactions"];

function applyLocally(reactions: Summary, previous: CommentReaction | null, next: CommentReaction | null): Summary {
  const counts = new Map<CommentReaction, number>(reactions.map((item) => [item.reaction, item.count]));
  if (previous) counts.set(previous, (counts.get(previous) ?? 1) - 1);
  if (next) counts.set(next, (counts.get(next) ?? 0) + 1);
  return Array.from(counts, ([reaction, count]) => ({ reaction, count }))
    .filter((item) => item.count > 0)
    .sort((a, b) => b.count - a.count);
}

/** "React" + "Reply" row under a comment, with the six reactions and the totals so far. */
export function CommentReactionBar({
  momentId,
  comment,
  onReply,
}: {
  momentId: number;
  comment: CommentView;
  onReply?: () => void;
}) {
  const { show } = useToast();
  const [reactions, setReactions] = useState<Summary>(comment.reactions ?? []);
  const [mine, setMine] = useState<CommentReaction | null>(comment.myReaction ?? null);
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const ready = comment.id > 0;

  useEffect(() => {
    if (!open) return;
    const close = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [open]);

  async function choose(reaction: CommentReaction) {
    setOpen(false);
    const before = { reactions, mine };
    const next = mine === reaction ? null : reaction;
    setReactions(applyLocally(reactions, mine, next));
    setMine(next);
    try {
      const result = await api.post<{ reactions: Summary; myReaction: CommentReaction | null }>(
        `/api/moments/${momentId}/engagement`,
        { action: "react", commentId: comment.id, reaction: next },
      );
      setReactions(result.reactions);
      setMine(result.myReaction);
    } catch (error) {
      setReactions(before.reactions);
      setMine(before.mine);
      show({ title: "Could not react", description: error instanceof Error ? error.message : undefined, tone: "error" });
    }
  }

  const total = reactions.reduce((sum, item) => sum + item.count, 0);
  const mineInfo = mine ? commentReactionInfo(mine) : null;

  return (
    <div ref={rootRef} className="relative mt-1 flex items-center gap-3 caption">
      {ready ? (
        <button
          type="button"
          className={cn("font-semibold hover:underline", mineInfo && "text-brand")}
          aria-expanded={open}
          onClick={() => setOpen((value) => !value)}
        >
          {mineInfo ? `${mineInfo.emoji} ${mineInfo.label}` : "React"}
        </button>
      ) : null}
      {ready && onReply ? (
        <button type="button" className="font-semibold hover:underline" onClick={onReply}>
          Reply
        </button>
      ) : null}
      {total > 0 ? (
        <span className="ml-auto flex items-center gap-1" aria-label={`${total} reactions`}>
          <span className="flex">
            {reactions.slice(0, 3).map((item) => (
              <span key={item.reaction} aria-hidden="true" className="-ml-1 first:ml-0">
                {commentReactionInfo(item.reaction).emoji}
              </span>
            ))}
          </span>
          <span className="numeric font-semibold">{total}</span>
        </span>
      ) : null}

      {open ? (
        <div
          role="menu"
          aria-label="Choose a reaction"
          className="absolute bottom-full left-0 z-20 mb-1 flex gap-0.5 rounded-full border border-[color:var(--line)] bg-surface p-1 shadow-lg"
        >
          {COMMENT_REACTIONS.map((item) => (
            <button
              key={item.id}
              type="button"
              role="menuitem"
              aria-label={item.label}
              title={item.label}
              className={cn(
                "grid h-10 w-10 place-items-center rounded-full text-2xl transition-transform hover:scale-125 active:scale-110",
                mine === item.id && "bg-brand-soft",
              )}
              onClick={() => void choose(item.id)}
            >
              {item.emoji}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

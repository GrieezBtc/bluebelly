"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { Icon } from "@/components/icons";
import { PageHeader } from "@/components/app-shell";
import { Avatar, Badge, ErrorState, InfoBanner, LoadingRows, TimeAgo } from "@/components/ui";
import { MomentCard } from "@/components/moments/moment-card";
import { api } from "@/lib/client";
import type { CommentView, MomentView } from "@/lib/types";

export default function MomentDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [moment, setMoment] = useState<MomentView | null>(null);
  const [comments, setComments] = useState<CommentView[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const id = Number(params?.id);
    if (!Number.isFinite(id)) {
      setError("That Moment link is not valid.");
      setLoading(false);
      return;
    }
    api
      .get<{ moment: MomentView; comments: CommentView[] }>(`/api/moments/${id}`)
      .then((result) => {
        setMoment(result.moment);
        setComments(result.comments);
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, [params?.id]);

  if (loading) {
    return (
      <div className="page px-4">
        <PageHeader title="Moment" backHref="/home" />
        <LoadingRows rows={1} />
      </div>
    );
  }

  if (error || !moment) {
    return (
      <div className="page px-4">
        <PageHeader title="Moment" backHref="/home" />
        <InfoBanner tone="warn" icon="lock" title="This Moment is not available">
          <p className="pb-3">
            {error ?? "It may have been deleted, or its audience does not include you."}
          </p>
          <div className="flex gap-2">
            <Link href="/home" className="btn btn-secondary btn-sm">
              Back to Home
            </Link>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => router.refresh()}>
              Try again
            </button>
          </div>
        </InfoBanner>
      </div>
    );
  }

  return (
    <div className="page px-4">
      <PageHeader title="Moment" subtitle={`@${moment.author.username}`} backHref="/home" />
      <MomentCard
        moment={moment}
        priority
        onChanged={(patch) => {
          if (patch) setMoment((current) => (current ? { ...current, ...patch } : current));
          else router.refresh();
        }}
      />

      <section className="card mt-3 p-0" aria-labelledby="comment-list-heading">
        <div className="section-title px-4 pt-4">
          <h2 className="h3" id="comment-list-heading">
            Comments
          </h2>
          <Badge>{comments.length}</Badge>
        </div>
        {comments.length === 0 ? (
          <p className="body-sm px-4 pb-4">
            No comments yet. Open the comment button on the Moment above to reply.
          </p>
        ) : (
          <ul className="divide-y divide-[color:var(--line)]">
            {comments.map((comment) => (
              <li key={comment.id} className="flex gap-3 px-4 py-3">
                <Avatar user={comment.author} size="sm" />
                <div className="min-w-0">
                  <p className="flex items-center gap-1.5 text-sm font-semibold">
                    <Link href={`/profile/${comment.author.username}`} className="hover:underline">
                      {comment.author.name}
                    </Link>
                    <TimeAgo iso={comment.createdAt} className="caption font-normal" />
                  </p>
                  <p className="body-sm whitespace-pre-wrap">{comment.body}</p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="pt-3">
        <p className="caption flex items-center gap-1.5">
          <Icon name="info" size={14} /> Moments are permanent social content. Only the author can delete them.
        </p>
      </div>
      <div className="h-6" />
    </div>
  );
}

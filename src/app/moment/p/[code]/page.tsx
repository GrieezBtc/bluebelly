import type { Metadata } from "next";
import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { BrandMark, Icon } from "@/components/icons";
import { PublicProviders } from "@/components/providers";
import { Avatar, TimeAgo } from "@/components/ui";
import { getCurrentUser } from "@/lib/auth";
import { getMomentByShareCode } from "@/db/store";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ code: string }> };

async function origin() {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "bemblo.name.ng";
  const proto = h.get("x-forwarded-proto") ?? "https";
  return `${proto}://${host}`;
}

/** Only genuinely public Moments are ever visible to logged-out visitors. */
async function loadPublicMoment(code: string) {
  const found = await getMomentByShareCode(null, code);
  return found?.moment ?? null;
}

function excerpt(text: string, max: number) {
  const clean = text.replace(/\s+/g, " ").trim();
  return clean.length > max ? `${clean.slice(0, max - 1).trimEnd()}…` : clean;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { code } = await params;
  const moment = await loadPublicMoment(code);
  if (!moment) {
    return { title: "Moment on BlueBelly", robots: { index: false }, description: "Join BlueBelly — Talk. Share. Connect." };
  }
  const base = await origin();
  const url = `${base}/moment/p/${code}`;
  const title = `${moment.author.name} (@${moment.author.username}) on BlueBelly`;
  const fallback = moment.kind === "photo" ? "Shared a photo on BlueBelly" : moment.kind === "video" ? "Shared a video on BlueBelly" : "Shared a Moment on BlueBelly";
  const description = moment.body ? excerpt(moment.body, 200) : fallback;
  // Photos use the photo itself; text/video Moments get a generated card.
  const image =
    moment.kind === "photo" && moment.mediaUrl
      ? moment.mediaUrl.startsWith("http")
        ? moment.mediaUrl
        : `${base}${moment.mediaUrl}`
      : `${base}/moment/p/${code}/card`;
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: { type: "article", url, title, description, siteName: "BlueBelly", images: [{ url: image }] },
    twitter: { card: "summary_large_image", title, description, images: [image] },
  };
}

export default async function SharedMomentPage({ params }: Props) {
  const { code } = await params;
  const user = await getCurrentUser();
  if (user?.emailVerifiedAt && user.onboardedAt) {
    // Logged-in users get the full app view (this applies their own privacy/audience rules).
    const visible = await getMomentByShareCode(user.id, code);
    if (visible) redirect(`/moments/${visible.moment.id}`);
  }

  const moment = await loadPublicMoment(code);

  return (
    <PublicProviders>
      <div className="mx-auto flex min-h-dvh w-full max-w-lg flex-col px-4 py-5">
        <header className="flex items-center justify-between pb-4">
          <Link href="/" aria-label="BlueBelly home">
            <BrandMark size={30} />
          </Link>
          <div className="flex items-center gap-2">
            <Link href="/login" className="btn btn-ghost btn-sm">
              Log in
            </Link>
            <Link href="/signup" className="btn btn-primary btn-sm">
              Join
            </Link>
          </div>
        </header>

        <main className="flex flex-1 flex-col gap-4">
          {moment ? (
            <article className="card p-0 overflow-hidden">
              <div className="flex items-center gap-3 px-4 pt-4">
                <Avatar user={moment.author} size="md" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{moment.author.name}</p>
                  <p className="caption truncate">
                    @{moment.author.username} · <TimeAgo iso={moment.createdAt} className="caption" />
                  </p>
                </div>
              </div>
              {moment.body ? <p className="whitespace-pre-wrap px-4 pt-3 text-base leading-relaxed">{moment.body}</p> : null}
              {moment.kind === "photo" && moment.mediaUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={moment.mediaUrl} alt={moment.body ? excerpt(moment.body, 120) : "Photo shared on BlueBelly"} className="mt-3 w-full" />
              ) : null}
              {moment.kind === "video" && moment.mediaUrl ? (
                <video src={moment.mediaUrl} poster={moment.posterUrl ?? undefined} controls playsInline preload="metadata" className="mt-3 w-full" />
              ) : null}
              <div className="flex items-center gap-5 px-4 py-3 caption">
                <span className="flex items-center gap-1.5">
                  <Icon name="heart" size={16} /> {moment.likeCount}
                </span>
                <span className="flex items-center gap-1.5">
                  <Icon name="comment" size={16} /> {moment.commentCount}
                </span>
              </div>
            </article>
          ) : (
            <div className="card card-pad text-center">
              <h1 className="h3">This Moment is not available</h1>
              <p className="body-sm pt-2">It may have been deleted, or it is only shared with certain people.</p>
            </div>
          )}

          <section className="card card-pad text-center">
            <h2 className="h3">{moment ? `Join ${moment.author.name.split(" ")[0]} on BlueBelly` : "Join BlueBelly"}</h2>
            <p className="body-sm pt-1">Like, comment and follow. Private chats, lasting Moments, privacy you control.</p>
            <div className="flex flex-col gap-2 pt-4">
              <Link href="/signup" className="btn btn-primary btn-block">
                Create account
              </Link>
              <Link href="/login" className="btn btn-secondary btn-block">
                I already have an account
              </Link>
            </div>
          </section>
        </main>
      </div>
    </PublicProviders>
  );
}

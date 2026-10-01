import Link from "next/link";
import { redirect } from "next/navigation";
import { BrandMark, Icon } from "@/components/icons";
import { getCurrentUser } from "@/lib/auth";
import { PublicProviders } from "@/components/providers";

export const dynamic = "force-dynamic";

const PILLARS = [
  {
    icon: "chat" as const,
    title: "Temporary conversations",
    body: "1-to-1 messages disappear 24 hours after they are viewed. Group messages clear after 7 days. Your chats stay light on purpose.",
  },
  {
    icon: "moments" as const,
    title: "Lasting Moments",
    body: "Photos, videos and thoughts that stay until you delete them. Moments are social content, not temporary messages.",
  },
  {
    icon: "lock" as const,
    title: "Privacy you control",
    body: "Profile privacy, Moment audience and messaging permissions are three separate settings. Only Me stays Only Me.",
  },
  {
    icon: "help" as const,
    title: "Support that answers",
    body: "Real people reply, usually in under four hours. Safety reports are reviewed within a day.",
  },
];

export default async function LandingPage() {
  const user = await getCurrentUser();
  if (user) redirect("/home");

  return (
    <PublicProviders>
      <div className="min-h-dvh">
        <header className="mx-auto flex w-full max-w-5xl items-center justify-between gap-4 px-5 py-4">
          <BrandMark size={32} />
          <nav className="flex items-center gap-2" aria-label="Account">
            <Link href="/login" className="btn btn-ghost btn-sm">
              Log in
            </Link>
            <Link href="/signup" className="btn btn-primary btn-sm">
              Create account
            </Link>
          </nav>
        </header>

        <main className="mx-auto w-full max-w-5xl px-5">
          <section className="mx-auto max-w-3xl py-8 lg:py-14">
            <div className="rise-in">
              <span className="badge badge-onlyme">
                <span className="badge-dot" /> New · Bemblo 1.0
              </span>
              <h1 className="display pt-4 balance">
                Bemblo —{" "}
                <span className="bg-gradient-to-r from-brand via-[#9a5cff] to-mint bg-clip-text text-transparent">
                  Talk. Share. Connect.
                </span>
              </h1>
              <p className="body-sm pt-4 max-w-lg text-base" style={{ color: "var(--ink-2)" }}>
                One clean place for conversations that expire and Moments that last. Message a friend, share a photo, pick exactly
                who sees it — then get on with your day.
              </p>
              <div className="flex flex-col gap-3 pt-6 sm:flex-row">
                <Link href="/signup" className="btn btn-primary btn-lg">
                  Create account
                </Link>
                <Link href="/login" className="btn btn-secondary btn-lg">
                  Log in
                </Link>
              </div>
              <ul className="flex flex-wrap gap-x-5 gap-y-2 pt-6 text-sm" style={{ color: "var(--ink-2)" }}>
                <li className="flex items-center gap-2">
                  <Icon name="check" size={16} className="text-mint" /> Installable as an app
                </li>
                <li className="flex items-center gap-2">
                  <Icon name="check" size={16} className="text-mint" /> Fast on phones
                </li>
                <li className="flex items-center gap-2">
                  <Icon name="check" size={16} className="text-mint" /> Privacy enforced by our servers
                </li>
              </ul>
            </div>

          </section>

          <section className="grid gap-3 py-6 sm:grid-cols-2">
            {PILLARS.map((pillar) => (
              <article key={pillar.title} className="card card-pad">
                <span className="grid h-10 w-10 place-items-center rounded-md bg-brand-soft text-brand">
                  <Icon name={pillar.icon} size={20} />
                </span>
                <h2 className="h3 pt-3">{pillar.title}</h2>
                <p className="body-sm pt-1">{pillar.body}</p>
              </article>
            ))}
          </section>

          <section className="card card-pad my-6">
            <h2 className="h2">Who sees what — in plain language</h2>
            <div className="grid gap-4 pt-4 sm:grid-cols-3">
              {[
                { title: "Public", body: "Anyone on Bemblo can view the profile and Public Moments.", tone: "public" as const, icon: "globe" as const },
                { title: "Followers", body: "Only people whose follow request you approved.", tone: "followers" as const, icon: "users" as const },
                { title: "Only Me", body: "Only you — permanently, unless you change it yourself.", tone: "onlyme" as const, icon: "lock" as const },
              ].map((item) => (
                <div key={item.title} className="card-flat p-3">
                  <span className={`badge badge-${item.tone}`}>
                    <Icon name={item.icon} size={12} /> {item.title}
                  </span>
                  <p className="body-sm pt-2">{item.body}</p>
                </div>
              ))}
            </div>
            <p className="caption pt-4">
              Expiring messages remove content from Bemblo, but they cannot prevent screenshots, screen recording or someone
              photographing their screen. We will never claim otherwise.
            </p>
          </section>
        </main>

        <footer className="mx-auto w-full max-w-5xl px-5 pb-10 pt-4">
          <div className="flex flex-col gap-4 border-t border-line pt-6 sm:flex-row sm:items-center sm:justify-between">
            <BrandMark size={28} />
            <nav className="flex flex-wrap gap-x-5 gap-y-2 text-sm" style={{ color: "var(--ink-2)" }} aria-label="Legal">
              <Link href="/legal/privacy">Privacy</Link>
              <Link href="/legal/terms">Terms</Link>
              <Link href="/legal/guidelines">Community guidelines</Link>
              <Link href="/support">Help &amp; Support</Link>
            </nav>
          </div>
          <p className="caption pt-4">Bemblo — Talk. Share. Connect.</p>
        </footer>
      </div>
    </PublicProviders>
  );
}

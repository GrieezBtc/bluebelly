import Link from "next/link";
import { redirect } from "next/navigation";
import { BrandMark, Icon } from "@/components/icons";
import { getCurrentUser } from "@/lib/auth";
import { PublicProviders } from "@/components/providers";
import { DemoButton } from "@/components/auth/demo-button";

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
          <section className="grid gap-8 py-8 lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:py-14">
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
              <div className="flex flex-wrap items-center gap-3 pt-4">
                <DemoButton />
                <span className="caption">No signup needed — explore Bemblo with a ready-made demo world.</span>
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

            {/* Phone preview — pure CSS/SVG so the landing stays fast */}
            <div className="flex justify-center lg:justify-end">
              <div className="relative w-[290px] max-w-full">
                <div className="absolute -inset-6 -z-10 brand-gradient-soft blur-2xl" aria-hidden="true" />
                <div className="card overflow-hidden p-0 shadow-lg">
                  <div className="flex items-center justify-between border-b border-line px-3 py-2.5">
                    <BrandMark size={22} />
                    <div className="flex gap-1 text-ink-3">
                      <Icon name="search" size={16} />
                      <Icon name="bell" size={16} />
                    </div>
                  </div>
                  <div className="flex flex-col gap-3 p-3">
                    <div className="card-flat p-3">
                      <div className="flex items-center gap-2">
                        <span className="avatar avatar-sm accent-violet">AR</span>
                        <div>
                          <p className="text-sm font-semibold">Ava Rivera</p>
                          <p className="caption">2h · Followers</p>
                        </div>
                      </div>
                      <p className="body-sm pt-2">Sunday ride through the old quarter. Slowing down suits me.</p>
                      <div className="mt-2 h-24 rounded-sm" style={{ background: "linear-gradient(120deg,#f4553f33,#6c4bf733)" }} />
                      <div className="flex items-center gap-4 pt-2 text-ink-3">
                        <span className="flex items-center gap-1 text-xs">
                          <Icon name="heart" size={15} /> 24
                        </span>
                        <span className="flex items-center gap-1 text-xs">
                          <Icon name="comment" size={15} /> 3
                        </span>
                        <span className="flex items-center gap-1 text-xs">
                          <Icon name="share" size={15} />
                        </span>
                      </div>
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <div className="bubble bubble-theirs self-start">
                        Did you see the light on Rua do Norte?
                        <span className="bubble-meta">
                          <Icon name="clock" size={11} /> 24h after viewing
                        </span>
                      </div>
                      <div className="bubble bubble-mine self-end">
                        Yes! Send them when you are back at a screen.
                        <span className="bubble-meta">
                          <Icon name="check-double" size={11} /> viewed
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="grid grid-cols-5 border-t border-line px-1 py-2 text-[0.625rem] text-ink-3">
                    {[
                      { label: "Home", icon: "home" as const },
                      { label: "Moments", icon: "moments" as const },
                      { label: "Create", icon: "create" as const },
                      { label: "Messages", icon: "chat" as const },
                      { label: "Profile", icon: "user" as const },
                    ].map((item, index) => (
                      <span key={item.label} className="flex flex-col items-center gap-1" style={{ color: index === 1 ? "var(--brand)" : undefined }}>
                        <Icon name={item.icon} size={17} />
                        {item.label}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
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

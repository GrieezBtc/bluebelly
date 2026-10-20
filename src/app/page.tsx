import Link from "next/link";
import { redirect } from "next/navigation";
import { BrandMark, Icon } from "@/components/icons";
import { getCurrentUser } from "@/lib/auth";
import { PublicProviders } from "@/components/providers";

export const dynamic = "force-dynamic";

const PILLARS = [
  {
    icon: "chat" as const,
    title: "Private conversations, your rules",
    body: "Chat 1-to-1 or in groups with replies, voice notes and photos. You choose how long messages stay: right after viewing, 24 hours, 7 days or 30 days, or keep them. Group admins set the timer for their group.",
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
    body: "Real people reply, usually in under four hours. Safety reports are reviewed within a day, and you can follow the official Bemblo account for updates.",
  },
];

const STEPS = [
  {
    title: "Create and verify your account",
    body: "Sign up with your email, confirm it, and pick a username. Choose whether your profile is Public or Private.",
  },
  {
    title: "Share Moments with the right audience",
    body: "Post a photo, video or thought and pick Public, Followers or Only Me. Moments stay until you delete them. Friends can like, comment and reply.",
  },
  {
    title: "Message on your terms",
    body: "You decide who can message you. People you do not follow back arrive as message requests. Reply to, edit or delete your messages, and leave or manage groups as an admin.",
  },
  {
    title: "Control how long messages stay",
    body: "Every chat has its own disappearing-messages setting that you can switch on, off or change at any time. Group admins control the timer for their group.",
  },
  {
    title: "Stay in the loop",
    body: "Get notifications for messages, replies and activity, and follow the official Bemblo account for announcements and upcoming updates.",
  },
  {
    title: "Get help when you need it",
    body: "Report anything that breaks the Community Guidelines, or contact Support from your profile menu. A real person will reply.",
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
                One clean place for private conversations and lasting Moments. Message a friend, share a photo, choose exactly who
                sees it, and decide how long your messages stay.
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

          <section className="py-6" aria-labelledby="how-it-works">
            <h2 className="h2" id="how-it-works">
              How Bemblo works
            </h2>
            <ol className="grid gap-3 pt-4 sm:grid-cols-2">
              {STEPS.map((step, index) => (
                <li key={step.title} className="card card-pad flex gap-3">
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-brand-soft text-sm font-semibold text-brand">
                    {index + 1}
                  </span>
                  <div className="min-w-0">
                    <h3 className="text-sm font-semibold">{step.title}</h3>
                    <p className="body-sm pt-1">{step.body}</p>
                  </div>
                </li>
              ))}
            </ol>
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
              Disappearing messages remove content from Bemblo on the schedule you choose. They cannot prevent screenshots, screen
              recording or someone photographing a screen, and we will never claim otherwise.
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

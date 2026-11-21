import Link from "next/link";
import { notFound } from "next/navigation";
import { BrandMark, Icon } from "@/components/icons";
import { PublicProviders } from "@/components/providers";
import { LEGAL_DOCS } from "@/lib/content";
import { getCurrentUser } from "@/lib/auth";

const DOCS = LEGAL_DOCS as unknown as Record<
  string,
  { title: string; updated: string; sections: readonly { heading: string; body: string }[] }
>;

export function generateStaticParams() {
  return Object.keys(DOCS).map((doc) => ({ doc }));
}

export const metadata = { title: "BlueBelly legal" };

export default async function LegalDocPage({ params }: { params: Promise<{ doc: string }> }) {
  const { doc } = await params;
  const content = DOCS[doc];
  if (!content) notFound();
  const viewer = await getCurrentUser();
  const backHref = viewer ? `/profile/${viewer.username}?menu=1` : "/";

  return (
    <PublicProviders>
      <div className="mx-auto w-full max-w-2xl px-5 pt-5 pb-10">
        <header className="flex items-center justify-between gap-3 pb-4">
          <Link href={backHref} className="btn-icon" aria-label="Go back">
            <Icon name="chevron-left" size={22} />
          </Link>
          <BrandMark size={28} />
          <Link href="/support" className="text-sm font-semibold text-brand">
            Help
          </Link>
        </header>

        <p className="eyebrow">BlueBelly legal</p>
        <h1 className="h1 pt-1">{content.title}</h1>
        <p className="caption pt-1">{content.updated}</p>

        <article className="flex flex-col gap-3 pt-4">
          {content.sections.map((section) => (
            <section key={section.heading} className="card card-pad">
              <h2 className="h3">{section.heading}</h2>
              <p className="body-sm whitespace-pre-wrap pt-1">{section.body}</p>
            </section>
          ))}
        </article>

        <nav className="flex flex-wrap gap-2 py-5" aria-label="Other legal documents">
          {Object.entries(DOCS)
            .filter(([key]) => key !== doc)
            .map(([key, value]) => (
              <Link key={key} href={`/legal/${key}`} className="chip">
                <Icon name="link" size={14} /> {value.title}
              </Link>
            ))}
          <Link href="/support" className="chip">
            <Icon name="help" size={14} /> Help &amp; Support
          </Link>
        </nav>
        <p className="caption">
          Questions about this document? Contact BlueBelly Support and choose Privacy &amp; security — average first reply is under
          four hours.
        </p>
      </div>
    </PublicProviders>
  );
}

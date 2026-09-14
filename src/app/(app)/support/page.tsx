"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Icon, type IconName } from "@/components/icons";
import { PageHeader } from "@/components/app-shell";
import { EmptyState, ErrorState, Field, InfoBanner, LoadingRows, Segmented, Spinner, TimeAgo, useToast } from "@/components/ui";
import { api, useQuery } from "@/lib/client";
import { useSession } from "@/components/providers";
import type { FaqItem } from "@/lib/types";

type SupportPayload = {
  faqs: FaqItem[];
  categories: { id: string; title: string; blurb: string; count: number }[];
  topics: { id: string; label: string; blurb: string }[];
  tickets: { id: number; topic: string; subject: string; status: string; createdAt: string }[];
};

const CATEGORY_ICONS: Record<string, IconName> = {
  start: "sparkle",
  messaging: "chat",
  moments: "moments",
  privacy: "shield-check",
  account: "key",
  support: "help",
};

function SupportInner() {
  const { user } = useSession();
  const { show } = useToast();
  const { data, error, loading, reload } = useQuery<SupportPayload>("/api/support");
  const [tab, setTab] = useState<"help" | "contact" | "recovery">("help");
  const [search, setSearch] = useState("");
  const [openFaq, setOpenFaq] = useState<string | null>(null);
  const [topic, setTopic] = useState("report_problem");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (user?.email) setEmail(user.email);
  }, [user?.email]);

  const faqs = useMemo(() => {
    const list = data?.faqs ?? [];
    if (!search.trim()) return list;
    const needle = search.trim().toLowerCase();
    return list.filter((item) => item.q.toLowerCase().includes(needle) || item.a.toLowerCase().includes(needle));
  }, [data?.faqs, search]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setFormError(null);
    try {
      const response = await api.post<{ message: string }>("/api/support", { email, topic, subject, body });
      setResult(response.message);
      setSubject("");
      setBody("");
      reload();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "We could not send your request.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="page px-4">
      <PageHeader title="Help & Support" subtitle="Real people, fast answers" />

      <div className="pb-3">
        <Segmented
          label="Support sections"
          value={tab}
          onChange={setTab}
          options={[
            { value: "help", label: "Help centre" },
            { value: "contact", label: "Contact support" },
            { value: "recovery", label: "Account recovery" },
          ]}
        />
      </div>

      {tab === "help" ? (
        <>
          <div className="pb-3">
            <Field label="Search the help centre" htmlFor="help-search">
              <div className="input-affix">
                <Icon name="search" size={18} className="text-ink-3" />
                <input
                  id="help-search"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Expiry, privacy, blocking, audiences…"
                />
              </div>
            </Field>
          </div>

          {loading ? (
            <LoadingRows rows={2} />
          ) : error ? (
            <ErrorState title="Help centre unavailable" description={error} onRetry={reload} />
          ) : search ? (
            faqs.length === 0 ? (
              <div className="card">
                <EmptyState
                  icon="search"
                  title="No article found"
                  description="Try different words, or contact support and we will answer directly."
                  action={
                    <button type="button" className="btn btn-primary btn-sm" onClick={() => setTab("contact")}>
                      Contact support
                    </button>
                  }
                />
              </div>
            ) : (
              <FaqList faqs={faqs} openFaq={openFaq} setOpenFaq={setOpenFaq} />
            )
          ) : (
            <>
              <section className="grid gap-2 sm:grid-cols-2">
                {(data?.categories ?? []).map((category) => (
                  <button
                    key={category.id}
                    type="button"
                    className="card card-pad text-left"
                    onClick={() => setSearch(category.title.split(" ")[0])}
                  >
                    <span className="grid h-9 w-9 place-items-center rounded-md bg-brand-soft text-brand">
                      <Icon name={CATEGORY_ICONS[category.id] ?? "help"} size={18} />
                    </span>
                    <span className="block pt-2 font-semibold">{category.title}</span>
                    <span className="body-sm block">{category.blurb}</span>
                    <span className="caption block pt-1 numeric">{category.count} articles</span>
                  </button>
                ))}
              </section>

              <section className="pt-4">
                <h2 className="section-title h3 px-0 pb-2">Most asked questions</h2>
                <FaqList faqs={data?.faqs.slice(0, 6) ?? []} openFaq={openFaq} setOpenFaq={setOpenFaq} />
              </section>
            </>
          )}

          {(data?.tickets ?? []).length > 0 ? (
            <section className="pt-4">
              <h2 className="section-title h3 px-0 pb-2">Your support requests</h2>
              <ul className="card divide-y divide-[color:var(--line)] p-0">
                {(data?.tickets ?? []).map((ticket) => (
                  <li key={ticket.id} className="flex items-center gap-3 px-4 py-3">
                    <span className="grid h-9 w-9 place-items-center rounded-full bg-brand-soft text-brand">
                      <Icon name="help" size={16} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold">
                        #{ticket.id} · {ticket.subject}
                      </span>
                      <span className="caption">
                        {ticket.status} · <TimeAgo iso={ticket.createdAt} />
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </>
      ) : null}

      {tab === "contact" ? (
        <div className="flex flex-col gap-4">
          <InfoBanner tone="brand" icon="help" title="Average first reply: under 4 hours">
            <p>
              Safety reports are reviewed within 24 hours. Urgent threats to safety are escalated immediately, day or night.
            </p>
          </InfoBanner>

          {result ? (
            <InfoBanner tone="info" icon="check" title="Request received">
              <p>{result}</p>
              <button type="button" className="btn btn-secondary btn-sm mt-2" onClick={() => setResult(null)}>
                Send another message
              </button>
            </InfoBanner>
          ) : (
            <form className="card card-pad flex flex-col gap-4" onSubmit={submit}>
              <Field label="What is this about?" htmlFor="support-topic">
                <select id="support-topic" className="select" value={topic} onChange={(event) => setTopic(event.target.value)}>
                  {(data?.topics ?? []).map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </Field>
              <p className="field-hint -mt-2">{(data?.topics ?? []).find((option) => option.id === topic)?.blurb}</p>
              <Field label="Subject" htmlFor="support-subject">
                <input
                  id="support-subject"
                  className="input"
                  required
                  minLength={4}
                  maxLength={120}
                  value={subject}
                  onChange={(event) => setSubject(event.target.value)}
                  placeholder="Short summary of your issue"
                />
              </Field>
              <Field label="Email for our reply" htmlFor="support-email">
                <input
                  id="support-email"
                  className="input"
                  type="email"
                  required
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                />
              </Field>
              <Field label="Tell us what happened" htmlFor="support-body">
                <textarea
                  id="support-body"
                  className="textarea"
                  rows={5}
                  required
                  minLength={10}
                  maxLength={4000}
                  value={body}
                  onChange={(event) => setBody(event.target.value)}
                  placeholder="Include what you expected, what happened, and the steps to reproduce it."
                />
              </Field>
              {formError ? (
                <p className="field-error" role="alert">
                  {formError}
                </p>
              ) : null}
              <button type="submit" className="btn btn-primary btn-block" disabled={busy}>
                {busy ? <Spinner /> : <Icon name="send" size={18} />} Send to Bemblo Support
              </button>
              <p className="caption">
                Never share your password. Bemblo Support will never ask for it.{" "}
                <Link href="/legal/privacy" className="font-semibold text-brand">
                  How we handle your data
                </Link>
              </p>
            </form>
          )}
        </div>
      ) : null}

      {tab === "recovery" ? (
        <div className="flex flex-col gap-3">
          <InfoBanner tone="info" icon="key" title="Step 1 — Try the reset link">
            <p>
              Use{" "}
              <Link href="/forgot-password" className="font-semibold text-brand">
                Forgot password
              </Link>{" "}
              on the login screen. The link works for one hour and signs out other devices for your safety.
            </p>
          </InfoBanner>
          <InfoBanner tone="info" icon="mail" title="Step 2 — No access to your email?">
            <p>
              Contact support with the topic Account recovery. Include your username, the email or phone on the account, and the
              month you created it. We verify ownership before making any change.
            </p>
          </InfoBanner>
          <InfoBanner tone="warn" icon="shield" title="Step 3 — Suspicious activity">
            <p>
              If you think someone else has access, change your password, then use Settings → Account → Sign out other devices.
              Tell us about it so we can review the account and Messenger limits.
            </p>
          </InfoBanner>
          <div className="card card-pad">
            <h2 className="h3">What we can help with</h2>
            <ul className="body-sm list-disc space-y-1 pt-2 pl-4">
              <li>Locked accounts and lost login access</li>
              <li>Removing a phone number or email you no longer control</li>
              <li>Restoring access after account takeover</li>
              <li>Deleting an account you cannot sign into</li>
            </ul>
            <button type="button" className="btn btn-primary btn-block mt-4" onClick={() => setTab("contact")}>
              Start a recovery request
            </button>
          </div>
        </div>
      ) : null}

      <p className="caption pt-5 pb-6">
        Bemblo Support differentiates us from bigger platforms: every message is read by a person, and we answer in plain
        language.
      </p>
    </div>
  );
}

function FaqList({
  faqs,
  openFaq,
  setOpenFaq,
}: {
  faqs: FaqItem[];
  openFaq: string | null;
  setOpenFaq: (value: string | null) => void;
}) {
  return (
    <ul className="card divide-y divide-[color:var(--line)] p-0">
      {faqs.map((faq) => {
        const open = openFaq === faq.q;
        return (
          <li key={faq.q}>
            <button
              type="button"
              className="flex w-full items-center gap-3 px-4 py-3 text-left"
              aria-expanded={open}
              onClick={() => setOpenFaq(open ? null : faq.q)}
            >
              <span className="flex-1 text-sm font-semibold">{faq.q}</span>
              <Icon name={open ? "chevron-down" : "chevron-right"} size={18} className="shrink-0 text-ink-3" />
            </button>
            {open ? <p className="body-sm px-4 pb-4 whitespace-pre-wrap">{faq.a}</p> : null}
          </li>
        );
      })}
    </ul>
  );
}

export default function SupportPage() {
  return (
    <Suspense fallback={<LoadingRows rows={2} />}>
      <SupportInner />
    </Suspense>
  );
}

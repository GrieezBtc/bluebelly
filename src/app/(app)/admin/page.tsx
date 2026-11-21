"use client";

import Link from "next/link";
import { useState } from "react";
import { Icon } from "@/components/icons";
import { PageHeader } from "@/components/app-shell";
import { Badge, EmptyState, ErrorState, LoadingRows, Segmented, TimeAgo, useToast } from "@/components/ui";
import { api, useQuery } from "@/lib/client";
import type { AdminReportRow, AdminTicketRow } from "@/db/store";

type Inbox = { reports: AdminReportRow[]; tickets: AdminTicketRow[] };

const REPORT_DONE = ["resolved", "dismissed"];

function label(value: string) {
  return value.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase());
}

function ReportCard({ report, onDone }: { report: AdminReportRow; onDone: () => void }) {
  const { show } = useToast();
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const closed = REPORT_DONE.includes(report.status);

  async function act(status: "reviewing" | "resolved" | "dismissed") {
    setBusy(true);
    try {
      await api.patch(`/api/admin/reports/${report.id}`, { status, note });
      show({ title: status === "reviewing" ? "Marked as in review" : `Report ${status}`, tone: "success" });
      setNote("");
      onDone();
    } catch (error) {
      show({ title: "Could not update", description: error instanceof Error ? error.message : undefined, tone: "error" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <li className="card card-pad flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-semibold">#{report.id}</span>
        <Badge tone={closed ? "neutral" : report.status === "reviewing" ? "followers" : "danger"}>{label(report.status)}</Badge>
        <span className="caption">{label(report.targetType)} report</span>
        <TimeAgo iso={report.createdAt} className="caption ml-auto" />
      </div>
      <p className="text-sm">
        <strong>{label(report.reason)}</strong>
        {report.targetLabel ? <span className="text-ink-2"> · {report.targetLabel}</span> : null}
        {report.targetId ? <span className="caption"> (id {report.targetId})</span> : null}
      </p>
      {report.details ? <p className="body-sm whitespace-pre-wrap">{report.details}</p> : null}
      <p className="caption">
        Reported by{" "}
        {report.reporter ? (
          <Link href={`/profile/${report.reporter.username}`} className="font-semibold hover:underline">
            @{report.reporter.username}
          </Link>
        ) : (
          "someone not signed in"
        )}
        {report.targetHref ? (
          <>
            {" · "}
            <Link href={report.targetHref} className="font-semibold text-brand">
              Open reported {report.targetType}
            </Link>
          </>
        ) : null}
      </p>
      {report.resolutionNote ? <p className="caption">Note: {report.resolutionNote}</p> : null}
      {!closed ? (
        <div className="flex flex-col gap-2 pt-1">
          <input
            className="input"
            value={note}
            maxLength={500}
            placeholder="Note (sent to the reporter when you resolve or dismiss)"
            onChange={(event) => setNote(event.target.value)}
          />
          <div className="flex flex-wrap gap-2">
            {report.status === "open" ? (
              <button type="button" className="btn btn-secondary btn-sm" disabled={busy} onClick={() => void act("reviewing")}>
                Start review
              </button>
            ) : null}
            <button type="button" className="btn btn-primary btn-sm" disabled={busy} onClick={() => void act("resolved")}>
              <Icon name="check" size={14} /> Resolve
            </button>
            <button type="button" className="btn btn-ghost btn-sm" disabled={busy} onClick={() => void act("dismissed")}>
              Dismiss
            </button>
          </div>
        </div>
      ) : null}
    </li>
  );
}

function TicketCard({ ticket, onDone }: { ticket: AdminTicketRow; onDone: () => void }) {
  const { show } = useToast();
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  async function act(status: "open" | "waiting" | "resolved") {
    setBusy(true);
    try {
      await api.patch(`/api/admin/tickets/${ticket.id}`, { status, note });
      show({ title: status === "resolved" ? "Marked resolved" : "Updated", tone: "success" });
      setNote("");
      onDone();
    } catch (error) {
      show({ title: "Could not update", description: error instanceof Error ? error.message : undefined, tone: "error" });
    } finally {
      setBusy(false);
    }
  }

  const mailto = `mailto:${ticket.email}?subject=${encodeURIComponent(`Re: [BlueBelly #${ticket.id}] ${ticket.subject}`)}`;

  return (
    <li className="card card-pad flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-semibold">#{ticket.id}</span>
        <Badge tone={ticket.status === "resolved" ? "neutral" : ticket.status === "waiting" ? "followers" : "danger"}>{label(ticket.status)}</Badge>
        <span className="caption">{label(ticket.topic)}</span>
        <TimeAgo iso={ticket.createdAt} className="caption ml-auto" />
      </div>
      <p className="text-sm font-semibold">{ticket.subject}</p>
      <p className="body-sm whitespace-pre-wrap">{ticket.body}</p>
      <p className="caption">
        From {ticket.user ? <Link href={`/profile/${ticket.user.username}`} className="font-semibold hover:underline">@{ticket.user.username}</Link> : "a visitor"} ·{" "}
        <a href={mailto} className="font-semibold text-brand">
          {ticket.email}
        </a>
      </p>
      {ticket.adminNote ? <p className="caption">Note: {ticket.adminNote}</p> : null}
      {ticket.status !== "resolved" ? (
        <div className="flex flex-col gap-2 pt-1">
          <input
            className="input"
            value={note}
            maxLength={500}
            placeholder="Note (shown to the user in their notification when you resolve)"
            onChange={(event) => setNote(event.target.value)}
          />
          <div className="flex flex-wrap gap-2">
            <a href={mailto} className="btn btn-secondary btn-sm">
              <Icon name="mail" size={14} /> Reply by email
            </a>
            {ticket.status === "open" ? (
              <button type="button" className="btn btn-ghost btn-sm" disabled={busy} onClick={() => void act("waiting")}>
                Waiting on user
              </button>
            ) : null}
            <button type="button" className="btn btn-primary btn-sm" disabled={busy} onClick={() => void act("resolved")}>
              <Icon name="check" size={14} /> Resolve
            </button>
          </div>
        </div>
      ) : (
        <div>
          <button type="button" className="btn btn-ghost btn-sm" disabled={busy} onClick={() => void act("open")}>
            Reopen
          </button>
        </div>
      )}
    </li>
  );
}

export default function AdminInboxPage() {
  const { data, error, loading, reload } = useQuery<Inbox>("/api/admin/inbox");
  const [tab, setTab] = useState<"reports" | "tickets">("reports");
  const [showClosed, setShowClosed] = useState(false);

  if (loading && !data) {
    return (
      <div className="page px-4">
        <PageHeader title="Admin inbox" backHref="/home" />
        <LoadingRows rows={3} />
      </div>
    );
  }
  if (error || !data) {
    return (
      <div className="page px-4">
        <PageHeader title="Admin inbox" backHref="/home" />
        <ErrorState title="Not available" description={error ?? "This area is only for BlueBelly admins."} onRetry={reload} />
      </div>
    );
  }

  const openReports = data.reports.filter((r) => !REPORT_DONE.includes(r.status));
  const openTickets = data.tickets.filter((t) => t.status !== "resolved");
  const reports = showClosed ? data.reports : openReports;
  const tickets = showClosed ? data.tickets : openTickets;

  return (
    <div className="page px-4 pb-8">
      <PageHeader title="Admin inbox" subtitle="Reports and support requests" backHref="/home" />
      <Segmented
        label="Inbox sections"
        value={tab}
        onChange={setTab}
        options={[
          { value: "reports", label: "Reports", badge: openReports.length },
          { value: "tickets", label: "Support", badge: openTickets.length },
        ]}
      />
      <label className="caption flex items-center gap-2 py-3">
        <input type="checkbox" checked={showClosed} onChange={(event) => setShowClosed(event.target.checked)} />
        Show resolved and dismissed
      </label>

      {tab === "reports" ? (
        reports.length === 0 ? (
          <div className="card">
            <EmptyState icon="shield-check" title="No open reports" description="New safety reports from users land here." />
          </div>
        ) : (
          <ul className="flex flex-col gap-3">
            {reports.map((report) => (
              <ReportCard key={report.id} report={report} onDone={reload} />
            ))}
          </ul>
        )
      ) : tickets.length === 0 ? (
        <div className="card">
          <EmptyState icon="mail" title="No open support requests" description="Requests from Help & Support land here." />
        </div>
      ) : (
        <ul className="flex flex-col gap-3">
          {tickets.map((ticket) => (
            <TicketCard key={ticket.id} ticket={ticket} onDone={reload} />
          ))}
        </ul>
      )}
    </div>
  );
}

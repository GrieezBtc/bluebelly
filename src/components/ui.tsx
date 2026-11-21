"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Icon, type IconName } from "@/components/icons";
import { api } from "@/lib/client";
import { cn, initials, timeAgo } from "@/lib/utils";
import { REPORT_REASONS } from "@/lib/content";

/* ------------------------------------------------------------------ *
 * Toasts
 * ------------------------------------------------------------------ */

type Toast = { id: number; title: string; description?: string; tone: "info" | "success" | "error" };
type ToastContextValue = { show: (toast: Omit<Toast, "id">) => void };

const ToastContext = createContext<ToastContextValue>({ show: () => {} });

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const counter = useRef(0);

  const show = useCallback((toast: Omit<Toast, "id">) => {
    counter.current += 1;
    const id = counter.current;
    setToasts((current) => [...current, { ...toast, id }]);
    window.setTimeout(() => setToasts((current) => current.filter((item) => item.id !== id)), 4200);
  }, []);

  const value = useMemo(() => ({ show }), [show]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="toast-wrapper" role="status" aria-live="polite">
        {toasts.map((toast) => (
          <div key={toast.id} className={cn("toast", `toast-${toast.tone}`)}>
            <Icon
              name={toast.tone === "error" ? "alert" : toast.tone === "success" ? "check" : "info"}
              size={18}
              className="shrink-0"
            />
            <span>
              <span className="font-semibold">{toast.title}</span>
              {toast.description ? <span className="block opacity-90">{toast.description}</span> : null}
            </span>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}

/* ------------------------------------------------------------------ *
 * Primitives
 * ------------------------------------------------------------------ */

export function Avatar({
  user,
  size = "md",
  ring = false,
  className,
}: {
  user: { name: string; avatarUrl?: string | null; accent?: string | null };
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  ring?: boolean;
  className?: string;
}) {
  return (
    <span
      className={cn("avatar", `avatar-${size}`, `accent-${user.accent ?? "violet"}`, ring && "avatar-ring", className)}
      aria-hidden="true"
    >
      {user.avatarUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={user.avatarUrl} alt="" loading="lazy" decoding="async" />
      ) : (
        initials(user.name)
      )}
    </span>
  );
}

export function Spinner({ className }: { className?: string }) {
  return <span className={cn("spinner", className)} role="presentation" />;
}

export function Skeleton({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return <span className={cn("skeleton block", className)} style={style} aria-hidden="true" />;
}

export function EmptyState({
  icon = "sparkle",
  title,
  description,
  action,
}: {
  icon?: IconName;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="empty-state">
      <span className="empty-state__icon">
        <Icon name={icon} size={26} />
      </span>
      <p className="h3">{title}</p>
      {description ? <p className="body-sm max-w-sm">{description}</p> : null}
      {action ? <div className="pt-2">{action}</div> : null}
    </div>
  );
}

export function ErrorState({
  title = "We could not load this",
  description,
  onRetry,
  retrying,
}: {
  title?: string;
  description?: string;
  onRetry?: () => void;
  retrying?: boolean;
}) {
  return (
    <div className="empty-state">
      <span className="empty-state__icon" style={{ background: "var(--coral-soft)", color: "var(--coral)" }}>
        <Icon name="alert" size={26} />
      </span>
      <p className="h3">{title}</p>
      {description ? <p className="body-sm max-w-sm">{description}</p> : null}
      {onRetry ? (
        <button type="button" className="btn btn-secondary btn-sm" onClick={onRetry} disabled={retrying}>
          {retrying ? <Spinner /> : <Icon name="refresh" size={16} />}
          Try again
        </button>
      ) : null}
    </div>
  );
}

export function Card({ children, className, flat }: { children: ReactNode; className?: string; flat?: boolean }) {
  return <div className={cn(flat ? "card-flat" : "card", className)}>{children}</div>;
}

export function Badge({
  children,
  tone = "neutral",
  icon,
}: {
  children: ReactNode;
  tone?: "neutral" | "public" | "followers" | "onlyme" | "private" | "danger";
  icon?: IconName;
}) {
  return (
    <span className={cn("badge", tone !== "neutral" && `badge-${tone}`)}>
      {icon ? <Icon name={icon} size={12} /> : <span className="badge-dot" />}
      {children}
    </span>
  );
}

export function AudienceBadge({ audience }: { audience: "public" | "followers" | "only_me" | "hidden" }) {
  if (audience === "hidden") return null;
  const map = {
    public: { label: "Public", tone: "public" as const, icon: "globe" as IconName },
    followers: { label: "Followers", tone: "followers" as const, icon: "users" as IconName },
    only_me: { label: "Only Me", tone: "onlyme" as const, icon: "lock" as IconName },
  };
  const config = map[audience];
  return (
    <Badge tone={config.tone} icon={config.icon}>
      {config.label}
    </Badge>
  );
}

export function TimeAgo({ iso, className }: { iso: string; className?: string }) {
  const [label, setLabel] = useState(() => timeAgo(iso));
  useEffect(() => {
    const timer = window.setInterval(() => setLabel(timeAgo(iso)), 60_000);
    return () => window.clearInterval(timer);
  }, [iso]);
  return (
    <time dateTime={iso} className={className} title={new Date(iso).toLocaleString()}>
      {label}
    </time>
  );
}

export function Switch({
  checked,
  onChange,
  label,
  disabled,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      data-on={checked}
      className="switch"
      disabled={disabled}
      onClick={() => onChange(!checked)}
    />
  );
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  label,
}: {
  options: { value: T; label: string; badge?: number }[];
  value: T;
  onChange: (next: T) => void;
  label: string;
}) {
  return (
    <div className="scroll-x" role="tablist" aria-label={label}>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          role="tab"
          aria-selected={value === option.value}
          className="chip"
          data-active={value === option.value}
          onClick={() => onChange(option.value)}
        >
          {option.label}
          {typeof option.badge === "number" && option.badge > 0 ? <span className="count-badge">{option.badge}</span> : null}
        </button>
      ))}
    </div>
  );
}

export function Field({
  label,
  hint,
  error,
  children,
  htmlFor,
}: {
  label: string;
  hint?: ReactNode;
  error?: string | null;
  children: ReactNode;
  htmlFor?: string;
}) {
  return (
    <div className="field">
      <label className="field-label" htmlFor={htmlFor}>
        {label}
      </label>
      {children}
      {error ? (
        <p className="field-error" role="alert">
          {error}
        </p>
      ) : hint ? (
        <p className="field-hint">{hint}</p>
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Overlays
 * ------------------------------------------------------------------ */

export function Overlay({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  variant = "sheet",
  labelledBy,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  variant?: "sheet" | "dialog";
  labelledBy?: string;
}) {
    const generatedId = useId();
  const titleId = labelledBy ?? generatedId;

  useEffect(() => {
    if (!open) return;

    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };

    document.addEventListener("keydown", onKey);

    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [open, onClose]);
  if (!open) return null;

  return (
    <>
      <div className="scrim" onClick={onClose} aria-hidden="true" />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={cn(variant === "sheet" ? "sheet" : "sheet")}
        data-variant={variant}
      >
        {variant === "sheet" ? <div className="sheet-handle md:hidden" /> : null}
        <div className="sheet-header">
          <div>
            <h2 className="h2" id={titleId}>
              {title}
            </h2>
            {description ? <p className="caption pt-0.5">{description}</p> : null}
          </div>
          <button
            type="button"
            className="btn-icon"
            onClick={onClose}
            aria-label="Close"
          >
            <Icon name="x" size={20} />
          </button>
        </div>

        <div className="p-4">{children}</div>

        {footer ? (
          <div className="sticky bottom-0 border-t border-line bg-surface p-4">
            {footer}
          </div>
        ) : null}
      </div>
    </>
  );
}

export function ConfirmDialog({
  open,
  onClose,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  tone = "primary",
  onConfirm,
  confirmPhrase,
  details,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: "primary" | "danger";
  onConfirm: () => Promise<void> | void;
  confirmPhrase?: string;
  details?: ReactNode;
}) {
  const [busy, setBusy] = useState(false);
  const [typed, setTyped] = useState("");

  useEffect(() => {
    if (open) {
      setTyped("");
      setBusy(false);
    }
  }, [open]);

  const blocked = Boolean(confirmPhrase) && typed.trim() !== confirmPhrase;

  return (
    <Overlay open={open} onClose={onClose} title={title} variant="dialog">
      {description ? <p className="body-sm">{description}</p> : null}
      {details ? <div className="pt-3">{details}</div> : null}
      {confirmPhrase ? (
        <div className="pt-3">
          <Field label={`Type ${confirmPhrase} to confirm`} htmlFor="confirm-phrase">
            <input
              id="confirm-phrase"
              className="input"
              value={typed}
              onChange={(event) => setTyped(event.target.value)}
              autoComplete="off"
            />
          </Field>
        </div>
      ) : null}
      <div className="flex flex-col gap-2 pt-4 sm:flex-row sm:justify-end">
        <button type="button" className="btn btn-secondary" onClick={onClose}>
          {cancelLabel}
        </button>
        <button
          type="button"
          className={cn("btn", tone === "danger" ? "btn-danger" : "btn-primary")}
          disabled={busy || blocked}
          onClick={async () => {
            setBusy(true);
            try {
              await onConfirm();
              onClose();
            } finally {
              setBusy(false);
            }
          }}
        >
          {busy ? <Spinner /> : null}
          {confirmLabel}
        </button>
      </div>
    </Overlay>
  );
}

export function ReportDialog({
  open,
  onClose,
  target,
}: {
  open: boolean;
  onClose: () => void;
  target: { type: "user" | "moment" | "message" | "comment"; id?: number; label: string };
}) {
  const { show } = useToast();
  const [reason, setReason] = useState("");
  const [details, setDetails] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (open) {
      setReason("");
      setDetails("");
      setError(null);
      setDone(false);
    }
  }, [open]);

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      const result = await api.post<{ message: string }>("/api/reports", {
        targetType: target.type,
        targetId: target.id,
        targetLabel: target.label,
        reason,
        details,
      });
      setDone(true);
      show({ title: "Report sent", description: result.message, tone: "success" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "We could not send that report.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Overlay open={open} onClose={onClose} title={`Report ${target.label}`} description="Our safety team reviews every report.">
      {done ? (
        <div className="banner banner-brand">
          <Icon name="shield-check" size={20} />
          <span>
            Thank you — your report is with BlueBelly Safety. We review reports within 24 hours and never tell the other person
            who reported them.
          </span>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <fieldset>
            <legend className="field-label pb-2">What is happening?</legend>
            <div className="flex flex-col gap-1.5">
              {REPORT_REASONS.map((item) => (
                <label
                  key={item.id}
                  className={cn(
                    "flex min-h-11 cursor-pointer items-center gap-3 rounded-md border px-3 py-2 text-sm",
                    reason === item.id ? "border-brand bg-brand-soft font-semibold" : "border-line",
                  )}
                >
                  <input
                    type="radio"
                    name="report-reason"
                    className="h-4 w-4"
                    checked={reason === item.id}
                    onChange={() => setReason(item.id)}
                  />
                  {item.label}
                </label>
              ))}
            </div>
          </fieldset>
          <Field label="Anything else we should know? (optional)" htmlFor="report-details">
            <textarea
              id="report-details"
              className="textarea"
              value={details}
              maxLength={1000}
              onChange={(event) => setDetails(event.target.value)}
              placeholder="Add context, links or details that help our review."
            />
          </Field>
          {error ? (
            <p className="field-error" role="alert">
              {error}
            </p>
          ) : null}
          <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="button" className="btn btn-primary" disabled={!reason || busy} onClick={submit}>
              {busy ? <Spinner /> : <Icon name="flag" size={16} />}
              Send report
            </button>
          </div>
        </div>
      )}
    </Overlay>
  );
}

/* ------------------------------------------------------------------ *
 * Composite rows
 * ------------------------------------------------------------------ */

export function UserRow({
  user,
  subtitle,
  trailing,
  onClick,
}: {
  user: { name: string; username: string; avatarUrl?: string | null; accent?: string | null; verified?: boolean };
  subtitle?: ReactNode;
  trailing?: ReactNode;
  onClick?: () => void;
}) {
  const content = (
    <>
      <Avatar user={user} size="md" />
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1">
          <span className="truncate font-semibold">{user.name}</span>
          {user.verified ? <Icon name="shield-check" size={14} className="shrink-0 text-brand" /> : null}
        </span>
        <span className="truncate caption block">@{user.username}</span>
        {subtitle ? <span className="caption block truncate">{subtitle}</span> : null}
      </span>
      {trailing ? <span className="shrink-0">{trailing}</span> : null}
    </>
  );
  if (!onClick) return <div className="list-row">{content}</div>;
  return (
    <button type="button" className="list-row" onClick={onClick}>
      {content}
    </button>
  );
}

export function ExpiryNote({ label, mine, icon = "clock" }: { label: string | null; mine?: boolean; icon?: IconName }) {
  if (!label) return null;
  return (
    <span className={cn("expiry-note", mine && "expiry-note-mine")}>
      <Icon name={icon} size={12} />
      {label}
    </span>
  );
}

export function MomentMedia({
  moment,
  priority,
}: {
  moment: {
    kind: "text" | "photo" | "video";
    mediaUrl: string | null;
    posterUrl?: string | null;
    mediaWidth?: number | null;
    mediaHeight?: number | null;
    body: string;
  };
  priority?: boolean;
}) {
  if (moment.kind === "text" || !moment.mediaUrl) return null;
  const ratio =
    moment.mediaWidth && moment.mediaHeight ? `${moment.mediaWidth} / ${moment.mediaHeight}` : undefined;
  if (moment.kind === "video") {
    return (
      <div className="moment-media" style={ratio ? { aspectRatio: ratio, maxHeight: "70vh" } : undefined}>
        <video
          controls
          playsInline
          preload={priority ? "metadata" : "none"}
          poster={moment.posterUrl ?? undefined}
          style={{ width: "100%", maxHeight: "70vh", objectFit: "cover" }}
        >
          <source src={moment.mediaUrl} />
          {moment.body ? moment.body : "Your browser cannot play this video."}
        </video>
      </div>
    );
  }
  return (
    <div className="moment-media" style={ratio ? { aspectRatio: ratio, maxHeight: "70vh" } : undefined}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={moment.mediaUrl}
        alt={moment.body ? moment.body.slice(0, 120) : "Moment photo"}
        loading={priority ? "eager" : "lazy"}
        decoding="async"
        style={{ width: "100%", maxHeight: "70vh", objectFit: "cover" }}
      />
    </div>
  );
}

export function LoadingRows({ rows = 3 }: { rows?: number }) {
  return (
    <div className="flex flex-col gap-3 p-4" aria-busy="true" aria-live="polite">
      {Array.from({ length: rows }).map((_, index) => (
        <div key={index} className="card card-pad flex flex-col gap-3">
          <div className="flex items-center gap-3">
            <Skeleton className="h-11 w-11 rounded-full" />
            <div className="flex-1">
              <Skeleton className="h-3 w-28" />
              <Skeleton className="mt-2 h-3 w-16" />
            </div>
          </div>
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-4/5" />
          <Skeleton className="h-44 w-full rounded-md" />
        </div>
      ))}
      <span className="sr-only">Loading</span>
    </div>
  );
}

export function InfoBanner({
  tone = "info",
  icon = "info",
  title,
  children,
}: {
  tone?: "info" | "warn" | "danger" | "brand";
  icon?: IconName;
  title?: string;
  children: ReactNode;
}) {
  return (
    <div className={cn("banner", `banner-${tone}`)}>
      <Icon name={icon} size={18} className="mt-0.5 shrink-0" />
      <div className="min-w-0">
        {title ? <p className="font-semibold">{title}</p> : null}
        <div className="body-sm" style={{ color: "inherit" }}>
          {children}
        </div>
      </div>
    </div>
  );
}

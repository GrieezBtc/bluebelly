export function cn(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

export function timeAgo(input: string | Date): string {
  const date = typeof input === "string" ? new Date(input) : input;
  const seconds = Math.max(1, Math.round((Date.now() - date.getTime()) / 1000));
  if (seconds < 60) return "just now";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days}d`;
  const weeks = Math.round(days / 7);
  if (weeks < 5) return `${weeks}w`;
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function formatClock(input: string | Date): string {
  const date = typeof input === "string" ? new Date(input) : input;
  return date.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

export function pluralize(count: number, singular: string, plural = `${singular}s`) {
  return `${count} ${count === 1 ? singular : plural}`;
}

export function compactNumber(value: number): string {
  if (value < 1000) return String(value);
  if (value < 1_000_000) return `${(value / 1000).toFixed(value % 1000 === 0 ? 0 : 1)}K`;
  return `${(value / 1_000_000).toFixed(1)}M`;
}

export function timeLeftLabel(iso: string | null): string | null {
  if (!iso) return null;
  const ms = new Date(iso).getTime() - Date.now();
  if (ms <= 0) return "expired";
  if (ms < 60_000) return `${Math.ceil(ms / 1000)}s left`;
  const totalMinutes = Math.round(ms / 60000);
  if (totalMinutes < 60) return `${totalMinutes}m left`;
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours < 24) return minutes ? `${hours}h ${minutes}m left` : `${hours}h left`;
  const days = Math.floor(hours / 24);
  const restHours = hours % 24;
  return restHours ? `${days}d ${restHours}h left` : `${days}d left`;
}

export const USERNAME_RULES = {
  min: 3,
  max: 20,
  pattern: /^[a-z0-9._]+$/,
  reserved: ["bluebelly", "bemblo", "admin", "support", "help", "root", "system", "team", "official", "security", "moderator", "staff"],
};

export function validateUsername(value: string): { ok: true; value: string } | { ok: false; message: string } {
  const username = value.trim().toLowerCase().replace(/^@/, "");
  if (username.length < USERNAME_RULES.min) return { ok: false, message: `Usernames need at least ${USERNAME_RULES.min} characters.` };
  if (username.length > USERNAME_RULES.max) return { ok: false, message: `Usernames can be up to ${USERNAME_RULES.max} characters.` };
  if (!USERNAME_RULES.pattern.test(username))
    return { ok: false, message: "Use lowercase letters, numbers, dots and underscores only." };
  if (/^[._]|[._]$/.test(username)) return { ok: false, message: "Usernames cannot start or end with a dot or underscore." };
  if (/[._]{2,}/.test(username)) return { ok: false, message: "Avoid repeating dots or underscores." };
  if (USERNAME_RULES.reserved.includes(username)) return { ok: false, message: "That username is reserved to prevent impersonation." };
  return { ok: true, value: username };
}

export function validateEmail(value: string) {
  const email = value.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return { ok: false as const, message: "Enter a valid email address." };
  return { ok: true as const, value: email };
}

export function passwordStrength(value: string): { score: 0 | 1 | 2 | 3 | 4; label: string; message?: string } {
  if (value.length < 8) return { score: 0, label: "Too short", message: "Use at least 8 characters." };
  let score = 1;
  if (value.length >= 12) score += 1;
  if (/[A-Z]/.test(value) && /[a-z]/.test(value)) score += 1;
  if (/\d/.test(value) && /[^A-Za-z0-9]/.test(value)) score += 1;
  const labels = ["Weak", "Fair", "Good", "Strong", "Very strong"] as const;
  return { score: Math.min(score, 4) as 0 | 1 | 2 | 3 | 4, label: labels[Math.min(score, 4)] };
}

export function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

export const ACCENTS = ["violet", "mint", "coral", "amber", "sky", "rose"] as const;
export type Accent = (typeof ACCENTS)[number];

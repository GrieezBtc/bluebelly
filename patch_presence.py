from pathlib import Path
from datetime import datetime
import re
import shutil
import sys

ROOT = Path.cwd()

FILES = {
    "store": ROOT / "src/db/store.ts",
    "types": ROOT / "src/lib/types.ts",
    "providers": ROOT / "src/components/providers.tsx",
    "conversation": ROOT / "src/components/messages/conversation.tsx",
}

ENDPOINT = ROOT / "src/app/api/presence/route.ts"
BACKUP_DIR = ROOT / f".presence-backup-{datetime.now():%Y%m%d-%H%M%S}"

def read_file(path):
    if not path.is_file():
        raise RuntimeError(f"Required file not found: {path.relative_to(ROOT)}")
    return path.read_text(encoding="utf-8")

def replace_once(text, old, new, description):
    count = text.count(old)
    if count != 1:
        raise RuntimeError(
            f"{description}: expected exactly one match, found {count}. "
            "No files have been changed."
        )
    return text.replace(old, new, 1)

def replace_regex_once(text, pattern, replacement, description):
    result, count = re.subn(pattern, replacement, text, count=1, flags=re.S)
    if count != 1:
        raise RuntimeError(
            f"{description}: expected exactly one match, found {count}. "
            "No files have been changed."
        )
    return result

def main():
    contents = {name: read_file(path) for name, path in FILES.items()}

    # Validate all expected insertion points before writing anything.
    store = contents["store"]
    types = contents["types"]
    providers = contents["providers"]
    conversation = contents["conversation"]

    if "lastActiveAt: users.lastActiveAt" in store:
        raise RuntimeError("Store presence field already exists; inspect the file before rerunning.")

    if "lastActiveAt: string;" in types:
        raise RuntimeError("Conversation presence type may already exist; inspect the file.")

    if "api.post(\"/api/presence\")" in providers:
        raise RuntimeError("Heartbeat already exists in providers.tsx.")

    if "function presenceLabel(" in conversation:
        raise RuntimeError("Presence label helper already exists in conversation.tsx.")

    if ENDPOINT.exists():
        raise RuntimeError(f"{ENDPOINT.relative_to(ROOT)} already exists. Not overwriting it.")

    # 1. Add lastActiveAt to the authorized conversation member query.
    store = replace_once(
        store,
        "      lastReadAt: conversationMembers.lastReadAt,",
        "      lastReadAt: conversationMembers.lastReadAt,\n"
        "      lastActiveAt: users.lastActiveAt,",
        "Conversation member query",
    )

    # 2. Add lastActiveAt to the conversation response, not PublicUser.
    store = replace_once(
        store,
        '      members: memberRows.filter((m) => m.state === "active" || m.state === "requested").map((m) => ({ ...toPublicUser(m), role: m.role, state: m.state })),',
        '      members: memberRows.filter((m) => m.state === "active" || m.state === "requested").map((m) => ({ ...toPublicUser(m), role: m.role, state: m.state, lastActiveAt: m.lastActiveAt.toISOString() })),',
        "Conversation member response mapping",
    )
    contents["store"] = store

    # 3. Extend the member type inside ConversationDetail only.
    types = replace_once(
        types,
        'members: (PublicUser & { role: "member" | "admin"; state: MemberState })[];',
        'members: (PublicUser & {\n'
        '      role: "member" | "admin";\n'
        '      state: MemberState;\n'
        '      lastActiveAt: string;\n'
        '    })[];',
        "ConversationDetail member type",
    )
    contents["types"] = types

    # 4. Add app-wide heartbeats while the signed-in app is visible.
    heartbeat = '''
  useEffect(() => {
    if (!user?.id) return;

    let inFlight = false;

    const heartbeat = () => {
      if (
        document.visibilityState !== "visible" ||
        !navigator.onLine ||
        inFlight
      ) {
        return;
      }

      inFlight = true;
      void api
        .post("/api/presence")
        .catch(() => {
          // A failed heartbeat must not interrupt the app.
        })
        .finally(() => {
          inFlight = false;
        });
    };

    heartbeat();

    const interval = window.setInterval(heartbeat, 45_000);
    document.addEventListener("visibilitychange", heartbeat);
    window.addEventListener("online", heartbeat);

    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", heartbeat);
      window.removeEventListener("online", heartbeat);
    };
  }, [user?.id]);

'''
    providers = replace_once(
        providers,
        "  const value = useMemo<SessionContextValue>(",
        heartbeat + "  const value = useMemo<SessionContextValue>(",
        "SessionProvider heartbeat effect",
    )
    contents["providers"] = providers

    # 5. Add a readable presence label and display it beside the direct-chat name.
    helper = '''function presenceLabel(lastActiveAt: string, now: number): string {
  const timestamp = Date.parse(lastActiveAt);
  if (!Number.isFinite(timestamp)) return "Status unavailable";

  const elapsed = Math.max(0, now - timestamp);

  if (elapsed < 2 * 60_000) return "Online";

  const minutes = Math.floor(elapsed / 60_000);
  if (minutes < 60) return `Active ${minutes} min ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `Active ${hours} hr ago`;

  const days = Math.floor(hours / 24);
  return `Active ${days} ${days === 1 ? "day" : "days"} ago`;
}

'''
    conversation = replace_once(
        conversation,
        "export function ConversationView(",
        helper + "export function ConversationView(",
        "Presence label helper insertion",
    )

    conversation = replace_once(
        conversation,
        '<span className="truncate font-semibold">{conversation.title}</span>',
        '''<span className="truncate font-semibold">{conversation.title}</span>
              {conversation.kind === "direct" && otherMember ? (
                <span
                  className="shrink-0 text-xs font-normal opacity-70"
                  aria-label="Account activity"
                >
                  {presenceLabel(otherMember.lastActiveAt, now)}
                </span>
              ) : null}''',
        "Direct conversation header status",
    )
    contents["conversation"] = conversation

    # Create the endpoint content.
    endpoint_content = '''import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { fail, ok } from "@/lib/api";
import { requireVerifiedUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const user = await requireVerifiedUser(request);
    const now = new Date();

    await db
      .update(users)
      .set({ lastActiveAt: now })
      .where(eq(users.id, user.id));

    return ok({ lastActiveAt: now.toISOString() });
  } catch (error) {
    return fail(error);
  }
}
'''

    # All replacements succeeded in memory. Back up original files, then write.
    BACKUP_DIR.mkdir(parents=True, exist_ok=False)
    for name, path in FILES.items():
        backup_path = BACKUP_DIR / path.relative_to(ROOT)
        backup_path.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(path, backup_path)

    try:
        for name, path in FILES.items():
            path.write_text(contents[name], encoding="utf-8")

        ENDPOINT.parent.mkdir(parents=True, exist_ok=True)
        ENDPOINT.write_text(endpoint_content, encoding="utf-8")
    except Exception:
        print("Write failed. Restoring backed-up source files.", file=sys.stderr)
        for name, path in FILES.items():
            backup_path = BACKUP_DIR / path.relative_to(ROOT)
            if backup_path.exists():
                shutil.copy2(backup_path, path)
        if ENDPOINT.exists():
            ENDPOINT.unlink()
        raise

    print("Presence patch applied successfully.")
    print(f"Backups: {BACKUP_DIR.relative_to(ROOT)}")
    print(f"Created: {ENDPOINT.relative_to(ROOT)}")
    print("Modified:")
    for path in FILES.values():
        print(f"  {path.relative_to(ROOT)}")

if __name__ == "__main__":
    try:
        main()
    except Exception as error:
        print(f"PATCH ABORTED: {error}", file=sys.stderr)
        sys.exit(1)

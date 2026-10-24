from pathlib import Path
import sys

changes = {}

def add(file, old, new, count=1):
    changes.setdefault(file, []).append((old, new, count))

# 1. Message types
add(
    "src/db/schema.ts",
    'export type MessageKind = "text" | "voice" | "image" | "video" | "system";',
    'export type MessageKind = "text" | "voice" | "image" | "video" | "document" | "system";',
)
add(
    "src/db/schema.ts",
    'kind: text("kind").$type<"image" | "video" | "audio">().notNull(),',
    'kind: text("kind").$type<"image" | "video" | "audio" | "document">().notNull(),',
)

# 2. Safe media classification. Unknown formats become downloadable documents.
add(
    "src/lib/storage.ts",
    '''export type MediaKind = "image" | "video" | "audio";

export function kindFromMime(mime: string): MediaKind {
  if (mime.startsWith("image/")) return "image";
  if (mime.startsWith("video/")) return "video";
  return "audio";
}''',
    '''export type MediaKind = "image" | "video" | "audio" | "document";

export function kindFromMime(mime: string): MediaKind {
  const type = mime.toLowerCase().split(";")[0].trim();

  const images = new Set([
    "image/jpeg", "image/png", "image/webp", "image/gif",
    "image/avif", "image/heic", "image/heif",
  ]);
  const videos = new Set([
    "video/mp4", "video/webm", "video/quicktime",
    "video/3gpp", "video/3gpp2", "video/x-m4v",
  ]);
  const audio = new Set([
    "audio/webm", "audio/mpeg", "audio/ogg", "audio/mp4",
    "audio/wav", "audio/x-wav", "audio/aac",
    "audio/3gpp", "audio/3gpp2", "audio/flac",
  ]);

  if (images.has(type)) return "image";
  if (videos.has(type)) return "video";
  if (audio.has(type)) return "audio";
  return "document";
}''',
)

# Permit documents only when registering an upload for a message.
add(
    "src/lib/storage.ts",
    '''  durationSec?: number | null;
}) {
  const { pathname } = input;''',
    '''  durationSec?: number | null;
  allowDocuments?: boolean;
}) {
  const { pathname } = input;''',
)
add(
    "src/lib/storage.ts",
    '''  if (meta.size > MAX_UPLOAD_BYTES || !/^(image|video|audio)\\//.test(mimeType)) {
    await blobDel(pathname).catch(() => undefined);
    throw badRequest("Only photos, videos and voice notes up to 25 MB can be uploaded.");
  }''',
    '''  const mediaKind = kindFromMime(mimeType);
  if (meta.size > MAX_UPLOAD_BYTES || (mediaKind === "document" && !input.allowDocuments)) {
    await blobDel(pathname).catch(() => undefined);
    throw badRequest("This file type is only supported in messages, and uploads are limited to 25 MB.");
  }''',
)

# 3. Allow arbitrary file types through the private Blob upload flow.
# The registration route validates the scope and file size.
add(
    "src/app/api/upload/blob/route.ts",
    '          allowedContentTypes: ["image/*", "video/*", "audio/*"],\n',
    "",
)

# 4. Local and Blob registration paths must both support message attachments.
add(
    "src/app/api/upload/route.ts",
    '''        pathname: body.pathname,
        expiresInMs: body.scope === "message" ? MESSAGE_TTL_MS : null,''',
    '''        pathname: body.pathname,
        allowDocuments: body.scope === "message",
        expiresInMs: body.scope === "message" ? MESSAGE_TTL_MS : null,''',
)
add(
    "src/app/api/upload/route.ts",
    '''    const mimeType = file.type || "application/octet-stream";
    if (!/^(image|video|audio)\\//.test(mimeType)) throw badRequest("Only photos, videos and voice notes can be uploaded.");

    const scope = String(form.get("scope") ?? "moment");''',
    '''    const mimeType = file.type || "application/octet-stream";
    const scope = String(form.get("scope") ?? "moment");
    if (kindFromMime(mimeType) === "document" && scope !== "message") {
      throw badRequest("Documents can only be uploaded in messages.");
    }''',
)

# 5. Let the conversation API accept document messages.
add(
    "src/app/api/conversations/[id]/route.ts",
    '(["text", "voice", "image", "video"] as MessageView["kind"][])',
    '(["text", "voice", "image", "video", "document"] as MessageView["kind"][])',
)

# 6. Documents must download, not render inline as active content.
add(
    "src/app/api/media/route.ts",
    '"Content-Disposition": "inline",',
    '"Content-Disposition": storedAsset.kind === "document" ? "attachment" : "inline",',
)

# 7. Attachment picker UI.
add(
    "src/components/messages/conversation.tsx",
    '  const [optionsOpen, setOptionsOpen] = useState(false);',
    '''  const [optionsOpen, setOptionsOpen] = useState(false);
  const [attachmentMenuOpen, setAttachmentMenuOpen] = useState(false);''',
)
add(
    "src/components/messages/conversation.tsx",
    '''  const bottomRef = useRef<HTMLDivElement>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);''',
    '''  const bottomRef = useRef<HTMLDivElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const photosInputRef = useRef<HTMLInputElement>(null);
  const filesInputRef = useRef<HTMLInputElement>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);''',
)
add(
    "src/components/messages/conversation.tsx",
    '      await send(uploaded.kind === "video" ? "video" : "image", "", uploaded.url);',
    '''      const kind =
        uploaded.kind === "document" ? "document" :
        uploaded.kind === "video" ? "video" :
        uploaded.kind === "audio" ? "voice" : "image";
      await send(kind, kind === "document" ? file.name : "", uploaded.url);''',
)
add(
    "src/components/messages/conversation.tsx",
    '''        <label
          className={cn("btn-icon", groupSendBlocked && "pointer-events-none opacity-50")}
          aria-label="Attach a photo or video"
        >
          {uploading ? <Spinner /> : <Icon name="image" size={22} />}
          <input
            type="file"
            accept="image/*,video/*"
            className="sr-only"
            disabled={groupSendBlocked}
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void uploadAndSend(file);
            }}
          />
        </label>''',
    '''        <div className="relative shrink-0">
          <button
            type="button"
            className={cn("btn-icon", groupSendBlocked && "pointer-events-none opacity-50")}
            aria-label="Attachment options"
            aria-expanded={attachmentMenuOpen}
            disabled={groupSendBlocked || uploading}
            onClick={() => setAttachmentMenuOpen((open) => !open)}
          >
            {uploading ? <Spinner /> : <Icon name="plus" size={22} />}
          </button>

          {attachmentMenuOpen ? (
            <div className="absolute bottom-full left-0 z-30 mb-2 flex min-w-40 flex-col rounded-md border border-line bg-surface p-1 shadow-lg">
              <button
                type="button"
                className="list-row rounded-md"
                onClick={() => {
                  setAttachmentMenuOpen(false);
                  cameraInputRef.current?.click();
                }}
              >
                <Icon name="camera" size={19} />
                <span className="flex-1 text-left text-sm font-semibold">Camera</span>
              </button>
              <button
                type="button"
                className="list-row rounded-md"
                onClick={() => {
                  setAttachmentMenuOpen(false);
                  photosInputRef.current?.click();
                }}
              >
                <Icon name="image" size={19} />
                <span className="flex-1 text-left text-sm font-semibold">Photos</span>
              </button>
              <button
                type="button"
                className="list-row rounded-md"
                onClick={() => {
                  setAttachmentMenuOpen(false);
                  filesInputRef.current?.click();
                }}
              >
                <Icon name="link" size={19} />
                <span className="flex-1 text-left text-sm font-semibold">Files</span>
              </button>
            </div>
          ) : null}

          <input
            ref={cameraInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="sr-only"
            disabled={groupSendBlocked || uploading}
            onChange={(event) => {
              const file = event.currentTarget.files?.[0];
              event.currentTarget.value = "";
              if (file) void uploadAndSend(file);
            }}
          />
          <input
            ref={photosInputRef}
            type="file"
            accept="image/*,video/*"
            className="sr-only"
            disabled={groupSendBlocked || uploading}
            onChange={(event) => {
              const file = event.currentTarget.files?.[0];
              event.currentTarget.value = "";
              if (file) void uploadAndSend(file);
            }}
          />
          <input
            ref={filesInputRef}
            type="file"
            className="sr-only"
            disabled={groupSendBlocked || uploading}
            onChange={(event) => {
              const file = event.currentTarget.files?.[0];
              event.currentTarget.value = "";
              if (file) void uploadAndSend(file);
            }}
          />
        </div>''',
)
add(
    "src/components/messages/conversation.tsx",
    '''        <div className="bubble-meta">''',
    '''        {message.kind === "document" && message.mediaUrl ? (
          <a
            href={message.mediaUrl}
            download={message.body || "attachment"}
            className="flex max-w-xs flex-col gap-1 rounded-md border border-current/20 px-3 py-2 underline"
          >
            <span className="break-all text-sm font-semibold">
              {message.body || "Download attachment"}
            </span>
            <span className="text-xs opacity-70">Download file</span>
          </a>
        ) : null}

        <div className="bubble-meta">''',
)
add(
    "src/components/messages/conversation.tsx",
    '''{replyingTo.kind === "text" ? replyingTo.body : replyingTo.kind === "voice" ? "Voice message" : replyingTo.kind === "image" ? "Photo" : "Video"}''',
    '''{replyingTo.kind === "text" ? replyingTo.body : replyingTo.kind === "voice" ? "Voice message" : replyingTo.kind === "image" ? "Photo" : replyingTo.kind === "document" ? (replyingTo.body || "File") : "Video"}''',
)

# Validate every replacement before writing any file.
loaded = {}
planned = {}
errors = []

for filename, operations in changes.items():
    path = Path(filename)
    if not path.is_file():
        errors.append(f"Missing file: {filename}")
        continue

    original = path.read_text()
    content = original

    for old, new, expected in operations:
        actual = content.count(old)
        if actual != expected:
            errors.append(
                f"{filename}: expected {expected} occurrence(s), found {actual} "
                f"for snippet: {old[:90]!r}"
            )
        else:
            content = content.replace(old, new, expected)

    loaded[filename] = original
    planned[filename] = content

if errors:
    print("PATCH ABORTED. No files have been changed.")
    for error in errors:
        print(" -", error)
    sys.exit(1)

# Back up all originals first, then write the prepared changes.
for filename, original in loaded.items():
    backup = Path(filename + ".attachments.bak")
    if backup.exists():
        print(f"PATCH ABORTED: backup already exists: {backup}")
        print("No files have been changed. Move or rename that backup first.")
        sys.exit(1)
    backup.write_text(original)

try:
    for filename, content in planned.items():
        Path(filename).write_text(content)
except Exception as exc:
    for filename, original in loaded.items():
        Path(filename).write_text(original)
    print("PATCH FAILED. Original source files have been restored.")
    print(exc)
    sys.exit(1)

print("PATCH APPLIED.")
print("Backups: *.attachments.bak")
print("Next: run the project typecheck and build before testing uploads.")

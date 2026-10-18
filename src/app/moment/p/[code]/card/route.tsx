import { ImageResponse } from "next/og";
import { getMomentByShareCode } from "@/db/store";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ code: string }> };

/** GET /moment/p/:code/card — 1200x630 link-preview card for public Moments without a photo. */
export async function GET(_request: Request, { params }: Ctx) {
  const { code } = await params;
  const found = await getMomentByShareCode(null, code);
  const moment = found?.moment ?? null;

  const raw = moment?.body?.replace(/\s+/g, " ").trim() ?? "";
  const text = raw.length > 220 ? `${raw.slice(0, 219).trimEnd()}…` : raw;
  const headline = moment
    ? text || (moment.kind === "video" ? "Shared a video" : "Shared a Moment")
    : "Talk. Share. Connect.";

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: 56,
          background: "linear-gradient(135deg, #6C4BF7 0%, #9a5cff 100%)",
          color: "#171329",
        }}
      >
        <div style={{ display: "flex", color: "#ffffff", fontSize: 40, fontWeight: 800 }}>bemblo</div>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            background: "#ffffff",
            borderRadius: 36,
            padding: 48,
            gap: 24,
          }}
        >
          {moment ? (
            <div style={{ display: "flex", flexDirection: "column" }}>
              <div style={{ display: "flex", fontSize: 36, fontWeight: 700 }}>{moment.author.name}</div>
              <div style={{ display: "flex", fontSize: 28, color: "#6d6680" }}>@{moment.author.username}</div>
            </div>
          ) : null}
          <div style={{ display: "flex", fontSize: text.length > 120 ? 36 : 48, lineHeight: 1.3 }}>{headline}</div>
        </div>
        <div style={{ display: "flex", color: "#ffffff", fontSize: 28 }}>Bemblo — Talk. Share. Connect.</div>
      </div>
    ),
    { width: 1200, height: 630, headers: { "Cache-Control": "public, max-age=300, s-maxage=300" } },
  );
}

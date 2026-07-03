import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getOrCreateSessionId } from "@/lib/session";

export const dynamic = "force-dynamic";

const ALLOWED_CHANNELS = ["copy", "native", "twitter", "linkedin", "facebook", "reddit", "email"];

/**
 * POST /api/share
 * body: { articleId: string, channel: string }
 * Records a share event (analytics only). Degrades gracefully when the DB is
 * unavailable (Vercel) — returns success without persisting.
 */
export async function POST(req: Request) {
  try {
    const sessionId = await getOrCreateSessionId();
    const { articleId, channel } = await req.json();
    if (!articleId) {
      return NextResponse.json({ success: false, error: "articleId required" }, { status: 400 });
    }
    const safeChannel = ALLOWED_CHANNELS.includes(channel) ? channel : "copy";
    try {
      await db.shareEvent.create({
        data: { sessionId, articleKey: articleId, channel: safeChannel },
      });
    } catch {
      // DB unavailable (Vercel read-only FS) — analytics only, ignore.
    }
    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("[api/share] error:", err);
    return NextResponse.json(
      { success: false, error: err?.message || "Server error" },
      { status: 500 },
    );
  }
}

import { NextResponse } from "next/server";
import { summarizeArticle } from "@/lib/ai";

export const dynamic = "force-dynamic";

/**
 * POST /api/news/summarize
 * body: { articleId: string }
 * Returns AI summary + tags (lazy-populated on the article).
 */
export async function POST(req: Request) {
  try {
    const { articleId } = await req.json();
    if (!articleId || typeof articleId !== "string") {
      return NextResponse.json({ success: false, error: "articleId required" }, { status: 400 });
    }
    const result = await summarizeArticle(articleId);
    if (!result) {
      return NextResponse.json({ success: false, error: "Could not summarize" }, { status: 502 });
    }
    return NextResponse.json({ success: true, ...result });
  } catch (err: any) {
    console.error("[api/news/summarize] error:", err);
    return NextResponse.json(
      { success: false, error: err?.message || "Server error" },
      { status: 500 },
    );
  }
}

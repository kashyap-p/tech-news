import { NextResponse } from "next/server";
import { summarizeArticle, ArticleInput } from "@/lib/ai";

export const dynamic = "force-dynamic";

/**
 * POST /api/news/summarize
 * body: { articleId, title, description?, url, source?, author?, publishedAt? }
 * Returns AI summary + tags (lazy-populated on the article when DB available).
 * Works with or without a DB — the article data comes from the client.
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const input: ArticleInput = {
      articleId: body.articleId,
      title: body.title,
      description: body.description,
      url: body.url,
      source: body.source,
      author: body.author,
      publishedAt: body.publishedAt,
    };
    if (!input.articleId || !input.url || !input.title) {
      return NextResponse.json(
        { success: false, error: "articleId, title, and url are required" },
        { status: 400 },
      );
    }
    const result = await summarizeArticle(input);
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

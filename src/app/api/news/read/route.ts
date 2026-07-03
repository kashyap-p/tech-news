import { NextResponse } from "next/server";
import { extractArticleContent } from "@/lib/ai";

export const dynamic = "force-dynamic";

/**
 * POST /api/news/read
 * body: { articleId: string }
 * Returns extracted readable HTML content for the in-app reader.
 */
export async function POST(req: Request) {
  try {
    const { articleId, force } = await req.json();
    if (!articleId || typeof articleId !== "string") {
      return NextResponse.json({ success: false, error: "articleId required" }, { status: 400 });
    }
    const { content, article } = await extractArticleContent(articleId, force === true);
    if (!article) {
      return NextResponse.json({ success: false, error: "Article not found" }, { status: 404 });
    }
    return NextResponse.json({
      success: true,
      article: {
        id: article.id,
        title: article.title,
        url: article.url,
        source: article.source,
        author: article.author,
        publishedAt: article.publishedAt,
      },
      content,
    });
  } catch (err: any) {
    console.error("[api/news/read] error:", err);
    return NextResponse.json(
      { success: false, error: err?.message || "Server error" },
      { status: 500 },
    );
  }
}

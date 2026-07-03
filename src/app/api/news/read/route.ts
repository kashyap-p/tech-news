import { NextResponse } from "next/server";
import { extractArticleContent, ArticleInput } from "@/lib/ai";

export const dynamic = "force-dynamic";

/**
 * POST /api/news/read
 * body: { articleId, title, description?, url, source?, author?, publishedAt?, force? }
 * Returns extracted readable HTML content for the in-app reader.
 * Works with or without a DB — the article data comes from the client.
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { force, ...rest } = body;
    const input: ArticleInput = {
      articleId: rest.articleId,
      title: rest.title,
      description: rest.description,
      url: rest.url,
      source: rest.source,
      author: rest.author,
      publishedAt: rest.publishedAt,
    };
    if (!input.articleId || !input.url || !input.title) {
      return NextResponse.json(
        { success: false, error: "articleId, title, and url are required" },
        { status: 400 },
      );
    }
    const { content, article } = await extractArticleContent(input, force === true);
    return NextResponse.json({
      success: true,
      article,
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

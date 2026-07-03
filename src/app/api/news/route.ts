import { NextResponse } from "next/server";
import { fetchAllNews } from "@/lib/news";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * GET /api/news?force=1
 * Returns aggregated tech + AI news from Dev.to, Hacker News, and live web search.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const force = url.searchParams.get("force") === "1";
  try {
    const result = await fetchAllNews(force);
    return NextResponse.json({
      success: true,
      articles: result.articles,
      sources: result.sources,
      fetchedAt: result.fetchedAt,
      count: result.articles.length,
    });
  } catch (err: any) {
    console.error("[api/news] error:", err);
    return NextResponse.json(
      { success: false, error: err?.message || "Failed to fetch news" },
      { status: 500 },
    );
  }
}

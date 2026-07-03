import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { fetchAllNews } from "@/lib/news";

export const dynamic = "force-dynamic";

/**
 * GET /api/trending
 * Returns top tags across recent articles + the hottest articles.
 * Degrades gracefully: when the DB is unavailable (Vercel), builds trending
 * data from the in-memory news cache instead.
 */
export async function GET() {
  let tags: { tag: string; count: number }[] = [];
  let hottest: { id: string; title: string; source: string; url: string; points: number; publishedAt: string | null }[] = [];

  // Try the DB first (when available).
  let dbOk = false;
  try {
    await db.$queryRaw`SELECT 1`;
    dbOk = true;
  } catch {
    dbOk = false;
  }

  if (dbOk) {
    try {
      const recent = await db.article.findMany({
        where: { aiTags: { not: null } },
        orderBy: { publishedAt: "desc" },
        take: 60,
        select: { aiTags: true },
      });
      const tagCounts = new Map<string, number>();
      for (const r of recent) {
        if (!r.aiTags) continue;
        for (const t of r.aiTags.split(",")) {
          const tag = t.trim().toLowerCase();
          if (!tag) continue;
          tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
        }
      }
      tags = Array.from(tagCounts.entries())
        .map(([tag, count]) => ({ tag, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 12);

      hottest = await db.article.findMany({
        orderBy: { points: "desc" },
        take: 5,
        select: { id: true, title: true, source: true, url: true, points: true, publishedAt: true },
      });
      return NextResponse.json({ success: true, tags, hottest });
    } catch (err) {
      console.error("[api/trending] db error, using cache:", err);
    }
  }

  // Fallback: build from the in-memory news cache.
  try {
    const { articles } = await fetchAllNews(false);
    // No AI tags in the cache (those require the DB), so derive simple tags
    // from category + source for the trending widget.
    const tagCounts = new Map<string, number>();
    for (const a of articles) {
      const t = (a.category || a.source || "").toLowerCase();
      if (t) tagCounts.set(t, (tagCounts.get(t) || 0) + 1);
    }
    tags = Array.from(tagCounts.entries())
      .map(([tag, count]) => ({ tag, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);
    hottest = articles
      .slice()
      .sort((a, b) => b.points - a.points)
      .slice(0, 5)
      .map((a) => ({
        id: a.id,
        title: a.title,
        source: a.source,
        url: a.url,
        points: a.points,
        publishedAt: a.publishedAt,
      }));
  } catch {
    // ignore
  }
  return NextResponse.json({ success: true, tags, hottest });
}

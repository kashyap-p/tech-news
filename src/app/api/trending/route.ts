import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * GET /api/trending
 * Returns the top tags across recent articles (by frequency of AI tags) plus
 * the hottest articles by points. Lightweight "trending now" widget data.
 */
export async function GET() {
  const recent = await db.article.findMany({
    where: { aiTags: { not: null } },
    orderBy: { publishedAt: "desc" },
    take: 60,
    select: { aiTags: true, title: true, source: true, points: true, publishedAt: true },
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
  const tags = Array.from(tagCounts.entries())
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 12);

  const hottest = await db.article.findMany({
    orderBy: { points: "desc" },
    take: 5,
    select: {
      id: true,
      title: true,
      source: true,
      url: true,
      points: true,
      publishedAt: true,
    },
  });

  return NextResponse.json({ success: true, tags, hottest });
}

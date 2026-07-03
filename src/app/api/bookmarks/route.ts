import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getOrCreateSessionId } from "@/lib/session";

export const dynamic = "force-dynamic";

/**
 * GET  /api/bookmarks          — list bookmarks for this session
 * POST /api/bookmarks          { articleId } — add bookmark
 * DELETE /api/bookmarks?id=... — remove bookmark
 */
export async function GET() {
  const sessionId = await getOrCreateSessionId();
  const rows = await db.bookmark.findMany({
    where: { sessionId },
    include: { article: true },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json({
    success: true,
    sessionId,
    bookmarks: rows.map((b) => ({
      id: b.id,
      createdAt: b.createdAt,
      article: {
        id: b.article.id,
        source: b.article.source,
        sourceId: b.article.sourceId,
        category: b.article.category,
        title: b.article.title,
        description: b.article.description,
        url: b.article.url,
        image: b.article.image,
        author: b.article.author,
        publishedAt: b.article.publishedAt,
        aiSummary: b.article.aiSummary,
        aiTags: b.article.aiTags,
        points: b.article.points,
      },
    })),
  });
}

export async function POST(req: Request) {
  try {
    const sessionId = await getOrCreateSessionId();
    const { articleId } = await req.json();
    if (!articleId) {
      return NextResponse.json({ success: false, error: "articleId required" }, { status: 400 });
    }
    const bookmark = await db.bookmark.upsert({
      where: { sessionId_articleId: { sessionId, articleId } },
      create: { sessionId, articleId },
      update: {},
    });
    return NextResponse.json({ success: true, bookmark });
  } catch (err: any) {
    console.error("[api/bookmarks POST] error:", err);
    return NextResponse.json(
      { success: false, error: err?.message || "Server error" },
      { status: 500 },
    );
  }
}

export async function DELETE(req: Request) {
  try {
    const sessionId = await getOrCreateSessionId();
    const url = new URL(req.url);
    const articleId = url.searchParams.get("id");
    if (!articleId) {
      return NextResponse.json({ success: false, error: "id required" }, { status: 400 });
    }
    await db.bookmark.deleteMany({ where: { sessionId, articleId } });
    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("[api/bookmarks DELETE] error:", err);
    return NextResponse.json(
      { success: false, error: err?.message || "Server error" },
      { status: 500 },
    );
  }
}

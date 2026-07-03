import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getOrCreateSessionId } from "@/lib/session";
import { ArticleDTO } from "@/lib/types";

export const dynamic = "force-dynamic";

/** In-memory bookmark fallback for when the DB is unavailable (Vercel). */
const memoryBookmarks = new Map<string, ArticleDTO[]>();

async function isDbAvailable(): Promise<boolean> {
  try {
    await db.$queryRaw`SELECT 1`;
    return true;
  } catch {
    return false;
  }
}

/**
 * GET  /api/bookmarks          — list bookmarks for this session
 * POST /api/bookmarks          { article: ArticleDTO } — add bookmark
 * DELETE /api/bookmarks?id=... — remove bookmark by article id
 *
 * Self-contained: stores the full article snapshot so it works even when the
 * Article table is unavailable (Vercel read-only filesystem). Falls back to
 * an in-memory store when the DB is down (per server instance, non-persistent).
 */
export async function GET() {
  const sessionId = await getOrCreateSessionId();
  const dbOk = await isDbAvailable();
  if (dbOk) {
    try {
      const rows = await db.bookmark.findMany({
        where: { sessionId },
        orderBy: { createdAt: "desc" },
      });
      const bookmarks = rows
        .map((r) => {
          try {
            return JSON.parse(r.data) as ArticleDTO;
          } catch {
            return null;
          }
        })
        .filter((b): b is ArticleDTO => b !== null);
      return NextResponse.json({ success: true, sessionId, bookmarks });
    } catch (err) {
      console.error("[api/bookmarks GET] db error, using memory:", err);
    }
  }
  return NextResponse.json({
    success: true,
    sessionId,
    bookmarks: memoryBookmarks.get(sessionId) || [],
  });
}

export async function POST(req: Request) {
  try {
    const sessionId = await getOrCreateSessionId();
    const { article } = await req.json();
    if (!article || !article.id) {
      return NextResponse.json({ success: false, error: "article required" }, { status: 400 });
    }
    const dbOk = await isDbAvailable();
    if (dbOk) {
      try {
        await db.bookmark.upsert({
          where: { sessionId_articleKey: { sessionId, articleKey: article.id } },
          create: {
            sessionId,
            articleKey: article.id,
            data: JSON.stringify(article),
          },
          update: { data: JSON.stringify(article) },
        });
        return NextResponse.json({ success: true });
      } catch (err) {
        console.error("[api/bookmarks POST] db error, using memory:", err);
      }
    }
    // In-memory fallback
    const arr = memoryBookmarks.get(sessionId) || [];
    const idx = arr.findIndex((a) => a.id === article.id);
    if (idx === -1) arr.unshift(article);
    memoryBookmarks.set(sessionId, arr);
    return NextResponse.json({ success: true });
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
    const dbOk = await isDbAvailable();
    if (dbOk) {
      try {
        await db.bookmark.deleteMany({
          where: { sessionId, articleKey: articleId },
        });
        return NextResponse.json({ success: true });
      } catch (err) {
        console.error("[api/bookmarks DELETE] db error, using memory:", err);
      }
    }
    // In-memory fallback
    const arr = memoryBookmarks.get(sessionId) || [];
    memoryBookmarks.set(
      sessionId,
      arr.filter((a) => a.id !== articleId),
    );
    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("[api/bookmarks DELETE] error:", err);
    return NextResponse.json(
      { success: false, error: err?.message || "Server error" },
      { status: 500 },
    );
  }
}

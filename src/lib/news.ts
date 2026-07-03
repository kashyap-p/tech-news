import { db } from "@/lib/db";

/**
 * News fetching service.
 *
 * Aggregates tech + AI news from multiple sources worldwide:
 *  - Dev.to API (developer-written articles across many tags)
 *  - Hacker News (Algolia search API — far cheaper than 40 concurrent firebase calls)
 *  - z-ai-web-dev-sdk `web_search` for live worldwide AI & tech news
 *
 * All fetching happens server-side (no CORS, no client API exposure).
 * Results are normalised into a single Article shape, persisted to the DB
 * (upsert by sourceId) and cached in-memory for a short TTL.
 */

export type NewsSource = "devto" | "hackernews" | "web";

export interface RawArticle {
  source: NewsSource;
  sourceId: string;
  title: string;
  description: string;
  url: string;
  image?: string | null;
  author?: string | null;
  publishedAt?: string | null;
  points?: number;
  /** Category hint used when persisting (e.g. "ai", "tech", "devto", "hackernews"). */
  category?: string;
}

export interface ArticleDTO {
  id: string;
  source: NewsSource;
  sourceId: string;
  category: string;
  title: string;
  description: string;
  url: string;
  image: string | null;
  author: string | null;
  publishedAt: string | null;
  aiSummary: string | null;
  aiTags: string | null;
  points: number;
  createdAt: string;
}

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
let cache: { ts: number; data: ArticleDTO[] } | null = null;

function sha8(input: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, "0");
}

async function fetchWithTimeout(url: string, timeoutMs = 10000, init?: RequestInit) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...init, signal: ctrl.signal });
    if (!res.ok) throw new Error(`${url} returned ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(t);
  }
}

// ---------------------------------------------------------------------------
// Dev.to
// ---------------------------------------------------------------------------
const DEVTO_TAGS = [
  "tech",
  "programming",
  "webdev",
  "javascript",
  "python",
  "ai",
  "machinelearning",
  "opensource",
  "react",
  "devops",
  "security",
  "cloud",
  "database",
];

async function fetchDevTo(): Promise<RawArticle[]> {
  const results = await Promise.allSettled(
    DEVTO_TAGS.map((tag) =>
      fetchWithTimeout(`https://dev.to/api/articles?tag=${tag}&per_page=6`, 9000).catch(() => null),
    ),
  );
  const seen = new Set<number>();
  const articles: RawArticle[] = [];
  for (const r of results) {
    if (r.status !== "fulfilled" || !Array.isArray(r.value)) continue;
    for (const item of r.value) {
      if (!item?.id || seen.has(item.id)) continue;
      seen.add(item.id);
      const tag = item.tag_list?.includes("ai") || item.tag_list?.includes("machinelearning")
        ? "ai"
        : "devto";
      articles.push({
        source: "devto",
        sourceId: `devto:${item.id}`,
        title: item.title ?? "",
        description: item.description ?? "",
        url: item.url ?? "",
        image: item.cover_image || item.social_image || null,
        author: item.user?.name ?? null,
        publishedAt: item.published_at ?? null,
        points: item.public_reactions_count ?? 0,
        category: tag,
      });
    }
  }
  return articles;
}

// ---------------------------------------------------------------------------
// Hacker News (Algolia — single request, much cheaper than 40 firebase calls)
// ---------------------------------------------------------------------------
async function fetchHackerNews(): Promise<RawArticle[]> {
  const data = await fetchWithTimeout(
    "https://hn.algolia.com/api/v1/search_by_date?tags=story&query=technology&hitsPerPage=30",
    9000,
  );
  const hits: any[] = data.hits || [];
  return hits
    .filter((h) => h.title && h.url)
    .map((h) => ({
      source: "hackernews" as const,
      sourceId: `hn:${h.objectID}`,
      title: h.title,
      description: `${h.points ?? 0} points · ${h.num_comments ?? 0} comments`,
      url: h.url,
      image: null,
      author: h.author ?? null,
      publishedAt: h.created_at ?? null,
      points: h.points ?? 0,
      category: "hackernews",
    }));
}

// ---------------------------------------------------------------------------
// Worldwide AI / Tech news via z-ai web search
// ---------------------------------------------------------------------------
async function fetchWebNewsAI(): Promise<RawArticle[]> {
  return fetchWebNews("artificial intelligence news", "ai");
}

async function fetchWebNewsTech(): Promise<RawArticle[]> {
  return fetchWebNews("latest technology news", "tech");
}

async function fetchWebNews(query: string, category: string): Promise<RawArticle[]> {
  try {
    const ZAI = (await import("z-ai-web-dev-sdk")).default;
    const zai = await ZAI.create();
    const results: any[] = await zai.functions.invoke("web_search", {
      query,
      num: 15,
      recency_days: 3,
    });
    if (!Array.isArray(results)) return [];
    return results
      .filter((r) => r?.url && r?.name)
      .map((r) => ({
        source: "web" as const,
        sourceId: `web:${sha8(r.url)}`,
        title: r.name,
        description: r.snippet ?? "",
        url: r.url,
        image: null,
        author: r.host_name ?? null,
        publishedAt: r.date || null,
        points: 0,
        category,
      }));
  } catch (err) {
    console.error("[news] web_search failed:", err);
    return [];
  }
}

// ---------------------------------------------------------------------------
// Persist + normalise
// ---------------------------------------------------------------------------
async function persist(raw: RawArticle[]): Promise<ArticleDTO[]> {
  const dtos: ArticleDTO[] = [];
  for (const r of raw) {
    if (!r.title || !r.url) continue;
    const category: string = r.category || r.source;
    const pub = r.publishedAt ? new Date(r.publishedAt) : null;
    const pubValid = pub && !isNaN(pub.getTime()) ? pub : null;
    try {
      const article = await db.article.upsert({
        where: { sourceId: r.sourceId },
        create: {
          sourceId: r.sourceId,
          source: r.source,
          category,
          title: r.title.slice(0, 500),
          description: (r.description || "").slice(0, 1000),
          url: r.url,
          image: r.image || null,
          author: r.author || null,
          publishedAt: pubValid,
          points: r.points ?? 0,
        },
        update: {
          // refresh mutable fields but keep AI-generated content
          description: (r.description || "").slice(0, 1000),
          image: r.image || null,
          points: r.points ?? 0,
          publishedAt: pubValid ?? undefined,
        },
      });
      dtos.push(toDTO(article));
    } catch (e) {
      // skip on error (e.g. invalid date) — don't fail the whole batch
    }
  }
  return dtos;
}

function toDTO(a: any): ArticleDTO {
  return {
    id: a.id,
    source: a.source,
    sourceId: a.sourceId,
    category: a.category,
    title: a.title,
    description: a.description,
    url: a.url,
    image: a.image,
    author: a.author,
    publishedAt: a.publishedAt ? new Date(a.publishedAt).toISOString() : null,
    aiSummary: a.aiSummary,
    aiTags: a.aiTags,
    points: a.points,
    createdAt: new Date(a.createdAt).toISOString(),
  };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------
export async function fetchAllNews(force = false): Promise<{
  articles: ArticleDTO[];
  sources: string[];
  fetchedAt: string;
}> {
  if (!force && cache && Date.now() - cache.ts < CACHE_TTL_MS) {
    return {
      articles: cache.data,
      sources: ["devto", "hackernews", "web"],
      fetchedAt: new Date(cache.ts).toISOString(),
    };
  }

  const [devto, hn, webAI, webTech] = await Promise.all([
    fetchDevTo(),
    fetchHackerNews(),
    fetchWebNewsAI(),
    fetchWebNewsTech(),
  ]);

  const raw = [...devto, ...hn, ...webAI, ...webTech];
  let articles = await persist(raw);

  // de-dup by url (web search may overlap) keeping highest-points / newest
  const byUrl = new Map<string, ArticleDTO>();
  for (const a of articles) {
    const existing = byUrl.get(a.url);
    if (!existing) {
      byUrl.set(a.url, a);
    } else {
      const aTime = a.publishedAt ? new Date(a.publishedAt).getTime() : 0;
      const eTime = existing.publishedAt ? new Date(existing.publishedAt).getTime() : 0;
      if (a.points > existing.points || aTime > eTime) byUrl.set(a.url, a);
    }
  }
  articles = Array.from(byUrl.values()).sort((a, b) => {
    const at = a.publishedAt ? new Date(a.publishedAt).getTime() : 0;
    const bt = b.publishedAt ? new Date(b.publishedAt).getTime() : 0;
    return bt - at;
  });

  cache = { ts: Date.now(), data: articles };
  return {
    articles,
    sources: ["devto", "hackernews", "web"],
    fetchedAt: new Date().toISOString(),
  };
}

export async function getArticleById(id: string) {
  const a = await db.article.findUnique({ where: { id } });
  return a ? toDTO(a) : null;
}

export async function getArticleBySourceId(sourceId: string) {
  const a = await db.article.findUnique({ where: { sourceId } });
  return a ? toDTO(a) : null;
}

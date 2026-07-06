import { db } from "@/lib/db";
import { createAIClient, fetchAllNews } from "@/lib/news";

/**
 * AI service (backend only — the AI SDK must never run client-side).
 *
 * Provides:
 *  - summarizeArticle(): concise bullet summary + tags for an article
 *  - extractArticleContent(): pull clean readable HTML via page_reader
 *  - chatAboutNews(): multi-turn assistant grounded on the latest articles
 *
 * All helpers are defensive: they degrade gracefully if the SDK, network, OR
 * the database fails (e.g. on a read-only serverless filesystem). AI features
 * work as long as the AI env vars are set; the DB is an optional cache.
 */

/** Check if the DB is available (best-effort). */
async function isDbAvailable(): Promise<boolean> {
  try {
    await db.$queryRaw`SELECT 1`;
    return true;
  } catch {
    return false;
  }
}

/** The article data passed from the frontend — works with or without a DB. */
export interface ArticleInput {
  articleId: string; // sourceId, used as the DB key when available
  title: string;
  description?: string;
  url: string;
  source?: string;
  author?: string | null;
  publishedAt?: string | null;
}

export interface ArticleSummary {
  summary: string;
  tags: string[];
}

const SYSTEM_SUMMARIZER =
  "You are TechBrief, an expert tech-news analyst. Given an article title and description, produce a concise, neutral summary in 3-4 bullet points and 3-5 short tags. Respond ONLY with valid JSON of shape {\"summary\": string (markdown bullets), \"tags\": string[]}. Do not add commentary outside the JSON.";

export async function summarizeArticle(input: ArticleInput): Promise<ArticleSummary | null> {
  const { articleId, title, description, url } = input;
  if (!title || !url) return null;

  // Check the DB cache first (best-effort).
  const dbOk = await isDbAvailable();
  if (dbOk) {
    try {
      const cached = await db.article.findUnique({
        where: { sourceId: articleId },
        select: { aiSummary: true, aiTags: true },
      });
      if (cached?.aiSummary && cached?.aiTags) {
        return {
          summary: cached.aiSummary,
          tags: cached.aiTags.split(",").map((t) => t.trim()).filter(Boolean),
        };
      }
    } catch {
      // ignore
    }
  }

  try {
    const ai = await createAIClient();
    const completion = await ai.chat.completions.create({
      messages: [
        { role: "assistant", content: SYSTEM_SUMMARIZER },
        {
          role: "user",
          content: `Title: ${title}\n\nDescription: ${description || "(no description provided)"}\n\nSource: ${url}`,
        },
      ],
      thinking: { type: "disabled" },
    });
    const raw = completion.choices[0]?.message?.content || "";
    const json = extractJson(raw);
    if (!json) return null;
    const summary: string = (json.summary || "").toString().slice(0, 1200);
    const tags: string[] = Array.isArray(json.tags)
      ? json.tags.map((t: any) => String(t)).slice(0, 6)
      : [];

    // Cache to DB (best-effort).
    if (dbOk) {
      try {
        // Upsert the article first (in case it doesn't exist yet), then set the summary.
        await db.article.upsert({
          where: { sourceId: articleId },
          create: {
            sourceId: articleId,
            source: input.source || "web",
            category: input.source || "web",
            title: title.slice(0, 500),
            description: (description || "").slice(0, 1000),
            url,
            author: input.author || null,
            publishedAt: input.publishedAt ? new Date(input.publishedAt) : null,
            points: 0,
            aiSummary: summary,
            aiTags: tags.join(","),
          },
          update: { aiSummary: summary, aiTags: tags.join(",") },
        });
      } catch {
        // ignore
      }
    }
    return { summary, tags };
  } catch (err) {
    console.error("[ai] summarize failed:", err);
    return null;
  }
}

function extractJson(text: string): any | null {
  if (!text) return null;
  // strip code fences
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1] : text;
  try {
    return JSON.parse(candidate.trim());
  } catch {
    const start = candidate.indexOf("{");
    const end = candidate.lastIndexOf("}");
    if (start !== -1 && end !== -1 && end > start) {
      try {
        return JSON.parse(candidate.slice(start, end + 1));
      } catch {
        return null;
      }
    }
    return null;
  }
}

export interface ExtractedContent {
  title: string;
  html: string;
  publishedTime: string | null;
  url: string;
}

export interface ArticleMeta {
  id: string;
  title: string;
  url: string;
  source: string;
  author: string | null;
  publishedAt: string | null;
}

export async function extractArticleContent(
  input: ArticleInput,
  force = false,
): Promise<{ content: ExtractedContent | null; article: ArticleMeta }> {
  const { articleId, title, url } = input;
  const article: ArticleMeta = {
    id: articleId,
    title,
    url,
    source: input.source || "web",
    author: input.author || null,
    publishedAt: input.publishedAt || null,
  };

  const dbOk = await isDbAvailable();

  // Check DB cache first (best-effort).
  if (!force && dbOk) {
    try {
      const cached = await db.article.findUnique({
        where: { sourceId: articleId },
        select: { content: true, title: true, publishedAt: true },
      });
      if (cached?.content) {
        return {
          article,
          content: {
            title: cached.title || title,
            html: cached.content,
            publishedTime: cached.publishedAt
              ? new Date(cached.publishedAt).toISOString()
              : null,
            url,
          },
        };
      }
    } catch {
      // ignore
    }
  }

  try {
    const ai = await createAIClient();
    const result: any = await ai.functions.invoke("page_reader", { url });
    const data = result?.data;
    if (!data?.html) return { article, content: null };
    // Readability-style extraction isolates the actual article body
    // (page_reader returns the full page HTML including nav, sidebars, etc.).
    const cleanHtml = extractReadableContent(data.html);
    if (!cleanHtml) return { article, content: null };
    const exTitle = data.title || title;
    const publishedTime = data.publishedTime || null;

    // Cache to DB (best-effort).
    if (dbOk) {
      try {
        await db.article.upsert({
          where: { sourceId: articleId },
          create: {
            sourceId: articleId,
            source: input.source || "web",
            category: input.source || "web",
            title: title.slice(0, 500),
            description: (input.description || "").slice(0, 1000),
            url,
            author: input.author || null,
            publishedAt: input.publishedAt ? new Date(input.publishedAt) : null,
            points: 0,
            content: cleanHtml.slice(0, 200000),
          },
          update: { content: cleanHtml.slice(0, 200000) },
        });
      } catch {
        // ignore
      }
    }

    return {
      article,
      content: { title: exTitle, html: cleanHtml, publishedTime, url },
    };
  } catch (err) {
    console.error("[ai] page_reader failed:", err);
    return { article, content: null };
  }
}

/**
 * Readability-style content extraction.
 * (unchanged from previous version — isolates article body from full page HTML)
 */
function extractReadableContent(html: string): string | null {
  if (!html) return null;
  let out = html;

  // 1. Drop <head>
  out = out.replace(/<head[\s\S]*?<\/head>/i, "");

  // 2. Isolate main content container.
  out =
    extractTagBlock(out, "article") ||
    extractTagBlock(out, "main") ||
    extractAttrBlock(out, "role", "main") ||
    extractClassOrIdBlock(out, /(post-content|article-body|article__body|entry-content|story-body|content-body|main-content|post-body|article-content)/i) ||
    out;

  // 3. Strip non-content BLOCK elements (with their children), depth-aware.
  const JUNK_BLOCK_TAGS = [
    "header",
    "nav",
    "aside",
    "footer",
    "form",
    "svg",
    "template",
    "noscript",
    "iframe",
    "video",
    "audio",
    "canvas",
  ];
  for (const tag of JUNK_BLOCK_TAGS) {
    out = stripBlocksByTag(out, tag);
  }
  out = stripBlocksWithAttr(
    out,
    /(comment|sidebar|related|share|social|newsletter|subscribe|advert|banner|widget|popup|modal|cookie|consent|paywall|recommend|trending|popular|breadcrumb|pagination|signup|signin|login|toolbar|action-bar|reading-progress)/i,
  );

  // 4. Strip inline non-content tags (void + raw-text elements).
  out = out
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<title[^>]*>[\s\S]*?<\/title>/gi, "")
    .replace(/<link[^>]*>/gi, "")
    .replace(/<meta[^>]*>/gi, "")
    .replace(/<base[^>]*>/gi, "")
    .replace(/<input[^>]*>/gi, "")
    .replace(/<button[\s\S]*?<\/button>/gi, "")
    .replace(/<select[\s\S]*?<\/select>/gi, "")
    .replace(/<textarea[\s\S]*?<\/textarea>/gi, "")
    .replace(/<label[\s\S]*?<\/label>/gi, "")
    .replace(/<map[\s\S]*?<\/map>/gi, "")
    .replace(/<area[^>]*>/gi, "");

  // Strip inline event handlers + inline styles (keep the element, drop attrs).
  out = out
    .replace(/\son\w+\s*=\s*"[^"]*"/gi, "")
    .replace(/\son\w+\s*=\s*'[^']*'/gi, "")
    .replace(/\son\w+\s*=\s*[^\s>]+/gi, "")
    .replace(/\sstyle\s*=\s*"[^"]*"/gi, "")
    .replace(/\sstyle\s*=\s*'[^']*'/gi, "");

  // 5. Remove empty wrappers (repeat a few times to collapse nested empties).
  for (let i = 0; i < 3; i++) {
    out = out
      .replace(/<div\b[^>]*>\s*<\/div>/gi, "")
      .replace(/<section\b[^>]*>\s*<\/section>/gi, "")
      .replace(/<span\b[^>]*>\s*<\/span>/gi, "")
      .replace(/<p\b[^>]*>\s*<\/p>/gi, "")
      .replace(/<ul\b[^>]*>\s*<\/ul>/gi, "")
      .replace(/<ol\b[^>]*>\s*<\/ol>/gi, "");
  }

  // Collapse excessive whitespace.
  out = out.replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();

  // 6. Bail out if there's almost no readable text.
  const text = out.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  if (text.length < 100) return null;

  return out;
}

/** Extract the first `<tag ...>` ... LAST `</tag>` block (handles nesting). */
function extractTagBlock(html: string, tag: string): string | null {
  const openRe = new RegExp(`<${tag}\\b`, "i");
  const openMatch = openRe.exec(html);
  if (!openMatch) return null;
  const start = openMatch.index;
  const closeTag = `</${tag}>`;
  const lower = html.toLowerCase();
  const end = lower.lastIndexOf(closeTag);
  if (end === -1 || end <= start) return null;
  return html.slice(start, end + closeTag.length);
}

/** Extract the first block whose given attribute matches `value`. */
function extractAttrBlock(html: string, attr: string, value: string): string | null {
  const re = new RegExp(`<([a-z0-9]+)\\b[^>]*\\s${attr}\\s*=\\s*["']?${value}["']?[^>]*>`, "i");
  const m = re.exec(html);
  if (!m) return null;
  const tag = m[1];
  return extractTagBlockFromIndex(html, tag, m.index);
}

/** Extract the first <div>/<section>/<article> whose class or id matches `pattern`. */
function extractClassOrIdBlock(html: string, pattern: RegExp): string | null {
  const re = new RegExp(
    `<(div|section|article|main)\\b[^>]*\\s(class|id)\\s*=\\s*["'][^"']*${pattern.source}[^"']*["']`,
    "i",
  );
  const m = re.exec(html);
  if (!m) return null;
  return extractTagBlockFromIndex(html, m[1], m.index);
}

/** Extract `<tag>` block starting at a known opening-tag index (depth-aware). */
function extractTagBlockFromIndex(html: string, tag: string, openIdx: number): string | null {
  const close = findMatchingClose(html, openIdx, tag);
  if (close === -1) return null;
  const closeTag = `</${tag}>`;
  return html.slice(openIdx, close + closeTag.length);
}

/** Find the index of the `</tag>` that closes the tag opened at `openIdx`. */
function findMatchingClose(html: string, openIdx: number, tag: string): number {
  const openEnd = html.indexOf(">", openIdx);
  if (openEnd === -1) return -1;
  const re = new RegExp(`<${tag}\\b[^>]*>|</${tag}>`, "gi");
  re.lastIndex = openEnd + 1;
  let depth = 1;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    if (m[0].startsWith("</")) {
      depth--;
      if (depth === 0) return m.index;
    } else {
      depth++;
    }
  }
  return -1;
}

/** Remove every `<tag>...</tag>` block (and its children) from the html. */
function stripBlocksByTag(html: string, tag: string): string {
  const openRe = new RegExp(`<${tag}\\b`, "gi");
  let result = "";
  let cursor = 0;
  let m: RegExpExecArray | null;
  while ((m = openRe.exec(html)) !== null) {
    const openIdx = m.index;
    const close = findMatchingClose(html, openIdx, tag);
    if (close === -1) {
      result += html.slice(cursor, openIdx);
      const gt = html.indexOf(">", openIdx);
      cursor = gt === -1 ? html.length : gt + 1;
      openRe.lastIndex = cursor;
      continue;
    }
    result += html.slice(cursor, openIdx);
    cursor = close + `</${tag}>`.length;
    openRe.lastIndex = cursor;
  }
  result += html.slice(cursor);
  return result;
}

/** Remove `<div|section|article|aside|nav|span>` blocks whose opening tag
 *  has a class/id matching `pattern`. Depth-aware so nested content is safe. */
function stripBlocksWithAttr(html: string, pattern: RegExp): string {
  const tagRe = /<(div|section|article|aside|nav|span|ul|ol)\b[^>]*>/gi;
  let result = "";
  let cursor = 0;
  let m: RegExpExecArray | null;
  while ((m = tagRe.exec(html)) !== null) {
    const openTag = m[0];
    if (!pattern.test(openTag)) continue;
    const tag = m[1];
    const close = findMatchingClose(html, m.index, tag);
    if (close === -1) continue;
    result += html.slice(cursor, m.index);
    cursor = close + `</${tag}>`.length;
    tagRe.lastIndex = cursor;
  }
  result += html.slice(cursor);
  return result;
}

// ---------------------------------------------------------------------------
// Chatbot
// ---------------------------------------------------------------------------
const SYSTEM_NEWS_ASSISTANT = `You are Pulse, an AI news assistant inside TechNews Worldwide — a tech & AI news aggregator.
You help the user understand the latest technology and AI news. Be concise, friendly and accurate.

When given a context block of recent article titles + snippets, ground your answers in them and cite the article number like [1], [2]. Only cite numbers that exist in the context list — never invent citation numbers.

If the user asks about something not in the context, say you don't have a recent article on that and give a brief general answer instead.
Never invent article URLs. Keep answers under 180 words unless the user asks for more detail.

Format your response in clean Markdown: use **bold** for key terms, bullet lists for multiple items, and short paragraphs. Do NOT start your response with a blank line or newline — begin with the first word directly.`;

export interface ChatTurn {
  role: "user" | "assistant";
  content: string;
}

export async function chatAboutNews(
  sessionId: string,
  userMessage: string,
): Promise<{ reply: string; context: { title: string; url: string }[] }> {
  // Build context from the most recent articles — prefer DB, fall back to the
  // in-memory news cache so the chatbot still has grounding on Vercel.
  let context: { title: string; url: string; description?: string }[] = [];
  const dbOk = await isDbAvailable();
  if (dbOk) {
    try {
      const recent = await db.article.findMany({
        orderBy: { publishedAt: "desc" },
        take: 20,
        select: { title: true, url: true, description: true },
      });
      context = recent.map((a) => ({ title: a.title, url: a.url, description: a.description || undefined }));
    } catch {
      // ignore
    }
  }
  if (context.length === 0) {
    // Fall back to the in-memory news cache (works without a DB).
    try {
      const { articles } = await fetchAllNews(false);
      context = articles.slice(0, 20).map((a) => ({
        title: a.title,
        url: a.url,
        description: a.description || undefined,
      }));
    } catch {
      // ignore
    }
  }

  const ctxBlock = context
    .map((a, i) => `[${i + 1}] ${a.title}\n    ${a.description || ""}\n    ${a.url}`)
    .join("\n");
  const ctxLinks = context.map((a) => ({ title: a.title, url: a.url }));

  // Load recent chat history for this session (cap to last 10 turns).
  // In-memory fallback when DB unavailable.
  let history: ChatTurn[] = [];
  if (dbOk) {
    try {
      const historyRows = await db.chatMessage.findMany({
        where: { sessionId },
        orderBy: { createdAt: "desc" },
        take: 10,
      });
      history = historyRows
        .reverse()
        .map((r) => ({ role: r.role as "user" | "assistant", content: r.content }));
    } catch {
      // ignore
    }
  }
  // Always include in-memory turns for this session (covers DB-less case).
  history = [...memoryChatHistory.get(sessionId) || [], ...history].slice(-10);

  const messages: any[] = [
    { role: "assistant", content: SYSTEM_NEWS_ASSISTANT },
    {
      role: "assistant",
      content:
        context.length > 0
          ? `Recent articles context (use these for grounding):\n${ctxBlock}`
          : "No recent articles are available right now. Answer generally.",
    },
    ...history,
    { role: "user", content: userMessage },
  ];

  // Record the user's message (in-memory + best-effort DB).
  pushMemoryChat(sessionId, { role: "user", content: userMessage });
  if (dbOk) {
    try {
      await db.chatMessage.create({ data: { sessionId, role: "user", content: userMessage } });
    } catch {
      // ignore
    }
  }

  let reply = "I couldn't reach the news brain right now. Please try again in a moment.";
  try {
    const ai = await createAIClient();
    const completion = await ai.chat.completions.create({
      messages,
      thinking: { type: "disabled" },
    });
    reply = (completion.choices[0]?.message?.content || reply).trim();
  } catch (err) {
    console.error("[ai] chat failed:", err);
  }

  // Record the assistant's reply (in-memory + best-effort DB).
  pushMemoryChat(sessionId, { role: "assistant", content: reply });
  if (dbOk) {
    try {
      await db.chatMessage.create({ data: { sessionId, role: "assistant", content: reply } });
    } catch {
      // ignore
    }
  }
  return { reply, context: ctxLinks };
}

/** In-memory chat history fallback (per session, capped at 30 turns). */
const memoryChatHistory = new Map<string, ChatTurn[]>();
function pushMemoryChat(sessionId: string, turn: ChatTurn) {
  const arr = memoryChatHistory.get(sessionId) || [];
  arr.push(turn);
  if (arr.length > 30) arr.shift();
  memoryChatHistory.set(sessionId, arr);
}

export async function getChatHistory(sessionId: string): Promise<ChatTurn[]> {
  const dbOk = await isDbAvailable();
  if (dbOk) {
    try {
      const rows = await db.chatMessage.findMany({
        where: { sessionId },
        orderBy: { createdAt: "asc" },
        take: 50,
      });
      if (rows.length > 0) {
        return rows.map((r) => ({ role: r.role as "user" | "assistant", content: r.content }));
      }
    } catch {
      // ignore
    }
  }
  return memoryChatHistory.get(sessionId) || [];
}

/** Clear chat history for a session (both DB and in-memory fallback). */
export async function clearChatHistory(sessionId: string): Promise<void> {
  memoryChatHistory.delete(sessionId);
  const dbOk = await isDbAvailable();
  if (dbOk) {
    try {
      await db.chatMessage.deleteMany({ where: { sessionId } });
    } catch {
      // ignore
    }
  }
}

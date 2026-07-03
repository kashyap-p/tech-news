import { db } from "@/lib/db";

/**
 * AI service (backend only — z-ai-web-dev-sdk must never run client-side).
 *
 * Provides:
 *  - summarizeArticle(): concise bullet summary + tags for an article
 *  - extractArticleContent(): pull clean readable HTML via page_reader
 *  - chatAboutNews(): multi-turn assistant grounded on the latest articles
 *
 * All helpers are defensive: they degrade gracefully if the SDK or network
 * fails, so the UI never hard-crashes on an AI hiccup.
 */

let zaiPromise: Promise<any> | null = null;
async function getZAI() {
  if (!zaiPromise) {
    const ZAI = (await import("z-ai-web-dev-sdk")).default;
    zaiPromise = ZAI.create();
  }
  return zaiPromise;
}

export interface ArticleSummary {
  summary: string;
  tags: string[];
}

const SYSTEM_SUMMARIZER =
  "You are TechBrief, an expert tech-news analyst. Given an article title and description, produce a concise, neutral summary in 3-4 bullet points and 3-5 short tags. Respond ONLY with valid JSON of shape {\"summary\": string (markdown bullets), \"tags\": string[]}. Do not add commentary outside the JSON.";

export async function summarizeArticle(articleId: string): Promise<ArticleSummary | null> {
  const article = await db.article.findUnique({ where: { id: articleId } });
  if (!article) return null;
  if (article.aiSummary && article.aiTags) {
    return { summary: article.aiSummary, tags: article.aiTags.split(",").map((t) => t.trim()).filter(Boolean) };
  }

  try {
    const zai = await getZAI();
    const completion = await zai.chat.completions.create({
      messages: [
        { role: "assistant", content: SYSTEM_SUMMARIZER },
        {
          role: "user",
          content: `Title: ${article.title}\n\nDescription: ${article.description || "(no description provided)"}\n\nSource: ${article.url}`,
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
    await db.article.update({
      where: { id: articleId },
      data: { aiSummary: summary, aiTags: tags.join(",") },
    });
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

export async function extractArticleContent(
  articleId: string,
  force = false,
): Promise<{ content: ExtractedContent | null; article: any }> {
  const article = await db.article.findUnique({ where: { id: articleId } });
  if (!article) return { content: null, article: null };

  if (!force && article.content) {
    return {
      article,
      content: {
        title: article.title,
        html: article.content,
        publishedTime: article.publishedAt ? new Date(article.publishedAt).toISOString() : null,
        url: article.url,
      },
    };
  }

  try {
    const zai = await getZAI();
    const result: any = await zai.functions.invoke("page_reader", { url: article.url });
    const data = result?.data;
    if (!data?.html) return { article, content: null };
    // Run readability-style extraction to isolate the actual article body
    // (the page_reader returns the full page HTML including nav, sidebars,
    // forms, footers — without this the reader renders as page chrome).
    const cleanHtml = extractReadableContent(data.html);
    if (!cleanHtml) return { article, content: null };
    const title = data.title || article.title;
    const publishedTime = data.publishedTime || null;
    await db.article.update({
      where: { id: articleId },
      data: { content: cleanHtml.slice(0, 200000) },
    });
    return {
      article,
      content: { title, html: cleanHtml, publishedTime, url: article.url },
    };
  } catch (err) {
    console.error("[ai] page_reader failed:", err);
    return { article, content: null };
  }
}

/**
 * Readability-style content extraction.
 *
 * `page_reader` returns the FULL page HTML (head, nav, sidebars, forms,
 * footers, ads, comment sections). Rendering that verbatim buries the article
 * under hundreds of junk elements. This function isolates the real article
 * body and strips non-content chrome so the in-app reader is actually readable.
 *
 * Strategy:
 *  1. Drop <head> entirely.
 *  2. Isolate the main content container — prefer <article>, then <main>,
 *     then [role=main], then common content ids/classes, else full body.
 *  3. Strip non-content block tags (nav, header, aside, footer, form, etc.)
 *     and junk containers (comments, sidebar, related, newsletter, ads…)
 *     using a depth-aware balanced-tag stripper so nesting is handled.
 *  4. Strip inline non-content tags (script, style, meta, link, input, …).
 *  5. Remove empty wrappers and collapse whitespace.
 *  6. If the remaining visible text is too short, return null so the caller
 *     can fall back to the article description + original link.
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
  //    These wrap nav, headers, sidebars, footers, forms, etc.
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
  // Strip containers whose class/id screams "not article body".
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
      // unbalanced — drop just the opening tag and continue
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
When given a context block of recent article titles + snippets, ground your answers in them and cite the article number like [1], [2].
If the user asks about something not in the context, say you don't have a recent article on that and give a brief general answer instead.
Never invent article URLs. Keep answers under 180 words unless the user asks for more detail.`;

export interface ChatTurn {
  role: "user" | "assistant";
  content: string;
}

export async function chatAboutNews(
  sessionId: string,
  userMessage: string,
): Promise<{ reply: string; context: { title: string; url: string }[] }> {
  // Build context from the most recent articles
  const recent = await db.article.findMany({
    orderBy: { publishedAt: "desc" },
    take: 20,
  });
  const ctxBlock = recent
    .map((a, i) => `[${i + 1}] ${a.title}\n    ${a.description || ""}\n    ${a.url}`)
    .join("\n");
  const context = recent.map((a) => ({ title: a.title, url: a.url }));

  // Load recent chat history for this session (cap to last 10 turns)
  const historyRows = await db.chatMessage.findMany({
    where: { sessionId },
    orderBy: { createdAt: "desc" },
    take: 10,
  });
  const history: ChatTurn[] = historyRows
    .reverse()
    .map((r) => ({ role: r.role as "user" | "assistant", content: r.content }));

  const messages: any[] = [
    { role: "assistant", content: SYSTEM_NEWS_ASSISTANT },
    {
      role: "assistant",
      content: `Recent articles context (use these for grounding):\n${ctxBlock}`,
    },
    ...history,
    { role: "user", content: userMessage },
  ];

  await db.chatMessage.create({ data: { sessionId, role: "user", content: userMessage } });

  let reply = "I couldn't reach the news brain right now. Please try again in a moment.";
  try {
    const zai = await getZAI();
    const completion = await zai.chat.completions.create({
      messages,
      thinking: { type: "disabled" },
    });
    reply = completion.choices[0]?.message?.content || reply;
  } catch (err) {
    console.error("[ai] chat failed:", err);
  }

  await db.chatMessage.create({ data: { sessionId, role: "assistant", content: reply } });
  return { reply, context };
}

export async function getChatHistory(sessionId: string): Promise<ChatTurn[]> {
  const rows = await db.chatMessage.findMany({
    where: { sessionId },
    orderBy: { createdAt: "asc" },
    take: 50,
  });
  return rows.map((r) => ({ role: r.role as "user" | "assistant", content: r.content }));
}

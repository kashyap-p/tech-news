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
): Promise<{ content: ExtractedContent | null; article: any }> {
  const article = await db.article.findUnique({ where: { id: articleId } });
  if (!article) return { content: null, article: null };

  if (article.content) {
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
    const cleanHtml = sanitizeHtml(data.html);
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
 * Light sanitisation of reader HTML before storing/rendering:
 * strip scripts, iframes, event handlers, and external images that aren't
 * strictly needed. We keep semantic tags so react-markdown / dangerouslySetInnerHTML
 * rendering stays readable. The reader view always links back to the source.
 */
function sanitizeHtml(html: string): string {
  let out = html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<iframe[\s\S]*?<\/iframe>/gi, "")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, "")
    .replace(/\son\w+\s*=\s*"[^"]*"/gi, "")
    .replace(/\son\w+\s*=\s*'[^']*'/gi, "")
    .replace(/\son\w+\s*=\s*[^\s>]+/gi, "")
    .replace(/<svg[\s\S]*?<\/svg>/gi, "");
  return out;
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

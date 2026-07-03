# TechNews Worldwide - Project Worklog

## Project Goal
Transform the static `kashyap-p/tech-news` repo into a visually stunning, interactive, responsive Next.js 16 web app that fetches AI + tech news worldwide, with reading view, sharing, bookmarks, and AI integrations (summaries, smart categorization, AI chatbot assistant).

## Original Repo Audit (software engineering review)
Cloned from GitHub. Original = plain HTML/CSS/JS static site.

**Bugs & issues found:**
1. No build system / framework — not scalable, not a real "project".
2. All API calls (Dev.to, Hacker News) made directly from the browser → CORS risk + exposes fetch logic + no caching/persistence.
3. `fetchDevTo` throws `Error('No Dev.to articles')` when an upstream tag returns empty — propagates as a hard failure even though other tags succeeded (misleading error toast).
4. `Promise.allSettled` of 40 concurrent HN item fetches — hammers the HN Firebase API, easily rate-limited.
5. Memory leak pattern: `toast._hide` timer attached to a DOM node; not cleaned up.
6. Inline `onerror` handler in card HTML (`this.parentElement.classList.add('fallback');this.remove()`) — works but is an anti-pattern (CSP-unsafe, hard to maintain).
7. `hnCount: 40` then slices to 40 — fine, but combined with point 4 it's a thundering-herd.
8. No persistence: bookmarks / read history / shares are impossible.
9. No reading view — every card just links out (no in-app read experience).
10. No sharing UX beyond opening the source URL.
11. No AI features (user explicitly wants AI integrations).
12. Only "tech" via Dev.to + HN — no dedicated AI-news or worldwide sources.
13. Accessibility gaps: missing ARIA on tabs/toast, no keyboard focus rings, cards are `<a>` with no accessible name beyond title.
14. Sort uses `new Date(b.time || 0)` — okay but `time` may be missing on some HN items → sorts to epoch, silently wrong.
15. Search is client-side only over currently-loaded articles (max ~80) — limited.
16. No error retry / backoff; single hard failure path.
17. `escapeHtml` via DOM `textContent` — works but creates a throwaway node per call (perf under large lists).
18. No dark/light theme toggle (only dark).
19. Footer is not sticky to viewport bottom on short content (floats mid-page).

**Architecture decisions for the rewrite:**
- Next.js 16 App Router + TypeScript (required stack).
- Backend API routes own all news fetching (Dev.to, HN Algolia, + z-ai-web-dev-sdk `web_search` for worldwide AI/tech news) → no CORS, with in-memory cache + DB persistence.
- Prisma + SQLite: `Article`, `Bookmark`, `ShareEvent`, `ChatSession` models.
- AI via z-ai-web-dev-sdk (backend only): `chat.completions` for summaries / categorization / chatbot; `web_search` for live worldwide news; `page_reader` for in-app reading view.
- Frontend: single `/` route (per constraints), shadcn/ui + Tailwind 4 + framer-motion, neon dark theme (pink/blue/cyan) preserving the original aesthetic but far more polished, fully responsive, sticky footer.
- Session-based bookmarks/chat (no auth needed for a portfolio project) using a cookie/localStorage session id.

---
Task ID: 0
Agent: main (orchestrator)
Task: Clone repo, audit, plan architecture, set up worklog.

Work Log:
- Cloned https://github.com/kashyap-p/tech-news to /tmp/tech-news.
- Read index.html, js/app.js, css/style.css, README.md.
- Performed software-engineering audit (bugs listed above).
- Read LLM, web-search, web-reader SKILL.md files for correct SDK usage.
- Confirmed project stack: Next.js 16, Prisma+SQLite, z-ai-web-dev-sdk, shadcn/ui.

Stage Summary:
- Audit complete. Architecture planned. Ready to build backend + frontend.

---
Task ID: 1
Agent: main (orchestrator)
Task: Build full-stack TechNews Worldwide app — backend + frontend + AI integrations.

Work Log:
- Defined Prisma schema (Article, Bookmark, ShareEvent, ChatMessage) + pushed to SQLite.
- Built news aggregation service (src/lib/news.ts): Dev.to (12 tags), Hacker News Algolia (single cheap request), z-ai web_search for worldwide AI + tech news. In-memory 5-min cache + DB persistence + de-dup by URL.
- Built AI service (src/lib/ai.ts): summarizeArticle (JSON-structured bullets + tags via chat.completions), extractArticleContent (page_reader + HTML sanitisation), chatAboutNews (multi-turn, grounded on 20 recent articles with [n] citations).
- Built session helper (src/lib/session.ts) — anonymous cookie session for bookmarks/chat.
- Built 7 API routes: /api/news, /api/news/summarize, /api/news/read, /api/bookmarks (GET/POST/DELETE), /api/share, /api/chat (GET/POST), /api/trending.
- Built frontend (single / route): neon dark theme, sticky header (logo/search/bookmarks/AI toggle), hero with live stats, category tabs (All/AI/Tech/Dev.to/HN/Worldwide), trending tags, news grid with framer-motion cards, in-app reader dialog (AI summary + extracted content + share), bookmarks drawer, floating AI chatbot panel (Pulse), sticky footer.
- Fixed bugs found during testing:
  * lucide-react v0.525 removed `Reddit` icon → replaced with `MessageSquare`.
  * Next.js 16 made `cookies()` async → made getOrCreateSessionId async + awaited in all 3 routes (bookmarks/share/chat). This was the only real runtime bug; root-caused via dev.log stack trace.

Stage Summary:
- App fully functional and browser-verified via Agent Browser.
- 88 articles aggregated across 4 source streams on first load.
- AI summary, AI chatbot (with grounded citations), bookmarks, share menu, category filtering, search, trending tags, reader with content extraction — all verified working end-to-end.
- `bun run lint` passes with 0 errors / 0 warnings.
- Responsive verified at 390x844 (mobile) and 1440x900 (desktop). Sticky footer confirmed.

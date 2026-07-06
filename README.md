# TechNews Worldwide 🌐

> A visually stunning, AI-powered aggregator for **technology & artificial-intelligence news from around the world** — with an in-app reader, AI summaries, bookmarks, one-tap sharing, and an AI news assistant you can ask anything.

Built with **Next.js 16 + TypeScript + Tailwind CSS 4 + shadcn/ui + Prisma**.

---

## ✨ Features

### News aggregation (worldwide)
- **Dev.to** — developer-written articles across 12 tags (tech, ai, webdev, python, react, devops, security, cloud…)
- **Hacker News** — top stories via the Algolia search API (one cheap request instead of 40 concurrent firebase calls)
- **Worldwide web search** — live AI & tech news via web search (recency-filtered to 3 days)
- All fetching is **server-side** → no CORS, no client API exposure, with a 5-minute in-memory cache + SQLite persistence

### AI integrations
- **AI Summaries** — every article can be summarized on-demand into bullet points + smart tags (lazy, cached in DB)
- **In-app reader** — extracts the full article content with a clean reading view and source attribution
- **Pulse, the AI news assistant** — a floating chatbot grounded on the 20 most recent articles, answers with `[1] [2]` source citations and multi-turn context
- **Smart categorization** — articles auto-tagged as `ai`, `tech`, `devto`, `hackernews`, or `web`
- **Trending tags** — computed from AI-generated tags across recent articles

### Reading & sharing
- **In-app reader dialog** — extracted content, AI summary, share menu, source attribution
- **Bookmarks** — session-based save/remove with a slide-in drawer (persists per browser, no login needed)
- **Share menu** — native share, copy link, Twitter/X, LinkedIn, Facebook, Reddit, Email + share analytics

### Design
- Neon dark theme (pink/blue/cyan) with animated aurora background
- Framer Motion card animations, shimmer effects, breathing logo
- Fully responsive (verified at 390×844 mobile and 1440×900 desktop)
- Sticky header + sticky footer, accessible (ARIA roles, keyboard nav, focus management)
- Chat panel with locked scroll (wheel events never leak to the page)

---

## 🏗️ Architecture

```
src/
├── app/
│   ├── page.tsx                  # Single-route SPA (news feed + reader + chat + bookmarks)
│   ├── layout.tsx                # Root layout + metadata
│   ├── globals.css               # Neon theme tokens, aurora, reader typography
│   └── api/
│       ├── news/route.ts         # GET  — aggregated news (Dev.to + HN + web search)
│       ├── news/summarize/       # POST — AI summary + tags
│       ├── news/read/            # POST — extract article content
│       ├── bookmarks/route.ts    # GET/POST/DELETE — session bookmarks
│       ├── share/route.ts        # POST — share analytics
│       ├── chat/route.ts         # GET/POST/DELETE — Pulse AI assistant
│       └── trending/route.ts     # GET — trending tags + hottest articles
├── components/tech-news/
│   ├── news-card.tsx             # Animated article card
│   ├── reader-dialog.tsx         # In-app reader (content + AI summary + share)
│   ├── chat-panel.tsx            # Pulse AI assistant (locked-scroll chat)
│   ├── chat-markdown.tsx         # Markdown renderer for chat bubbles
│   ├── bookmarks-drawer.tsx      # Saved stories drawer
│   └── share-menu.tsx            # Multi-channel share dropdown
└── lib/
    ├── news.ts                   # News fetching + caching + persistence
    ├── ai.ts                     # LLM summaries, content extraction, chatbot
    ├── session.ts                # Anonymous cookie session
    ├── db.ts                     # Prisma client singleton
    ├── types.ts                  # Shared DTOs + source metadata
    └── format.ts                 # timeAgo, truncate, hostname helpers

prisma/
└── schema.prisma                 # Article, Bookmark, ShareEvent, ChatMessage
```

---

## 🚀 Getting started

### Prerequisites
- Node.js 18+ / Bun
- An AI provider account (for summaries, content extraction, and the chatbot)

### Install & run
```bash
bun install
bun run db:push      # create the SQLite database
bun run dev          # start the dev server on http://localhost:3000
```

### Scripts
| Script | Description |
|--------|-------------|
| `bun run dev` | Start the Next.js dev server |
| `bun run lint` | Run ESLint |
| `bun run db:push` | Push the Prisma schema to SQLite |
| `bun run db:generate` | Regenerate the Prisma client |
| `bun run build` | Production build |

---

## 🗄️ Database schema

| Model | Purpose |
|-------|---------|
| `Article` | Cached news articles (title, url, image, AI summary, AI tags, extracted content) |
| `Bookmark` | Session-based saved articles (self-contained — stores article JSON, no FK) |
| `ShareEvent` | Share analytics (channel: copy/twitter/linkedin/…) |
| `ChatMessage` | Pulse chatbot conversation history (per session) |

SQLite via Prisma locally. The `db/*.db` files are gitignored — run `bun run db:push` to create locally.

> **The database is optional.** The app is built to work without it on serverless platforms (the filesystem is read-only). News DTOs are built directly from fetched data, AI features accept article data from the client, and bookmarks fall back to an in-memory store. The DB is used as a best-effort cache for AI summaries, extracted content, and chat history.

---

## ▲ Deploying to Vercel

This app is Vercel-ready. After importing the repo:

1. **Set environment variables** (Project → Settings → Environment Variables). The AI SDK reads from env vars on serverless platforms because the local config file doesn't exist there:

   | Variable | Value | Required? |
   |----------|-------|-----------|
   | `AI_BASE_URL` | your AI provider base URL | ✅ Yes |
   | `AI_API_KEY` | your api key | ✅ Yes |
   | `AI_TOKEN` | your jwt token | ✅ Yes |
   | `AI_CHAT_ID` | your chat id | ✅ Yes |
   | `AI_USER_ID` | your user id | ✅ Yes |
   | `DATABASE_URL` | a Postgres URL (e.g. Vercel Postgres) | Optional |

   Get the `AI_*` values from your local AI config file.

2. **Build settings**: leave as defaults. The `postinstall: prisma generate` script runs automatically.

3. **Database (optional)**: For persistent bookmarks/chat-history across serverless instances, connect a Vercel Postgres database and set `DATABASE_URL` to its URL. Without it, the app still works — news + AI features use in-memory caches, and bookmarks use a per-instance memory store.

> **Note:** SQLite (`file:./db/custom.db`) does **not** work on Vercel — the filesystem is read-only. Either use Postgres or leave `DATABASE_URL` unset. The app degrades gracefully either way.

---

## 🤖 AI integrations

All AI runs **server-side only** (the AI SDK is never imported in client code):

| Feature | Method | Notes |
|---------|--------|-------|
| Worldwide news | `functions.invoke('web_search', …)` | recency_days: 3, num: 15 per query |
| Article extraction | `functions.invoke('page_reader', …)` | HTML sanitized + readability-extracted before storage |
| AI summaries | `chat.completions.create(…)` | JSON-structured bullets + tags, cached on Article |
| Pulse chatbot | `chat.completions.create(…)` | Multi-turn, grounded on 20 recent articles with citations |

The AI client is created via `createAIClient()` in `src/lib/news.ts`, which reads `AI_*` env vars (for serverless) and falls back to the local config file (for dev).

---

## 🛡️ Software-engineering audit

This repo was rebuilt from a [static HTML/CSS/JS starter](./legacy-static). The original had 19 documented issues (client-side API calls with CORS risk, 40 concurrent firebase fetches, no persistence, no reader, no sharing, no AI, a11y gaps, etc.) — all fixed.

### Notable engineering decisions
- **Server-side aggregation** — no CORS, no exposed fetch logic, with caching + persistence
- **Single Algolia request** instead of 40 concurrent HN firebase calls
- **Readability-style content extraction** — depth-aware balanced-tag parser isolates the article body from full page HTML (nav, sidebars, forms, ads)
- **Non-passive wheel listener** on the chat panel + reader dialog — locks scroll so the page never scrolls behind a modal
- **Graceful degradation** — every AI/source/DB failure is caught and the UI degrades gracefully (fallback to original link, error toast, retry button, in-memory stores)
- **Session-based bookmarks/chat** — no auth needed for a portfolio project; anonymous cookie session
- **Optional database** — the app works on serverless platforms with zero DB config

---

## 📁 Legacy

The original static site is preserved in [`./legacy-static`](./legacy-static) for reference.

---

## 📄 License

MIT — built as a portfolio project.

# TechNews Worldwide 🌐

> A visually stunning, AI-powered aggregator for **technology & artificial-intelligence news from around the world** — with an in-app reader, AI summaries, bookmarks, one-tap sharing, and an AI news assistant you can ask anything.

Built with **Next.js 16 + TypeScript + Tailwind CSS 4 + shadcn/ui + Prisma + Z.ai SDK**.

---

## ✨ Features

### News aggregation (worldwide)
- **Dev.to** — developer-written articles across 12 tags (tech, ai, webdev, python, react, devops, security, cloud…)
- **Hacker News** — top stories via the Algolia search API (one cheap request instead of 40 concurrent firebase calls)
- **Worldwide web search** — live AI & tech news via `z-ai-web-dev-sdk` `web_search` (recency-filtered to 3 days)
- All fetching is **server-side** → no CORS, no client API exposure, with a 5-minute in-memory cache + SQLite persistence

### AI integrations (powered by Z.ai)
- **AI Summaries** — every article can be summarized on-demand into bullet points + smart tags (lazy, cached in DB)
- **In-app reader** — extracts the full article content via `page_reader` with a clean reading view and source attribution
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
│       ├── news/read/            # POST — extract article content (page_reader)
│       ├── bookmarks/route.ts    # GET/POST/DELETE — session bookmarks
│       ├── share/route.ts        # POST — share analytics
│       ├── chat/route.ts         # GET/POST — Pulse AI assistant
│       └── trending/route.ts     # GET — trending tags + hottest articles
├── components/tech-news/
│   ├── news-card.tsx             # Animated article card
│   ├── reader-dialog.tsx         # In-app reader (content + AI summary + share)
│   ├── chat-panel.tsx            # Pulse AI assistant (locked-scroll chat)
│   ├── bookmarks-drawer.tsx      # Saved stories drawer
│   └── share-menu.tsx            # Multi-channel share dropdown
└── lib/
    ├── news.ts                   # News fetching + caching + persistence
    ├── ai.ts                     # LLM summaries, page_reader extraction, chatbot
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
- The `z-ai-web-dev-sdk` package (already in dependencies)

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
| `Bookmark` | Session-based saved articles |
| `ShareEvent` | Share analytics (channel: copy/twitter/linkedin/…) |
| `ChatMessage` | Pulse chatbot conversation history (per session) |

SQLite via Prisma. The `db/*.db` files are gitignored — run `bun run db:push` to create locally.

---

## 🤖 AI integrations (Z.ai SDK)

All AI runs **server-side only** (`z-ai-web-dev-sdk` is never imported in client code):

| Feature | SDK method | Notes |
|---------|-----------|-------|
| Worldwide news | `functions.invoke('web_search', …)` | recency_days: 3, num: 15 per query |
| Article extraction | `functions.invoke('page_reader', …)` | HTML sanitized before storage |
| AI summaries | `chat.completions.create(…)` | JSON-structured bullets + tags, cached on Article |
| Pulse chatbot | `chat.completions.create(…)` | Multi-turn, grounded on 20 recent articles with citations |

---

## 🛡️ Software-engineering audit

This repo was rebuilt from a [static HTML/CSS/JS starter](./legacy-static). The original had 19 documented issues (client-side API calls with CORS risk, 40 concurrent firebase fetches, no persistence, no reader, no sharing, no AI, a11y gaps, etc.) — all fixed. See `worklog.md` (gitignored) for the full audit.

### Notable engineering decisions
- **Server-side aggregation** — no CORS, no exposed fetch logic, with caching + persistence
- **Single Algolia request** instead of 40 concurrent HN firebase calls
- **Non-passive wheel listener** on the chat panel — locks scroll to the chat viewport so the page never scrolls behind it
- **Graceful degradation** — every AI/source failure is caught and the UI degrades gracefully (fallback to original link, error toast, retry button)
- **Session-based bookmarks/chat** — no auth needed for a portfolio project; anonymous cookie session

---

## 📁 Legacy

The original static site is preserved in [`./legacy-static`](./legacy-static) for reference.

---

## 📄 License

MIT — built as a portfolio project.

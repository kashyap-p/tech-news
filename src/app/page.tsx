"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Newspaper,
  Search,
  RefreshCw,
  Bookmark,
  Bot,
  TrendingUp,
  AlertCircle,
  Sparkles,
  Loader2,
  Github,
  Heart,
  Zap,
  Globe2,
  Cpu,
} from "lucide-react";
import {
  ArticleDTO,
  CategoryKey,
  CATEGORY_TABS,
  SOURCE_META,
  TrendingTag,
} from "@/lib/types";
import { NewsCard } from "@/components/tech-news/news-card";
import { ReaderDialog } from "@/components/tech-news/reader-dialog";
import { ChatPanel } from "@/components/tech-news/chat-panel";
import { BookmarksDrawer } from "@/components/tech-news/bookmarks-drawer";
import { toast } from "sonner";

export default function Home() {
  const [articles, setArticles] = useState<ArticleDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fetchedAt, setFetchedAt] = useState<string | null>(null);

  const [category, setCategory] = useState<CategoryKey>("all");
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");

  const [bookmarks, setBookmarks] = useState<ArticleDTO[]>([]);
  const [bookmarkIds, setBookmarkIds] = useState<Set<string>>(new Set());

  const [readerArticle, setReaderArticle] = useState<ArticleDTO | null>(null);
  const [readerOpen, setReaderOpen] = useState(false);
  const [bookmarksOpen, setBookmarksOpen] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);

  const [trending, setTrending] = useState<TrendingTag[]>([]);

  // ----- fetch news -----
  const loadNews = useCallback(async (force = false) => {
    if (force) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/news${force ? "?force=1" : ""}`, { cache: "no-store" });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || "Failed to fetch news");
      setArticles(data.articles || []);
      setFetchedAt(data.fetchedAt);
      if (force) toast.success(`Refreshed · ${data.count} stories`);
    } catch (e: any) {
      setError(e?.message || "Failed to load news");
      toast.error("Failed to load news");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // ----- fetch bookmarks -----
  const loadBookmarks = useCallback(async () => {
    try {
      const res = await fetch("/api/bookmarks", { cache: "no-store" });
      const data = await res.json();
      if (data.success) {
        const list: ArticleDTO[] = data.bookmarks.map((b: any) => b.article);
        setBookmarks(list);
        setBookmarkIds(new Set(list.map((a) => a.id)));
      }
    } catch {
      // ignore
    }
  }, []);

  // ----- fetch trending -----
  const loadTrending = useCallback(async () => {
    try {
      const res = await fetch("/api/trending", { cache: "no-store" });
      const data = await res.json();
      if (data.success) setTrending(data.tags || []);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    loadNews();
    loadBookmarks();
    loadTrending();
  }, [loadNews, loadBookmarks, loadTrending]);

  // ----- debounced search -----
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query), 280);
    return () => clearTimeout(t);
  }, [query]);

  // ----- toggle bookmark -----
  const toggleBookmark = useCallback(
    async (article: ArticleDTO) => {
      const isBookmarked = bookmarkIds.has(article.id);
      // optimistic
      if (isBookmarked) {
        setBookmarkIds((prev) => {
          const n = new Set(prev);
          n.delete(article.id);
          return n;
        });
        setBookmarks((prev) => prev.filter((a) => a.id !== article.id));
      } else {
        setBookmarkIds((prev) => new Set(prev).add(article.id));
        setBookmarks((prev) => [article, ...prev]);
      }
      try {
        if (isBookmarked) {
          await fetch(`/api/bookmarks?id=${article.id}`, { method: "DELETE" });
        } else {
          await fetch("/api/bookmarks", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ articleId: article.id }),
          });
        }
      } catch {
        // revert on failure
        loadBookmarks();
        toast.error("Bookmark sync failed");
      }
    },
    [bookmarkIds, loadBookmarks],
  );

  // ----- open reader -----
  const openReader = useCallback((article: ArticleDTO) => {
    setReaderArticle(article);
    setReaderOpen(true);
  }, []);

  // ----- filtered articles -----
  const filtered = useMemo(() => {
    let list = articles;
    if (category !== "all") {
      list = list.filter((a) => a.category === category || a.source === category);
    }
    const q = debouncedQuery.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (a) =>
          a.title.toLowerCase().includes(q) ||
          a.description.toLowerCase().includes(q) ||
          (a.author || "").toLowerCase().includes(q) ||
          (a.aiTags || "").toLowerCase().includes(q),
      );
    }
    return list;
  }, [articles, category, debouncedQuery]);

  const stats = useMemo(() => {
    const aiCount = articles.filter((a) => a.category === "ai").length;
    const webCount = articles.filter((a) => a.source === "web").length;
    const sources = new Set(articles.map((a) => a.source)).size;
    return { total: articles.length, aiCount, webCount, sources };
  }, [articles]);

  return (
    <div className="relative flex min-h-screen flex-col">
      <div className="tn-aurora" />

      {/* ===== Header ===== */}
      <header className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-2.5">
            <div className="tn-breathe flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-pink-500 to-orange-500 text-white">
              <Newspaper className="h-5 w-5" />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-lg font-extrabold tracking-tight tn-gradient-text sm:text-xl">
                TechNews
              </span>
              <span className="flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[0.6rem] font-bold uppercase tracking-wider text-emerald-400">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 tn-pulse-dot" />
                Live
              </span>
            </div>
          </div>

          <div className="order-3 flex w-full items-center gap-2 sm:order-2 sm:w-auto sm:flex-1 sm:justify-center">
            <div className="relative flex-1 sm:max-w-md">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search AI, tech, authors, tags…"
                className="h-9 rounded-full border-border bg-secondary/40 pl-9 pr-4"
                aria-label="Search news"
              />
            </div>
          </div>

          <div className="order-2 flex items-center gap-1.5 sm:order-3">
            <Button
              variant="outline"
              size="sm"
              className="h-9 rounded-full px-3"
              onClick={() => setBookmarksOpen(true)}
              aria-label="Open bookmarks"
            >
              <Bookmark className="h-4 w-4" />
              <span className="ml-1.5 hidden text-xs sm:inline">Saved</span>
              {bookmarks.length > 0 && (
                <Badge
                  variant="secondary"
                  className="ml-1.5 h-5 min-w-5 justify-center bg-pink-500/20 px-1.5 text-[0.65rem] text-pink-300"
                >
                  {bookmarks.length}
                </Badge>
              )}
            </Button>
            <Button
              size="sm"
              className="h-9 rounded-full bg-gradient-to-r from-pink-500 to-blue-500 px-3 text-white"
              onClick={() => setChatOpen((v) => !v)}
              aria-label="Toggle AI assistant"
            >
              <Bot className="h-4 w-4" />
              <span className="ml-1.5 hidden text-xs sm:inline">Ask AI</span>
            </Button>
          </div>
        </div>
      </header>

      {/* ===== Main ===== */}
      <main className="relative z-[1] mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6 sm:py-8">
        {/* Hero */}
        <motion.section
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="mb-6"
        >
          <div className="mb-3 flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
            <Globe2 className="h-3.5 w-3.5 text-cyan-400" />
            Aggregating the world&apos;s tech &amp; AI pulse
          </div>
          <h1 className="text-3xl font-black leading-[1.05] tracking-tighter sm:text-5xl">
            <span className="tn-gradient-text-warm">Tech &amp; AI News,</span>
            <br />
            <span className="text-foreground">decoded from around the globe.</span>
          </h1>
          <p className="mt-3 max-w-2xl text-sm text-muted-foreground sm:text-base">
            Live stories from Dev.to, Hacker News and a worldwide web search — with
            AI summaries, an in-app reader, bookmarks, one-tap sharing and an AI
            news assistant you can ask anything.
          </p>

          {/* Stats */}
          <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatCard
              icon={<Newspaper className="h-4 w-4" />}
              label="Stories"
              value={loading ? "—" : String(stats.total)}
              accent="from-pink-500/20 to-pink-500/5"
              iconColor="text-pink-400"
            />
            <StatCard
              icon={<Cpu className="h-4 w-4" />}
              label="AI stories"
              value={loading ? "—" : String(stats.aiCount)}
              accent="from-purple-500/20 to-purple-500/5"
              iconColor="text-purple-400"
            />
            <StatCard
              icon={<Globe2 className="h-4 w-4" />}
              label="Worldwide"
              value={loading ? "—" : String(stats.webCount)}
              accent="from-cyan-500/20 to-cyan-500/5"
              iconColor="text-cyan-400"
            />
            <StatCard
              icon={<Zap className="h-4 w-4" />}
              label="Sources"
              value={loading ? "—" : String(stats.sources)}
              accent="from-blue-500/20 to-blue-500/5"
              iconColor="text-blue-400"
            />
          </div>
        </motion.section>

        {/* Category tabs + refresh */}
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div className="tn-scroll-thin -mx-1 flex items-center gap-2 overflow-x-auto px-1 pb-1">
            {CATEGORY_TABS.map((tab) => {
              const active = category === tab.key;
              const count =
                tab.key === "all"
                  ? articles.length
                  : articles.filter(
                      (a) => a.category === tab.key || a.source === tab.key,
                    ).length;
              return (
                <button
                  key={tab.key}
                  onClick={() => setCategory(tab.key)}
                  className={`flex flex-shrink-0 items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-xs font-medium transition-all ${
                    active
                      ? "border-transparent bg-gradient-to-r from-pink-500 to-blue-500 text-white shadow-lg shadow-pink-500/20"
                      : "border-border bg-secondary/40 text-muted-foreground hover:border-pink-500/30 hover:text-foreground"
                  }`}
                >
                  {tab.label}
                  <span
                    className={`rounded-full px-1.5 text-[0.6rem] ${
                      active ? "bg-white/20" : "bg-white/5"
                    }`}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
          <Button
            variant="outline"
            size="sm"
            className="h-9 flex-shrink-0 rounded-full"
            onClick={() => loadNews(true)}
            disabled={refreshing}
          >
            {refreshing ? (
              <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="mr-1.5 h-4 w-4" />
            )}
            <span className="text-xs">Refresh</span>
          </Button>
        </div>

        {/* Trending tags */}
        {trending.length > 0 && (
          <div className="mb-5 flex flex-wrap items-center gap-2">
            <span className="flex items-center gap-1 text-xs font-semibold text-muted-foreground">
              <TrendingUp className="h-3.5 w-3.5 text-emerald-400" /> Trending
            </span>
            {trending.slice(0, 8).map((t) => (
              <button
                key={t.tag}
                onClick={() => setQuery(t.tag)}
                className="rounded-full border border-border bg-secondary/30 px-2.5 py-0.5 text-[0.7rem] text-muted-foreground transition-all hover:border-cyan-500/30 hover:text-cyan-400"
              >
                #{t.tag}
                <span className="ml-1 text-[0.6rem] opacity-60">{t.count}</span>
              </button>
            ))}
          </div>
        )}

        {/* Error banner */}
        {error && (
          <div className="mb-5 flex items-center gap-3 rounded-xl border border-orange-500/30 bg-orange-500/5 p-4">
            <AlertCircle className="h-5 w-5 flex-shrink-0 text-orange-400" />
            <div className="flex-1">
              <p className="text-sm font-medium">Couldn&apos;t load fresh news</p>
              <p className="text-xs text-muted-foreground">{error}</p>
            </div>
            <Button variant="outline" size="sm" onClick={() => loadNews(true)}>
              <RefreshCw className="mr-1.5 h-4 w-4" /> Retry
            </Button>
          </div>
        )}

        {/* News grid */}
        {loading ? (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 9 }).map((_, i) => (
              <div
                key={i}
                className="overflow-hidden rounded-2xl border border-border bg-card"
              >
                <Skeleton className="h-44 w-full rounded-none" />
                <div className="space-y-2 p-4">
                  <Skeleton className="h-3 w-20" />
                  <Skeleton className="h-5 w-full" />
                  <Skeleton className="h-5 w-4/5" />
                  <Skeleton className="h-3 w-full" />
                  <Skeleton className="h-3 w-2/3" />
                  <div className="flex justify-between pt-2">
                    <Skeleton className="h-8 w-20" />
                    <Skeleton className="h-8 w-16" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-20 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-secondary/60">
              <Search className="h-8 w-8 text-muted-foreground/50" />
            </div>
            <div>
              <p className="text-base font-semibold">No stories found</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Try a different category, clear your search, or refresh the feed.
              </p>
            </div>
            <Button variant="outline" size="sm" onClick={() => { setQuery(""); setCategory("all"); }}>
              Reset filters
            </Button>
          </div>
        ) : (
          <>
            <div className="mb-3 flex items-center justify-between text-xs text-muted-foreground">
              <span>
                Showing <strong className="text-foreground">{filtered.length}</strong> of {articles.length} stories
              </span>
              {fetchedAt && (
                <span className="flex items-center gap-1">
                  Updated {new Date(fetchedAt).toLocaleTimeString()}
                </span>
              )}
            </div>
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {filtered.map((article, i) => (
                <NewsCard
                  key={article.id}
                  article={article}
                  index={i}
                  bookmarked={bookmarkIds.has(article.id)}
                  onToggleBookmark={toggleBookmark}
                  onRead={openReader}
                />
              ))}
            </div>
          </>
        )}
      </main>

      {/* ===== Footer (sticky to bottom) ===== */}
      <footer className="relative z-[1] mt-auto border-t border-border bg-background/60 backdrop-blur-sm">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-3 px-4 py-6 text-center sm:flex-row sm:px-6 sm:text-left">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span className="tn-gradient-text font-bold">TechNews Worldwide</span>
            <span className="hidden sm:inline">·</span>
            <span className="hidden items-center gap-1 sm:inline-flex">
              Built with <Heart className="h-3.5 w-3.5 text-pink-400" /> on Next.js + Z.ai
            </span>
          </div>
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <a
              href="https://dev.to"
              target="_blank"
              rel="noopener noreferrer"
              className="transition-colors hover:text-emerald-400"
            >
              Dev.to
            </a>
            <a
              href="https://news.ycombinator.com"
              target="_blank"
              rel="noopener noreferrer"
              className="transition-colors hover:text-orange-400"
            >
              Hacker News
            </a>
            <span className="flex items-center gap-1">
              <Sparkles className="h-3 w-3 text-purple-400" /> AI by Z.ai
            </span>
          </div>
        </div>
      </footer>

      {/* ===== Floating AI button (when chat closed) ===== */}
      <AnimatePresence>
        {!chatOpen && (
          <motion.button
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.5 }}
            onClick={() => setChatOpen(true)}
            className="tn-breathe fixed bottom-5 right-5 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-pink-500 to-blue-500 text-white shadow-2xl sm:bottom-6 sm:right-6"
            aria-label="Open AI assistant"
          >
            <Bot className="h-6 w-6" />
            <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex h-4 w-4 rounded-full bg-emerald-400" />
            </span>
          </motion.button>
        )}
      </AnimatePresence>

      {/* ===== Reader ===== */}
      <ReaderDialog
        article={readerArticle}
        open={readerOpen}
        onOpenChange={setReaderOpen}
        bookmarked={readerArticle ? bookmarkIds.has(readerArticle.id) : false}
        onToggleBookmark={toggleBookmark}
      />

      {/* ===== Bookmarks drawer ===== */}
      <BookmarksDrawer
        open={bookmarksOpen}
        onOpenChange={setBookmarksOpen}
        bookmarks={bookmarks}
        onRemove={toggleBookmark}
        onRead={openReader}
      />

      {/* ===== AI Chat ===== */}
      <ChatPanel open={chatOpen} onOpenChange={setChatOpen} />
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  accent,
  iconColor,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  accent: string;
  iconColor: string;
}) {
  return (
    <div className={`relative overflow-hidden rounded-xl border border-border bg-gradient-to-br ${accent} p-3`}>
      <div className="mb-1 flex items-center gap-1.5">
        <span className={iconColor}>{icon}</span>
        <span className="text-[0.7rem] font-medium uppercase tracking-wider text-muted-foreground">
          {label}
        </span>
      </div>
      <div className="text-2xl font-black tracking-tight">{value}</div>
    </div>
  );
}

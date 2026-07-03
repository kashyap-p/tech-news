"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Sparkles,
  ExternalLink,
  Loader2,
  RefreshCw,
  AlertCircle,
  Clock,
  User,
  Bookmark,
  BookmarkCheck,
} from "lucide-react";
import { ArticleDTO, SOURCE_META } from "@/lib/types";
import { timeAgo, hostname } from "@/lib/format";
import { ShareMenu } from "./share-menu";
import { toast } from "sonner";

interface ReaderDialogProps {
  article: ArticleDTO | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  bookmarked: boolean;
  onToggleBookmark: (article: ArticleDTO) => void;
}

interface ReadResult {
  article: {
    id: string;
    title: string;
    url: string;
    source: string;
    author: string | null;
    publishedAt: string | null;
  };
  content: {
    title: string;
    html: string;
    publishedTime: string | null;
    url: string;
  } | null;
}

interface SummaryResult {
  summary: string;
  tags: string[];
}

export function ReaderDialog({
  article,
  open,
  onOpenChange,
  bookmarked,
  onToggleBookmark,
}: ReaderDialogProps) {
  const [read, setRead] = useState<ReadResult | null>(null);
  const [summary, setSummary] = useState<SummaryResult | null>(null);
  const [loadingRead, setLoadingRead] = useState(false);
  const [loadingSummary, setLoadingSummary] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  const loadRead = useCallback(async (id: string, force = false) => {
    setLoadingRead(true);
    setError(null);
    setRead(null);
    try {
      const res = await fetch("/api/news/read", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ articleId: id, force }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || "Failed to load article");
      setRead(data);
    } catch (e: any) {
      setError(e?.message || "Failed to load article content");
    } finally {
      setLoadingRead(false);
    }
  }, []);

  const loadSummary = useCallback(async (id: string) => {
    setLoadingSummary(true);
    try {
      const res = await fetch("/api/news/summarize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ articleId: id }),
      });
      const data = await res.json();
      if (data.success) {
        setSummary({ summary: data.summary, tags: data.tags });
      }
    } catch {
      // silent — summary is optional
    } finally {
      setLoadingSummary(false);
    }
  }, []);

  useEffect(() => {
    if (article && open) {
      setSummary(
        article.aiSummary
          ? { summary: article.aiSummary, tags: (article.aiTags || "").split(",").filter(Boolean) }
          : null,
      );
      loadRead(article.id);
    } else {
      setRead(null);
      setSummary(null);
      setError(null);
    }
  }, [article, open, loadRead]);

  // Lock wheel + touch scrolling to the reader dialog.
  // The dialog is `position: fixed` over a scrollable page; without this, some
  // browsers route wheel/touch events to the document and the PAGE scrolls
  // instead of the dialog — so long articles get clipped and can't be reached.
  // We attach a NON-passIVE listener so preventDefault works, manually scroll
  // the dialog (clamped to bounds), and always swallow the event.
  useEffect(() => {
    if (!open) return;
    // Radix renders DialogContent into a portal; defer one frame so the
    // element is guaranteed to be in the DOM before we attach listeners.
    let cleanup: (() => void) | null = null;
    let el: HTMLElement | null = null;
    const raf = requestAnimationFrame(() => {
      el =
        contentRef.current ??
        (document.querySelector('[data-slot="dialog-content"]') as HTMLElement | null);
      if (!el) return;

      function onWheel(e: WheelEvent) {
        const max = el!.scrollHeight - el!.clientHeight;
        el!.scrollTop = Math.max(0, Math.min(max, el!.scrollTop + e.deltaY));
        e.preventDefault();
        e.stopPropagation();
      }
      function onTouchMove(e: TouchEvent) {
        const max = el!.scrollHeight - el!.clientHeight;
        if (max <= 0) {
          e.preventDefault();
          return;
        }
        if (el!.scrollTop <= 0 || el!.scrollTop >= max) {
          e.preventDefault();
        }
        e.stopPropagation();
      }

      el.addEventListener("wheel", onWheel, { passive: false });
      el.addEventListener("touchmove", onTouchMove, { passive: false });
      cleanup = () => {
        el!.removeEventListener("wheel", onWheel);
        el!.removeEventListener("touchmove", onTouchMove);
      };
    });
    return () => {
      cancelAnimationFrame(raf);
      cleanup?.();
    };
  }, [open]);

  if (!article) return null;
  const meta = SOURCE_META[article.source];
  const shownTitle = read?.content?.title || article.title;
  const author = read?.article?.author ?? article.author;
  const publishedAt = read?.article?.publishedAt ?? article.publishedAt;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        ref={contentRef}
        className="tn-scroll-thin overscroll-contain max-h-[92vh] w-[95vw] max-w-3xl overflow-y-auto gap-0 p-0 sm:rounded-2xl"
      >
        {/* Header */}
        <DialogHeader className="space-y-0 p-5 pb-3 sm:p-6 sm:pb-4">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <span
              className={`rounded-md border px-2 py-0.5 text-[0.6rem] font-bold uppercase tracking-wider ${meta.bg} ${meta.color} ${meta.border}`}
            >
              {meta.label}
            </span>
            <a
              href={article.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-[0.7rem] text-muted-foreground transition-colors hover:text-foreground"
            >
              {hostname(article.url)}
              <ExternalLink className="h-3 w-3" />
            </a>
            {publishedAt && (
              <span className="flex items-center gap-1 text-[0.7rem] text-muted-foreground">
                <Clock className="h-3 w-3" />
                {timeAgo(publishedAt)}
              </span>
            )}
          </div>
          <DialogTitle className="text-xl font-bold leading-tight tracking-tight sm:text-2xl">
            {shownTitle}
          </DialogTitle>
          <DialogDescription className="flex flex-wrap items-center gap-x-3 gap-y-1 pt-1 text-sm">
            {author && (
              <span className="flex items-center gap-1">
                <User className="h-3.5 w-3.5" /> {author}
              </span>
            )}
            {article.points > 0 && <span>▲ {article.points} points</span>}
          </DialogDescription>
        </DialogHeader>

        <Separator />

        {/* Action bar */}
        <div className="sticky top-0 z-10 flex items-center justify-between gap-2 border-b border-border bg-background/80 px-5 py-2.5 backdrop-blur-md sm:px-6">
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              className="h-8"
              onClick={() => {
                onToggleBookmark(article);
                toast.success(bookmarked ? "Removed from bookmarks" : "Saved to bookmarks");
              }}
            >
              {bookmarked ? (
                <BookmarkCheck className="mr-1.5 h-4 w-4 text-pink-400" />
              ) : (
                <Bookmark className="mr-1.5 h-4 w-4" />
              )}
              <span className="text-xs">{bookmarked ? "Saved" : "Save"}</span>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-8"
              onClick={() => {
                if (!summary && !loadingSummary) loadSummary(article.id);
              }}
              disabled={!!summary || loadingSummary}
            >
              {loadingSummary ? (
                <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="mr-1.5 h-4 w-4 text-purple-400" />
              )}
              <span className="text-xs">{summary ? "Summarized" : "AI Summary"}</span>
            </Button>
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              className="h-8"
              onClick={() => window.open(article.url, "_blank", "noopener,noreferrer")}
            >
              <ExternalLink className="mr-1.5 h-4 w-4" />
              <span className="text-xs">Original</span>
            </Button>
            <ShareMenu articleId={article.id} title={shownTitle} url={article.url} />
          </div>
        </div>

        {/* AI Summary */}
        <AnimatePresence>
          {summary && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="px-5 pt-4 sm:px-6"
            >
              <div className="rounded-xl border border-purple-500/25 bg-purple-500/5 p-4">
                <div className="mb-2 flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-purple-400" />
                  <span className="text-sm font-semibold">AI Summary</span>
                  {loadingSummary && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
                </div>
                <div
                  className="text-sm leading-relaxed text-foreground/90 [&_li]:my-1 [&_ul]:list-disc [&_ul]:pl-5"
                  dangerouslySetInnerHTML={{ __html: summaryToHtml(summary.summary) }}
                />
                {summary.tags.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {summary.tags.map((t) => (
                      <Badge
                        key={t}
                        variant="secondary"
                        className="bg-purple-500/10 text-[0.65rem] text-purple-300"
                      >
                        #{t.trim().toLowerCase()}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Content */}
        <div className="px-5 py-5 sm:px-6 sm:py-6">
          {loadingRead ? (
            <div className="space-y-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <div
                  key={i}
                  className="h-4 animate-pulse rounded bg-white/5"
                  style={{ width: `${80 + ((i * 13) % 20)}%` }}
                />
              ))}
              <div className="h-4 animate-pulse rounded bg-white/5" style={{ width: "55%" }} />
            </div>
          ) : error ? (
            <div className="flex flex-col items-center gap-3 py-10 text-center">
              <AlertCircle className="h-10 w-10 text-orange-400/70" />
              <p className="text-sm text-muted-foreground">
                Couldn&apos;t extract the article content.
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => loadRead(article.id, true)}
                >
                  <RefreshCw className="mr-1.5 h-4 w-4" /> Retry
                </Button>
                <Button
                  size="sm"
                  onClick={() => window.open(article.url, "_blank", "noopener,noreferrer")}
                >
                  <ExternalLink className="mr-1.5 h-4 w-4" /> Read on original site
                </Button>
              </div>
            </div>
          ) : read?.content?.html ? (
            <article
              className="tn-reader-content"
              dangerouslySetInnerHTML={{ __html: read.content.html }}
            />
          ) : read ? (
            // Extraction succeeded but yielded no usable content (e.g. paywalled
            // sites, SPAs, or Twitter cards). Show a clean fallback instead of
            // a broken empty box.
            <div className="flex flex-col gap-4 py-4">
              {article.description && (
                <p className="text-sm leading-relaxed text-foreground/90">
                  {article.description}
                </p>
              )}
              <div className="rounded-xl border border-border bg-secondary/40 p-4">
                <p className="text-sm text-muted-foreground">
                  The full article couldn&apos;t be extracted for in-app reading
                  (the source may use JavaScript rendering, a paywall, or block
                  readers).
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    onClick={() => window.open(article.url, "_blank", "noopener,noreferrer")}
                  >
                    <ExternalLink className="mr-1.5 h-4 w-4" /> Read on {hostname(article.url)}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => loadRead(article.id, true)}
                    disabled={loadingRead}
                  >
                    <RefreshCw className="mr-1.5 h-4 w-4" /> Re-extract
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            <div className="py-6">
              <p className="mb-4 text-sm leading-relaxed text-muted-foreground">
                {article.description}
              </p>
              <a
                href={article.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-sm font-medium text-cyan-400 hover:underline"
              >
                Read the full article on {hostname(article.url)}
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            </div>
          )}
        </div>

        {/* Footer attribution */}
        <Separator />
        <div className="flex flex-col gap-2 px-5 py-4 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <span>
            Source:{" "}
            <a
              href={article.url}
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-foreground hover:tn-gradient-text"
            >
              {hostname(article.url)}
            </a>{" "}
            · Content © its original publisher.
          </span>
          <span>Aggregated by TechNews Worldwide</span>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function summaryToHtml(summary: string): string {
  // Convert markdown-ish bullet lines into an <ul>
  const lines = summary.split(/\n+/).filter(Boolean);
  if (lines.every((l) => /^\s*([-*•]\s+)/.test(l))) {
    return `<ul>${lines
      .map((l) => `<li>${l.replace(/^\s*[-*•]\s+/, "")}</li>`)
      .join("")}</ul>`;
  }
  return summary;
}

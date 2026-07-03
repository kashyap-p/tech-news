"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Bookmark, BookmarkCheck, Newspaper, Sparkles, Clock, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArticleDTO, SOURCE_META } from "@/lib/types";
import { timeAgo, truncate, hostname } from "@/lib/format";
import { ShareMenu } from "./share-menu";
import { toast } from "sonner";

interface NewsCardProps {
  article: ArticleDTO;
  index: number;
  bookmarked: boolean;
  onToggleBookmark: (article: ArticleDTO) => void;
  onRead: (article: ArticleDTO) => void;
}

export function NewsCard({
  article,
  index,
  bookmarked,
  onToggleBookmark,
  onRead,
}: NewsCardProps) {
  const [imgError, setImgError] = useState(false);
  const meta = SOURCE_META[article.source];
  const hasSummary = !!article.aiSummary;

  return (
    <motion.article
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: Math.min(index * 0.025, 0.3), ease: "easeOut" }}
      className="tn-card-glow tn-shimmer group relative flex flex-col overflow-hidden rounded-2xl border border-border bg-card transition-all duration-300 hover:-translate-y-1 hover:border-pink-500/30 hover:shadow-[0_16px_48px_rgba(0,0,0,0.35),0_0_40px_rgba(255,78,205,0.07)]"
    >
      {/* Image */}
      <button
        onClick={() => onRead(article)}
        className="relative block h-44 w-full overflow-hidden text-left"
        aria-label={`Read: ${article.title}`}
      >
        {article.image && !imgError ? (
          <img
            src={article.image}
            alt=""
            loading="lazy"
            onError={() => setImgError(true)}
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-card to-secondary">
            <Newspaper className="h-12 w-12 text-white/10" />
          </div>
        )}
        <div className="absolute left-2.5 top-2.5 flex gap-1.5">
          <span
            className={`rounded-md border px-2 py-0.5 text-[0.6rem] font-bold uppercase tracking-wider backdrop-blur-md ${meta.bg} ${meta.color} ${meta.border}`}
          >
            {meta.short}
          </span>
          {hasSummary && (
            <span className="flex items-center gap-1 rounded-md border border-purple-500/30 bg-purple-500/15 px-2 py-0.5 text-[0.6rem] font-bold uppercase tracking-wider text-purple-300 backdrop-blur-md">
              <Sparkles className="h-2.5 w-2.5" /> AI
            </span>
          )}
        </div>
      </button>

      {/* Body */}
      <div className="relative z-[1] flex flex-1 flex-col p-4">
        <div className={`mb-1.5 text-[0.65rem] font-bold uppercase tracking-wider ${meta.color}`}>
          {meta.label}
        </div>

        <button
          onClick={() => onRead(article)}
          className="text-left text-[1.02rem] font-bold leading-snug tracking-tight transition-colors group-hover:tn-gradient-text"
        >
          {truncate(article.title, 110)}
        </button>

        {article.description && (
          <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-muted-foreground">
            {truncate(article.description, 150)}
          </p>
        )}

        {/* AI tags */}
        {article.aiTags && (
          <div className="mt-2.5 flex flex-wrap gap-1.5">
            {article.aiTags
              .split(",")
              .slice(0, 3)
              .map((t) => (
                <Badge
                  key={t}
                  variant="secondary"
                  className="bg-white/5 text-[0.6rem] font-medium text-muted-foreground hover:bg-white/10"
                >
                  #{t.trim().toLowerCase()}
                </Badge>
              ))}
          </div>
        )}

        {/* Meta */}
        <div className="mt-auto flex items-center justify-between gap-2 border-t border-white/5 pt-3 text-xs text-muted-foreground/70">
          <div className="flex min-w-0 items-center gap-2">
            {article.author ? (
              <span className="flex items-center gap-1 truncate">
                <User className="h-3 w-3 flex-shrink-0" />
                <span className="truncate">{truncate(article.author, 18)}</span>
              </span>
            ) : (
              <span className="truncate">{hostname(article.url)}</span>
            )}
          </div>
          <div className="flex flex-shrink-0 items-center gap-1">
            <Clock className="h-3 w-3" />
            <time>{timeAgo(article.publishedAt)}</time>
          </div>
        </div>

        {/* Actions */}
        <div className="mt-3 flex items-center justify-between gap-1">
          <Button
            variant="ghost"
            size="sm"
            className="h-8 px-2.5"
            onClick={() => onRead(article)}
          >
            <Newspaper className="mr-1.5 h-4 w-4" />
            <span className="text-xs">Read</span>
          </Button>
          <div className="flex items-center">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => {
                onToggleBookmark(article);
                toast.success(bookmarked ? "Removed from bookmarks" : "Saved to bookmarks");
              }}
              aria-label={bookmarked ? "Remove bookmark" : "Add bookmark"}
            >
              {bookmarked ? (
                <BookmarkCheck className="h-4 w-4 text-pink-400" />
              ) : (
                <Bookmark className="h-4 w-4" />
              )}
            </Button>
            <ShareMenu
              articleId={article.id}
              title={article.title}
              url={article.url}
              compact
            />
          </div>
        </div>
      </div>
    </motion.article>
  );
}

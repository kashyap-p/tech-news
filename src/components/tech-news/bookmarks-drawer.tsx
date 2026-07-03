"use client";

import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Bookmark, BookmarkX, Newspaper, Clock, ExternalLink } from "lucide-react";
import { ArticleDTO, SOURCE_META } from "@/lib/types";
import { timeAgo, truncate, hostname } from "@/lib/format";
import { ShareMenu } from "./share-menu";

interface BookmarksDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  bookmarks: ArticleDTO[];
  onRemove: (article: ArticleDTO) => void;
  onRead: (article: ArticleDTO) => void;
}

export function BookmarksDrawer({
  open,
  onOpenChange,
  bookmarks,
  onRemove,
  onRead,
}: BookmarksDrawerProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="tn-scroll-thin w-full overflow-y-auto p-0 sm:max-w-md">
        <SheetHeader className="border-b border-border bg-gradient-to-r from-pink-500/10 to-blue-500/10 px-5 py-4 text-left">
          <SheetTitle className="flex items-center gap-2 text-lg">
            <Bookmark className="h-5 w-5 text-pink-400" />
            Saved Stories
          </SheetTitle>
          <SheetDescription>
            {bookmarks.length} bookmarked {bookmarks.length === 1 ? "article" : "articles"}
          </SheetDescription>
        </SheetHeader>

        <div className="p-4">
          {bookmarks.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-16 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-secondary/60">
                <Bookmark className="h-7 w-7 text-muted-foreground/50" />
              </div>
              <div>
                <p className="text-sm font-medium">No bookmarks yet</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Tap the bookmark icon on any story to save it here for later.
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <AnimatePresence initial={false}>
                {bookmarks.map((a) => {
                  const meta = SOURCE_META[a.source];
                  return (
                    <motion.div
                      key={a.id}
                      layout
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, x: 40 }}
                      transition={{ duration: 0.2 }}
                      className="group rounded-xl border border-border bg-card p-3 transition-colors hover:border-pink-500/20"
                    >
                      <div className="mb-1.5 flex items-center gap-2">
                        <span
                          className={`rounded border px-1.5 py-0.5 text-[0.55rem] font-bold uppercase tracking-wider ${meta.bg} ${meta.color} ${meta.border}`}
                        >
                          {meta.short}
                        </span>
                        <span className="flex items-center gap-1 text-[0.7rem] text-muted-foreground">
                          <Clock className="h-3 w-3" />
                          {timeAgo(a.publishedAt)}
                        </span>
                      </div>
                      <button
                        onClick={() => {
                          onRead(a);
                          onOpenChange(false);
                        }}
                        className="block text-left text-sm font-semibold leading-snug tracking-tight transition-colors group-hover:tn-gradient-text"
                      >
                        {truncate(a.title, 90)}
                      </button>
                      {a.description && (
                        <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                          {truncate(a.description, 120)}
                        </p>
                      )}
                      <div className="mt-2.5 flex items-center justify-between">
                        <a
                          href={a.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-[0.7rem] text-muted-foreground transition-colors hover:text-cyan-400"
                        >
                          <ExternalLink className="h-3 w-3" />
                          {hostname(a.url)}
                        </a>
                        <div className="flex items-center">
                          <ShareMenu articleId={a.id} title={a.title} url={a.url} compact />
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => onRemove(a)}
                            aria-label="Remove bookmark"
                          >
                            <BookmarkX className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => {
                              onRead(a);
                              onOpenChange(false);
                            }}
                            aria-label="Read article"
                          >
                            <Newspaper className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

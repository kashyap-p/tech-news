"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Bot, Send, Sparkles, X, Loader2, MessageSquare, Trash2 } from "lucide-react";
import { ChatTurn } from "@/lib/types";
import { toast } from "sonner";

interface ChatPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const SUGGESTIONS = [
  "What's the latest in AI today?",
  "Summarize the top tech news",
  "Any news about LLMs or OpenAI?",
  "What's trending in software engineering?",
];

export function ChatPanel({ open, onOpenChange }: ChatPanelProps) {
  const [messages, setMessages] = useState<ChatTurn[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [context, setContext] = useState<{ title: string; url: string }[]>([]);
  // Ref to the REAL scrollable element (the native overflow-y-auto div).
  const scrollRef = useRef<HTMLDivElement>(null);
  // Ref to the panel root — we lock wheel events at this level so wheeling
  // ANYWHERE inside the chat (header, messages, input) never scrolls the page.
  const panelRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const loadHistory = useCallback(async () => {
    try {
      const res = await fetch("/api/chat");
      const data = await res.json();
      if (data.success && Array.isArray(data.history)) {
        setMessages(data.history);
      }
    } catch {
      // ignore — non-critical
    }
  }, []);

  useEffect(() => {
    if (open && messages.length === 0) loadHistory();
  }, [open, loadHistory, messages.length]);

  // Auto-scroll to the latest message / loading indicator.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    // requestAnimationFrame ensures new content has laid out before we scroll.
    const id = requestAnimationFrame(() => {
      el.scrollTop = el.scrollHeight;
    });
    return () => cancelAnimationFrame(id);
  }, [messages, loading]);

  // Escape closes the panel; focus the input when opened.
  useEffect(() => {
    if (!open) return;
    inputRef.current?.focus();
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        onOpenChange(false);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onOpenChange]);

  // Lock wheel scrolling to the chat viewport.
  // The panel is `position: fixed` over a scrollable page; without this, some
  // browsers redirect wheel events to the document and the page scrolls
  // instead of the chat. We attach a NON-passive listener to the whole panel
  // so wheeling anywhere inside the chat never reaches the page. If the event
  // is over the scroll region we scroll it (clamped); otherwise we just swallow
  // the event so the page stays put.
  useEffect(() => {
    if (!open) return;
    const panel = panelRef.current;
    const scroll = scrollRef.current;
    if (!panel) return;
    function onWheel(e: WheelEvent) {
      if (scroll && scroll.contains(e.target as Node)) {
        const max = scroll.scrollHeight - scroll.clientHeight;
        scroll.scrollTop = Math.max(0, Math.min(max, scroll.scrollTop + e.deltaY));
      }
      // Always swallow the event so the page NEVER scrolls while chat is open.
      e.preventDefault();
      e.stopPropagation();
    }
    panel.addEventListener("wheel", onWheel, { passive: false });
    return () => panel.removeEventListener("wheel", onWheel);
  }, [open]);

  async function send(text?: string) {
    const message = (text ?? input).trim();
    if (!message || loading) return;
    setInput("");
    const next: ChatTurn[] = [...messages, { role: "user", content: message }];
    setMessages(next);
    setLoading(true);
    setContext([]);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message }),
      });
      const data = await res.json();
      if (data.success) {
        setMessages([...next, { role: "assistant", content: data.reply }]);
        setContext(data.context || []);
      } else {
        setMessages([
          ...next,
          { role: "assistant", content: "Sorry, I couldn't process that. Please try again." },
        ]);
      }
    } catch {
      setMessages([
        ...next,
        {
          role: "assistant",
          content: "Network error. Please check your connection and try again.",
        },
      ]);
      toast.error("Chat request failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          ref={panelRef}
          initial={{ opacity: 0, x: 40, scale: 0.96 }}
          animate={{ opacity: 1, x: 0, scale: 1 }}
          exit={{ opacity: 0, x: 40, scale: 0.96 }}
          transition={{ type: "spring", stiffness: 260, damping: 26 }}
          role="dialog"
          aria-label="Pulse AI news assistant"
          aria-modal="true"
          className="fixed bottom-4 right-4 z-50 flex h-[85vh] w-[calc(100vw-2rem)] max-w-md flex-col overflow-hidden rounded-2xl border border-border bg-card/95 shadow-2xl backdrop-blur-xl sm:bottom-6 sm:right-6"
        >
          {/* Header */}
          <div className="flex flex-shrink-0 items-center justify-between border-b border-border bg-gradient-to-r from-pink-500/10 via-purple-500/10 to-cyan-500/10 px-4 py-3">
            <div className="flex items-center gap-2.5">
              <div className="tn-breathe flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-pink-500 to-blue-500 text-white">
                <Bot className="h-5 w-5" />
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="text-sm font-bold">Pulse</span>
                  <span className="flex items-center gap-1 text-[0.6rem] font-semibold uppercase tracking-wider text-purple-400">
                    <Sparkles className="h-3 w-3" /> AI
                  </span>
                </div>
                <div className="flex items-center gap-1 text-[0.7rem] text-muted-foreground">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 tn-pulse-dot" />
                  News assistant · online
                </div>
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => onOpenChange(false)}
              aria-label="Close chat"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          {/*
            Messages scroll container.
            CRITICAL: `min-h-0` + `flex-1` + `overflow-y-auto` makes this a real
            bounded scroll region. Without `min-h-0`, a flex item's min-height
            defaults to `auto` (content size) and the container grows instead of
            scrolling — which is exactly the page-scroll-instead-of-chat bug.
            `overscroll-contain` stops wheel/touch scroll chaining to the page.
          */}
          <div
            ref={scrollRef}
            className="tn-scroll-thin min-h-0 flex-1 overflow-y-auto overscroll-contain"
          >
            <div className="space-y-4 p-4">
              {messages.length === 0 && (
                <div className="space-y-4 py-6 text-center">
                  <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-pink-500/20 to-blue-500/20">
                    <MessageSquare className="h-7 w-7 text-purple-300" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold">Ask Pulse about the news</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      I&apos;m grounded on the latest tech &amp; AI stories. Try a question:
                    </p>
                  </div>
                  <div className="flex flex-col gap-2">
                    {SUGGESTIONS.map((s) => (
                      <button
                        key={s}
                        onClick={() => send(s)}
                        className="rounded-lg border border-border bg-secondary/40 px-3 py-2 text-left text-xs text-foreground/90 transition-all hover:border-pink-500/30 hover:bg-secondary"
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {messages.map((m, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${
                      m.role === "user"
                        ? "rounded-br-sm bg-gradient-to-br from-pink-500 to-blue-500 text-white"
                        : "rounded-bl-sm border border-border bg-secondary/60 text-foreground/90"
                    }`}
                  >
                    <div className="whitespace-pre-wrap break-words">{m.content}</div>
                    {m.role === "assistant" && i === messages.length - 1 && context.length > 0 && (
                      <div className="mt-2.5 border-t border-white/10 pt-2">
                        <div className="mb-1 text-[0.6rem] font-semibold uppercase tracking-wider text-muted-foreground">
                          Sources
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {context.slice(0, 4).map((c, j) => (
                            <a
                              key={j}
                              href={c.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-[0.65rem] text-cyan-400 hover:underline"
                            >
                              [{j + 1}]
                            </a>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </motion.div>
              ))}

              {loading && (
                <div className="flex justify-start">
                  <div className="flex items-center gap-2 rounded-2xl rounded-bl-sm border border-border bg-secondary/60 px-3.5 py-2.5">
                    <Loader2 className="h-4 w-4 animate-spin text-purple-400" />
                    <span className="text-xs text-muted-foreground">
                      Pulse is reading the news…
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Input */}
          <div className="flex-shrink-0 border-t border-border p-3">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                send();
              }}
              className="flex items-center gap-2"
            >
              <Input
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask about AI, tech, a topic…"
                disabled={loading}
                className="h-9 flex-1 bg-secondary/40"
                maxLength={2000}
                autoComplete="off"
              />
              <Button
                type="submit"
                size="icon"
                className="h-9 w-9 flex-shrink-0 bg-gradient-to-br from-pink-500 to-blue-500"
                disabled={loading || !input.trim()}
                aria-label="Send message"
              >
                <Send className="h-4 w-4" />
              </Button>
            </form>
            <div className="mt-1.5 flex items-center justify-between px-1">
              <Badge variant="secondary" className="bg-white/5 text-[0.6rem] text-muted-foreground">
                <Sparkles className="mr-1 h-2.5 w-2.5" /> Powered by Z.ai
              </Badge>
              {messages.length > 0 && (
                <button
                  onClick={() => {
                    setMessages([]);
                    setContext([]);
                    toast.success("Chat cleared");
                  }}
                  className="flex items-center gap-1 text-[0.65rem] text-muted-foreground transition-colors hover:text-foreground"
                >
                  <Trash2 className="h-3 w-3" /> Clear
                </button>
              )}
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

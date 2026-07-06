"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Bot,
  Send,
  Sparkles,
  X,
  Loader2,
  MessageSquare,
  Trash2,
  RotateCw,
  User as UserIcon,
  ExternalLink,
} from "lucide-react";
import { ChatTurn } from "@/lib/types";
import { toast } from "sonner";
import { ChatMarkdown } from "./chat-markdown";

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

interface ChatContextItem {
  title: string;
  url: string;
}

export function ChatPanel({ open, onOpenChange }: ChatPanelProps) {
  const [messages, setMessages] = useState<ChatTurn[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  // Per-message context: only the latest assistant message has context.
  const [context, setContext] = useState<ChatContextItem[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const loadHistory = useCallback(async () => {
    try {
      const res = await fetch("/api/chat", { cache: "no-store" });
      const data = await res.json();
      if (data.success && Array.isArray(data.history)) {
        setMessages(data.history);
        // Context isn't stored per-message historically; clear it on reload.
        setContext([]);
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

  // Lock wheel scrolling to the chat viewport (non-passive listener).
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
      e.preventDefault();
      e.stopPropagation();
    }
    panel.addEventListener("wheel", onWheel, { passive: false });
    return () => panel.removeEventListener("wheel", onWheel);
  }, [open]);

  const send = useCallback(
    async (text?: string) => {
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
            {
              role: "assistant",
              content:
                "Sorry, I couldn't process that right now. Please try again in a moment.",
            },
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
    },
    [input, loading, messages],
  );

  // Regenerate the last assistant response: drop it and re-ask the last user msg.
  const regenerate = useCallback(async () => {
    if (loading || messages.length < 2) return;
    // Find the last user message (there must be one before the last assistant).
    const lastUserIdx = [...messages].reverse().findIndex((m) => m.role === "user");
    if (lastUserIdx === -1) return;
    const userIdx = messages.length - 1 - lastUserIdx;
    const lastUserMsg = messages[userIdx].content;
    const trimmed = messages.slice(0, userIdx); // keep history up to (not incl) last user msg
    setMessages([...trimmed, { role: "user", content: lastUserMsg }]);
    setLoading(true);
    setContext([]);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: lastUserMsg }),
      });
      const data = await res.json();
      if (data.success) {
        setMessages([...trimmed, { role: "user", content: lastUserMsg }, { role: "assistant", content: data.reply }]);
        setContext(data.context || []);
      }
    } catch {
      toast.error("Regenerate failed");
    } finally {
      setLoading(false);
    }
  }, [loading, messages]);

  const clearChat = useCallback(async () => {
    setMessages([]);
    setContext([]);
    try {
      await fetch("/api/chat", { method: "DELETE" });
      toast.success("Chat cleared");
    } catch {
      toast.error("Couldn't clear chat history");
    }
  }, []);

  const lastAssistantIdx = [...messages].reverse().findIndex((m) => m.role === "assistant");

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

          {/* Messages */}
          <div
            ref={scrollRef}
            className="tn-scroll-thin min-h-0 flex-1 overflow-y-auto overscroll-contain"
          >
            <div className="space-y-4 p-4">
              {messages.length === 0 && !loading && (
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

              {messages.map((m, i) => {
                const isUser = m.role === "user";
                const isLastAssistant =
                  !isUser && lastAssistantIdx !== -1 && i === messages.length - 1 - lastAssistantIdx;
                return (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`flex items-end gap-2 ${isUser ? "justify-end" : "justify-start"}`}
                  >
                    {/* Bot avatar (assistant only) */}
                    {!isUser && (
                      <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-pink-500 to-blue-500 text-white">
                        <Bot className="h-4 w-4" />
                      </div>
                    )}
                    <div
                      className={`min-w-0 max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${
                        isUser
                          ? "rounded-br-sm bg-gradient-to-br from-pink-500 to-blue-500 text-white shadow-lg shadow-pink-500/20"
                          : "rounded-bl-sm border border-border bg-secondary/60 text-foreground/90"
                      }`}
                    >
                      {isUser ? (
                        <div className="whitespace-pre-wrap break-words">{m.content}</div>
                      ) : (
                        <ChatMarkdown content={m.content} />
                      )}

                      {/* Sources — show ALL cited sources on the latest assistant message */}
                      {isLastAssistant && context.length > 0 && (
                        <div className="mt-2.5 border-t border-white/10 pt-2">
                          <div className="mb-1.5 text-[0.6rem] font-semibold uppercase tracking-wider text-muted-foreground">
                            Sources
                          </div>
                          <div className="flex flex-wrap gap-1">
                            {context.slice(0, 8).map((c, j) => (
                              <a
                                key={j}
                                href={c.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                title={c.title}
                                className="inline-flex h-5 min-w-5 items-center justify-center rounded bg-white/10 px-1.5 text-[0.65rem] font-medium text-cyan-400 transition-colors hover:bg-cyan-500/20 hover:text-cyan-300"
                              >
                                {j + 1}
                              </a>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                    {/* User avatar (user only) */}
                    {isUser && (
                      <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-secondary border border-border text-muted-foreground">
                        <UserIcon className="h-4 w-4" />
                      </div>
                    )}
                  </motion.div>
                );
              })}

              {/* Loading indicator with a subtle shimmer */}
              {loading && (
                <div className="flex items-end gap-2">
                  <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-pink-500 to-blue-500 text-white">
                    <Bot className="h-4 w-4" />
                  </div>
                  <div className="flex items-center gap-2 rounded-2xl rounded-bl-sm border border-border bg-secondary/60 px-3.5 py-3">
                    <span className="flex gap-1">
                      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-purple-400 [animation-delay:-0.3s]" />
                      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-pink-400 [animation-delay:-0.15s]" />
                      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-cyan-400" />
                    </span>
                  </div>
                </div>
              )}

              {/* Regenerate button under the last assistant message (when not loading) */}
              {!loading && messages.length > 0 && lastAssistantIdx === 0 && (
                <div className="flex justify-start pl-9">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 gap-1.5 text-[0.7rem] text-muted-foreground hover:text-foreground"
                    onClick={regenerate}
                  >
                    <RotateCw className="h-3 w-3" /> Regenerate
                  </Button>
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
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </Button>
            </form>
            <div className="mt-1.5 flex items-center justify-between px-1">
              <Badge variant="secondary" className="bg-white/5 text-[0.6rem] text-muted-foreground">
                <Sparkles className="mr-1 h-2.5 w-2.5" /> Powered by Z.ai
              </Badge>
              {messages.length > 0 && (
                <button
                  onClick={clearChat}
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

"use client";

import ReactMarkdown from "react-markdown";
import { memo } from "react";

/**
 * Lightweight markdown renderer for chat messages.
 * Renders bold, italics, bullet lists, numbered lists, inline code, links,
 * and paragraphs — nothing heavier (no images, no code blocks with syntax
 * highlighting) to keep the chat bubbles fast and compact.
 *
 * gfm (GitHub Flavored Markdown) is enabled for strikethrough + tables.
 */
function ChatMarkdownImpl({ content }: { content: string }) {
  return (
    <div className="chat-markdown">
      <ReactMarkdown
        gfm
        components={{
          // Links open in a new tab safely
          a: ({ node, ...props }) => (
            <a
              {...props}
              target="_blank"
              rel="noopener noreferrer"
              className="text-cyan-400 underline underline-offset-2 hover:text-cyan-300"
            />
          ),
          // Compact paragraphs
          p: ({ node, ...props }) => <p className="my-1 first:mt-0 last:mb-0" {...props} />,
          // Tight bullet lists
          ul: ({ node, ...props }) => (
            <ul className="my-1 list-disc space-y-0.5 pl-4 first:mt-0 last:mb-0" {...props} />
          ),
          ol: ({ node, ...props }) => (
            <ol className="my-1 list-decimal space-y-0.5 pl-4 first:mt-0 last:mb-0" {...props} />
          ),
          li: ({ node, ...props }) => <li className="leading-relaxed" {...props} />,
          // Inline code
          code: ({ node, className, children, ...props }) => {
            const isBlock = /language-/.test(className || "");
            if (isBlock) {
              return (
                <code
                  className="block overflow-x-auto rounded bg-black/40 p-2 font-mono text-[0.8rem]"
                  {...props}
                >
                  {children}
                </code>
              );
            }
            return (
              <code
                className="rounded bg-white/10 px-1 py-0.5 font-mono text-[0.85em]"
                {...props}
              >
                {children}
              </code>
            );
          },
          pre: ({ node, ...props }) => <pre className="my-1.5" {...props} />,
          strong: ({ node, ...props }) => <strong className="font-semibold text-foreground" {...props} />,
          em: ({ node, ...props }) => <em className="italic" {...props} />,
          blockquote: ({ node, ...props }) => (
            <blockquote
              className="my-1 border-l-2 border-pink-400/50 pl-2 italic text-foreground/80"
              {...props}
            />
          ),
          h1: ({ node, ...props }) => <h3 className="my-1 text-sm font-bold first:mt-0" {...props} />,
          h2: ({ node, ...props }) => <h3 className="my-1 text-sm font-bold first:mt-0" {...props} />,
          h3: ({ node, ...props }) => <h3 className="my-1 text-sm font-semibold first:mt-0" {...props} />,
          hr: ({ node, ...props }) => <hr className="my-2 border-border" {...props} />,
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}

export const ChatMarkdown = memo(ChatMarkdownImpl);

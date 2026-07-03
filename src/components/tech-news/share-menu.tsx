"use client";

import { useState } from "react";
import {
  Share2,
  Copy,
  Check,
  Twitter,
  Linkedin,
  Facebook,
  MessageSquare,
  Mail,
  ExternalLink,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface ShareMenuProps {
  articleId: string;
  title: string;
  url: string;
  compact?: boolean;
}

export function ShareMenu({ articleId, title, url, compact = false }: ShareMenuProps) {
  const [copied, setCopied] = useState(false);

  async function recordShare(channel: string) {
    try {
      await fetch("/api/share", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ articleId, channel }),
      });
    } catch {
      // analytics only — ignore errors
    }
  }

  async function copyLink(e?: React.MouseEvent) {
    e?.stopPropagation();
    e?.preventDefault();
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast.success("Link copied to clipboard");
      await recordShare("copy");
      setTimeout(() => setCopied(false), 1800);
    } catch {
      toast.error("Couldn't copy link");
    }
  }

  function openShare(url: string, channel: string) {
    return async (e: React.MouseEvent) => {
      e.stopPropagation();
      e.preventDefault();
      window.open(url, "_blank", "noopener,noreferrer,width=620,height=600");
      await recordShare(channel);
    };
  }

  function nativeShare(e: React.MouseEvent) {
    e.stopPropagation();
    e.preventDefault();
    if (typeof navigator !== "undefined" && (navigator as any).share) {
      (navigator as any)
        .share({ title, url, text: title })
        .then(() => recordShare("native"))
        .catch(() => {});
    } else {
      copyLink();
    }
  }

  const encUrl = encodeURIComponent(url);
  const encTitle = encodeURIComponent(title);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size={compact ? "icon" : "sm"}
          className={compact ? "h-8 w-8" : "h-8 px-2.5"}
          onClick={(e) => {
            e.stopPropagation();
            e.preventDefault();
          }}
          aria-label="Share article"
        >
          <Share2 className="h-4 w-4" />
          {!compact && <span className="ml-1.5 text-xs">Share</span>}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="w-56"
        onClick={(e) => e.stopPropagation()}
      >
        <DropdownMenuLabel>Share this story</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={nativeShare} className="cursor-pointer">
          <Share2 className="mr-2 h-4 w-4" /> Native share
        </DropdownMenuItem>
        <DropdownMenuItem onClick={copyLink} className="cursor-pointer">
          {copied ? (
            <Check className="mr-2 h-4 w-4 text-emerald-400" />
          ) : (
            <Copy className="mr-2 h-4 w-4" />
          )}
          {copied ? "Copied!" : "Copy link"}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={openShare(
            `https://twitter.com/intent/tweet?text=${encTitle}&url=${encUrl}`,
            "twitter",
          )}
          className="cursor-pointer"
        >
          <Twitter className="mr-2 h-4 w-4" /> Twitter / X
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={openShare(
            `https://www.linkedin.com/sharing/share-offsite/?url=${encUrl}`,
            "linkedin",
          )}
          className="cursor-pointer"
        >
          <Linkedin className="mr-2 h-4 w-4" /> LinkedIn
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={openShare(
            `https://www.facebook.com/sharer/sharer.php?u=${encUrl}`,
            "facebook",
          )}
          className="cursor-pointer"
        >
          <Facebook className="mr-2 h-4 w-4" /> Facebook
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={openShare(
            `https://www.reddit.com/submit?url=${encUrl}&title=${encTitle}`,
            "reddit",
          )}
          className="cursor-pointer"
        >
          <MessageSquare className="mr-2 h-4 w-4" /> Reddit
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={openShare(`mailto:?subject=${encTitle}&body=${encUrl}`, "email")}
          className="cursor-pointer"
        >
          <Mail className="mr-2 h-4 w-4" /> Email
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={(e) => {
            e.stopPropagation();
            window.open(url, "_blank", "noopener,noreferrer");
          }}
          className="cursor-pointer"
        >
          <ExternalLink className="mr-2 h-4 w-4" /> Open original
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

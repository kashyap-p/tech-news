export type NewsSource = "devto" | "hackernews" | "web";

export interface ArticleDTO {
  id: string;
  source: NewsSource;
  sourceId: string;
  category: string;
  title: string;
  description: string;
  url: string;
  image: string | null;
  author: string | null;
  publishedAt: string | null;
  aiSummary: string | null;
  aiTags: string | null;
  points: number;
  createdAt: string;
}

export interface TrendingTag {
  tag: string;
  count: number;
}

export interface ChatTurn {
  role: "user" | "assistant";
  content: string;
}

export const SOURCE_META: Record<
  NewsSource,
  { label: string; short: string; color: string; bg: string; border: string }
> = {
  devto: {
    label: "Dev.to",
    short: "DEV",
    color: "text-emerald-400",
    bg: "bg-emerald-500/15",
    border: "border-emerald-500/30",
  },
  hackernews: {
    label: "Hacker News",
    short: "HN",
    color: "text-orange-400",
    bg: "bg-orange-500/15",
    border: "border-orange-500/30",
  },
  web: {
    label: "Web",
    short: "WEB",
    color: "text-cyan-400",
    bg: "bg-cyan-500/15",
    border: "border-cyan-500/30",
  },
};

export const CATEGORY_TABS = [
  { key: "all", label: "All News" },
  { key: "ai", label: "AI" },
  { key: "tech", label: "Tech" },
  { key: "devto", label: "Dev.to" },
  { key: "hackernews", label: "Hacker News" },
  { key: "web", label: "Worldwide" },
] as const;

export type CategoryKey = (typeof CATEGORY_TABS)[number]["key"];

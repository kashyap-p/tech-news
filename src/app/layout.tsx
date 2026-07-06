import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "TechNews Worldwide — AI & Tech News, Decoded",
  description:
    "A visually stunning, AI-powered aggregator for technology and artificial-intelligence news from around the world. Read, summarize, bookmark and share — with an AI news assistant built in.",
  keywords: [
    "tech news",
    "AI news",
    "artificial intelligence",
    "technology",
    "developer news",
    "hacker news",
    "Dev.to",
    "news aggregator",
    "AI summary",
  ],
  authors: [{ name: "TechNews Worldwide" }],
  icons: {
    icon: "/logo.svg",
  },
  openGraph: {
    title: "TechNews Worldwide — AI & Tech News, Decoded",
    description:
      "AI-powered aggregator for technology and AI news from around the world. Read, summarize, bookmark and share.",
    siteName: "TechNews Worldwide",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "TechNews Worldwide",
    description: "AI & tech news from around the world, decoded by AI.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        {children}
        <Toaster />
      </body>
    </html>
  );
}

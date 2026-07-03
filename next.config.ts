import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* Vercel-compatible config. `output: "standalone"` was removed — it's for
     Docker/VM deploys and breaks the Vercel build pipeline. */
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
};

export default nextConfig;

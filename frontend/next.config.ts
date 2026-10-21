import type { NextConfig } from "next";

const rawApiUrl = process.env.USUALLY_API_URL;
const isVercel = Boolean(process.env.VERCEL);

if (isVercel && !rawApiUrl) {
  throw new Error(
    "Missing USUALLY_API_URL environment variable on Vercel deployment. " +
    "Set USUALLY_API_URL in your Vercel Project Settings to your Railway FastAPI backend URL (e.g. https://usually-backend.up.railway.app)."
  );
}

// Fallback cleanly to local development port if unspecified
const backendOrigin = (rawApiUrl || "http://127.0.0.1:8000").replace(/\/+$/, "");

const nextConfig: NextConfig = {
  reactStrictMode: true,
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${backendOrigin}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;

import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The in-editor browser preview loads the app from 127.0.0.1; without this the dev
  // server blocks its JS/HMR requests, the page never hydrates and buttons do nothing.
  allowedDevOrigins: ["127.0.0.1"],
  // Hide the floating "N" dev badge (it covers the sidebar footer). Errors still show.
  devIndicators: false,
  experimental: {
    serverActions: {
      // Unit photo uploads (up to 8 MB each, several at once)
      bodySizeLimit: "25mb",
      // The in-editor preview proxies 127.0.0.1:<port> to localhost; without this every
      // form action from the preview (uploads, saves) is rejected as cross-site. Dev only.
      ...(process.env.NODE_ENV === "development" ? { allowedOrigins: ["127.0.0.*"] } : {}),
    },
  },
};

export default nextConfig;

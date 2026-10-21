import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The in-editor browser preview loads the app from 127.0.0.1; without this the dev
  // server blocks its JS/HMR requests, the page never hydrates and buttons do nothing.
  allowedDevOrigins: ["127.0.0.1"],
};

export default nextConfig;

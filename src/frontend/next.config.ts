import type { NextConfig } from "next";

const nextConfig = {
  output: 'standalone', // changed to 'standalone' for deployment, previously 'export'
  reactStrictMode: true,
};

export default nextConfig;

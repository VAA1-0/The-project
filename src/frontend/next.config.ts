import type { NextConfig } from "next";

const nextConfig = {
  output: 'standalone', // changed to 'standalone' for deployment, previously 'export'
  reactStrictMode: true,
  /*async rewrites() {
    return [
      {
        source: '/cvat/:path*',
        destination: 'http://localhost:8080/:path*', // CVAT backend/frontend
      },
    ];
  },*/
  /*async rewrites() {
    return [
      {
        source: '/cvat/:path*',
        destination: `${process.env.NEXT_PUBLIC_CVAT_BASE_URL || 'http://localhost:8080'}/:path*`,
      },
    ];
  },*/
};

export default nextConfig;

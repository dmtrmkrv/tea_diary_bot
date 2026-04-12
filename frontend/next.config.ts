import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**.twc1.net',
      },
      {
        protocol: 'https',
        hostname: '**.timeweb.cloud',
      },
      {
        protocol: 'https',
        hostname: 's3.twcstorage.ru',
      },
    ],
  },
};

export default nextConfig;

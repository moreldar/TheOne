import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**",
      },
    ],
  },
  webpack: (webpackConfig) => {
    // bullmq optionally supports the Valkey Glide client; we only use
    // ioredis, so this avoids a "module not found" build warning for an
    // optional dependency we never import.
    webpackConfig.resolve.alias = {
      ...webpackConfig.resolve.alias,
      "@valkey/valkey-glide": false,
    };
    return webpackConfig;
  },
};

export default nextConfig;

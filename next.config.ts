import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: "/online_result",
        destination: "/online-result",
      },
    ];
  },
};

export default nextConfig;

import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      {
        source: "/t/:deviceCode",
        destination: "/tap/:deviceCode",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;

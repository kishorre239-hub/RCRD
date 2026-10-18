import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      {
        source: "/calendar",
        destination: "/meetings",
        permanent: false,
      },
    ];
  },
};

export default nextConfig;

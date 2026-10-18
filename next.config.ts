import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      {
        source: "/calendar",
        destination: "/meetings",
        permanent: false,
      },
      {
        source: "/signup",
        destination: "/login",
        permanent: false,
      },
    ];
  },
};

export default nextConfig;

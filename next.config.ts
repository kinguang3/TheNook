import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "exixzgnhsyjnsrgzhrct.supabase.co",
      },
    ],
  },
};

export default nextConfig;

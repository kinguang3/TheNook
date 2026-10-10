import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // 默认仅 webp；开启 avif 后封面体积可再降约 30%，代价是首次转换稍慢
    formats: ["image/avif", "image/webp"],
    remotePatterns: [
      {
        protocol: "https",
        hostname: "exixzgnhsyjnsrgzhrct.supabase.co",
      },
    ],
  },
};

export default nextConfig;

import type { NextConfig } from "next";

// 封面放在 Supabase Storage 里：域名跟随 NEXT_PUBLIC_SUPABASE_URL，
// 换项目时无需再手改 next.config.ts。
function supabaseImageHost(): string {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (url) {
    try {
      return new URL(url).hostname;
    } catch {
      // 配置格式错误时保留旧域名，避免构建期直接失败
    }
  }
  return "exixzgnhsyjnsrgzhrct.supabase.co";
}

const nextConfig: NextConfig = {
  poweredByHeader: false,
  images: {
    // 默认仅 webp；开启 avif 后封面体积可再降约 30%，代价是首次转换稍慢
    formats: ["image/avif", "image/webp"],
    // 封面按固定路径存放，优化结果缓存 31 天，减少边缘重复转换
    minimumCacheTTL: 2678400,
    remotePatterns: [
      {
        protocol: "https",
        hostname: supabaseImageHost(),
      },
    ],
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          {
            key: "Strict-Transport-Security",
            value: "max-age=31536000; includeSubDomains",
          },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(), payment=()",
          },
        ],
      },
    ];
  },
};

export default nextConfig;

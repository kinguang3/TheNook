import type { NextConfig } from "next";

// 封面放在 Supabase Storage 里：域名/协议/端口跟随 NEXT_PUBLIC_SUPABASE_URL，
// 换项目或改连本地 Supabase 时无需再手改 next.config.ts。
type SupabaseImagePattern = {
  protocol: "http" | "https";
  hostname: string;
  port?: string;
};

const FALLBACK_SUPABASE_IMAGE: SupabaseImagePattern = {
  protocol: "https",
  hostname: "exixzgnhsyjnsrgzhrct.supabase.co",
};

function supabaseImagePattern(): SupabaseImagePattern {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (url) {
    try {
      const parsed = new URL(url);
      return {
        protocol: parsed.protocol === "http:" ? "http" : "https",
        hostname: parsed.hostname,
        ...(parsed.port ? { port: parsed.port } : {}),
      };
    } catch {
      // 配置格式错误时保留旧域名，避免构建期直接失败
    }
  }
  return FALLBACK_SUPABASE_IMAGE;
}

const nextConfig: NextConfig = {
  poweredByHeader: false,
  images: {
    // 默认仅 webp；开启 avif 后封面体积可再降约 30%，代价是首次转换稍慢
    formats: ["image/avif", "image/webp"],
    // 封面按固定路径存放，优化结果缓存 31 天，减少边缘重复转换
    minimumCacheTTL: 2678400,
    remotePatterns: [supabaseImagePattern()],
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

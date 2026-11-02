import type { MetadataRoute } from "next";
import { absoluteUrl } from "@/lib/site";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/auth/",
        "/forgot-password",
        "/login",
        "/search",
        "/shelf",
        "/signup",
      ],
    },
    sitemap: absoluteUrl("/sitemap.xml"),
  };
}

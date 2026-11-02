export const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://thenook.cc.cd"
).replace(/\/+$/, "");

export const SITE_NAME = "Casebook Timeline";

export const SITE_DESCRIPTION =
  "一个以纵向时间线呈现的推理小说推荐与收藏网站，支持标签筛选、收藏、评分与专题聚合。";

export function absoluteUrl(path: string): string {
  return `${SITE_URL}${path.startsWith("/") ? path : `/${path}`}`;
}

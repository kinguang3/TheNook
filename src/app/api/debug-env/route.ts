import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
  const site = process.env.NEXT_PUBLIC_SITE_URL ?? "";

  return NextResponse.json({
    supabaseUrl: {
      present: Boolean(url),
      length: url.length,
      value: url ? `${url.slice(0, 12)}...` : null,
    },
    anonKey: {
      present: Boolean(key),
      length: key.length,
      prefix: key ? key.slice(0, 12) : null,
    },
    siteUrl: { present: Boolean(site), value: site || null },
    nodeEnv: process.env.NODE_ENV ?? null,
  });
}

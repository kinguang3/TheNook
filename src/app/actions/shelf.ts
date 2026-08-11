"use server";

import { createClient } from "@/lib/supabase/server";
import { getShelfData } from "@/lib/data";
import type { ShelfData, ShelfStatus } from "@/lib/types";

export type ShelfResult =
  | { data?: ShelfData; error?: string }
  | undefined;

function deriveStatus(progress: number): ShelfStatus {
  if (progress >= 100) return "finished";
  if (progress > 0) return "reading";
  return "unread";
}

async function requireShelf(): Promise<ShelfData | { error: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "请先登录后操作。" };
  }

  return getShelfData(supabase, user.id);
}

export async function setProgress(
  bookId: string,
  progressValue: number,
): Promise<ShelfResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "请先登录后操作。" };
  }

  const progress = Math.min(Math.max(Math.round(progressValue), 0), 100);

  await supabase.from("shelf").upsert(
    {
      user_id: user.id,
      book_id: bookId,
      progress,
      status: deriveStatus(progress),
      last_read_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,book_id" },
  );

  const result = await requireShelf();
  return "error" in result ? result : { data: result };
}

export async function setStatus(
  bookId: string,
  status: ShelfStatus,
): Promise<ShelfResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "请先登录后操作。" };
  }

  const progress = status === "finished" ? 100 : status === "unread" ? 0 : null;

  const record: {
    user_id: string;
    book_id: string;
    status: ShelfStatus;
    progress?: number;
    last_read_at: string;
    updated_at: string;
  } = {
    user_id: user.id,
    book_id: bookId,
    status,
    last_read_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  if (progress !== null) {
    record.progress = progress;
  }

  await supabase.from("shelf").upsert(
    record,
    { onConflict: "user_id,book_id" },
  );

  const result = await requireShelf();
  return "error" in result ? result : { data: result };
}
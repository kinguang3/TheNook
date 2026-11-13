"use server";

import { getCurrentUser } from "@/lib/supabase/server";
import type { ShelfData, ShelfStatus } from "@/lib/types";

export type ShelfResult =
  | { data?: ShelfData; error?: string }
  | undefined;

const shelfStatuses = new Set<ShelfStatus>([
  "unread",
  "reading",
  "finished",
]);

function deriveStatus(progress: number): ShelfStatus {
  if (progress >= 100) return "finished";
  if (progress > 0) return "reading";
  return "unread";
}

type ShelfRow = {
  book_id: string;
  progress: number;
  status: string;
  last_read_at: string | null;
};

// 只回传本次变更的书：客户端按 bookId 合并，避免整张书架来回传输
function toShelfPatch(row: ShelfRow): ShelfData {
  const status = row.status as ShelfStatus;
  if (!shelfStatuses.has(status)) return {};
  return {
    [row.book_id]: {
      progress: Number(row.progress),
      status,
      lastReadAt: row.last_read_at,
    },
  };
}

export async function setProgress(
  bookId: string,
  progressValue: number,
): Promise<ShelfResult> {
  const { supabase, user } = await getCurrentUser();
  if (!user) {
    return { error: "请先登录后操作。" };
  }

  if (!Number.isFinite(progressValue)) {
    return { error: "进度必须是 0-100 之间的数字。" };
  }

  const progress = Math.min(Math.max(Math.round(progressValue), 0), 100);

  // upsert + select 一次往返拿回写入后的行，省掉重新查询整张书架
  const { data, error } = await supabase
    .from("shelf")
    .upsert(
      {
        user_id: user.id,
        book_id: bookId,
        progress,
        status: deriveStatus(progress),
        last_read_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,book_id" },
    )
    .select("book_id, progress, status, last_read_at")
    .single();
  if (error || !data) {
    return { error: "进度更新失败，请稍后再试。" };
  }

  return { data: toShelfPatch(data as ShelfRow) };
}

export async function setStatus(
  bookId: string,
  status: ShelfStatus,
): Promise<ShelfResult> {
  const { supabase, user } = await getCurrentUser();
  if (!user) {
    return { error: "请先登录后操作。" };
  }

  if (!shelfStatuses.has(status)) {
    return { error: "无效的阅读状态。" };
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

  const { data, error } = await supabase
    .from("shelf")
    .upsert(record, { onConflict: "user_id,book_id" })
    .select("book_id, progress, status, last_read_at")
    .single();
  if (error || !data) {
    return { error: "状态更新失败，请稍后再试。" };
  }

  return { data: toShelfPatch(data as ShelfRow) };
}

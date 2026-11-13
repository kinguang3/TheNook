"use server";

import { updateTag } from "next/cache";
import { getCurrentUser } from "@/lib/supabase/server";
import { getNotes } from "@/lib/data";
import { NOTE_MAX_LENGTH, type RatingStatView, type UserDataPatch } from "@/lib/types";

export type UserDataResult =
  | { data?: UserDataPatch; error?: string }
  | undefined;

export async function toggleFavorite(
  bookId: string,
): Promise<UserDataResult> {
  const { supabase, user } = await getCurrentUser();
  if (!user) {
    return { error: "请先登录后操作。" };
  }

  const { data: existing, error: lookupError } = await supabase
    .from("favorites")
    .select("book_id")
    .eq("user_id", user.id)
    .eq("book_id", bookId)
    .maybeSingle();
  if (lookupError) {
    return { error: "收藏失败，请稍后再试。" };
  }

  if (existing) {
    const { error } = await supabase
      .from("favorites")
      .delete()
      .eq("user_id", user.id)
      .eq("book_id", bookId);
    if (error) {
      return { error: "取消收藏失败，请稍后再试。" };
    }
  } else {
    const { error } = await supabase.from("favorites").insert({
      user_id: user.id,
      book_id: bookId,
    });
    if (error) {
      return { error: "收藏失败，请稍后再试。" };
    }
  }

  // 只回传被切换的那本书：省掉重新拉取全部收藏的往返与传输
  return {
    data: { favoriteState: { bookId, active: !existing } },
  };
}

export async function setRating(
  bookId: string,
  value: number,
): Promise<UserDataResult> {
  const { supabase, user } = await getCurrentUser();
  if (!user) {
    return { error: "请先登录后操作。" };
  }

  if (!Number.isInteger(value) || value < 1 || value > 5) {
    return { error: "评分必须是 1-5 的整数。" };
  }

  // upsert 更新分支不会触发列默认值，updated_at 需显式写入
  const { error } = await supabase.from("ratings").upsert(
    { user_id: user.id, book_id: bookId, value, updated_at: new Date().toISOString() },
    { onConflict: "user_id,book_id" },
  );
  if (error) {
    return { error: "评分失败，请稍后再试。" };
  }

  // 评分变化影响全站聚合分，主动失效缓存而不是等时间窗口
  updateTag("rating-stats");

  // 同时回传最新聚合值：页面上「读者综合评分」无需刷新即可更新。
  // 聚合查询失败时不影响评分本身成功，省略 ratingStat 让客户端保留旧值。
  // 只回传当前这本书的评分，省掉重新拉取用户全部评分的往返。
  const statResult = await supabase
    .from("rating_stats")
    .select("avg_value, rating_count")
    .eq("book_id", bookId)
    .maybeSingle();

  const data: UserDataPatch = { ratings: { [bookId]: value } };
  if (!statResult.error) {
    const row = statResult.data;
    const ratingStat: RatingStatView | null = row
      ? {
          avgValue: Number(row.avg_value),
          ratingCount: Number(row.rating_count),
        }
      : null;
    data.ratingStat = ratingStat;
  }

  return { data };
}

export async function saveNote(
  bookId: string,
  content: string,
): Promise<UserDataResult> {
  const { supabase, user } = await getCurrentUser();
  if (!user) {
    return { error: "请先登录后操作。" };
  }

  const trimmed = content.trim();
  if (trimmed.length > NOTE_MAX_LENGTH) {
    return { error: `笔记最多 ${NOTE_MAX_LENGTH} 字。` };
  }

  // 空内容走幂等删除，非空走 upsert：省掉保存前那次存在性查询。
  // upsert 的更新分支不会触发列默认值，updated_at 需显式写入。
  const { error } = trimmed
    ? await supabase.from("notes").upsert(
        {
          user_id: user.id,
          book_id: bookId,
          content: trimmed,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id,book_id" },
      )
    : await supabase
        .from("notes")
        .delete()
        .eq("user_id", user.id)
        .eq("book_id", bookId);
  if (error) {
    return { error: "保存失败，请稍后再试。" };
  }

  // 只回传笔记（唯一变化的一类）
  return { data: { notes: await getNotes(supabase, user.id) } };
}

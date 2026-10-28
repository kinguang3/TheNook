"use server";

import { revalidatePath, updateTag } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { REVIEW_MAX_LENGTH } from "@/lib/types";
import type { Review } from "@/lib/types";

export type ReviewMutationResult = {
  review?: Review;
  bookId?: string;
  error?: string;
};

function validateContent(content: string): string | null {
  const trimmed = content.trim();
  if (!trimmed) {
    return "评论内容不能为空。";
  }
  if (trimmed.length > REVIEW_MAX_LENGTH) {
    return `评论最多 ${REVIEW_MAX_LENGTH} 字。`;
  }
  return null;
}

export async function createReview(
  bookId: string,
  content: string,
): Promise<ReviewMutationResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "请先登录后发表评论。" };
  }

  const invalid = validateContent(content);
  if (invalid) {
    return { error: invalid };
  }

  // 身份取自服务端 Session，不信任前端传入的 user_id；
  // 顺带 return 里嵌入 profiles，省掉插入后再查一次昵称的往返
  const { data, error } = await supabase
    .from("reviews")
    .insert({
      book_id: bookId,
      user_id: user.id,
      content: content.trim(),
    })
    .select(
      "id, book_id, user_id, content, created_at, updated_at, profiles(display_name)",
    )
    .single();

  if (error) {
    if (error.code === "23503") {
      return { error: "该书籍不存在，无法发表评论。" };
    }
    return { error: "发表失败，请稍后再试。" };
  }

  const profile = (
    data as unknown as { profiles: { display_name: string } | null }
  ).profiles;

  updateTag("reviews");
  revalidatePath(`/books/${bookId}/reviews`);

  return {
    review: {
      id: data.id as string,
      bookId: data.book_id as string,
      userId: data.user_id as string,
      content: data.content as string,
      createdAt: data.created_at as string,
      updatedAt: data.updated_at as string,
      authorName: profile?.display_name ?? "匿名侦探",
    },
  };
}

export async function updateReview(
  reviewId: string,
  content: string,
): Promise<ReviewMutationResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "请先登录后操作。" };
  }

  const invalid = validateContent(content);
  if (invalid) {
    return { error: invalid };
  }

  // 同时按 id 与 user_id 过滤：即使 RLS 失效也不会改到他人评论
  const { data, error } = await supabase
    .from("reviews")
    .update({ content: content.trim(), updated_at: new Date().toISOString() })
    .eq("id", reviewId)
    .eq("user_id", user.id)
    .select(
      "id, book_id, user_id, content, created_at, updated_at, profiles(display_name)",
    )
    .maybeSingle();

  if (error) {
    return { error: "修改失败，请稍后再试。" };
  }
  if (!data) {
    return { error: "评论不存在或无权修改。" };
  }

  updateTag("reviews");
  revalidatePath(`/books/${data.book_id}/reviews`);

  const profile = (
    data as unknown as { profiles: { display_name: string } | null }
  ).profiles;

  return {
    review: {
      id: data.id as string,
      bookId: data.book_id as string,
      userId: data.user_id as string,
      content: data.content as string,
      createdAt: data.created_at as string,
      updatedAt: data.updated_at as string,
      authorName: profile?.display_name ?? "匿名侦探",
    },
  };
}

export async function deleteReview(
  reviewId: string,
): Promise<ReviewMutationResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "请先登录后操作。" };
  }

  const { data, error } = await supabase
    .from("reviews")
    .delete()
    .eq("id", reviewId)
    .eq("user_id", user.id)
    .select("book_id")
    .maybeSingle();

  if (error) {
    return { error: "删除失败，请稍后再试。" };
  }
  if (!data) {
    return { error: "评论不存在或无权删除。" };
  }

  updateTag("reviews");
  revalidatePath(`/books/${data.book_id}/reviews`);

  return { bookId: data.book_id as string };
}

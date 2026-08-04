"use server";

import { createClient } from "@/lib/supabase/server";
import { getUserData } from "@/lib/data";
import type { UserData } from "@/lib/types";

export type UserDataResult =
  | { data?: UserData; error?: string }
  | undefined;

async function requireUserData(): Promise<
  UserData | { error: string }
> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "请先登录后操作。" };
  }

  return getUserData(supabase, user.id);
}

export async function toggleFavorite(
  bookId: string,
): Promise<UserDataResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "请先登录后操作。" };
  }

  const { data: existing } = await supabase
    .from("favorites")
    .select("book_id")
    .eq("user_id", user.id)
    .eq("book_id", bookId)
    .maybeSingle();

  if (existing) {
    await supabase
      .from("favorites")
      .delete()
      .eq("user_id", user.id)
      .eq("book_id", bookId);
  } else {
    await supabase.from("favorites").insert({
      user_id: user.id,
      book_id: bookId,
    });
  }

  const result = await requireUserData();
  return "error" in result ? result : { data: result };
}

export async function setRating(
  bookId: string,
  value: number,
): Promise<UserDataResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "请先登录后操作。" };
  }

  await supabase.from("ratings").upsert(
    { user_id: user.id, book_id: bookId, value },
    { onConflict: "user_id,book_id" },
  );

  const result = await requireUserData();
  return "error" in result ? result : { data: result };
}

export async function saveNote(
  bookId: string,
  content: string,
): Promise<UserDataResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "请先登录后操作。" };
  }

  const trimmed = content.trim();
  const { data: existing } = await supabase
    .from("notes")
    .select("book_id")
    .eq("user_id", user.id)
    .eq("book_id", bookId)
    .maybeSingle();

  const record = { user_id: user.id, book_id: bookId, content: trimmed };

  if (existing) {
    await supabase
      .from("notes")
      .update({ content: trimmed })
      .eq("user_id", user.id)
      .eq("book_id", bookId);
  } else {
    await supabase.from("notes").insert(record);
  }

  const result = await requireUserData();
  return "error" in result ? result : { data: result };
}
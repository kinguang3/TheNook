import { createClient } from "@/lib/supabase/server";
import {
  getAuthors,
  getAllTags,
  getBooks,
  getRecentReviews,
  getSeries,
  getUserData,
} from "@/lib/data";
import { emptyUserData } from "@/lib/types";
import { HomeClient } from "@/components/home-client";
import { FootprintsLayer } from "@/components/footprints-layer";

type HomePageProps = {
  searchParams: Promise<{ focus?: string }>;
};

export default async function HomePage({ searchParams }: HomePageProps) {
  const { focus } = await searchParams;
  const supabase = await createClient();

  const [authors, seriesList] = await Promise.all([
    getAuthors(supabase),
    getSeries(supabase),
  ]);
  const books = await getBooks(supabase, authors, seriesList);

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [userData, recentReviews] = await Promise.all([
    user ? getUserData(supabase, user.id) : Promise.resolve(emptyUserData),
    getRecentReviews(supabase),
  ]);

  return (
    <>
      <FootprintsLayer />
      <HomeClient
        books={books}
        allTags={getAllTags(books)}
        initialUserData={userData}
        isAuthed={Boolean(user)}
        recentReviews={recentReviews}
        focusBookId={focus ?? null}
      />
    </>
  );
}
import { createClient } from "@/lib/supabase/server";
import {
  getAuthors,
  getAllTags,
  getBooks,
  getSeries,
  getUserData,
} from "@/lib/data";
import { emptyUserData } from "@/lib/types";
import { HomeClient } from "@/components/home-client";
import { FootprintsLayer } from "@/components/footprints-layer";

export default async function HomePage() {
  const supabase = await createClient();

  const [authors, seriesList] = await Promise.all([
    getAuthors(supabase),
    getSeries(supabase),
  ]);
  const books = await getBooks(supabase, authors, seriesList);

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const userData = user ? await getUserData(supabase, user.id) : emptyUserData;

  return (
    <>
      <FootprintsLayer />
      <HomeClient
        books={books}
        allTags={getAllTags(books)}
        initialUserData={userData}
        isAuthed={Boolean(user)}
      />
    </>
  );
}
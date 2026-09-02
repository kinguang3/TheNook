import { createClient } from "@/lib/supabase/server";
import {
  getAuthors,
  getBooks,
  getRatingStats,
  getRecentReviews,
  getSeries,
  getUserData,
} from "@/lib/data";
import { emptyUserData } from "@/lib/types";
import HomeClient from "@/components/home-client";

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

  const [userData, timelineReviews, ratingStats] = await Promise.all([
    user ? getUserData(supabase, user.id) : Promise.resolve(emptyUserData),
    getRecentReviews(supabase),
    getRatingStats(supabase),
  ]);

  return (
    <HomeClient
      initialBooks={books}
      userData={userData}
      ratingStats={ratingStats}
      timelineReviews={timelineReviews}
      isLoggedIn={Boolean(user)}
    />
  );
}

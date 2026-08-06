export type Author = {
  id: string;
  name: string;
  summary: string;
};

export type Series = {
  id: string;
  name: string;
  summary: string;
};

export type Book = {
  id: string;
  title: string;
  authorId: string;
  authorName: string;
  seriesId: string | null;
  seriesName: string;
  year: number;
  readTime: string;
  coverTone: string;
  coverMark: string;
  coverUrl: string;
  rating: number;
  tags: string[];
  blurb: string;
  note: string;
};

export type UserData = {
  favorites: string[];
  ratings: Record<string, number>;
  notes: Record<string, string>;
};

export const emptyUserData: UserData = {
  favorites: [],
  ratings: {},
  notes: {},
};

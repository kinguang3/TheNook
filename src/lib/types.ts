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

export type ShelfStatus = "unread" | "reading" | "finished";

export type ShelfEntry = {
  progress: number;
  status: ShelfStatus;
  lastReadAt: string | null;
};

export type ShelfData = Record<string, ShelfEntry>;

export type Review = {
  id: string;
  bookId: string;
  userId: string;
  content: string;
  createdAt: string;
  updatedAt: string;
  authorName: string;
};

export type RatingStat = {
  bookId: string;
  avgValue: number;
  ratingCount: number;
};

export const REVIEW_MAX_LENGTH = 2000;

export const emptyUserData: UserData = {
  favorites: [],
  ratings: {},
  notes: {},
};

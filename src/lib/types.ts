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

export type ShelfRow = ShelfEntry & {
  bookId: string;
};

export type Review = {
  id: string;
  bookId: string;
  userId: string;
  content: string;
  createdAt: string;
  updatedAt: string;
  authorName: string;
};

export type TimelineReview = {
  id: string;
  bookId: string;
  excerpt: string;
  createdAt: string;
  authorName: string;
};

export const REVIEW_MAX_LENGTH = 2000;

export const emptyUserData: UserData = {
  favorites: [],
  ratings: {},
  notes: {},
};

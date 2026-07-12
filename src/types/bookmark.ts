export interface BookmarkCollection {
  id: string;
  title: string;
  coverImageUrl: string | null;
  createdAt: string;
  savedPostIds: string[];
}

export interface PostBookmarkState {
  isSaved: boolean;
  savedCollectionIds: string[];
}

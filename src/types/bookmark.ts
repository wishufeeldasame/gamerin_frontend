export interface BookmarkCollection {
  collectionId: string;
  name: string;
  coverImageUrl: string | null;
  bookmarkCount: number;
  createdAt: string;
  updatedAt: string;
  containsPost?: boolean;
}

export interface PostBookmarkState {
  isSaved: boolean;
  savedCollectionIds: string[];
}

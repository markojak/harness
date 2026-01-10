/**
 * Bookmarks context for app-wide bookmark state
 */

import { createContext, useContext, type ReactNode } from "react";
import { useBookmarks, type Bookmark } from "../hooks/useBookmarks";

interface BookmarksContextValue {
  bookmarks: Bookmark[];
  loading: boolean;
  isBookmarked: (sessionId: string) => boolean;
  toggleBookmark: (session: {
    sessionId: string;
    projectId?: string;
    projectName?: string;
    originalPrompt?: string;
    goal?: string;
  }) => Promise<boolean>;
  updateBookmark: (id: string, data: {
    title?: string;
    notes?: string;
    tags?: string[];
  }) => Promise<Bookmark | null>;
}

const BookmarksContext = createContext<BookmarksContextValue | null>(null);

export function BookmarksProvider({ children }: { children: ReactNode }) {
  const bookmarksState = useBookmarks();

  return (
    <BookmarksContext.Provider value={bookmarksState}>
      {children}
    </BookmarksContext.Provider>
  );
}

export function useBookmarksContext() {
  const context = useContext(BookmarksContext);
  if (!context) {
    throw new Error("useBookmarksContext must be used within BookmarksProvider");
  }
  return context;
}

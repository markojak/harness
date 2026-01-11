/**
 * Bookmarks hook for managing session bookmarks
 */

import { useState, useEffect, useCallback } from "react";

export interface Bookmark {
  id: string;
  sessionId: string;
  projectId: string | null;
  projectName: string | null;
  title: string;
  notes: string;
  tags: string[];
  originalPrompt: string | null;
  createdAt: string;
  updatedAt: string;
}

const API_BASE = "";

export function useBookmarks() {
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
  const [loading, setLoading] = useState(true);
  const [bookmarkedIds, setBookmarkedIds] = useState<Set<string>>(new Set());

  const refresh = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/bookmarks`);
      if (res.ok) {
        const data = await res.json();
        setBookmarks(data);
        setBookmarkedIds(new Set(data.map((b: Bookmark) => b.sessionId)));
      }
    } catch (err) {
      console.error("Failed to fetch bookmarks:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const addBookmark = useCallback(async (data: {
    sessionId: string;
    projectId?: string;
    projectName?: string;
    title: string;
    notes?: string;
    originalPrompt?: string;
  }): Promise<Bookmark | null> => {
    try {
      const res = await fetch(`${API_BASE}/bookmarks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (res.ok) {
        const bookmark = await res.json();
        setBookmarks(prev => [bookmark, ...prev]);
        setBookmarkedIds(prev => new Set([...prev, bookmark.sessionId]));
        return bookmark;
      }
    } catch (err) {
      console.error("Failed to add bookmark:", err);
    }
    return null;
  }, []);

  const removeBookmark = useCallback(async (sessionId: string): Promise<boolean> => {
    try {
      const res = await fetch(`${API_BASE}/bookmarks/session/${sessionId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setBookmarks(prev => prev.filter(b => b.sessionId !== sessionId));
        setBookmarkedIds(prev => {
          const next = new Set(prev);
          next.delete(sessionId);
          return next;
        });
        return true;
      }
    } catch (err) {
      console.error("Failed to remove bookmark:", err);
    }
    return false;
  }, []);

  const updateBookmark = useCallback(async (id: string, data: {
    title?: string;
    notes?: string;
    tags?: string[];
  }): Promise<Bookmark | null> => {
    try {
      const res = await fetch(`${API_BASE}/bookmarks/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (res.ok) {
        const bookmark = await res.json();
        setBookmarks(prev => prev.map(b => b.id === id ? bookmark : b));
        return bookmark;
      }
    } catch (err) {
      console.error("Failed to update bookmark:", err);
    }
    return null;
  }, []);

  const isBookmarked = useCallback((sessionId: string): boolean => {
    return bookmarkedIds.has(sessionId);
  }, [bookmarkedIds]);

  const toggleBookmark = useCallback(async (session: {
    sessionId: string;
    projectId?: string;
    projectName?: string;
    originalPrompt?: string;
    goal?: string;
  }): Promise<boolean> => {
    if (isBookmarked(session.sessionId)) {
      return removeBookmark(session.sessionId);
    } else {
      const bookmark = await addBookmark({
        sessionId: session.sessionId,
        projectId: session.projectId,
        projectName: session.projectName,
        title: session.goal || session.originalPrompt?.slice(0, 60) || "Untitled",
        originalPrompt: session.originalPrompt,
      });
      return bookmark !== null;
    }
  }, [isBookmarked, addBookmark, removeBookmark]);

  return {
    bookmarks,
    loading,
    refresh,
    addBookmark,
    removeBookmark,
    updateBookmark,
    isBookmarked,
    toggleBookmark,
  };
}

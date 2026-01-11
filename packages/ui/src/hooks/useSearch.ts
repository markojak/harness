/**
 * Search hook with debouncing and provider filtering
 */

import { useState, useEffect, useCallback, useRef } from "react";
import type { SearchResult } from "../components/SearchResults";

const API_BASE = "";
const DEBOUNCE_MS = 200;

export type ProviderFilter = "all" | "claude" | "codex" | "opencode";

export function useSearch() {
  const [query, setQuery] = useState("");
  const [provider, setProvider] = useState<ProviderFilter>("all");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [debouncedProvider, setDebouncedProvider] = useState<ProviderFilter>("all");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Debounce the query and provider together
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(query);
      setDebouncedProvider(provider);
    }, DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [query, provider]);

  // Search when debounced values change
  useEffect(() => {
    if (!debouncedQuery.trim()) {
      setResults([]);
      setLoading(false);
      return;
    }

    // Cancel previous request
    if (abortRef.current) {
      abortRef.current.abort();
    }

    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);
    setError(null);

    const params = new URLSearchParams({
      q: debouncedQuery,
      limit: "50",
    });
    if (debouncedProvider !== "all") {
      params.set("provider", debouncedProvider);
    }

    fetch(`${API_BASE}/search?${params}`, {
      signal: controller.signal,
    })
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((data) => {
        setResults(data);
        setLoading(false);
      })
      .catch((err) => {
        if (err.name !== "AbortError") {
          setError(String(err));
          setLoading(false);
        }
      });

    return () => {
      controller.abort();
    };
  }, [debouncedQuery, debouncedProvider]);

  const clearSearch = useCallback(() => {
    setQuery("");
    setDebouncedQuery("");
    setResults([]);
  }, []);

  const isSearching = query.trim().length > 0;

  return {
    query,
    setQuery,
    provider,
    setProvider,
    results,
    loading,
    error,
    isSearching,
    clearSearch,
  };
}

/**
 * Config hook for harness settings
 */

import { useState, useEffect, useCallback } from "react";

interface HarnessConfig {
  resumeFlags: string;
}

const API_BASE = "";

const DEFAULT_CONFIG: HarnessConfig = {
  resumeFlags: "",
};

export function useConfig() {
  const [config, setConfig] = useState<HarnessConfig>(DEFAULT_CONFIG);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/config`);
      if (res.ok) {
        const data = await res.json();
        setConfig(data);
      }
    } catch {
      // Use defaults
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const updateConfig = useCallback(async (updates: Partial<HarnessConfig>) => {
    try {
      const res = await fetch(`${API_BASE}/config`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });
      if (res.ok) {
        setConfig(prev => ({ ...prev, ...updates }));
        return true;
      }
    } catch {
      // Failed
    }
    return false;
  }, []);

  return { config, loading, updateConfig, refresh };
}

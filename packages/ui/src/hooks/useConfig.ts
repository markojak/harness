/**
 * Config hook for harness settings
 */

import { useState, useEffect, useCallback } from "react";

interface HarnessConfig {
  resumeFlags: string;
  hiddenProjects: string[];
}

const API_BASE = "";

const DEFAULT_CONFIG: HarnessConfig = {
  resumeFlags: "",
  hiddenProjects: [],
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

  const hideProject = useCallback(async (projectId: string) => {
    try {
      const res = await fetch(`${API_BASE}/projects/hide`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId }),
      });
      if (res.ok) {
        const data = await res.json();
        setConfig(prev => ({ ...prev, hiddenProjects: data.hidden }));
        return true;
      }
    } catch {
      // Failed
    }
    return false;
  }, []);

  const unhideProject = useCallback(async (projectId: string) => {
    try {
      const res = await fetch(`${API_BASE}/projects/unhide`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId }),
      });
      if (res.ok) {
        const data = await res.json();
        setConfig(prev => ({ ...prev, hiddenProjects: data.hidden }));
        return true;
      }
    } catch {
      // Failed
    }
    return false;
  }, []);

  const isHidden = useCallback((projectId: string) => {
    return config.hiddenProjects.includes(projectId);
  }, [config.hiddenProjects]);

  return { config, loading, updateConfig, refresh, hideProject, unhideProject, isHidden };
}

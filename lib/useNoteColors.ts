import { useState, useEffect, useCallback } from "react";
import { storage } from "./storage";

const STORAGE_KEY = "note_color_overrides";

export function useNoteColors() {
  const [overrides, setOverrides] = useState<Record<string, number>>({});

  useEffect(() => {
    storage.get<Record<string, number>>(STORAGE_KEY).then(saved => {
      if (saved) setOverrides(saved);
    });
  }, []);

  const getNoteColorIdx = useCallback((id: string): number | null => {
    return overrides[id] ?? null;
  }, [overrides]);

  const setNoteColorIdx = useCallback((id: string, idx: number | null) => {
    setOverrides(prev => {
      const next = { ...prev };
      if (idx === null) delete next[id];
      else next[id] = idx;
      storage.set(STORAGE_KEY, next);
      return next;
    });
  }, []);

  return { getNoteColorIdx, setNoteColorIdx };
}

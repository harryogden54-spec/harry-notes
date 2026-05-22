import { useState, useEffect } from "react";

/**
 * Returns true after the first render. Used to gate hydration-sensitive values
 * (e.g. dates, window dimensions) that must match on server and client.
 *
 * Replaces the repeated pattern:
 *   const [mounted, setMounted] = useState(false);
 *   useEffect(() => { setMounted(true); }, []);
 */
export function useMounted(): boolean {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);
  return mounted;
}

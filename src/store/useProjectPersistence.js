// Hook to auto-save project state to Redis and load on login
import { useCallback, useRef } from 'react';

const SAVE_DEBOUNCE_MS = 2000; // save 2 seconds after last change

export function useProjectPersistence() {
  const saveTimer = useRef(null);

  // Save project state to Redis (debounced)
  const saveState = useCallback((projectCode, state) => {
    if (!projectCode) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      try {
        await fetch('/api/state', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code: projectCode, state }),
        });
      } catch (err) {
        console.error('Failed to save project state:', err.message);
      }
    }, SAVE_DEBOUNCE_MS);
  }, []);

  // Load project state by code
  const loadState = useCallback(async (projectCode) => {
    const res = await fetch(`/api/state?code=${projectCode.toUpperCase()}`);
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to load project');
    }
    const data = await res.json();
    return data.state;
  }, []);

  // Authenticate a team member
  const authenticate = useCallback(async (projectCode, memberCode) => {
    const res = await fetch('/api/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ projectCode, memberCode }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Authentication failed');
    return data; // { member, state }
  }, []);

  return { saveState, loadState, authenticate };
}

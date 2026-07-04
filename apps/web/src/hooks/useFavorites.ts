'use client';

import { useState, useCallback, useEffect } from 'react';

const KEY = 'bozpicks_favorites';

export function useFavorites() {
  const [favorites, setFavorites] = useState<Set<string>>(new Set());

  useEffect(() => {
    try {
      const saved = localStorage.getItem(KEY);
      if (saved) setFavorites(new Set(JSON.parse(saved)));
    } catch {}
  }, []);

  const toggle = useCallback((matchId: string) => {
    setFavorites(prev => {
      const next = new Set(prev);
      if (next.has(matchId)) next.delete(matchId); else next.add(matchId);
      localStorage.setItem(KEY, JSON.stringify([...next]));
      return next;
    });
  }, []);

  const isFav = useCallback((matchId: string) => favorites.has(matchId), [favorites]);

  return { favorites, toggle, isFav };
}

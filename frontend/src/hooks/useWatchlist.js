import { useEffect, useMemo, useState } from 'react';
import { getWatchlistIds, subscribeToWatchlist, toggleWatchlist } from '../utils/watchlist';

export default function useWatchlist() {
  const [watchlistIds, setWatchlistIds] = useState(() => getWatchlistIds());

  useEffect(() => {
    return subscribeToWatchlist(setWatchlistIds);
  }, []);

  const watchlistSet = useMemo(() => new Set(watchlistIds), [watchlistIds]);

  return {
    watchlistIds,
    watchlistSet,
    watchlistCount: watchlistIds.length,
    isSaved: (id) => watchlistSet.has(String(id)),
    toggle: (id) => toggleWatchlist(id),
  };
}

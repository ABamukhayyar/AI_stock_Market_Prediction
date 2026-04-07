import { useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { isAuthenticated } from '../utils/auth';

const UTILITY_ROUTES = new Set(['/help', '/support', '/settings', '/privacy', '/terms', '/about']);

function hasBrowserHistory() {
  if (typeof window === 'undefined') return false;
  return Number(window.history.state?.idx) > 0;
}

export default function useSmartBack(fallbackWhenAuthed = '/dashboard', fallbackWhenGuest = '/') {
  const location = useLocation();
  const navigate = useNavigate();

  return useCallback(() => {
    const mainRoute = isAuthenticated() ? location.state?.mainRoute : null;
    const fallback = isAuthenticated() ? fallbackWhenAuthed : fallbackWhenGuest;

    // Always prefer mainRoute if available and different from current page
    if (mainRoute && mainRoute !== location.pathname) {
      navigate(mainRoute, { replace: true });
      return;
    }

    // On utility pages without a mainRoute, go straight to fallback
    // to avoid bouncing between utility pages via browser history
    if (UTILITY_ROUTES.has(location.pathname)) {
      navigate(fallback, { replace: true });
      return;
    }

    if (hasBrowserHistory()) {
      navigate(-1);
      return;
    }

    navigate(fallback);
  }, [fallbackWhenAuthed, fallbackWhenGuest, location.pathname, location.state, navigate]);
}

const MAIN_ROUTES = new Set(['/dashboard', '/stocks', '/profile', '/watchlist']);

export function resolveMainRoute(location) {
  if (location?.state?.mainRoute) return location.state.mainRoute;

  if (location?.pathname?.startsWith('/stock/')) {
    return location.state?.from || '/stocks';
  }

  if (MAIN_ROUTES.has(location?.pathname)) {
    return location.pathname;
  }

  return '/dashboard';
}

export function buildUtilityRouteState(location, extraState = {}) {
  return {
    ...extraState,
    mainRoute: resolveMainRoute(location),
  };
}

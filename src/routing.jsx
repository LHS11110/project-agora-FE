import { createContext, startTransition, useCallback, useContext, useEffect, useMemo, useState } from 'react';

const RouterContext = createContext(null);
const ParamsContext = createContext({});

function currentLocation() {
  return {
    pathname: window.location.pathname,
    search: window.location.search,
    hash: window.location.hash,
    state: window.history.state?.__agora ? window.history.state.value : undefined,
  };
}

export function BrowserRouter({ children }) {
  const [location, setLocation] = useState(currentLocation);
  const sync = useCallback(() => {
    startTransition(() => setLocation(currentLocation()));
  }, []);
  useEffect(() => {
    window.addEventListener('popstate', sync);
    return () => window.removeEventListener('popstate', sync);
  }, [sync]);
  const navigate = useCallback((to, options = {}) => {
    const target = typeof to === 'string' ? to : to.pathname;
    const historyState = { __agora: true, value: options.state };
    if (options.replace) window.history.replaceState(historyState, '', target);
    else window.history.pushState(historyState, '', target);
    startTransition(() => setLocation(currentLocation()));
    if (options.scroll !== false) window.scrollTo({ top: 0, behavior: 'instant' });
  }, []);
  const value = useMemo(() => ({ location, navigate }), [location, navigate]);
  return <RouterContext.Provider value={value}>{children}</RouterContext.Provider>;
}

function useRouter() {
  const router = useContext(RouterContext);
  if (!router) throw new Error('Router components require BrowserRouter');
  return router;
}

function matchPath(pattern, pathname) {
  if (pattern === '*') return {};
  const expected = pattern.split('/').filter(Boolean);
  const actual = pathname.split('/').filter(Boolean);
  if (expected.length !== actual.length) return null;
  const params = {};
  for (let index = 0; index < expected.length; index += 1) {
    if (expected[index].startsWith(':')) params[expected[index].slice(1)] = decodeURIComponent(actual[index]);
    else if (expected[index] !== actual[index]) return null;
  }
  return params;
}

export function Routes({ children }) {
  const { location } = useRouter();
  const routes = Array.isArray(children) ? children : [children];
  const match = routes.map((route) => ({ route, params: matchPath(route.props.path, location.pathname) }))
    .find((candidate) => candidate.params !== null);
  if (!match) return null;
  return <ParamsContext.Provider value={match.params}>{match.route.props.element}</ParamsContext.Provider>;
}

export function Route() { return null; }

export function Navigate({ to, replace = false, state }) {
  const { navigate } = useRouter();
  useEffect(() => navigate(to, { replace, state }), [navigate, replace, state, to]);
  return null;
}

export function useNavigate() { return useRouter().navigate; }
export function useLocation() { return useRouter().location; }
export function useParams() { return useContext(ParamsContext); }

export function Link({ to, state, onClick, target, children, ...props }) {
  const { navigate } = useRouter();
  const href = typeof to === 'string' ? to : to.pathname;
  const handleClick = (event) => {
    onClick?.(event);
    if (event.defaultPrevented || event.button !== 0 || target || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    navigate(to, { state });
  };
  return <a href={href} target={target} onClick={handleClick} {...props}>{children}</a>;
}

export function NavLink({ to, className, end = false, ...props }) {
  const { location } = useRouter();
  const path = typeof to === 'string' ? to : to.pathname;
  const isActive = location.pathname === path || (!end && location.pathname.startsWith(`${path}/`));
  const resolvedClassName = typeof className === 'function' ? className({ isActive, isPending: false }) : className;
  return <Link to={to} className={resolvedClassName} aria-current={isActive ? 'page' : undefined} {...props} />;
}

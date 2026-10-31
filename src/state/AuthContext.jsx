import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { tokenExpired, isCurrentAccountFailure } from './authSession.js';
import { api } from '../api/client.js';

const AuthContext = createContext(null);
const TOKEN_KEY = 'agora_token';
const USER_KEY = 'agora_user';

function readUser() {
  try { return JSON.parse(localStorage.getItem(USER_KEY) || 'null'); }
  catch { return null; }
}

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem(TOKEN_KEY));
  const [user, setUser] = useState(readUser);
  const [authError, setAuthError] = useState('');
  const login = useCallback(async (email, password) => {
    const result = await api('/api/auth/login', { method: 'POST', body: { email, password } });
    localStorage.setItem(TOKEN_KEY, result.accessToken);
    localStorage.setItem(USER_KEY, JSON.stringify(result.user));
    setAuthError('');
    setToken(result.accessToken); setUser(result.user);
    return result.user;
  }, []);
  const oauthRequest = useRef(null);
  const completeGoogleLogin = useCallback(() => {
    // StrictMode remounts must not consume the one-use handoff twice.
    if (!oauthRequest.current) oauthRequest.current = api('/api/auth/oauth2/session').then(result => {
      localStorage.setItem(TOKEN_KEY, result.accessToken);
      localStorage.setItem(USER_KEY, JSON.stringify(result.user));
      setAuthError(''); setToken(result.accessToken); setUser(result.user);
      return result.user;
    });
    return oauthRequest.current;
  }, []);
  const signup = useCallback(async ({ email, password, nickname }) => {
    await api('/api/auth/signup', { method: 'POST', body: { email, password, nickname } });
    return login(email, password);
  }, [login]);
  const updateUser = useCallback((nextUser) => {
    setUser(current => {
      const updated = typeof nextUser === 'function' ? nextUser(current) : nextUser;
      localStorage.setItem(USER_KEY, JSON.stringify(updated));
      return updated;
    });
  }, []);
  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY); localStorage.removeItem(USER_KEY); setToken(null); setUser(null);
  }, []);
  useEffect(() => {
    const handleUnauthorized = event => {
      if (!isCurrentAccountFailure(localStorage.getItem(TOKEN_KEY), event.detail?.token)) return;
      setAuthError(event.detail?.message || '로그인 세션이 만료되었거나 유효하지 않습니다. 다시 로그인해주세요.');
      logout();
    };
    const syncStoredAccount = (event) => {
      if (event.storageArea !== localStorage || (event.key !== null && ![TOKEN_KEY, USER_KEY].includes(event.key))) return;
      setToken(localStorage.getItem(TOKEN_KEY));
      setUser(readUser());
    };
    window.addEventListener('agora:unauthorized', handleUnauthorized);
    window.addEventListener('storage', syncStoredAccount);
    return () => {
      window.removeEventListener('agora:unauthorized', handleUnauthorized);
      window.removeEventListener('storage', syncStoredAccount);
    };
  }, [logout]);
  useEffect(() => {
    if (!token) return undefined;
    if (tokenExpired(token)) {
      if (localStorage.getItem(TOKEN_KEY) === token) {
        setAuthError('로그인 세션이 만료되었습니다. 다시 로그인해주세요.');
        logout();
      }
      return undefined;
    }
    let cancelled = false;
    api('/api/auth/me', { method: 'POST', token, body: { token } }).then(next => {
      if (cancelled) return;
      setUser(current => {
        if (!current || current.nickname !== next.nickname || current.tag_number !== next.tag_number) return current;
        const merged = { ...current, user_id: next.user_id };
        localStorage.setItem(USER_KEY, JSON.stringify(merged));
        return merged;
      });
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [token, logout]);
  const value = useMemo(() => ({ token, user, authError, isAuthenticated: Boolean(token && user && !tokenExpired(token)), login, signup, completeGoogleLogin, updateUser, logout }),
    [token, user, authError, login, signup, completeGoogleLogin, updateUser, logout]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}

import { createContext, useCallback, useContext, useMemo, useState } from 'react';
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
  const login = useCallback(async (email, password) => {
    const result = await api('/api/auth/login', { method: 'POST', body: { email, password } });
    localStorage.setItem(TOKEN_KEY, result.accessToken);
    localStorage.setItem(USER_KEY, JSON.stringify(result.user));
    setToken(result.accessToken); setUser(result.user);
    return result.user;
  }, []);
  const signup = useCallback(async ({ email, password, nickname }) => {
    await api('/api/auth/signup', { method: 'POST', body: { email, password, nickname } });
    return login(email, password);
  }, [login]);
  const updateUser = useCallback((nextUser) => {
    localStorage.setItem(USER_KEY, JSON.stringify(nextUser)); setUser(nextUser);
  }, []);
  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY); localStorage.removeItem(USER_KEY); setToken(null); setUser(null);
  }, []);
  const value = useMemo(() => ({ token, user, isAuthenticated: Boolean(token && user), login, signup, updateUser, logout }),
    [token, user, login, signup, updateUser, logout]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}

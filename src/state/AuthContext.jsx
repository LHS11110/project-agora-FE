import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { clearAccessToken, currentAccessToken, endServerSession, isCurrentAccountFailure, refreshAccessToken, sameSession, setAccessToken, tokenClaims } from './authSession.js';
import { api } from '../api/client.js';
import {purgeAgentKeys} from '../components/agentCredentials.js';

const AuthContext = createContext(null);
// Removed: access tokens are no longer persisted. Cleared on startup for old sessions.
const LEGACY_TOKEN_KEY = 'agora_token';
// Profile cache and the "this browser has a session" hint shared across tabs. Not a credential.
const USER_KEY = 'agora_user';
const REFRESH_BEFORE_EXPIRY_MS = 60_000;

function readUser() {
  try { return JSON.parse(localStorage.getItem(USER_KEY) || 'null'); }
  catch { return null; }
}
function storeUser(user) {
  try { if (user) localStorage.setItem(USER_KEY, JSON.stringify(user)); else localStorage.removeItem(USER_KEY); } catch { /* Storage is a cache only. */ }
}

export function AuthProvider({ children }) {
  // The first access token of the current session. It stays stable across
  // refreshes; requests resolve it to the latest token (see authSession.js).
  const [token, setToken] = useState(null);
  const [user, setUser] = useState(readUser);
  const [ready, setReady] = useState(() => !readUser());
  const [authError, setAuthError] = useState('');
  const [pendingMfa, setPendingMfa] = useState(null);
  const [pendingOAuthEnrollment,setPendingOAuthEnrollment]=useState(null);
  const tokenRef = useRef(null), userRef = useRef(user);
  tokenRef.current = token; userRef.current = user;
  const oauthRequest = useRef(null);
  const orcidRequest = useRef(null);

  const clearLocal = useCallback(() => {
    purgeAgentKeys();
    setPendingMfa(null);setPendingOAuthEnrollment(null);oauthRequest.current=null;orcidRequest.current=null;
    clearAccessToken(); storeUser(null); setToken(null); setUser(null);
  }, []);
  const adoptSession = useCallback((accessToken, nextUser) => {
    if (nextUser) {
      if (userRef.current?.user_id !== nextUser.user_id) purgeAgentKeys();
      storeUser(nextUser); setUser(nextUser);
    }
    setToken(current => current && sameSession(current, accessToken) ? current : accessToken);
  }, []);
  const acceptLoginResponse = useCallback(result => {
    if(result.oauthEnrollmentRequired){setPendingOAuthEnrollment(result);setPendingMfa(null);return result;}
    if (result.mfaRequired) { setPendingOAuthEnrollment(null); setPendingMfa({ challengeToken: result.challengeToken }); return result; }
    if (!result.accessToken || !result.user) throw new Error('로그인을 완료하지 못했습니다. 다시 시도해주세요.');
    if(readUser()?.user_id!==result.user.user_id)purgeAgentKeys();
    setAccessToken(result.accessToken, result.user);
    storeUser(result.user);
    setAuthError(''); setPendingOAuthEnrollment(null); setPendingMfa(null);setToken(result.accessToken);setUser(result.user);setReady(true);
    return result;
  }, []);
  const login = useCallback(async (email, password) => acceptLoginResponse(await api('/api/auth/login', { method: 'POST', body: { email, password } })), [acceptLoginResponse]);
  const completeGoogleLogin = useCallback(() => {
    if (!oauthRequest.current) oauthRequest.current = api('/api/auth/oauth2/session').then(acceptLoginResponse);
    return oauthRequest.current;
  }, [acceptLoginResponse]);
  const completeOrcidLogin = useCallback(() => {
    if (!orcidRequest.current) orcidRequest.current = api('/api/irade/auth/session', {method:'POST',body:{}}).then(result => acceptLoginResponse(result.login));
    return orcidRequest.current;
  }, [acceptLoginResponse]);
  const completeOAuthEnrollment=useCallback(async(email,emailVerificationToken)=>acceptLoginResponse(await api('/api/auth/oauth2/enrollment',{method:'POST',body:{email,emailVerificationToken,enrollmentToken:pendingOAuthEnrollment?.enrollmentToken}})),[pendingOAuthEnrollment,acceptLoginResponse]);
  const cancelOAuthEnrollment=useCallback(()=>{setPendingOAuthEnrollment(null);oauthRequest.current=null;orcidRequest.current=null;},[]);
  const verifyMfa = useCallback(async code => acceptLoginResponse(await api('/api/auth/mfa/verify', {method:'POST',body:{challengeToken:pendingMfa?.challengeToken,code}})), [pendingMfa,acceptLoginResponse]);
  const cancelMfa = useCallback(() => {setPendingMfa(null);oauthRequest.current=null;orcidRequest.current=null;}, []);
  const signup = useCallback(async ({ email, password, nickname, emailVerificationToken }) => {
    await api('/api/auth/signup', { method: 'POST', body: { email, password, nickname, emailVerificationToken } });
    return login(email, password);
  }, [login]);
  const updateUser = useCallback((nextUser) => {
    setUser(current => {
      const updated = typeof nextUser === 'function' ? nextUser(current) : nextUser;
      storeUser(updated);
      return updated;
    });
  }, []);
  const logout = useCallback(() => {
    // Revoke on the server so a copied token or cookie stops working now, not at expiry.
    endServerSession({ token: tokenRef.current });
    clearLocal();
  }, [clearLocal]);
  const logoutEverywhere = useCallback(async () => {
    const done = await endServerSession({ everywhere: true, token: tokenRef.current });
    if (!done) throw new Error('모든 기기에서 로그아웃하지 못했습니다. 네트워크 연결을 확인한 뒤 다시 시도해주세요.');
    clearLocal();
  }, [clearLocal]);

  // Restore the session from the refresh cookie; nothing secret was persisted.
  useEffect(() => {
    try { localStorage.removeItem(LEGACY_TOKEN_KEY); } catch { /* ignore */ }
    if (!readUser()) return undefined;
    let cancelled = false;
    refreshAccessToken().then(result => {
      if (cancelled) return;
      if (result?.accessToken) adoptSession(result.accessToken, result.user);
      else clearLocal();
    }).catch(() => { /* Offline: the login page is shown; a reload retries. */ })
      .finally(() => { if (!cancelled) setReady(true); });
    return () => { cancelled = true; };
  }, [adoptSession, clearLocal]);

  // Refresh shortly before the access token expires, and when a hidden tab
  // (whose timers were throttled) becomes visible again.
  useEffect(() => {
    if (!token) return undefined;
    let timer = null, disposed = false;
    const expiresAt = () => (tokenClaims(currentAccessToken(tokenRef.current))?.exp || 0) * 1000;
    const run = () => {
      if (disposed) return;
      refreshAccessToken({ ifExpiringBefore: Date.now() + REFRESH_BEFORE_EXPIRY_MS }).then(result => {
        if (disposed) return;
        if (!result) { setAuthError('로그인 세션이 만료되었습니다. 다시 로그인해주세요.'); clearLocal(); }
      }).catch(() => { if (!disposed) { clearTimeout(timer); timer = setTimeout(run, 30_000); } });
    };
    const schedule = () => {
      clearTimeout(timer);
      timer = setTimeout(run, Math.max(5_000, expiresAt() - Date.now() - REFRESH_BEFORE_EXPIRY_MS));
    };
    const onAccessToken = event => {
      const next = event.detail?.token;
      if (next && tokenRef.current && !sameSession(next, tokenRef.current)) adoptSession(next, event.detail?.user);
      schedule();
    };
    const onVisible = () => { if (document.visibilityState === 'visible' && expiresAt() - Date.now() < REFRESH_BEFORE_EXPIRY_MS) run(); };
    schedule();
    window.addEventListener('agora:access-token', onAccessToken);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      disposed = true; clearTimeout(timer);
      window.removeEventListener('agora:access-token', onAccessToken);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [token, adoptSession, clearLocal]);

  useEffect(() => {
    const handleUnauthorized = event => {
      if (!isCurrentAccountFailure(tokenRef.current, event.detail?.token)) return;
      setAuthError(event.detail?.message || '로그인 세션이 만료되었거나 유효하지 않습니다. 다시 로그인해주세요.');
      logout();
    };
    // Another tab signed in or out; the refresh cookie is shared, the access token is not.
    const syncStoredAccount = (event) => {
      if (event.storageArea !== localStorage || (event.key !== null && event.key !== USER_KEY)) return;
      const stored = readUser();
      if (!stored) { clearLocal(); return; }
      if (tokenRef.current && stored.user_id === userRef.current?.user_id) { setUser(stored); return; }
      refreshAccessToken().then(result => { if (result?.accessToken) adoptSession(result.accessToken, result.user || stored); }).catch(() => {});
    };
    window.addEventListener('agora:unauthorized', handleUnauthorized);
    window.addEventListener('storage', syncStoredAccount);
    return () => {
      window.removeEventListener('agora:unauthorized', handleUnauthorized);
      window.removeEventListener('storage', syncStoredAccount);
    };
  }, [logout, clearLocal, adoptSession]);

  const value = useMemo(() => ({ token, user, ready, authError, isAuthenticated: Boolean(token && user), login, signup, completeGoogleLogin, completeOAuthLogin:completeGoogleLogin, completeOrcidLogin, pendingOAuthEnrollment, completeOAuthEnrollment, cancelOAuthEnrollment, pendingMfa, verifyMfa, cancelMfa, acceptLoginResponse, updateUser, logout, logoutEverywhere }),
    [token, user, ready, authError, login, signup, completeGoogleLogin, completeOrcidLogin, pendingOAuthEnrollment, completeOAuthEnrollment, cancelOAuthEnrollment, pendingMfa, verifyMfa, cancelMfa, acceptLoginResponse, updateUser, logout, logoutEverywhere]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}

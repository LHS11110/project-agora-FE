import React from 'react';
import { createRoot } from 'react-dom/client';
import { AuthProvider, useAuth } from '../../src/state/AuthContext.jsx';
import { api } from '../../src/api/client.js';
function Probe() {
  const auth = useAuth();
  window.authProbe = auth;
  return <>
    <output id="session">{auth.isAuthenticated ? 'authenticated' : 'signed-out'}</output>
    <output id="reason">{auth.authError}</output>
    <button onClick={() => auth.login('fixture@example.invalid', 'fixture')}>Login</button>
    <button onClick={() => api('/api/canvases/fixture', { token: 'canvas-access' }).catch(() => {})}>Canvas failure</button>
  </>;
}
createRoot(document.getElementById('root')).render(<AuthProvider><Probe /></AuthProvider>);

import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes, useLocation } from './routing.jsx';
import { useAuth } from './state/AuthContext.jsx';
import AppShell from './components/AppShell.jsx';
import HomePage from './pages/HomePage.jsx';
import LoginPage from './pages/LoginPage.jsx';
import ProfilePage from './pages/ProfilePage.jsx';
import SearchPage from './pages/SearchPage.jsx';
const CanvasPage = lazy(() => import('./pages/CanvasPage.jsx'));
import DocsPage from './pages/DocsPage.jsx';
const TutorialPage = lazy(() => import('./pages/TutorialPage.jsx'));

function Protected({ children }) {
  const { isAuthenticated } = useAuth();
  const location = useLocation();
  return isAuthenticated ? <AppShell>{children}</AppShell> : <Navigate to="/login" replace state={{ from: location.pathname }} />;
}

export default function App() {
  return <Routes>
    <Route path="/" element={<HomePage />} />
    <Route path="/docs" element={<DocsPage />} />
    <Route path="/tutorial" element={<Suspense fallback={<div className="route-loading">캔버스 체험을 준비하고 있어요.</div>}><TutorialPage /></Suspense>} />
    <Route path="/login" element={<LoginPage />} />
    <Route path="/profile" element={<Protected><ProfilePage /></Protected>} />
    <Route path="/search" element={<Protected><SearchPage /></Protected>} />
    <Route path="/canvases/:canvasId" element={<Protected><Suspense fallback={<div className="canvas-app-page canvas-loading-state"><span className="loader" /> 캔버스 화면을 불러오고 있어요.</div>}><CanvasPage /></Suspense></Protected>} />
    <Route path="*" element={<Navigate to="/" replace />} />
  </Routes>;
}

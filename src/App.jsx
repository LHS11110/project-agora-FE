import GlobalYoutubePlayer from './media/GlobalYoutubePlayer.jsx';
import { ui } from './i18n/locale.js';
import { useUiLocale } from './i18n/useUiLocale.js';
import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes, useLocation, useParams } from './routing.jsx';
import { useAuth } from './state/AuthContext.jsx';
import AppShell from './components/AppShell.jsx';
const HomePage = lazy(() => import('./pages/HomePage.jsx'));
const LoginPage = lazy(() => import('./pages/LoginPage.jsx'));
const ProfilePage = lazy(() => import('./pages/ProfilePage.jsx'));
const SearchPage = lazy(() => import('./pages/SearchPage.jsx'));
const QrApprovalPage = lazy(() => import('./pages/QrApprovalPage.jsx'));
const CanvasPage = lazy(() => import('./pages/CanvasPage.jsx'));
const DocsPage = lazy(() => import('./pages/DocsPage.jsx'));
const TutorialPage = lazy(() => import('./pages/TutorialPage.jsx'));

function PageLoading() {
  return <div className="route-loading">{ui('페이지를 불러오고 있어요.')}</div>;
}

function Protected({ children }) {

  const { isAuthenticated } = useAuth();
  const location = useLocation();
  return isAuthenticated ? <AppShell>{children}</AppShell> : <Navigate to="/login" replace state={{ from: location.pathname }} />;
}

function CanvasRoute() {

  const { canvasId } = useParams();
  return <CanvasPage key={canvasId} />;
}

export default function App() {
  useUiLocale();
  return <><GlobalYoutubePlayer /><Suspense fallback={<PageLoading />}><Routes>
    <Route path="/" element={<HomePage />} />
    <Route path="/docs" element={<DocsPage />} />
    <Route path="/tutorial" element={<TutorialPage />} />
    <Route path="/qr-login" element={<QrApprovalPage />} />
    <Route path="/login" element={<LoginPage />} />
    <Route path="/profile" element={<Protected><ProfilePage /></Protected>} />
    <Route path="/search" element={<Protected><SearchPage /></Protected>} />
    <Route path="/canvases/:canvasId" element={<Protected><Suspense fallback={<div className="canvas-app-page canvas-loading-state"><span className="loader" />{" " + ui("캔버스 화면을 불러오고 있어요.") + ""}</div>}><CanvasRoute /></Suspense></Protected>} />
    <Route path="*" element={<Navigate to="/" replace />} />
  </Routes></Suspense></>;
}

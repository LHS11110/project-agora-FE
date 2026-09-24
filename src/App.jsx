import { Navigate, Route, Routes, useLocation } from './routing.jsx';
import { useAuth } from './state/AuthContext.jsx';
import AppShell from './components/AppShell.jsx';
import HomePage from './pages/HomePage.jsx';
import LoginPage from './pages/LoginPage.jsx';
import ProfilePage from './pages/ProfilePage.jsx';
import SearchPage from './pages/SearchPage.jsx';
import CanvasPage from './pages/CanvasPage.jsx';

function Protected({ children }) {
  const { isAuthenticated } = useAuth();
  const location = useLocation();
  return isAuthenticated ? <AppShell>{children}</AppShell> : <Navigate to="/login" replace state={{ from: location.pathname }} />;
}

export default function App() {
  return <Routes>
    <Route path="/" element={<HomePage />} />
    <Route path="/login" element={<LoginPage />} />
    <Route path="/profile" element={<Protected><ProfilePage /></Protected>} />
    <Route path="/search" element={<Protected><SearchPage /></Protected>} />
    <Route path="/canvases/:canvasId" element={<Protected><CanvasPage /></Protected>} />
    <Route path="*" element={<Navigate to="/" replace />} />
  </Routes>;
}

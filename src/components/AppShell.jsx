import UserAvatar from './account/UserAvatar.jsx';
import { NavLink, useLocation, useNavigate } from '../routing.jsx';
import { useAuth } from '../state/AuthContext.jsx';
import Icon from './Icon.jsx';
import FreLogBrand from './frelog/FreLogBrand.jsx';

const navItems = [
  { to: '/search', label: '캔버스 탐색', icon: 'search' },
  { to: '/profile', label: '내 프로필', icon: 'user' },
  { to: '/docs', label: '프로젝트 문서', icon: 'book' },
];

export default function AppShell({ children }) {
  const { user, token, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  return (
    <div className="app-shell">
      <aside className="app-sidebar">
        <FreLogBrand />
        <div className="sidebar-section-label">WORKSPACE</div>
        <nav className="side-nav" aria-label="주요 메뉴">
          {navItems.map((item) => <NavLink key={item.to} to={item.to} className={({ isActive }) => `side-link${isActive ? ' active' : ''}`}><Icon name={item.icon} size={19} /><span>{item.label}</span>{item.to === '/search' && location.pathname.startsWith('/canvases/') && <span className="nav-live-dot" />}</NavLink>)}
        </nav>
        <div className="sidebar-tip"><span className="tip-icon"><Icon name="sparkle" size={18} /></span><p>좋은 생각은<br /><strong>함께 그릴수록</strong><br />선명해져요.</p><div className="tip-art"><span /><span /><span /></div></div>
        <div className="sidebar-account"><UserAvatar user={user} token={token} className="avatar-small" /><div className="account-copy"><strong>{user?.nickname || 'FreLog 사용자'}</strong><small>#{user?.tag_number ?? '—'}</small></div><button className="icon-button logout-button" onClick={() => { logout(); navigate('/'); }} aria-label="로그아웃" title="로그아웃"><Icon name="logout" size={18} /></button></div>
      </aside>
      <div className="app-main"><header className="mobile-app-header"><FreLogBrand /><div className="mobile-header-actions"><button className="icon-button" onClick={() => navigate('/search')} aria-label="캔버스 탐색"><Icon name="search" size={19} /></button><button className="avatar avatar-small" onClick={() => navigate('/profile')} aria-label="프로필"><UserAvatar user={user} token={token} className="avatar-small" /></button></div></header>{children}</div>
    </div>
  );
}

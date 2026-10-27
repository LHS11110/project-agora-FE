import LanguageSwitcher from '../i18n/LanguageSwitcher.jsx';
import { ui } from '../i18n/locale.js';
import { useUiLocale } from '../i18n/useUiLocale.js';
import { useEffect, useState } from 'react';
import './app-navigation.css';
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
  useUiLocale();
  const { user, token, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const isCanvas=location.pathname.startsWith('/canvases/');
  const [navigationCollapsed,setNavigationCollapsed]=useState(()=>{try{return localStorage.getItem('agora_canvas_navigation_collapsed')!=='false';}catch{return false;}});
  useEffect(()=>{try{localStorage.setItem('agora_canvas_navigation_collapsed',String(navigationCollapsed));}catch{/* Optional local preference. */}},[navigationCollapsed]);
  const collapsed=isCanvas && navigationCollapsed;
  return (
    <div className={`app-shell${isCanvas?' is-canvas-shell':''}${collapsed?' is-navigation-collapsed':''}`}>

      <aside id="app-sidebar" className="app-sidebar" hidden={collapsed}>
        <FreLogBrand />
        <div className="sidebar-section-label">WORKSPACE</div>
        <nav className="side-nav" aria-label={ui("주요 메뉴")}>
          {navItems.map((item) => <NavLink key={item.to} to={item.to} className={({ isActive }) => `side-link${isActive ? ' active' : ''}`}><Icon name={item.icon} size={19} /><span>{ui(item.label)}</span>{item.to === '/search' && location.pathname.startsWith('/canvases/') && <span className="nav-live-dot" />}</NavLink>)}
        </nav>
        {!isCanvas && <div className="sidebar-tip"><span className="tip-icon"><Icon name="sparkle" size={18} /></span><p>{ui("좋은 생각은")}<br /><strong>{ui("함께 그릴수록")}</strong><br />{ui("선명해져요.")}</p><div className="tip-art"><span /><span /><span /></div></div>}
        {!isCanvas && <div className="sidebar-language-control"><LanguageSwitcher /></div>}<div className="sidebar-account">{!isCanvas && <><UserAvatar user={user} token={token} className="avatar-small" /><div className="account-copy"><strong>{user?.nickname || ui("FreLog 사용자")}</strong><small>#{user?.tag_number ?? '—'}</small></div></>}<button className="icon-button logout-button" onClick={() => { logout(); navigate('/'); }} aria-label={ui("로그아웃")} title={ui("로그아웃")}><Icon name="logout" size={18} /></button></div>
      </aside>
      <div className="app-main">      {isCanvas && <button className="app-navigation-toggle" type="button" aria-controls="app-sidebar mobile-app-navigation" aria-expanded={!collapsed}
        aria-label={ui('캔버스 탐색 창 {action}',{action:ui(collapsed?'펼치기':'접기')})} title={ui('캔버스 탐색 창 {action}',{action:ui(collapsed?'펼치기':'접기')})}
        onClick={()=>setNavigationCollapsed(value=>!value)}><Icon name={collapsed?'search':'back'} size={15} /></button>}<header id="mobile-app-navigation" className="mobile-app-header"><FreLogBrand /><div className="mobile-header-actions"><LanguageSwitcher /><button className="icon-button" onClick={() => navigate('/search')} aria-label={ui("캔버스 탐색")}><Icon name="search" size={19} /></button><button className="avatar avatar-small" onClick={() => navigate('/profile')} aria-label={ui("프로필")}>{isCanvas ? <Icon name="user" size={19} /> : <UserAvatar user={user} token={token} className="avatar-small" />}</button></div></header>{children}</div>
    </div>
  );
}

import { Link, useNavigate } from '../routing.jsx';
import HomeIntroSlide from '../components/home/HomeIntroSlide.jsx';
import ArchitectureSlide from '../components/home/ArchitectureSlide.jsx';
import ProjectMapSlide from '../components/home/ProjectMapSlide.jsx';
import CollaborationSlide from '../components/home/CollaborationSlide.jsx';
import StartSlide from '../components/home/StartSlide.jsx';
import Icon from '../components/Icon.jsx';
import { useHomeSlideNavigation } from '../home/useHomeSlideNavigation.js';
import { useAuth } from '../state/AuthContext.jsx';
import '../home-slides.css';
import '../home-hero.css';
import '../home-matrix.css';

export default function HomePage() {
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const target = isAuthenticated ? '/search' : '/login';
  const { activeSlide, activePosition, slideLabels, selectSlide, handleWheel, handleTouchStart, handleTouchEnd } = useHomeSlideNavigation();
  return <div className="marketing-page home-slides-page">
    <header className="marketing-header page-container">
      <Link className="brand-lockup" to="/"><span className="brand-mark"><i /><i /><i /><i /></span><span>agora<span className="brand-period">.</span></span></Link>
      <nav className="marketing-nav" aria-label="소개 슬라이드"><button className={activeSlide === 0 ? 'current' : ''} onClick={() => selectSlide(0)}>아고라</button><button className={activeSlide === 1 ? 'current' : ''} onClick={() => selectSlide(1)}>서비스 구조</button><button className={activeSlide === 2 ? 'current' : ''} onClick={() => selectSlide(2)}>프로젝트 맵</button><button className={activeSlide === 3 ? 'current' : ''} onClick={() => selectSlide(3)}>실시간 협업</button><Link to="/docs">문서</Link></nav>
      <div className="marketing-actions">{isAuthenticated ? <Link className="button button-light" to="/search">워크스페이스 <Icon name="arrow" size={16} /></Link> : <Link className="text-link" to="/login">로그인</Link>}<button className="button button-dark button-small" onClick={() => navigate(target)}>{isAuthenticated ? '캔버스 열기' : '무료로 시작하기'} <Icon name="arrow" size={16} /></button></div>
    </header>
    <main className="home-slide-window" aria-label="Agora 소개" onWheel={handleWheel} onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>
      <div className="home-slide-track" style={{ transform: `translate3d(-${(activePosition.column * 100) / 3}%, -${(activePosition.row * 100) / 3}%, 0)` }}>
        <HomeIntroSlide navigate={navigate} target={target} selectSlide={selectSlide} />        <ArchitectureSlide />        <ProjectMapSlide />        <CollaborationSlide selectSlide={selectSlide} />        <StartSlide navigate={navigate} target={target} />
      </div>
    </main>
    <footer className="home-slide-controls page-container"><span className="slide-counter"><b>{String(activeSlide + 1).padStart(2, '0')}</b> / {String(slideLabels.length).padStart(2, '0')}</span><div className="slide-progress" role="tablist" aria-label="슬라이드 이동">{slideLabels.map((label, index) => <button key={label} role="tab" aria-selected={index === activeSlide} aria-label={`${index + 1}번 슬라이드: ${label}`} className={index === activeSlide ? 'active' : ''} onClick={() => selectSlide(index)} />)}</div><div className="slide-control-actions"><button className="slide-arrow" onClick={() => selectSlide(activeSlide - 1)} disabled={activeSlide === 0} aria-label="이전 슬라이드"><Icon name="back" size={17} /></button><button className="slide-arrow next" onClick={() => selectSlide(activeSlide + 1)} disabled={activeSlide === slideLabels.length - 1} aria-label="다음 슬라이드"><Icon name="chevron" size={17} /></button></div></footer>
  </div>;
}

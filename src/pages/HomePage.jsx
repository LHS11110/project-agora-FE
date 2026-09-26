import { useEffect, useState } from 'react';
import { Link, useNavigate } from '../routing.jsx';
import Icon from '../components/Icon.jsx';
import { useAuth } from '../state/AuthContext.jsx';
import '../home-slides.css';

function MiniBoard() {
  return <div className="hero-board-wrap" aria-label="Agora 협업 캔버스 미리보기">
    <div className="hero-board-shadow" />
    <div className="hero-board">
      <div className="mini-board-top"><span className="mini-board-logo">a.</span><span>새로운 브랜드 아이디어</span><span className="mini-online"><i /> 4명 작업 중</span></div>
      <div className="mini-board-canvas">
        <div className="mini-sticky sticky-yellow"><span>what if?</span><strong>생각을<br />그려보자</strong><small>민지 · 10:42</small></div>
        <div className="mini-sticky sticky-blue"><span>01 / 방향</span><strong>가볍고<br />선명하게</strong></div>
        <div className="mini-scribble" aria-hidden="true"><svg viewBox="0 0 150 100"><path d="M8 75 C20 53 39 45 53 57 S78 89 96 54 S119 24 137 31" fill="none" stroke="#d58165" strokeWidth="4" strokeLinecap="round" /></svg></div>
        <div className="mini-photo"><div className="photo-sun" /><div className="photo-hill one" /><div className="photo-hill two" /></div>
        <div className="mini-code"><div><i /><i /><i /></div><code><b>const</b> idea = <em>together</em>;</code><code>makeSomethingGood();</code></div>
        <div className="mini-cursor"><span />지수</div>
        <div className="mini-board-footer"><span><i /> 공유 캔버스</span><span>⌘ K</span></div>
      </div>
    </div>
    <div className="floating-note"><span className="float-avatar">J</span><span>같이 떠올려봐요</span><i>✦</i></div>
    <div className="hero-orbit orbit-one" /><div className="hero-orbit orbit-two" />
  </div>;
}

export default function HomePage() {
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const target = isAuthenticated ? '/search' : '/login';
  const [activeSlide, setActiveSlide] = useState(0);
  const slideLabels = ['아고라 소개', '벡터 캔버스', '함께 편집', '직접 체험'];
  const selectSlide = (index) => setActiveSlide(Math.max(0, Math.min(slideLabels.length - 1, index)));

  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.target instanceof HTMLElement && (event.target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(event.target.tagName))) return;
      if (event.key === 'ArrowRight' || event.key === 'PageDown') { event.preventDefault(); setActiveSlide((slide) => Math.min(slideLabels.length - 1, slide + 1)); }
      if (event.key === 'ArrowLeft' || event.key === 'PageUp') { event.preventDefault(); setActiveSlide((slide) => Math.max(0, slide - 1)); }
      if (event.key === 'Home') setActiveSlide(0);
      if (event.key === 'End') setActiveSlide(slideLabels.length - 1);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  return <div className="marketing-page home-slides-page">
    <header className="marketing-header page-container">
      <Link className="brand-lockup" to="/"><span className="brand-mark"><i /><i /><i /><i /></span><span>agora<span className="brand-period">.</span></span></Link>
      <nav className="marketing-nav" aria-label="소개 슬라이드"><button className={activeSlide === 0 ? 'current' : ''} onClick={() => selectSlide(0)}>아고라</button><button className={activeSlide === 1 ? 'current' : ''} onClick={() => selectSlide(1)}>벡터 캔버스</button><button className={activeSlide === 2 ? 'current' : ''} onClick={() => selectSlide(2)}>실시간 협업</button><Link to="/docs">문서</Link></nav>
      <div className="marketing-actions">{isAuthenticated ? <Link className="button button-light" to="/search">워크스페이스 <Icon name="arrow" size={16} /></Link> : <Link className="text-link" to="/login">로그인</Link>}<button className="button button-dark button-small" onClick={() => navigate(target)}>{isAuthenticated ? '캔버스 열기' : '무료로 시작하기'} <Icon name="arrow" size={16} /></button></div>
    </header>
    <main className="home-slide-window" aria-label="Agora 소개">
      <div className="home-slide-track" style={{ transform: `translateX(-${activeSlide * 25}%)` }}>
        <section className="home-slide slide-hero" aria-roledescription="슬라이드" aria-label="1 / 4">
          <div className="home-slide-inner page-container"><div className="home-slide-copy"><span className="home-slide-kicker"><i /> IDEAS IN GOOD COMPANY · 01</span><h1>생각이 모이면<br /><em>가능성의 모양</em>이 보여요.</h1><p>낙서부터 완성된 계획까지.<br />팀의 생각이 한 장 위에서 자라나는 협업 캔버스, 아고라.</p><div className="home-slide-actions"><button className="button button-dark button-large" onClick={() => navigate(target)}>함께 시작하기 <Icon name="arrow" size={18} /></button><button className="button button-soft button-large" onClick={() => selectSlide(1)}>어떻게 작동하나요 <Icon name="chevron" size={16} /></button></div><div className="home-slide-note"><span className="avatar-stack"><i>H</i><i>M</i><i>J</i></span>한 장의 캔버스에서, 더 멀리 생각합니다.</div></div><MiniBoard /><div className="hero-side-note"><span>01</span><span className="vertical-rule" /><span>COLLABORATION, IN FULL COLOR</span></div></div>
        </section>
        <section className="home-slide slide-vector" aria-roledescription="슬라이드" aria-label="2 / 4">
          <div className="home-slide-inner page-container"><div className="home-slide-copy"><span className="home-slide-kicker"><i /> DRAW IT INTO VIEW · 02</span><h1>선을 그리고<br /><em>생각을 연결해요.</em></h1><p>획과 도형은 확대해도 또렷한 벡터 그래픽으로.<br />직접 그린 선과 화살표로 복잡한 생각도 빠르게 잇습니다.</p><div className="vector-slide-metrics"><span><b>GPU</b><small>가속 렌더링</small></span><span><b>∞</b><small>확대에도 선명하게</small></span><span><b>→</b><small>객체 간 연결</small></span></div><Link className="underlined-link" to="/tutorial">튜토리얼에서 직접 그려보기 <Icon name="arrow" size={15} /></Link></div><div className="vector-showcase" aria-hidden="true"><div className="vector-showcase-label">IDEA FLOW / 01</div><svg viewBox="0 0 700 440" role="presentation"><defs><marker id="home-vector-arrow-coral" viewBox="0 0 12 12" markerWidth="12" markerHeight="12" refX="1" refY="6" orient="auto" markerUnits="userSpaceOnUse"><path d="M1 1L11 6L1 11Z" fill="#d58165" /></marker><marker id="home-vector-arrow-sage" viewBox="0 0 12 12" markerWidth="12" markerHeight="12" refX="1" refY="6" orient="auto" markerUnits="userSpaceOnUse"><path d="M1 1L11 6L1 11Z" fill="#63846e" /></marker></defs><rect x="78" y="122" width="174" height="108" rx="18" fill="#f3ead0" stroke="#e5d8b9" strokeWidth="2"/><path d="M226 122v23h26" fill="#e9ddc1" stroke="#e5d8b9" strokeWidth="2" strokeLinejoin="round"/><ellipse cx="386" cy="160" rx="78" ry="54" fill="#dce9e4" stroke="#8aa899" strokeWidth="3"/><rect x="500" y="272" width="154" height="104" rx="20" fill="#e8e1ef" stroke="#ab9bbc" strokeWidth="3"/><path d="M258 176 C275 176 279 160 292 160" fill="none" stroke="#d58165" strokeWidth="4" strokeLinecap="round" markerEnd="url(#home-vector-arrow-coral)"/><path d="M448 198 C476 208 490 244 512 261" fill="none" stroke="#63846e" strokeWidth="4" strokeLinecap="round" markerEnd="url(#home-vector-arrow-sage)"/><path d="M333 250l6 13 13 6-13 5-6 13-5-13-13-5 13-6z" fill="#e2bd74"/><path d="M579 102l4 9 9 4-9 4-4 9-4-9-9-4 9-4z" fill="#d58165"/><text className="vector-eyebrow" x="101" y="158">QUESTION / 01</text><text className="vector-title" x="101" y="192">생각을 꺼내요</text><text className="vector-node-copy" x="386" y="166">새로운 방향</text><text className="vector-eyebrow" x="523" y="309">NEXT / 02</text><text className="vector-title" x="523" y="341">다음 한 걸음</text><text className="vector-small-copy" x="523" y="360">함께 정리하기</text></svg><span className="vector-showcase-caption">작은 선 하나가 협업의 시작이 되도록.</span></div></div>
        </section>
        <section className="home-slide slide-collab" aria-roledescription="슬라이드" aria-label="3 / 4">
          <div className="home-slide-inner page-container"><div className="home-slide-copy"><span className="home-slide-kicker"><i /> ONE CANVAS, MANY MINDS · 03</span><h1>동시에 고쳐도<br /><em>하나의 이야기로.</em></h1><p>메모와 코드 아이디어를 같은 화면에서 함께 다듬고,<br />바뀐 생각은 팀원 화면에 바로 이어집니다.</p><div className="collab-card-row"><article><span>MEMO / LIVE</span><strong>메모를<br />같이 다듬고</strong><small>한 문장도 함께 다듬어요</small></article><article><span>CODE / LIVE</span><strong>코드 생각을<br />이어 붙여요</strong><small>수식도 읽기 좋게 보여요</small></article></div><button className="button button-dark button-large" onClick={() => selectSlide(3)}>다음 장면 <Icon name="arrow" size={18} /></button></div><div className="collab-showcase-stack"><div className="live-edit-showcase"><div className="showcase-window-top"><span><i /><i /><i /></span><strong>idea.js</strong><span className="live-badge"><i /> LIVE</span></div><div className="shared-editor-demo"><div className="editor-lines"><span>01</span><span>02</span><span>03</span><span>04</span></div><code><b>const</b> <em>idea</em> = <strong>"함께 그려요"</strong>;<br />notes.add(<strong>"what if?"</strong>);<br /><b>share</b>(<em>idea</em>, <em>withTeam</em>);<br /><span>지수 · 한 줄 더하는 중</span></code></div><div className="formula-preview"><span>EXPRESSION / 02</span><strong className="formula-display">ƒ(x) = ∑ᵢ xᵢ</strong></div><div className="shared-cursor cursor-minji"><i>M</i> 민지</div></div><div className="text-edit-showcase"><div className="text-edit-showcase-head"><span><Icon name="text" size={13} /><b>공유 메모</b></span><small><i /> MARKDOWN · LIVE</small></div><p>작은 아이디어도 <strong>함께 다듬으면</strong> 더 선명해져요. <span className="remote-caret">민지</span></p></div></div></div>
        </section>
        <section className="home-slide slide-start" aria-roledescription="슬라이드" aria-label="4 / 4">
          <div className="home-slide-inner page-container"><div className="start-slide-card"><span className="home-slide-kicker"><i /> YOUR NEXT GOOD IDEA · 04</span><h1>첫 선을 그어볼까요?</h1><p>좋은 아이디어는 함께 시작하는 순간부터 자라나요.<br />샘플 캔버스를 가볍게 체험하거나, 나만의 공간을 열어보세요.</p><div className="home-slide-actions"><Link className="button button-dark button-large" to="/tutorial">튜토리얼 체험하기 <Icon name="arrow" size={18} /></Link><button className="button button-cream button-large" onClick={() => navigate(target)}>아고라 시작하기 <Icon name="arrow" size={18} /></button></div><div className="start-slide-links"><Link to="/docs">프로젝트 구조와 API 문서 보기 <Icon name="arrow" size={14} /></Link><span>© 2026 Agora Project</span></div><span className="start-star start-star-a">✳</span><span className="start-star start-star-b">✦</span></div></div>
        </section>
      </div>
    </main>
    <footer className="home-slide-controls page-container"><span className="slide-counter"><b>{String(activeSlide + 1).padStart(2, '0')}</b> / {String(slideLabels.length).padStart(2, '0')}</span><div className="slide-progress" role="tablist" aria-label="슬라이드 이동">{slideLabels.map((label, index) => <button key={label} role="tab" aria-selected={index === activeSlide} aria-label={`${index + 1}번 슬라이드: ${label}`} className={index === activeSlide ? 'active' : ''} onClick={() => selectSlide(index)} />)}</div><div className="slide-control-actions"><button className="slide-arrow" onClick={() => selectSlide(activeSlide - 1)} disabled={activeSlide === 0} aria-label="이전 슬라이드"><Icon name="back" size={17} /></button><button className="slide-arrow next" onClick={() => selectSlide(activeSlide + 1)} disabled={activeSlide === slideLabels.length - 1} aria-label="다음 슬라이드"><Icon name="chevron" size={17} /></button></div></footer>
  </div>;
}

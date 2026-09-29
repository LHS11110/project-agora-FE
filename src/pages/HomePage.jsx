import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from '../routing.jsx';
import Icon from '../components/Icon.jsx';
import { useAuth } from '../state/AuthContext.jsx';
import '../home-slides.css';
import '../home-matrix.css';

const HOME_SLIDES = [
  { label: '아고라 소개', row: 0, column: 0 },
  { label: '서비스 구조', row: 1, column: 0 },
  { label: '벡터 캔버스', row: 1, column: 1 },
  { label: '실시간 협업', row: 1, column: 2 },
  { label: '직접 체험', row: 2, column: 2 },
];

function getAdjacentSlide(index, rowOffset, columnOffset) {
  const current = HOME_SLIDES[index];
  return HOME_SLIDES.findIndex((slide) => (
    slide.row === current.row + rowOffset && slide.column === current.column + columnOffset
  ));
}

function canScroll(element, direction) {
  if (!element || direction === 0) return false;
  const { overflowY } = window.getComputedStyle(element);
  if (overflowY !== 'auto' && overflowY !== 'scroll') return false;
  const maxScroll = element.scrollHeight - element.clientHeight;
  if (maxScroll <= 1) return false;
  return direction > 0
    ? element.scrollTop < maxScroll - 1
    : element.scrollTop > 1;
}

function ArchitectureDiagram() {
  return <div className="architecture-showcase" aria-label="프론트엔드에서 백엔드와 데이터베이스로 이어지는 구성">
    <div className="architecture-showcase-label">AGORA / SYSTEM MAP</div>
    <div className="architecture-main-flow">
      <article className="architecture-node architecture-client">
        <span className="architecture-node-kicker">01 / CLIENT</span>
        <h3>프론트엔드</h3>
        <strong>React · Vite</strong>
        <p>화면과 사용자 입력을 맡고, 캔버스의 그림과 아이템을 보여줘요.</p>
        <div className="architecture-tags"><i>UI</i><i>HTTPS</i><i>WebRTC</i></div>
      </article>
      <div className="architecture-flow-arrow" aria-hidden="true"><span>API 요청</span><Icon name="arrow" size={17} /></div>
      <article className="architecture-node architecture-server">
        <span className="architecture-node-kicker">02 / BACKEND</span>
        <h3>백엔드</h3>
        <strong>Spring Boot + C++</strong>
        <p>Spring은 로그인·권한·API를, C++은 캔버스 세션·저장과 WebRTC 신호 전달을 맡아요.</p>
        <div className="architecture-tags"><i>REST</i><i>WebSocket</i><i>Realtime</i></div>
      </article>
    </div>
    <div className="architecture-storage-connector"><span>작업의 성격에 맞춰 나눠 저장</span></div>
    <div className="architecture-storage-grid">
      <article><span>RELATIONAL</span><strong>SQL Server</strong><small>계정 · 접속 세션 · 서버 정보</small></article>
      <article><span>DOCUMENT</span><strong>Elasticsearch</strong><small>캔버스 검색 · 영구 문서</small></article>
      <article><span>ACTIVE STATE</span><strong>Redis Stack</strong><small>활성 캔버스 · 작업 상태</small></article>
    </div>
    <div className="architecture-showcase-foot"><span>브라우저</span><b>→</b><span>API · 실시간 서버</span><b>→</b><span>저장소</span></div>
  </div>;
}

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
  const slideLabels = HOME_SLIDES.map(({ label }) => label);
  const activePosition = HOME_SLIDES[activeSlide];
  const wheelDeltaRef = useRef({ x: 0, y: 0 });
  const gestureStartRef = useRef(null);
  const navigationCooldownRef = useRef(0);
  const selectSlide = (index) => setActiveSlide(Math.max(0, Math.min(slideLabels.length - 1, index)));
  const moveInDirection = (rowOffset, columnOffset) => {
    const nextSlide = getAdjacentSlide(activeSlide, rowOffset, columnOffset);
    if (nextSlide < 0) return false;
    setActiveSlide(nextSlide);
    return true;
  };
  const moveFromGesture = (rowOffset, columnOffset) => {
    if (Date.now() < navigationCooldownRef.current) return;
    if (moveInDirection(rowOffset, columnOffset)) navigationCooldownRef.current = Date.now() + 620;
  };
  const handleWheel = (event) => {
    if (Date.now() < navigationCooldownRef.current) return;
    const vertical = Math.abs(event.deltaY) >= Math.abs(event.deltaX);
    const target = event.target instanceof Element ? event.target : null;
    const contentPane = target?.closest('.home-slide-inner');
    if (vertical && canScroll(contentPane, Math.sign(event.deltaY))) {
      wheelDeltaRef.current = { x: 0, y: 0 };
      return;
    }

    const accumulated = wheelDeltaRef.current;
    accumulated.x += event.deltaX;
    accumulated.y += event.deltaY;
    if (Math.max(Math.abs(accumulated.x), Math.abs(accumulated.y)) < 42) return;

    const horizontal = Math.abs(accumulated.x) > Math.abs(accumulated.y);
    const rowOffset = horizontal ? 0 : Math.sign(accumulated.y);
    const columnOffset = horizontal ? Math.sign(accumulated.x) : 0;
    wheelDeltaRef.current = { x: 0, y: 0 };
    moveFromGesture(rowOffset, columnOffset);
  };
  const handleTouchStart = (event) => {
    const target = event.target instanceof Element ? event.target : null;
    if (target?.closest('a, button, input, textarea, select')) {
      gestureStartRef.current = null;
      return;
    }
    const touch = event.touches[0];
    const contentPane = target?.closest('.home-slide-inner');
    const overflowY = contentPane ? window.getComputedStyle(contentPane).overflowY : 'visible';
    const maxScroll = contentPane && (overflowY === 'auto' || overflowY === 'scroll')
      ? Math.max(0, contentPane.scrollHeight - contentPane.clientHeight)
      : 0;
    if (touch) gestureStartRef.current = {
      x: touch.clientX,
      y: touch.clientY,
      scrollTop: contentPane?.scrollTop ?? 0,
      maxScroll,
    };
  };
  const handleTouchEnd = (event) => {
    const start = gestureStartRef.current;
    const touch = event.changedTouches[0];
    gestureStartRef.current = null;
    if (!start || !touch) return;
    const deltaX = touch.clientX - start.x;
    const deltaY = touch.clientY - start.y;
    if (Math.max(Math.abs(deltaX), Math.abs(deltaY)) < 48) return;
    if (Math.abs(deltaX) > Math.abs(deltaY)) moveFromGesture(0, deltaX < 0 ? 1 : -1);
    else {
      const scrollDirection = deltaY < 0 ? 1 : -1;
      const contentCanScrollAtStart = start.maxScroll > 1 && (scrollDirection > 0
        ? start.scrollTop < start.maxScroll - 1
        : start.scrollTop > 1);
      if (!contentCanScrollAtStart) moveFromGesture(scrollDirection, 0);
    }
  };

  useEffect(() => {
    const onKeyDown = (event) => {
      const target = event.target instanceof HTMLElement ? event.target : null;
      if (target && (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))) return;
      if (target?.closest('a, button')) return;
      const directions = {
        ArrowDown: [1, 0],
        ArrowUp: [-1, 0],
        ArrowRight: [0, 1],
        ArrowLeft: [0, -1],
      };
      if (directions[event.key]) {
        const [rowOffset, columnOffset] = directions[event.key];
        const contentPane = target?.closest('.home-slide-inner');
        if (rowOffset !== 0 && canScroll(contentPane, rowOffset)) return;
        const nextSlide = getAdjacentSlide(activeSlide, rowOffset, columnOffset);
        if (nextSlide >= 0) {
          event.preventDefault();
          setActiveSlide(nextSlide);
        }
        return;
      }
      if (event.key === 'PageDown') { event.preventDefault(); setActiveSlide((slide) => Math.min(slideLabels.length - 1, slide + 1)); }
      if (event.key === 'PageUp') { event.preventDefault(); setActiveSlide((slide) => Math.max(0, slide - 1)); }
      if (event.key === 'Home') setActiveSlide(0);
      if (event.key === 'End') setActiveSlide(slideLabels.length - 1);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [activeSlide, slideLabels.length]);

  return <div className="marketing-page home-slides-page">
    <header className="marketing-header page-container">
      <Link className="brand-lockup" to="/"><span className="brand-mark"><i /><i /><i /><i /></span><span>agora<span className="brand-period">.</span></span></Link>
      <nav className="marketing-nav" aria-label="소개 슬라이드"><button className={activeSlide === 0 ? 'current' : ''} onClick={() => selectSlide(0)}>아고라</button><button className={activeSlide === 1 ? 'current' : ''} onClick={() => selectSlide(1)}>서비스 구조</button><button className={activeSlide === 2 ? 'current' : ''} onClick={() => selectSlide(2)}>프로젝트 맵</button><button className={activeSlide === 3 ? 'current' : ''} onClick={() => selectSlide(3)}>실시간 협업</button><Link to="/docs">문서</Link></nav>
      <div className="marketing-actions">{isAuthenticated ? <Link className="button button-light" to="/search">워크스페이스 <Icon name="arrow" size={16} /></Link> : <Link className="text-link" to="/login">로그인</Link>}<button className="button button-dark button-small" onClick={() => navigate(target)}>{isAuthenticated ? '캔버스 열기' : '무료로 시작하기'} <Icon name="arrow" size={16} /></button></div>
    </header>
    <main className="home-slide-window" aria-label="Agora 소개" onWheel={handleWheel} onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>
      <div className="home-slide-track" style={{ transform: `translate3d(-${(activePosition.column * 100) / 3}%, -${(activePosition.row * 100) / 3}%, 0)` }}>
        <section className="home-slide slide-hero" style={{ gridColumn: 1, gridRow: 1 }} aria-roledescription="슬라이드" aria-label="1 / 5">
          <div className="home-slide-inner page-container"><div className="home-slide-copy"><span className="home-slide-kicker"><i /> IDEAS IN GOOD COMPANY · 01</span><h1>생각이 모이면<br /><em>가능성의 모양</em>이 보여요.</h1><p>낙서부터 완성된 계획까지.<br />팀의 생각이 한 장 위에서 자라나는 협업 캔버스, 아고라.</p><div className="home-slide-actions"><button className="button button-dark button-large" onClick={() => navigate(target)}>함께 시작하기 <Icon name="arrow" size={18} /></button><button className="button button-soft button-large" onClick={() => selectSlide(1)}>어떻게 작동하나요 <Icon name="chevron" size={16} /></button></div><div className="home-slide-note"><span className="avatar-stack"><i>H</i><i>M</i><i>J</i></span>한 장의 캔버스에서, 더 멀리 생각합니다.</div><span className="home-scroll-hint" aria-hidden="true">↓ 아래로 내려 서비스 구조 보기</span></div><MiniBoard /><div className="hero-side-note"><span>01</span><span className="vertical-rule" /><span>COLLABORATION, IN FULL COLOR</span></div></div>
        </section>
        <section className="home-slide slide-architecture" style={{ gridColumn: 1, gridRow: 2 }} aria-roledescription="슬라이드" aria-label="2 / 5">
          <div className="home-slide-inner page-container"><div className="home-slide-copy"><span className="home-slide-kicker"><i /> SERVICE ARCHITECTURE · 02</span><h1>세 가지 역할이 모여<br /><em>한 캔버스를 만들어요.</em></h1><p>프론트엔드는 화면을 그리고, 백엔드는 요청과 실시간 연결을 맡아요.<br />DB는 계정과 캔버스 데이터를 안전하게 나눠 저장합니다.</p><div className="architecture-slide-note"><span>01</span><span>화면과 입력</span><i /><span>02</span><span>API와 실시간 연결</span><i /><span>03</span><span>저장과 검색</span></div></div><ArchitectureDiagram /></div>
        </section>
        <section className="home-slide slide-vector" style={{ gridColumn: 2, gridRow: 2 }} aria-roledescription="슬라이드" aria-label="3 / 5">
          <div className="home-slide-inner page-container"><div className="home-slide-copy"><span className="home-slide-kicker"><i /> PROJECT PLANNING · 03</span><h1>프로젝트를 나누고<br /><em>할 일을 연결해요.</em></h1><p>가입 개선 목표 아래 조사·기능·출시 단계를 두고,<br />각 단계의 실행 과제를 한눈에 정리합니다.</p><div className="vector-slide-metrics"><span><b>GOAL</b><small>목표부터 정리</small></span><span><b>TASK</b><small>실행 단위로 분해</small></span><span><b>→</b><small>다음 작업 연결</small></span></div><Link className="underlined-link" to="/tutorial">튜토리얼에서 직접 그려보기 <Icon name="arrow" size={15} /></Link></div><div className="vector-showcase" aria-hidden="true"><div className="vector-showcase-label">PROJECT STRUCTURE / 01</div><svg viewBox="0 0 700 440" role="presentation">
  <defs><marker id="home-project-arrow" viewBox="0 0 10 10" markerWidth="10" markerHeight="10" refX="1" refY="5" orient="auto" markerUnits="userSpaceOnUse"><path d="M1 1L9 5L1 9Z" fill="#82988a" /></marker></defs>
  <path d="M187 220 C213 220 219 89 244 89" fill="none" stroke="#82988a" strokeWidth="2.5" strokeLinecap="round" markerEnd="url(#home-project-arrow)" />
  <path d="M187 220 C210 220 222 220 244 220" fill="none" stroke="#82988a" strokeWidth="2.5" strokeLinecap="round" markerEnd="url(#home-project-arrow)" />
  <path d="M187 220 C213 220 219 351 244 351" fill="none" stroke="#82988a" strokeWidth="2.5" strokeLinecap="round" markerEnd="url(#home-project-arrow)" />
  <path d="M415 89 C442 89 457 77 486 77" fill="none" stroke="#a0b2a6" strokeWidth="2" strokeLinecap="round" markerEnd="url(#home-project-arrow)" />
  <path d="M415 89 C446 100 450 134 486 143" fill="none" stroke="#a0b2a6" strokeWidth="2" strokeLinecap="round" markerEnd="url(#home-project-arrow)" />
  <path d="M415 220 C444 220 456 208 486 208" fill="none" stroke="#a0b2a6" strokeWidth="2" strokeLinecap="round" markerEnd="url(#home-project-arrow)" />
  <path d="M415 220 C444 220 456 274 486 274" fill="none" stroke="#a0b2a6" strokeWidth="2" strokeLinecap="round" markerEnd="url(#home-project-arrow)" />
  <path d="M415 351 C444 351 456 339 486 339" fill="none" stroke="#a0b2a6" strokeWidth="2" strokeLinecap="round" markerEnd="url(#home-project-arrow)" />
  <path d="M415 351 C444 351 456 405 486 405" fill="none" stroke="#a0b2a6" strokeWidth="2" strokeLinecap="round" markerEnd="url(#home-project-arrow)" />
  <rect x="42" y="176" width="145" height="88" rx="15" fill="#f3ead0" stroke="#e5d8b9" strokeWidth="2" />
  <rect x="258" y="53" width="157" height="72" rx="13" fill="#dce9e4" stroke="#a9c0b2" strokeWidth="2" />
  <rect x="258" y="184" width="157" height="72" rx="13" fill="#f3ead0" stroke="#ddcfad" strokeWidth="2" />
  <rect x="258" y="315" width="157" height="72" rx="13" fill="#e8e1ef" stroke="#b6a9c1" strokeWidth="2" />
  <rect x="500" y="49" width="165" height="56" rx="10" fill="#fff" stroke="#e3e9e1" strokeWidth="2" />
  <rect x="500" y="115" width="165" height="56" rx="10" fill="#fff" stroke="#e3e9e1" strokeWidth="2" />
  <rect x="500" y="180" width="165" height="56" rx="10" fill="#fff" stroke="#e3e9e1" strokeWidth="2" />
  <rect x="500" y="246" width="165" height="56" rx="10" fill="#fff" stroke="#e3e9e1" strokeWidth="2" />
  <rect x="500" y="311" width="165" height="56" rx="10" fill="#fff" stroke="#e3e9e1" strokeWidth="2" />
  <rect x="500" y="377" width="165" height="56" rx="10" fill="#fff" stroke="#e3e9e1" strokeWidth="2" />
  <path d="M169 176h18v18" fill="#e9ddc1" stroke="#e5d8b9" strokeWidth="2" strokeLinejoin="round" />
  <text className="map-root-label" x="57" y="200">PROJECT / ROOT</text>
  <text className="map-root-title" x="57" y="224">가입 흐름 개선</text>
  <text className="map-root-metric" x="57" y="246">전환율 목표 +15%</text>
  <text className="map-group-label" x="274" y="73">01 / DISCOVER</text>
  <text className="map-group-title" x="274" y="96">사용자 조사</text>
  <text className="map-group-note" x="274" y="113">문제와 기회 찾기</text>
  <text className="map-group-label" x="274" y="204">02 / BUILD</text>
  <text className="map-group-title" x="274" y="227">핵심 기능</text>
  <text className="map-group-note" x="274" y="244">가설을 빠르게 검증</text>
  <text className="map-group-label" x="274" y="335">03 / LAUNCH</text>
  <text className="map-group-title" x="274" y="358">출시와 측정</text>
  <text className="map-group-note" x="274" y="375">결과를 함께 살펴보기</text>
  <text className="map-task-index" x="515" y="69">RESEARCH / 01</text>
  <text className="map-task-title" x="515" y="91">사용자 인터뷰 5명</text>
  <text className="map-task-index" x="515" y="135">RESEARCH / 02</text>
  <text className="map-task-title" x="515" y="157">가입 이탈 지점 찾기</text>
  <text className="map-task-index" x="515" y="200">MVP / 01</text>
  <text className="map-task-title" x="515" y="222">가입 3단계로 단축</text>
  <text className="map-task-index" x="515" y="266">MVP / 02</text>
  <text className="map-task-title" x="515" y="288">온보딩 A/B 실험</text>
  <text className="map-task-index" x="515" y="331">LAUNCH / 01</text>
  <text className="map-task-title" x="515" y="353">베타 버전 출시</text>
  <text className="map-task-index" x="515" y="397">LAUNCH / 02</text>
  <text className="map-task-title" x="515" y="419">전환율 주간 측정</text>
</svg><span className="vector-showcase-caption">목표 → 단계 → 실행 과제가 이어지는 프로젝트 맵.</span></div></div>
        </section>
        <section className="home-slide slide-collab" style={{ gridColumn: 3, gridRow: 2 }} aria-roledescription="슬라이드" aria-label="4 / 5">
          <div className="home-slide-inner page-container"><div className="home-slide-copy"><span className="home-slide-kicker"><i /> ONE CANVAS, MANY MINDS · 04</span><h1>동시에 고쳐도<br /><em>하나의 이야기로.</em></h1><p>메모와 코드 아이디어를 같은 화면에서 함께 다듬고,<br />바뀐 생각은 팀원 화면에 바로 이어집니다.</p><div className="collab-card-row"><article><span>MEMO / LIVE</span><strong>메모를<br />같이 다듬고</strong><small>한 문장도 함께 다듬어요</small></article><article><span>CODE / LIVE</span><strong>코드 생각을<br />이어 붙여요</strong><small>수식도 읽기 좋게 보여요</small></article></div><button className="button button-dark button-large" onClick={() => selectSlide(4)}>다음 장면 <Icon name="arrow" size={18} /></button></div><div className="collab-showcase-stack"><div className="live-edit-showcase"><div className="showcase-window-top"><span><i /><i /><i /></span><strong>idea.js</strong><span className="live-badge"><i /> LIVE</span></div><div className="shared-editor-demo"><div className="editor-lines"><span>01</span><span>02</span><span>03</span><span>04</span></div><code><b>const</b> <em>idea</em> = <strong>"함께 그려요"</strong>;<br />notes.add(<strong>"what if?"</strong>);<br /><b>share</b>(<em>idea</em>, <em>withTeam</em>);<br /><span>지수 · 한 줄 더하는 중</span></code></div><div className="formula-preview"><span>EXPRESSION / 02</span><strong className="formula-display">ƒ(x) = ∑ᵢ xᵢ</strong></div><div className="shared-cursor cursor-minji"><i>M</i> 민지</div></div><div className="text-edit-showcase"><div className="text-edit-showcase-head"><span><Icon name="text" size={13} /><b>공유 메모</b></span><small><i /> MARKDOWN · LIVE</small></div><p>작은 아이디어도 <strong>함께 다듬으면</strong> 더 선명해져요. <span className="remote-caret">민지</span></p></div></div></div>
        </section>
        <section className="home-slide slide-start" style={{ gridColumn: 3, gridRow: 3 }} aria-roledescription="슬라이드" aria-label="5 / 5">
          <div className="home-slide-inner page-container"><div className="start-slide-card"><span className="home-slide-kicker"><i /> YOUR NEXT GOOD IDEA · 05</span><h1>첫 선을 그어볼까요?</h1><p>좋은 아이디어는 함께 시작하는 순간부터 자라나요.<br />샘플 캔버스를 가볍게 체험하거나, 나만의 공간을 열어보세요.</p><div className="home-slide-actions"><Link className="button button-dark button-large" to="/tutorial">튜토리얼 체험하기 <Icon name="arrow" size={18} /></Link><button className="button button-cream button-large" onClick={() => navigate(target)}>아고라 시작하기 <Icon name="arrow" size={18} /></button></div><div className="start-slide-links"><Link to="/docs">프로젝트 구조와 API 문서 보기 <Icon name="arrow" size={14} /></Link><span>© 2026 Agora Project</span></div><span className="start-star start-star-a">✳</span><span className="start-star start-star-b">✦</span></div></div>
        </section>
      </div>
    </main>
    <footer className="home-slide-controls page-container"><span className="slide-counter"><b>{String(activeSlide + 1).padStart(2, '0')}</b> / {String(slideLabels.length).padStart(2, '0')}</span><div className="slide-progress" role="tablist" aria-label="슬라이드 이동">{slideLabels.map((label, index) => <button key={label} role="tab" aria-selected={index === activeSlide} aria-label={`${index + 1}번 슬라이드: ${label}`} className={index === activeSlide ? 'active' : ''} onClick={() => selectSlide(index)} />)}</div><div className="slide-control-actions"><button className="slide-arrow" onClick={() => selectSlide(activeSlide - 1)} disabled={activeSlide === 0} aria-label="이전 슬라이드"><Icon name="back" size={17} /></button><button className="slide-arrow next" onClick={() => selectSlide(activeSlide + 1)} disabled={activeSlide === slideLabels.length - 1} aria-label="다음 슬라이드"><Icon name="chevron" size={17} /></button></div></footer>
  </div>;
}

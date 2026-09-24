import { Link, useNavigate } from '../routing.jsx';
import Icon from '../components/Icon.jsx';
import { useAuth } from '../state/AuthContext.jsx';

function MiniBoard() {
  return <div className="hero-board-wrap" aria-label="Agora 협업 캔버스 미리보기">
    <div className="hero-board-shadow" />
    <div className="hero-board">
      <div className="mini-board-top"><span className="mini-board-logo">a.</span><span>새로운 브랜드 아이디어</span><span className="mini-online"><i /> 4명 작업 중</span></div>
      <div className="mini-board-canvas">
        <div className="mini-sticky sticky-yellow"><span>what if?</span><strong>생각을<br />그려보자</strong><small>민지 · 10:42</small></div>
        <div className="mini-sticky sticky-blue"><span>01 / 방향</span><strong>가볍고<br />선명하게</strong></div>
        <div className="mini-scribble">↗</div>
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
  return <div className="marketing-page">
    <header className="marketing-header page-container">
      <Link className="brand-lockup" to="/"><span className="brand-mark"><i /><i /><i /><i /></span><span>agora<span className="brand-period">.</span></span></Link>
      <nav className="marketing-nav"><a href="#how">어떻게 쓰나요</a><a href="#features">기능</a><a href="#about">이야기</a></nav>
      <div className="marketing-actions">{isAuthenticated ? <Link className="button button-light" to="/search">워크스페이스 <Icon name="arrow" size={16} /></Link> : <Link className="text-link" to="/login">로그인</Link>}<button className="button button-dark button-small" onClick={() => navigate(target)}>{isAuthenticated ? '캔버스 열기' : '무료로 시작하기'} <Icon name="arrow" size={16} /></button></div>
    </header>
    <main>
      <section className="hero-section page-container">
        <div className="hero-copy"><div className="eyebrow"><span className="eyebrow-dot" /> IDEAS IN GOOD COMPANY <span className="eyebrow-line" /></div><h1>생각이 모이면<br /><em>가능성이</em> 보여요.</h1><p className="hero-description">낙서부터 완성된 계획까지.<br />팀의 생각이 한 장 위에서 자라나는 협업 캔버스, 아고라.</p><div className="hero-actions"><button className="button button-dark button-large" onClick={() => navigate(target)}>함께 시작하기 <Icon name="arrow" size={18} /></button><a className="quiet-link" href="#how"><span className="play-button">▶</span> 1분 안에 둘러보기</a></div><div className="hero-proof"><div className="avatar-stack"><span>H</span><span>M</span><span>J</span><span>+</span></div><span>생각을 나누는 팀들이<br /><strong>아고라에서 함께 만들고 있어요</strong></span></div></div>
        <MiniBoard /><div className="hero-side-note"><span>01</span><span className="vertical-rule" /><span>COLLABORATION, IN FULL COLOR</span></div>
      </section>
      <section id="how" className="manifesto-section"><div className="page-container manifesto-inner"><span className="section-kicker">A SHARED SPACE FOR THOUGHT</span><h2>말로만 맴돌던 생각을<br /><span>눈앞에 펼쳐놓는 곳.</span></h2><p>정답을 찾기 전에, 함께 질문을 놓아두세요.<br />아고라는 아이디어의 첫 모양부터 마지막 디테일까지 한곳에 담아요.</p><a className="underlined-link" href="#features">아고라가 만드는 방식 <Icon name="arrow" size={15} /></a><div className="manifesto-decoration">“</div></div></section>
      <section id="features" className="feature-section page-container"><div className="section-heading"><div><span className="section-kicker">ONE CANVAS, MANY WAYS</span><h2>함께 만드는 데 필요한<br />모든 것이 한 장에.</h2></div><p>다르게 생각하는 사람들이<br />같은 방향을 바라볼 수 있도록.</p></div>
        <div className="feature-grid">
          <article className="feature-card"><div className="feature-visual draw-visual"><span className="draw-caret">✳</span><svg viewBox="0 0 300 130" aria-hidden="true"><path d="M12 70 C 58 10, 90 120, 140 56 S 220 14, 285 64" fill="none" stroke="#dd8061" strokeWidth="5" strokeLinecap="round"/><path d="M36 97 Q 83 36, 126 90 T 253 93" fill="none" stroke="#59786d" strokeWidth="4" strokeLinecap="round" strokeDasharray="2 8"/></svg></div><div className="feature-meta"><span>01 · VISUAL THINKING</span><span>↗</span></div><h3>그려서 나누기</h3><p>완벽한 선보다 빠른 스케치가 먼저인 순간이 있어요. 펜을 들고 생각을 이어보세요.</p></article>
          <article className="feature-card"><div className="feature-visual share-visual"><div className="tiny-window"><div className="tiny-window-head"><i /><i /><i /></div><div><span>const</span> team = <b>"you + me"</b><br /><small>build(idea);</small></div></div><span className="share-sticker">같이 고쳐봐요 ↗</span></div><div className="feature-meta"><span>02 · LIVE COLLABORATION</span><span>↗</span></div><h3>실시간으로 함께</h3><p>멀리 있어도 같은 캔버스 위에서. 바뀌는 순간이 모두에게 이어져요.</p></article>
          <article className="feature-card"><div className="feature-visual organize-visual"><div className="organize-card card-a">질문을 모아요<span>✦</span></div><div className="organize-card card-b">생각을 잇고<span>↗</span></div><div className="organize-card card-c">답을 그려요<span>○</span></div></div><div className="feature-meta"><span>03 · FROM SPARK TO PLAN</span><span>↗</span></div><h3>흐름을 이어가기</h3><p>흩어진 메모와 이미지, 코드 조각이 하나의 이야기로 연결됩니다.</p></article>
        </div>
      </section>
      <section id="about" className="closing-section"><div className="page-container closing-inner"><span className="section-kicker">YOUR NEXT GOOD IDEA</span><h2>첫 선을 그어볼까요?</h2><p>좋은 아이디어는, 함께 시작하는 순간부터 자라나요.</p><button className="button button-cream button-large" onClick={() => navigate(target)}>아고라 시작하기 <Icon name="arrow" size={18} /></button><span className="closing-star star-a">✳</span><span className="closing-star star-b">✦</span></div></section>
    </main>
    <footer className="marketing-footer page-container"><Link className="brand-lockup" to="/"><span className="brand-mark"><i /><i /><i /><i /></span><span>agora<span className="brand-period">.</span></span></Link><span>생각이 만나면, 다음 장면이 시작돼요.</span><span>© 2026 Agora Project</span></footer>
  </div>;
}

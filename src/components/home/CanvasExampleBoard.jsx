export default function CanvasExampleBoard() {
  return <div className="hero-board-wrap" role="img" aria-label="메모, 그림, 코드가 함께 놓인 아고라 협업 캔버스 예시">
    <div className="hero-board-shadow" />
    <div className="hero-board">
      <div className="mini-board-top"><span className="mini-board-logo">a.</span><span>새로운 브랜드 아이디어</span><span className="mini-online"><i /> 4명 작업 중</span></div>
      <div className="mini-board-canvas">
        <div className="mini-sticky sticky-yellow"><span>what if?</span><strong>생각을<br />그려보자</strong><small>민지 · 10:42</small></div>
        <div className="mini-sticky sticky-blue"><span>01 / 방향</span><strong>가볍고<br />선명하게</strong></div>
        <div className="mini-scribble" aria-hidden="true"><svg viewBox="0 0 150 100"><path d="M8 75 C20 53 39 45 53 57 S78 89 96 54 S119 24 137 31" fill="none" stroke="#d58165" strokeWidth="4" strokeLinecap="round" /></svg></div>
        <div className="mini-photo" aria-hidden="true"><div className="photo-sun" /><div className="photo-hill one" /><div className="photo-hill two" /></div>
        <div className="mini-code"><div><i /><i /><i /></div><code><b>const</b> idea = <em>together</em>;</code><code>makeSomethingGood();</code></div>
        <div className="mini-cursor"><span />지수</div>
        <div className="mini-board-footer"><span><i /> 공유 캔버스</span><span>⌘ K</span></div>
      </div>
    </div>
  </div>;
}

import ArchitectureDiagram from './ArchitectureDiagram.jsx';

export default function ArchitectureSlide() {
  return (
        <section className="home-slide slide-architecture" style={{ gridColumn: 1, gridRow: 2 }} aria-roledescription="슬라이드" aria-label="2 / 5">
          <div className="home-slide-inner page-container"><div className="home-slide-copy"><span className="home-slide-kicker"><i /> SERVICE ARCHITECTURE · 02</span><h1>세 가지 역할이 모여<br /><em>한 캔버스를 만들어요.</em></h1><p>프론트엔드는 화면을 그리고, 백엔드는 요청과 실시간 연결을 맡아요.<br />DB는 계정과 캔버스 데이터를 안전하게 나눠 저장합니다.</p><div className="architecture-slide-note"><span>01</span><span>화면과 입력</span><i /><span>02</span><span>API와 실시간 연결</span><i /><span>03</span><span>저장과 검색</span></div></div><ArchitectureDiagram /></div>
        </section>
  );
}

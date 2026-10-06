import PointerWater from '../frelog/PointerWater.jsx';
import SlideDeskObjects from './SlideDeskObjects.jsx';
import ArchitectureDiagram from './ArchitectureDiagram.jsx';

export default function ArchitectureSlide() {
  return (
        <section className="home-slide slide-architecture" aria-roledescription="슬라이드" aria-label="2 / 5"><PointerWater />
          <div className="home-slide-inner page-container"><div className="home-slide-copy"><span className="home-slide-kicker"><i /> FRELOG SYSTEM · 02</span><h1>필요한 기능이 이어져<br /><em>하나의 흐름이 돼요.</em></h1><p>화면과 실시간 연결, 데이터 저장이 각자의 역할을 해요.<br />작업 흐름은 자연스럽게 이어지고 캔버스는 계속 움직입니다.</p><SlideDeskObjects variant="architecture" /><div className="architecture-slide-note"><span>01</span><span>화면과 입력</span><i /><span>02</span><span>실시간 연결</span><i /><span>03</span><span>저장과 검색</span></div></div><ArchitectureDiagram /></div>
        </section>
  );
}

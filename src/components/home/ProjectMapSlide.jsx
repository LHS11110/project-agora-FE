import KnowledgeStrip from './knowledge/KnowledgeStrip.jsx';
import SlideContextRibbon from './SlideContextRibbon.jsx';
import PointerWater from '../frelog/PointerWater.jsx';
import SlideDeskObjects from './SlideDeskObjects.jsx';
import { Link } from '../../routing.jsx';
import Icon from '../Icon.jsx';
import ProjectMapDiagram from './ProjectMapDiagram.jsx';

export default function ProjectMapSlide() {
  return (
        <section className="home-slide slide-vector" aria-roledescription="슬라이드" aria-label="3 / 5"><PointerWater />
          <div className="home-slide-inner page-container"><div className="home-slide-copy"><span className="home-slide-kicker"><i /> IDEAS TO ACTION · 03</span><h1>프로젝트를 나누고<br /><em>할 일을 연결해요.</em></h1><p>목표와 질문을 작은 단계로 나누고,<br />각 아이디어가 다음 실행으로 이어지도록 정리해요.</p><SlideDeskObjects variant="map" /><div className="vector-slide-metrics"><span><b>GOAL</b><small>목표부터 정리</small></span><span><b>TASK</b><small>실행 단위로 분해</small></span><span><b>→</b><small>다음 작업 연결</small></span></div><Link className="underlined-link" to="/tutorial">튜토리얼에서 직접 그려보기 <Icon name="arrow" size={15} /></Link></div><div className="home-knowledge-stage"><ProjectMapDiagram /><KnowledgeStrip variant="map" /></div><SlideContextRibbon variant="map" /></div>
        </section>
  );
}

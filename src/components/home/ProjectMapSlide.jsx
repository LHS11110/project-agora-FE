import PointerWater from '../frelog/PointerWater.jsx';
import SlideDeskObjects from './SlideDeskObjects.jsx';
import { Link } from '../../routing.jsx';
import Icon from '../Icon.jsx';

export default function ProjectMapSlide() {
  return (
        <section className="home-slide slide-vector" aria-roledescription="슬라이드" aria-label="3 / 5"><PointerWater />
          <div className="home-slide-inner page-container"><div className="home-slide-copy"><span className="home-slide-kicker"><i /> IDEAS TO ACTION · 03</span><h1>프로젝트를 나누고<br /><em>할 일을 연결해요.</em></h1><p>목표와 질문을 작은 단계로 나누고,<br />각 아이디어가 다음 실행으로 이어지도록 정리해요.</p><SlideDeskObjects variant="map" /><div className="vector-slide-metrics"><span><b>GOAL</b><small>목표부터 정리</small></span><span><b>TASK</b><small>실행 단위로 분해</small></span><span><b>→</b><small>다음 작업 연결</small></span></div><Link className="underlined-link" to="/tutorial">튜토리얼에서 직접 그려보기 <Icon name="arrow" size={15} /></Link></div><div className="vector-showcase" aria-hidden="true"><div className="vector-showcase-label">PROJECT STRUCTURE / 01</div><svg viewBox="0 0 700 440" role="presentation">
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
  <g className="project-map-object">
  <rect x="42" y="176" width="145" height="88" rx="15" fill="#f3ead0" stroke="#e5d8b9" strokeWidth="2" />
  <text className="map-root-label" x="57" y="200">PROJECT / ROOT</text>
  <text className="map-root-title" x="57" y="224">가입 흐름 개선</text>
  <text className="map-root-metric" x="57" y="246">전환율 목표 +15%</text>
  </g>
  <g className="project-map-object">
  <rect x="258" y="53" width="157" height="72" rx="13" fill="#dce9e4" stroke="#a9c0b2" strokeWidth="2" />
  </g>
  <g className="project-map-object">
  <rect x="258" y="184" width="157" height="72" rx="13" fill="#f3ead0" stroke="#ddcfad" strokeWidth="2" />
  <text className="map-root-label" x="57" y="200">PROJECT / ROOT</text>
  <text className="map-root-title" x="57" y="224">가입 흐름 개선</text>
  <text className="map-root-metric" x="57" y="246">전환율 목표 +15%</text>
  </g>
  <g className="project-map-object">
  <rect x="258" y="315" width="157" height="72" rx="13" fill="#e8e1ef" stroke="#b6a9c1" strokeWidth="2" />
  </g>
  <g className="project-map-object">
  <rect x="500" y="49" width="165" height="56" rx="10" fill="#fff" stroke="#e3e9e1" strokeWidth="2" />
  </g>
  <g className="project-map-object">
  <rect x="500" y="115" width="165" height="56" rx="10" fill="#fff" stroke="#e3e9e1" strokeWidth="2" />
  </g>
  <g className="project-map-object">
  <rect x="500" y="180" width="165" height="56" rx="10" fill="#fff" stroke="#e3e9e1" strokeWidth="2" />
  <text className="map-root-label" x="57" y="200">PROJECT / ROOT</text>
  <text className="map-root-title" x="57" y="224">가입 흐름 개선</text>
  </g>
  <g className="project-map-object">
  <rect x="500" y="246" width="165" height="56" rx="10" fill="#fff" stroke="#e3e9e1" strokeWidth="2" />
  <text className="map-root-metric" x="57" y="246">전환율 목표 +15%</text>
  </g>
  <g className="project-map-object">
  <rect x="500" y="311" width="165" height="56" rx="10" fill="#fff" stroke="#e3e9e1" strokeWidth="2" />
  </g>
  <g className="project-map-object">
  <rect x="500" y="377" width="165" height="56" rx="10" fill="#fff" stroke="#e3e9e1" strokeWidth="2" />
  </g>
</svg><span className="vector-showcase-caption">목표 → 단계 → 실행 과제가 이어지는 프로젝트 맵.</span></div></div>
        </section>
  );
}

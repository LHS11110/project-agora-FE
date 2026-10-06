import PointerWater from '../frelog/PointerWater.jsx';
import SlideDeskObjects from './SlideDeskObjects.jsx';
import Icon from '../Icon.jsx';
import FreLogMotionScene from '../frelog/FreLogMotionScene.jsx';

export default function HomeIntroSlide({navigate, target, selectSlide}) {
  return (
        <section className="home-slide slide-hero" aria-roledescription="슬라이드" aria-label="1 / 5"><PointerWater />
          <div className="home-slide-inner page-container">
            <div className="home-slide-copy">
              <span className="home-slide-kicker"><i /> FRELOG · COLLABORATIVE CANVAS</span>
              <h1>생각을 자유롭게<br /><em>기록하고 연결해요.</em></h1>
              <p>메모와 질문, 수식과 코드가 한곳에서 만나요.<br />움직이는 캔버스 위에 팀의 다음 생각을 이어보세요.</p><SlideDeskObjects variant="intro" />
              <div className="home-slide-actions"><button className="button button-dark button-large" onClick={() => navigate(target)}>FreLog 시작하기 <Icon name="arrow" size={18} /></button><button className="button button-soft button-large" onClick={() => selectSlide(3)}>함께 편집 살펴보기 <Icon name="chevron" size={16} /></button></div>
              <div className="home-slide-note"><span className="avatar-stack"><i>H</i><i>M</i><i>J</i></span>서로 다른 생각을 한 장에 모아보세요.</div>
              <span className="home-scroll-hint" aria-hidden="true">↓ 아래로 FreLog 둘러보기</span>
            </div>
            <div className="hero-scene-setting">
              <FreLogMotionScene variant="home" />
              <div className="hero-side-note"><span>01</span><span className="vertical-rule" aria-hidden="true" /><span>IDEAS IN GOOD COMPANY</span></div>
            </div>
          </div>
        </section>
  );
}

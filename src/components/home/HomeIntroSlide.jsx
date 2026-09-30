import Icon from '../Icon.jsx';
import CanvasExampleBoard from './CanvasExampleBoard.jsx';

export default function HomeIntroSlide({navigate, target, selectSlide}) {
  return (
        <section className="home-slide slide-hero" style={{ gridColumn: 1, gridRow: 1 }} aria-roledescription="슬라이드" aria-label="1 / 5">
          <div className="home-slide-inner page-container">
            <div className="home-slide-copy">
              <span className="home-slide-kicker"><i /> THE PUBLIC SQUARE · 01</span>
              <h1>생각이 모이는 순간,<br /><em>가능성이 자라나요.</em></h1>
              <p>서로 다른 질문과 아이디어가 만나는 열린 광장.<br />팀의 생각을 한 장의 캔버스에 모아 함께 답을 찾아요.</p>
              <div className="home-slide-actions"><button className="button button-dark button-large" onClick={() => navigate(target)}>광장에 참여하기 <Icon name="arrow" size={18} /></button><button className="button button-soft button-large" onClick={() => selectSlide(3)}>함께 이야기 나누기 <Icon name="chevron" size={16} /></button></div>
              <div className="home-slide-note"><span className="avatar-stack"><i>H</i><i>M</i><i>J</i></span>여러 목소리가 만나, 더 나은 생각이 됩니다.</div>
              <span className="home-scroll-hint" aria-hidden="true">↓ 아래로 내려 아고라 둘러보기</span>
            </div>
            <CanvasExampleBoard />
            <div className="hero-side-note"><span>01</span><span className="vertical-rule" /><span>IDEAS IN GOOD COMPANY</span></div>
          </div>
        </section>
  );
}

import { Link } from '../../routing.jsx';
import Icon from '../Icon.jsx';

export default function StartSlide({navigate, target}) {
  return (
        <section className="home-slide slide-start" style={{ gridColumn: 3, gridRow: 3 }} aria-roledescription="슬라이드" aria-label="5 / 5">
          <div className="home-slide-inner page-container"><div className="start-slide-card"><span className="home-slide-kicker"><i /> YOUR NEXT GOOD IDEA · 05</span><h1>첫 선을 그어볼까요?</h1><p>좋은 아이디어는 함께 시작하는 순간부터 자라나요.<br />샘플 캔버스를 가볍게 체험하거나, 나만의 공간을 열어보세요.</p><div className="home-slide-actions"><Link className="button button-dark button-large" to="/tutorial">튜토리얼 체험하기 <Icon name="arrow" size={18} /></Link><button className="button button-cream button-large" onClick={() => navigate(target)}>아고라 시작하기 <Icon name="arrow" size={18} /></button></div><div className="start-slide-links"><Link to="/docs">프로젝트 구조와 API 문서 보기 <Icon name="arrow" size={14} /></Link><span>© 2026 Agora Project</span></div><span className="start-star start-star-a">✳</span><span className="start-star start-star-b">✦</span></div></div>
        </section>
  );
}

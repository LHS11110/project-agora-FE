import { useRef } from 'react';
import LanguageSwitcher from '../i18n/LanguageSwitcher.jsx';
import { ui } from '../i18n/locale.js';
import { useUiLocale } from '../i18n/useUiLocale.js';
import { Link } from '../routing.jsx';
import FreLogBrand from '../components/frelog/FreLogBrand.jsx';
import HomeCinematicIntro from '../components/home/HomeCinematicIntro.jsx';
import WorkspacePreview from '../components/home/WorkspacePreview.jsx';
import { useHomeCinematicIntro } from '../home/useHomeCinematicIntro.js';
import Icon from '../components/Icon.jsx';
import { useAuth } from '../state/AuthContext.jsx';
import '../home/home-scroll.css';

const features = [
  { number: '01', icon: 'pen', title: '생각을 펼치는 자유', text: '텍스트와 손글씨, 도형과 이미지를 원하는 자리에 놓으세요. 정해진 틀 없이 생각을 정리할 수 있어요.', tags: ['자유로운 드로잉', '다이어그램'] },
  { number: '02', icon: 'code', title: '연결하고, 실행하고', text: '코드 객체를 연결해 실행 흐름을 만들고, 결과를 같은 캔버스에서 확인하세요.', tags: ['블루프린트', '코드 실행'] },
  { number: '03', icon: 'chat', title: '함께 만드는 다음 장면', text: '같은 캔버스에서 편집하고, 객체에 댓글을 남기고, 멘션으로 필요한 사람을 연결하세요.', tags: ['실시간 협업', '댓글과 멘션'] },
];

export default function HomePage() {
  useUiLocale();
  const { introVisible, homeRevealed, finishIntro } = useHomeCinematicIntro();
  const { isAuthenticated } = useAuth();
  const target = isAuthenticated ? '/search' : '/login';
  const pageRef = useRef(null);
  return <>
    {introVisible && <HomeCinematicIntro onComplete={finishIntro} pageRef={pageRef} />}
    <div ref={pageRef} className={`home-scroll-page${!homeRevealed ? ' home-intro-pending' : ''}`} inert={introVisible ? '' : undefined} aria-hidden={introVisible || undefined}>
      <header className="home-scroll-header"><div className="home-container">
        <FreLogBrand />
        <nav aria-label={ui('홈페이지 탐색')}><a href="#possibilities">{ui('가능성')}</a><a href="#collaboration">{ui('함께 작업하기')}</a><Link to="/docs">{ui('문서')}</Link></nav>
        <div className="home-header-actions"><LanguageSwitcher /><Link className="home-header-login" to={target}>{isAuthenticated ? ui('워크스페이스') : ui('로그인')}<Icon name="arrow" size={15} /></Link></div>
      </div></header>
      <main id="home-main">
        <section className="home-scroll-hero home-container" aria-labelledby="home-title">
          <div className="home-hero-copy"><span className="home-product-pill"><span className="home-pill-icon"><Icon name="sparkle" size={14}/></span>{ui('아이디어에서 코드까지, 하나의 캔버스.')}<Icon name="chevron" size={13}/></span>
            <h1 id="home-title">{ui('생각의 경계를')}<br/><em>{ui('넘어, 함께.')}</em></h1>
            <p>{ui('흩어진 생각을 연결하고 팀의 다음 가능성을 열어보세요.')}<br/>{ui('기록부터 실행, 팀과의 대화까지.')}</p>
            <div className="home-hero-actions"><Link className="home-button home-button-primary" to={target}>{isAuthenticated ? ui('캔버스 열기') : ui('무료로 시작하기')}<Icon name="arrow" size={18}/></Link><Link className="home-button home-button-quiet" to="/tutorial">{ui('캔버스 체험하기')}<Icon name="chevron" size={16}/></Link></div>
            <div className="home-hero-caption"><span><Icon name="pen" size={13}/>{ui('자유로운 드로잉')}</span><span><Icon name="code" size={13}/>{ui('코드 실행')}</span><span><Icon name="chat" size={13}/>{ui('실시간 협업')}</span></div>
          </div>
          <div className="home-product-frame"><div className="home-product-sidebar" aria-hidden="true"><span className="home-preview-space">F<span>FreLog<br/><small>Workspace</small></span><Icon name="chevron" size={12}/></span><div className="home-preview-nav"><span className="selected"><Icon name="grid" size={15}/>{ui('팀의 다음 아이디어')}</span><span><Icon name="book" size={15}/>{ui('문서')}</span><span><Icon name="chat" size={15}/>{ui('댓글과 멘션')}</span></div><span className="home-preview-section">WORKSPACE</span><div className="home-preview-project"><i/>{ui('아이디어')}<span>01</span></div><div className="home-preview-project"><i/>{ui('다이어그램')}<span>02</span></div><div className="home-preview-project"><i/>{ui('코드')}<span>03</span></div><div className="home-preview-members"><span>J</span><span>M</span><span>Y</span><small>{ui('함께 편집')}</small></div></div><WorkspacePreview/></div>
        </section>
        <div className="home-capability-strip"><div className="home-container"><span>{ui('하나의 공간, 다양한 가능성')}</span><div>{[['sticky', '아이디어'], ['connect', '다이어그램'], ['code', '코드'], ['math', '수식'], ['chat', '협업']].map(([icon, label]) => <span key={icon}><Icon name={icon} size={16} />{ui(label)}</span>)}</div></div></div>
        <section id="possibilities" className="home-possibilities" aria-labelledby="possibilities-title"><div className="home-container">
          <div className="home-section-heading"><div><span className="home-eyebrow">BUILT FOR YOUR FLOW</span><h2 id="possibilities-title">{ui('도구 사이의 경계는 줄이고,')}<br />{ui('생각의 가능성은 넓히고.')}</h2></div><p>{ui('기록부터 실행, 팀과의 대화까지.')}<br />{ui('작업의 모든 순간이 자연스럽게 이어집니다.')}</p></div>
          <div className="home-feature-grid">{features.map(feature => <article className="home-feature-card" key={feature.number}><div className="home-feature-top"><span className="home-feature-icon"><Icon name={feature.icon} size={23}/></span><span>{feature.number}</span></div><h3>{ui(feature.title)}</h3><p>{ui(feature.text)}</p><div className="home-feature-tags">{feature.tags.map(tag => <span key={tag}>{ui(tag)}</span>)}</div></article>)}</div>
        </div></section>
        <section id="collaboration" className="home-collaboration home-container" aria-labelledby="collaboration-title">
          <div className="home-team-visual" role="img" aria-label={ui('아이디어에 댓글과 멘션으로 의견을 나누는 모습')}><span className="home-team-label">BETTER, TOGETHER.</span><div className="home-team-card"><span className="home-team-avatar">J</span><div><strong>{ui('팀의 다음 아이디어')}</strong><p>{ui('이 아이디어에 함께 생각을 더해볼까요?')}</p><div className="home-team-comment"><span className="home-team-avatar is-lime">M</span><p><b>@J</b> {ui('좋아요. 이 방향으로 연결해봐요.')}</p></div><span className="home-team-reply"><Icon name="chat" size={13} />{ui('생각을 나누는 대화')}</span></div></div><div className="home-team-chips"><span><Icon name="pen" size={14} />{ui('함께 편집')}</span><span><Icon name="chat" size={14} />{ui('댓글과 멘션')}</span></div></div>
          <div className="home-collaboration-copy"><span className="home-eyebrow">LESS DISTANCE. MORE IDEAS.</span><h2 id="collaboration-title">{ui('같은 공간이 아니어도,')}<br /><em>{ui('같은 생각의 흐름으로.')}</em></h2><p>{ui('서로의 커서를 따라가고, 아이디어에 바로 의견을 남기세요. 함께 만드는 과정 자체가 하나의 기록이 됩니다.')}</p><Link className="home-inline-link" to={target}>{ui('팀의 캔버스 시작하기')}<Icon name="arrow" size={17} /></Link></div>
        </section>
        <section className="home-start home-container" aria-labelledby="home-start-title"><div><span className="home-eyebrow">THE NEXT CHAPTER IS YOURS</span><h2 id="home-start-title">{ui('다음 아이디어를 펼칠 시간.')}</h2><p>{ui('첫 번째 점을 찍으면, 새로운 연결이 시작됩니다.')}</p></div><Link className="home-button home-button-primary" to={target}>{isAuthenticated ? ui('캔버스 열기') : ui('지금 시작하기')}<Icon name="pen" size={18} /></Link><span className="home-start-drawing" aria-hidden="true"><svg viewBox="0 0 280 180" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M20 145c24-32 65-45 87-32 21 13-43 32-36 9 5-18 40-23 65-15"/><path d="m137 107 9-29 70-64a10 10 0 0 1 14 14l-70 64-23 15Z"/><path d="m146 78 14 14m41-64 15 14m-79 65 4-14"/><path d="M33 162h104" opacity=".45"/></svg></span></section>
      </main>
      <footer className="home-scroll-footer home-container"><FreLogBrand /><span>© {new Date().getFullYear()} FreLog</span><div><Link to="/docs">{ui('문서')}</Link><a href="#home-main">{ui('맨 위로')} ↑</a></div></footer>
    </div>
  </>;
}

import { useEffect, useId, useRef, useState } from 'react';
import { ui } from '../../i18n/locale.js';
import { useUiLocale } from '../../i18n/useUiLocale.js';
import Icon from '../Icon.jsx';
import '../../home/home-motion-showcase.css';

const SCENE_DURATION_MS = 4800;

const SHOWCASE_SCENES = [
  {
    id: 'sketch',
    number: '01',
    activeTool: 'pen',
    title: '아이디어 스케치',
    subtitle: '자유로운 발상과 공간 정렬',
    summary: '격자 없는 캔버스에 메모, 수식, 도형을 자유롭게 배치하고 정렬합니다.',
  },
  {
    id: 'blueprint',
    number: '02',
    activeTool: 'connect',
    title: '블루프린트 실행',
    subtitle: '연결선으로 이어지는 코드 실행',
    summary: '연결된 코드가 순서대로 실행되고 결과와 차트가 즉시 갱신됩니다.',
  },
  {
    id: 'collab',
    number: '03',
    activeTool: 'chat',
    title: '실시간 협업 · 통화',
    subtitle: '같은 흐름 위의 커서, 멘션, 통화',
    summary: '서로의 커서와 레이저를 따라가고 멘션과 음성 통화로 소통합니다.',
  },
  {
    id: 'agent',
    number: '04',
    activeTool: 'sparkle',
    title: 'AI 에이전트 · 발표',
    subtitle: 'AI 생성과 시선 따라가기 발표',
    summary: '캔버스 위에서 AI가 구조를 제안하고 발표 시선으로 함께 확인합니다.',
  },
];

const DOCK_TOOLS = [
  'select',
  'hand',
  'pen',
  'eraser',
  'connect',
  'shape',
  'text',
  'sticky',
  'sparkle',
  'chat',
];

function FlowArrow({ tone = 'violet', delay = '320ms' }) {
  return <div className={`hms-flow-arrow is-${tone}`} style={{ '--arrow-delay': delay }} aria-hidden="true">
    <svg viewBox="0 0 36 16" fill="none">
      <line className="hms-arrow-stem" x1="2" y1="8" x2="29" y2="8" pathLength="100" />
      <path className="hms-arrow-head" d="M25 3.5L31.5 8L25 12.5" pathLength="100" />
    </svg>
  </div>;
}

function SketchScene() {
  return <div className="hms-scene-flow is-three">
    <article className="hms-obj hms-s1-note">
      <span className="hms-note-kicker"><Icon name="sticky" size={12} /> {ui('포스트잇')}</span>
      <strong>{ui('질문에서 출발')}</strong>
      <small>{ui('작은 메모에서 시작하기')}</small>
    </article>

    <FlowArrow tone="violet" delay="280ms" />

    <article className="hms-obj hms-s1-shape">
      <div className="hms-shape-head">
        <span className="hms-card-kicker"><Icon name="shape" size={12} /> {ui('다이어그램')}</span>
        <span className="hms-shape-sub">{ui('자유로운 드로잉')}</span>
      </div>
      <div className="hms-s1-sketch-box" aria-hidden="true">
        <svg viewBox="0 0 180 64" fill="none">
          <path className="hms-s1-curve" d="M12 48 C 44 12, 82 54, 118 22 S 154 20, 168 32" pathLength="100" />
        </svg>
      </div>
    </article>

    <FlowArrow tone="emerald" delay="560ms" />

    <article className="hms-obj hms-s1-math">
      <span className="hms-card-kicker"><Icon name="math" size={12} /> MATH</span>
      <div className="hms-s1-formula-eq">y = sin(x) + Δ</div>
      <div className="hms-s1-wave-box" aria-hidden="true">
        <svg viewBox="0 0 180 34" fill="none">
          <path className="hms-s1-wave" d="M6 18 C 32 4, 58 32, 86 17 S 138 4, 174 16" pathLength="100" />
        </svg>
      </div>
    </article>
  </div>;
}

function BlueprintScene() {
  return <div className="hms-scene-flow is-blueprint">
    <article className="hms-obj hms-s2-code">
      <header className="hms-code-header">
        <span><Icon name="code" size={12} /> {ui('코드 스니펫')}</span>
        <i>Python</i>
      </header>
      <code className="hms-code-body">
        <span><b className="is-kw">def</b> solve(items):</span>
        <span>{'  '}<b className="is-kw">return</b> sum(items) * 2</span>
        <span>print(solve([3, 5, 8]))<i className="hms-caret" aria-hidden="true" /></span>
      </code>
    </article>

    <FlowArrow tone="violet" delay="260ms" />

    <article className="hms-obj hms-s2-executor">
      <header className="hms-exec-head">
        <span className="hms-exec-badge"><Icon name="code" size={12} /> {ui('실행 객체')}</span>
        <span className="hms-exec-status">{ui('실행 완료')}</span>
      </header>
      <p className="hms-exec-desc">{ui('연결된 코드를 순서대로 실행합니다.')}</p>
      <div className="hms-exec-run-btn" aria-hidden="true">
        <span>▶ {ui('코드 실행')}</span>
        <kbd>⇧ ↵</kbd>
      </div>
    </article>

    <FlowArrow tone="emerald" delay="920ms" />

    <article className="hms-obj hms-s2-output">
      <header className="hms-output-head">
        <Icon name="document" size={12} />
        <span>{ui('실행 결과 객체')}</span>
      </header>
      <div className="hms-output-meta">
        <span>solver.py</span>
        <span>{ui('종료 코드')}: 0</span>
      </div>
      <div className="hms-output-pre">
        <span className="hms-output-val">32</span>
        <span className="hms-output-ok"><Icon name="check" size={12} /> {ui('실행 완료 · 12ms')}</span>
      </div>
    </article>
  </div>;
}

function CollabScene() {
  return <div className="hms-collab-grid">
    <div className="hms-obj hms-collab-board">
      <span className="hms-card-kicker"><Icon name="grid" size={12} /> {ui('함께 만드는 공간')}</span>
      <div className="hms-collab-items">
        <div className="hms-collab-note">
          <span className="hms-note-kicker">{ui('포스트잇')}</span>
          <strong>{ui('설계 메모')}</strong>
        </div>
        <div className="hms-collab-outline">
          <span className="hms-card-kicker">{ui('함께 편집')}</span>
          <strong>Workflow v2</strong>
        </div>
      </div>
      <div className="hms-collab-cursors" aria-hidden="true">
        <div className="hms-cursor-tag is-violet">
          <svg width="14" height="17" viewBox="0 0 19 23" fill="none"><path d="m2 2 14 10-7 1-3 7-4-18Z" fill="#725be4" stroke="#fff" strokeWidth="1.5" /></svg>
          <span>Jun</span>
        </div>
        <div className="hms-cursor-tag is-emerald">
          <svg width="14" height="17" viewBox="0 0 19 23" fill="none"><path d="m2 2 14 10-7 1-3 7-4-18Z" fill="#2f7d52" stroke="#fff" strokeWidth="1.5" /></svg>
          <span>Min</span>
        </div>
      </div>
    </div>

    <div className="hms-collab-side">
      <article className="hms-obj hms-chat-card">
        <header className="hms-chat-head">
          <Icon name="chat" size={12} />
          <span>{ui('채팅 · 통화')}</span>
        </header>
        <div className="hms-chat-msgs">
          <div className="hms-chat-peer">
            <span className="hms-chat-avatar">M</span>
            <p className="hms-chat-bubble-peer">{ui('@Jun 실행 결과 확인했어요!')}</p>
          </div>
          <div className="hms-chat-self">
            <p className="hms-chat-bubble-self">{ui('블루프린트 연결 완료')}</p>
          </div>
        </div>
      </article>

      <article className="hms-obj hms-voice-card">
        <div className="hms-voice-top">
          <span className="hms-voice-dot" aria-hidden="true" />
          <span>{ui('음성 통화 중 · 화면 공유')}</span>
        </div>
        <div className="hms-voice-eq" aria-hidden="true">
          {['56%', '92%', '68%', '100%', '48%', '84%', '62%', '96%', '54%', '80%'].map((h, idx) => (
            <i key={idx} style={{ '--eq-h': h, '--eq-delay': `${idx * 90}ms` }} />
          ))}
        </div>
      </article>
    </div>
  </div>;
}

function AgentScene() {
  return <div className="hms-agent-stack">
    <div className="hms-obj hms-s4-prompt">
      <span className="hms-s4-sparkle" aria-hidden="true"><Icon name="sparkle" size={15} /></span>
      <span className="hms-s4-prompt-text">{ui('핵심 흐름에 예제를 연결해줘')}</span>
      <span className="hms-s4-done"><Icon name="check" size={11} /> {ui('AI 생성 완료')}</span>
    </div>

    <div className="hms-s4-flow">
      <article className="hms-obj hms-s4-source">
        <span className="hms-card-kicker">{ui('아이디어')}</span>
        <strong>Concept Note</strong>
      </article>

      <FlowArrow tone="violet" delay="620ms" />

      <div className="hms-s4-spotlight">
        <div className="hms-s4-spotlight-head">
          <span><Icon name="eye" size={11} /> {ui('발표 모드 · 함께 보는 중')}</span>
        </div>
        <div className="hms-s4-generated">
          <article className="hms-obj hms-s4-code">
            <span className="hms-card-kicker"><Icon name="code" size={12} /> example.py</span>
            <strong>run_flow()</strong>
          </article>

          <FlowArrow tone="emerald" delay="1000ms" />

          <article className="hms-obj hms-s4-chart">
            <span className="hms-card-kicker"><Icon name="chart" size={12} /> CHART</span>
            <strong>98.4%</strong>
          </article>
        </div>
      </div>
    </div>
  </div>;
}

const SCENE_RENDERERS = [SketchScene, BlueprintScene, CollabScene, AgentScene];

export default function FreLogMotionShowcase({ pausedByIntro = false }) {
  useUiLocale();
  const baseId = useId();
  const sectionRef = useRef(null);
  const [activeScene, setActiveScene] = useState(0);
  const [cycle, setCycle] = useState(0);
  const [playing, setPlaying] = useState(() => !window.matchMedia?.('(prefers-reduced-motion: reduce)').matches);
  const [visible, setVisible] = useState(true);
  const [tabVisible, setTabVisible] = useState(() => (typeof document !== 'undefined' ? !document.hidden : true));

  useEffect(() => {
    const onVisibility = () => setTabVisible(!document.hidden);
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, []);

  useEffect(() => {
    const node = sectionRef.current;
    if (!node || typeof IntersectionObserver === 'undefined') return undefined;
    const observer = new IntersectionObserver(
      (entries) => setVisible(Boolean(entries[0]?.isIntersecting)),
      { threshold: 0.12 }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const isRunning = playing && visible && tabVisible && !pausedByIntro;

  useEffect(() => {
    if (!isRunning) return undefined;
    const timer = window.setTimeout(() => {
      setActiveScene((current) => (current + 1) % SHOWCASE_SCENES.length);
      setCycle((c) => c + 1);
    }, SCENE_DURATION_MS);
    return () => window.clearTimeout(timer);
  }, [isRunning, activeScene, cycle]);

  const selectScene = (index) => {
    setActiveScene(index);
    setCycle((c) => c + 1);
  };

  const currentScene = SHOWCASE_SCENES[activeScene];
  const SceneArt = SCENE_RENDERERS[activeScene];

  return <section ref={sectionRef} id="motion-showcase" className="home-motion-showcase" aria-labelledby="showcase-title">
    <div className="home-container">
      <div className="home-section-heading home-reveal">
        <div>
          <span className="home-eyebrow"><i /> MOTION STORY · 01 — 04</span>
          <h2 id="showcase-title">{ui('아이디어가 결과가 되기까지,')}<br />{ui('한 편의 움직이는 캔버스로.')}</h2>
        </div>
        <p>{ui('자유로운 스케치부터 블루프린트 실행, 실시간 협업과 AI 에이전트까지 FreLog의 흐름을 살펴보세요.')}</p>
      </div>

      <div className="hms-frame home-reveal" role="region" aria-label={ui('FreLog 소개 모션 그래픽')}>
        <div className="hms-topbar">
          <div className="hms-topbar-left">
            <span className="hms-dots" aria-hidden="true"><i /><i /><i /></span>
            <span>FreLog / {ui('팀의 다음 아이디어')}</span>
          </div>
          <div className="hms-topbar-right">
            <span className="hms-scene-counter">SCENE {currentScene.number} / 0{SHOWCASE_SCENES.length}</span>
            <button
              type="button"
              className="hms-play-toggle"
              aria-pressed={playing}
              aria-label={playing ? ui('장면 일시정지') : ui('장면 재생')}
              onClick={() => setPlaying((value) => !value)}
            >
              <Icon name={playing ? 'pause' : 'play'} size={12} />
              <span>{playing ? ui('재생 중') : ui('일시정지됨')}</span>
            </button>
          </div>
        </div>

        <div className={`hms-stage${!isRunning ? ' is-paused' : ''}`} role="tabpanel" id={`${baseId}-panel-${currentScene.id}`} aria-labelledby={`${baseId}-tab-${currentScene.id}`}>
          <div className="hms-canvas-bg" aria-hidden="true">
            <svg width="100%" height="100%">
              <defs>
                <pattern id={`${baseId}-dots`} width="24" height="24" patternUnits="userSpaceOnUse">
                  <circle cx="2" cy="2" r="1" fill="#d4d1e2" />
                </pattern>
              </defs>
              <rect width="100%" height="100%" fill={`url(#${baseId}-dots)`} />
            </svg>
            <span className="hms-axis-x" />
            <span className="hms-axis-y" />
          </div>

          <div className="hms-ui-topbar" aria-hidden="true">
            <span className="hms-ui-pill is-title"><Icon name="search" size={11} /><i>−</i>{ui('팀의 다음 아이디어')}</span>
            <span className={`hms-ui-pill is-agent${currentScene.id === 'agent' ? ' is-active' : ''}`}><Icon name="sparkle" size={11} />{ui('AI 에이전트')}</span>
            <div className="hms-ui-right">
              <span className={`hms-ui-pill is-voice${currentScene.id === 'collab' ? ' is-active' : ''}`}><Icon name="microphone" size={11} />{ui('음성 통화')}</span>
              <span className="hms-ui-pill is-live"><i />{ui('연결됨')}</span>
            </div>
          </div>

          <div className="hms-scene" key={`${currentScene.id}-${cycle}`}>
            <SceneArt />
          </div>

          <div className="hms-ui-dockrow" aria-hidden="true">
            <div className="hms-ui-dock">
              {DOCK_TOOLS.map((tool) => (
                <span key={tool} className={currentScene.activeTool === tool ? 'is-active' : ''}>
                  <Icon name={tool} size={13} />
                </span>
              ))}
            </div>
            <span className="hms-ui-pill is-status">100% · {ui('격자 켜짐')}</span>
          </div>
        </div>

        <div className="hms-progress-track" aria-hidden="true">
          <div
            key={`bar-${activeScene}-${cycle}`}
            className={`hms-progress-fill${!isRunning ? ' is-paused' : ''}`}
            style={{ '--scene-duration': `${SCENE_DURATION_MS}ms` }}
          />
        </div>

        <div className="hms-chapters" role="tablist" aria-label={ui('장면 선택')}>
          {SHOWCASE_SCENES.map((scene, index) => (
            <button
              key={scene.id}
              id={`${baseId}-tab-${scene.id}`}
              type="button"
              role="tab"
              aria-selected={index === activeScene}
              aria-controls={`${baseId}-panel-${scene.id}`}
              className={`hms-chapter${index === activeScene ? ' is-active' : ''}`}
              onClick={() => selectScene(index)}
            >
              <span className="hms-chapter-index">{scene.number} · {ui(scene.subtitle)}</span>
              <strong>{ui(scene.title)}</strong>
              <small>{ui(scene.summary)}</small>
            </button>
          ))}
        </div>
      </div>
    </div>
  </section>;
}

import { ui } from '../../i18n/locale.js';
import Icon from '../Icon.jsx';
import './workspace-preview.css';

/** A lightweight illustration of the workspace; it never handles pointer input. */
export default function WorkspacePreview({ compact = false }) {
  return <div className={`workspace-preview${compact ? ' is-compact' : ''}`} role="img" aria-label={ui('메모, 코드, 다이어그램이 연결된 캔버스 미리보기')}>
    <div className="wp-top"><span className="wp-window-dots"><i /><i /><i /></span><span>FreLog / {ui('팀의 다음 아이디어')}</span><span className="wp-preview-label">{ui('미리보기')}</span></div>
    <div className="wp-board">
      <svg className="wp-grid" width="100%" height="100%" aria-hidden="true"><defs><pattern id={compact ? 'wp-grid-auth' : 'wp-grid-home'} width="22" height="22" patternUnits="userSpaceOnUse"><circle cx="1" cy="1" r=".8" fill="#cdd4df" /></pattern></defs><rect width="100%" height="100%" fill={`url(#${compact ? 'wp-grid-auth' : 'wp-grid-home'})`} /></svg>
      <div className="wp-tools" aria-hidden="true">{['select', 'pen', 'shape', 'text', 'connect'].map((name, index) => <span className={index === 0 ? 'is-selected' : ''} key={name}><Icon name={name} size={15} /></span>)}</div>
      <span className="wp-board-label">01 / {ui('함께 만드는 공간')}</span>
      <svg className="wp-wires" viewBox="0 0 600 410" preserveAspectRatio="none" aria-hidden="true"><path d="M220 133 H290 Q305 133 305 148 V240 H354" /><path d="M220 275 H270 Q285 275 285 260 V258 H354" /><circle cx="220" cy="133" r="4" /><circle cx="354" cy="240" r="4" /><circle cx="220" cy="275" r="4" /></svg>
      <div className="wp-note"><span>IDEA / 01</span><strong>{ui('좋은 생각은,')}<br />{ui('연결될 때 자라요.')}</strong><div><i /><span>{ui('작은 메모에서 시작하기')}</span></div></div>
      <div className="wp-code"><div><Icon name="code" size={13} /><span>hello.py</span><i>PYTHON</i></div><code><span className="wp-code-muted">01</span> <b>def</b> create_together():<br /><span className="wp-code-muted">02</span>   <b>return</b> <em>"Hello, ideas."</em><br /><span className="wp-code-muted">03</span><br /><span className="wp-code-muted">04</span> print(create_together())</code></div>
      <div className="wp-plan"><div className="wp-plan-title"><Icon name="connect" size={14} />{ui('아이디어를 실행으로')}</div><span className="wp-node">{ui('실행')}</span><span className="wp-node-line" /><span className="wp-node is-code">{ui('코드')}</span><div className="wp-result"><Icon name="check" size={13} /><code>Hello, ideas.</code></div></div>
      <div className="wp-cursor"><svg width="19" height="23" viewBox="0 0 19 23" fill="none" aria-hidden="true"><path d="m2 2 14 10-7 1-3 7-4-18Z" fill="#7459e7" stroke="white" strokeWidth="1.5" /></svg><span>{ui('팀원')}</span></div>
      <div className="wp-zoom" aria-hidden="true"><span>−</span>100%<span>+</span></div>
    </div>
    <div className="wp-foot"><span><i />{ui('생각을 연결하는 캔버스')}</span><span>CANVAS / CODE / TEAM</span></div>
  </div>;
}

import {ui} from '../i18n/locale.js';
import {useUiLocale} from '../i18n/useUiLocale.js';
import './canvas-agent.css';
export function AgentMark(){return <span className="canvas-agent-mark" aria-hidden="true"><svg viewBox="0 0 32 32" fill="none"><path d="m16 6 2.7 7.3L26 16l-7.3 2.7L16 26l-2.7-7.3L6 16l7.3-2.7L16 6Z" fill="currentColor"/><path d="m25 3 .9 2.1L28 6l-2.1.9L25 9l-.9-2.1L22 6l2.1-.9L25 3Z" fill="currentColor"/></svg><i/></span>}
export default function CanvasAgentLauncher({open,busy,disabled,onClick}){useUiLocale();return <button type="button" className={`canvas-agent-launcher${busy?' is-working':''}${open?' is-open':''}`} disabled={disabled} onClick={onClick} aria-label={ui('AI 에이전트')} aria-expanded={open} aria-controls="canvas-agent-panel"><AgentMark/><span><strong>{ui('AI 에이전트')}</strong><small>{busy?ui('캔버스에서 작업 중'):ui('함께 만들어보세요')}</small></span><span className="canvas-agent-launcher-dot" aria-hidden="true"/></button>}

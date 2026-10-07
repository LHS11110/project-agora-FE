import CodeLanguageBadge from './CodeLanguageBadge.jsx';
import CodeLanguageOptions from '../CodeLanguageOptions.jsx';
import { CONTENT_MODES, contentMode } from './contentPresentation.js';
export default function ContentRenderControls({ item, onChange }) {
  const mode = contentMode(item);
  return <section className="inspector-section content-render-controls"><strong className="inspector-label">내용 렌더링</strong><label>표시 방식<select value={mode} aria-label="텍스트 렌더링 방식" onChange={event => onChange('renderMode', event.target.value)}>{CONTENT_MODES.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
    {mode === 'code' && <><CodeLanguageBadge language={item.language || 'javascript'} /><label>프로그래밍 언어<select value={item.language || 'javascript'} aria-label="텍스트 코드 언어" onChange={event => onChange('language', event.target.value)}><CodeLanguageOptions value={item.language || 'javascript'} /></select></label><label>파일 이름<input value={item.filename || ''} maxLength={80} placeholder="snippet.js" aria-label="텍스트 파일 이름" onChange={event => onChange('filename', event.target.value)} /></label></>}
    <small className="inspector-hint">같은 내용을 다른 방식으로 표시합니다. Markdown 안에서도 $수식$과 코드 블록을 사용할 수 있어요.</small>
  </section>;
}

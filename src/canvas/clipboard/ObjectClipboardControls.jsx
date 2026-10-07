import Icon from '../../components/Icon.jsx';
import './object-clipboard.css';
export default function ObjectClipboardControls({ actions, selectedCount, blocked }) {
  const modifier = /Mac|iPhone|iPad/.test(navigator.platform) ? '⌘' : 'Ctrl';
  return <section className="inspector-section object-clipboard-controls"><strong className="inspector-label">객체 클립보드</strong><div>
    <button type="button" disabled={blocked || actions.busy || !selectedCount} onClick={actions.cut} title={`${modifier}+X`}><Icon name="cut" size={15} />잘라내기</button>
    <button type="button" disabled={blocked || actions.busy || !selectedCount} onClick={actions.copy} title={`${modifier}+C`}><Icon name="copy" size={15} />복사</button>
    <button type="button" disabled={blocked || actions.busy} onClick={actions.paste} title={`${modifier}+V`}><Icon name="paste" size={15} />붙여넣기</button>
  </div><small className="inspector-hint">{modifier}+X / C / V · 여러 객체도 함께 처리합니다. 편집 중에는 내용에 적용됩니다.</small></section>;
}

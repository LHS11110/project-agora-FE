import { ui } from '../../i18n/locale.js';
import { useUiLocale } from '../../i18n/useUiLocale.js';
import Icon from '../../components/Icon.jsx';
import './object-clipboard.css';
export default function ObjectClipboardControls({ actions, selectedCount, blocked }) {
  useUiLocale();
  const modifier = /Mac|iPhone|iPad/.test(navigator.platform) ? '⌘' : 'Ctrl';
  return <section className="inspector-section object-clipboard-controls"><strong className="inspector-label">{ui("객체 클립보드")}</strong><div>
    <button type="button" disabled={blocked || actions.busy || !selectedCount} onClick={actions.cut} title={`${modifier}+X`}><Icon name="cut" size={15} />{ui("잘라내기")}</button>
    <button type="button" disabled={blocked || actions.busy || !selectedCount} onClick={actions.copy} title={`${modifier}+C`}><Icon name="copy" size={15} />{ui("복사")}</button>
    <button type="button" disabled={blocked || actions.busy} onClick={actions.paste} title={`${modifier}+V`}><Icon name="paste" size={15} />{ui("붙여넣기")}</button>
  </div><small className="inspector-hint">{modifier}{ui("+X / C / V · 여러 객체도 함께 처리합니다. 편집 중에는 내용에 적용됩니다.")}</small></section>;
}

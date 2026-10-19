import { ui } from '../i18n/locale.js';
import { useUiLocale } from '../i18n/useUiLocale.js';
export default function ImageFrameControls({ item, onChange }) {
  useUiLocale();
  return <section className="inspector-section image-frame-controls">
    <div className="inspector-switch-row"><span><strong>{ui("이미지 테두리")}</strong><small>{ui("흰색 프레임과 파일 정보 표시")}</small></span>
      <button type="button" className={`toggle-switch${item.imageFrameEnabled !== false ? ' on' : ''}`} role="switch" aria-label={ui("이미지 테두리 표시")} aria-checked={item.imageFrameEnabled !== false} onClick={() => onChange(item.imageFrameEnabled === false)}><i /></button>
    </div>
  </section>;
}

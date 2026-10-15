export default function ImageFrameControls({ item, onChange }) {
  return <section className="inspector-section image-frame-controls">
    <div className="inspector-switch-row"><span><strong>이미지 테두리</strong><small>흰색 프레임과 파일 정보 표시</small></span>
      <button type="button" className={`toggle-switch${item.imageFrameEnabled !== false ? ' on' : ''}`} role="switch" aria-label="이미지 테두리 표시" aria-checked={item.imageFrameEnabled !== false} onClick={() => onChange(item.imageFrameEnabled === false)}><i /></button>
    </div>
  </section>;
}

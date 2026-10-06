import { useEffect, useRef, useState } from 'react';
import AuthenticatedImage from '../AuthenticatedImage.jsx';
import './canvas-preview.css';

const palette = ['lavender', 'mint', 'peach', 'blue'];
export default function CanvasPreview({ index, canvas, token }) {
  const container = useRef(null);
  const [visible, setVisible] = useState(false);
  const [placeholder, setPlaceholder] = useState(false);
  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) { setVisible(true); observer.disconnect(); }
    }, { rootMargin: '180px' });
    observer.observe(container.current);
    return () => observer.disconnect();
  }, []);
  useEffect(() => { setPlaceholder(false); }, [canvas.canvas_id, canvas.image, token]);
  const hasImage = Boolean(canvas.image) && !placeholder;
  const message = text => <div className="canvas-preview-message">{text}</div>;
  return <div ref={container} className={`canvas-preview preview-${palette[index % palette.length]}`}>
    <div className="preview-toolbar"><span className="preview-dot" /><span className="preview-dot" /><span className="preview-dot" /><i>{canvas.canvas_name || '새로운 생각'}</i></div>
    <div className={`preview-art actual-canvas-preview${hasImage ? ' has-cover' : ''}`}>
      {visible && hasImage ? <AuthenticatedImage src={canvas.image} token={token} alt={`${canvas.canvas_name || '캔버스'} 대표 이미지`} fallback={message('대표 이미지를 불러오지 못했어요')} loadingFallback={message('대표 이미지를 불러오는 중…')} onLoad={event => { if (event.currentTarget.naturalWidth <= 1 && event.currentTarget.naturalHeight <= 1) setPlaceholder(true); }} /> : message(hasImage ? '대표 이미지를 불러오는 중…' : '대표 이미지가 없어요')}
    </div>
    <div className="preview-bottom"><span>FRELOG CANVAS</span><span>↗</span></div>
  </div>;
}

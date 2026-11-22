import { useLayoutEffect, useRef } from 'react';
import { ui } from '../i18n/locale.js';
import { useUiLocale } from '../i18n/useUiLocale.js';
import AuthenticatedImage from '../components/AuthenticatedImage.jsx';
import Icon from '../components/Icon.jsx';

/** Give the image its real contained size so rounding also works with letterboxing. */
export default function CanvasImageContent({ item, token }) {
  useUiLocale();
  const media = useRef(null), boxSize = useRef(null);
  // Uses the size reported by ResizeObserver instead of reading clientWidth, which
  // forced a synchronous layout for every image that mounted (zoom/pan remounts).
  const fit = () => {
    const box = media.current, image = box?.querySelector('img'), size = boxSize.current;
    if (!box || !size || !image?.naturalWidth || !item.height) return;
    const ratio = Math.min(size.width / image.naturalWidth, size.height / image.naturalHeight);
    box.style.setProperty('--image-render-width', `${image.naturalWidth * ratio}px`);
    box.style.setProperty('--image-render-height', `${image.naturalHeight * ratio}px`);
  };
  useLayoutEffect(() => {
    if (!item.height || !media.current) return undefined;
    const observer = new ResizeObserver(([entry]) => {
      boxSize.current = { width: entry.contentRect.width, height: entry.contentRect.height };
      fit();
    });
    observer.observe(media.current);
    return () => observer.disconnect();
  }, [Boolean(item.height)]);
  const fallback = text => <div className="image-object-fallback"><Icon name="image" size={19} /><span>{ui(text)}</span></div>;
  return <div className="image-object-surface"><div ref={media} className="image-object-media">
    <AuthenticatedImage src={item.src} token={token} alt={item.filename || ui('공유된 이미지')} onLoad={fit} fallback={fallback('이미지를 표시할 수 없어요')} loadingFallback={<div className="image-object-fallback" role="status">
      <span className="runtime-spinner" aria-hidden="true" />
      <span>{ui('이미지를 불러오는 중…')}</span>
    </div>} />
  </div></div>;
}

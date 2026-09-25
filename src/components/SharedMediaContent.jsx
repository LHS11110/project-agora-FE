import Icon from './Icon.jsx';
import { inspectShareUrl } from './shareMedia.js';

export default function SharedMediaContent({ item }) {
  const media = inspectShareUrl(item?.url);
  if (!media) return <div className="shared-media-invalid">올바른 주소가 아닙니다.</div>;

  if (media.mediaType === 'youtube') {
    return <iframe className="shared-video-player" src={media.embedUrl} title={item.title || media.defaultTitle} loading="lazy" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" referrerPolicy="strict-origin-when-cross-origin" allowFullScreen onPointerDown={(event) => event.stopPropagation()} />;
  }
  if (media.mediaType === 'video') {
    return <video className="shared-video-player" controls playsInline preload="metadata" onPointerDown={(event) => event.stopPropagation()} onWheel={(event) => event.stopPropagation()}>
      <source src={media.url} />
      브라우저에서 이 동영상을 재생할 수 없습니다.
    </video>;
  }

  return <a className="shared-link-card" href={media.url} target="_blank" rel="noopener noreferrer" onPointerDown={(event) => event.stopPropagation()}>
    <span className="shared-link-icon"><Icon name="link" size={17} /></span>
    <span className="shared-link-copy"><strong>{item.title || media.defaultTitle}</strong><small>{media.url}</small></span>
    <Icon name="arrow" size={15} />
  </a>;
}

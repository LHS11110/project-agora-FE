import { LinkSummary } from './LinkPreview.jsx';
import { mediaPosition, youtubeEmbedSrc } from '../canvas/media/mediaModel.js';
import { ui } from '../i18n/locale.js';
import { useUiLocale } from '../i18n/useUiLocale.js';
import { useEffect, useId, useRef, useState } from 'react';
import { inspectShareUrl } from './shareMedia.js';
import './shared-playback.css';

export function playbackTime(state, now = Date.now()) {
  return Math.max(0, (state?.time || 0) + (state && !state.paused ? Math.max(0, now - state.updatedAt) / 1000 : 0));
}

function SharedVideoPlayer({ item, media, interactive, writable, onChange }) {
  const fieldId = useId();
  const video = useRef(null);
  const actor = useRef(globalThis.crypto?.randomUUID?.() || String(Math.random()));
  const until = useRef(0);
  const latest = useRef(null);
  const lastPublished = useRef(null);
  const seekTimer = useRef(null);
  const pendingSeek = useRef(0);
  const [position, setPosition] = useState(0);
  const [duration, setDuration] = useState(0);
  const [blocked, setBlocked] = useState(false);

  latest.current = { item, writable, interactive, onChange, duration };
  const sharedTime = state => mediaPosition(state, latest.current.duration, latest.current.item.mediaLoop);

  const publish = (paused, time) => {
    const c = latest.current;
    if (!c.writable || !c.onChange || !Number.isFinite(time)) return;
    const state = { paused: Boolean(paused), time: Math.max(0, time), updatedAt: Date.now(), actor: actor.current };
    lastPublished.current = state;
    c.onChange({ mediaState: state });
  };

  const apply = () => {
    const state = latest.current.item.mediaState;
    if (!state) return;
    clearTimeout(seekTimer.current);
    seekTimer.current = null;
    until.current = Date.now() + 900;
    if (state.paused) setBlocked(false);
    const target = sharedTime(state);
    setPosition(target);
    const node = video.current;
    if (!node) return;
    if (Math.abs(node.currentTime - target) > 0.75) {
      node.currentTime = Number.isFinite(node.duration) ? Math.min(target, node.duration) : target;
    }
    if (state.paused) node.pause();
    else node.play().then(() => setBlocked(false)).catch(() => setBlocked(true));
  };

  useEffect(() => {
    if (item.mediaState?.actor !== actor.current) apply();
  }, [item.mediaState, item.mediaLoop, item.url]);

  useEffect(() => () => clearTimeout(seekTimer.current), [item.url]);

  const seek = (time) => {
    setPosition(time);
    until.current = Date.now() + 800;
    if (video.current) video.current.currentTime = time;
    pendingSeek.current = time;
    if (!seekTimer.current) {
      seekTimer.current = setTimeout(() => {
        seekTimer.current = null;
        publish(latest.current.item.mediaState?.paused ?? true, pendingSeek.current);
      }, 100);
    }
  };

  const local = () => Date.now() > until.current && writable && interactive;
  const paused = item.mediaState?.paused !== false;

  return (
    <div className="shared-playback" data-playback-paused={paused}>
      <div className="shared-media-preview">
        <video
          key={media.url}
          ref={video}
          className="shared-video-player"
          controls={interactive}
          playsInline
          preload="metadata"
          loop={Boolean(item.mediaLoop)}
          onPointerDown={e => { until.current = 0; e.stopPropagation(); }}
          onWheel={e => e.stopPropagation()}
          onLoadedMetadata={e => { setDuration(e.currentTarget.duration); apply(); }}
          onPlay={e => { if (local() && item.mediaState?.paused !== false) publish(false, e.currentTarget.currentTime); }}
          onPause={e => { if (local() && item.mediaState?.paused !== true) publish(true, e.currentTarget.currentTime); }}
          onSeeked={e => { if (local() && Math.abs(e.currentTarget.currentTime - sharedTime(item.mediaState)) > 0.75) publish(e.currentTarget.paused, e.currentTarget.currentTime); }}
          onTimeUpdate={e => setPosition(e.currentTarget.currentTime)}
          onEnded={e => { if (local() && !item.mediaLoop) publish(true, e.currentTarget.currentTime); }}
        >
          <source src={media.url} />
          {ui('브라우저에서 이 동영상을 재생할 수 없습니다.')}
        </video>
        {!interactive && <div className="shared-media-activate" aria-hidden="true" />}
      </div>
      {interactive && writable && onChange && (
        <div
          className="shared-playback-controls"
          data-object-action="playback"
          onPointerDown={e => e.stopPropagation()}
          onDoubleClick={e => e.stopPropagation()}
        >
          <button
            aria-label={ui(!paused ? '공유 일시정지' : '공유 재생')}
            onClick={() => {
              clearTimeout(seekTimer.current);
              seekTimer.current = null;
              const current = lastPublished.current?.updatedAt >= (item.mediaState?.updatedAt || 0) ? lastPublished.current : item.mediaState;
              const nextPaused = current?.paused === false;
              const time = video.current ? video.current.currentTime : position;
              until.current = Date.now() + 500;
              publish(nextPaused, time);
              if (video.current) {
                if (nextPaused) video.current.pause();
                else video.current.play().catch(() => setBlocked(true));
              }
            }}
          >
            {ui(!paused ? '일시정지' : '재생')}
          </button>
          <input
            id={`${fieldId}-position`}
            name="shared-media-position"
            aria-label={ui('공유 재생 위치')}
            type="range"
            min={0}
            max={Math.max(1, duration, position)}
            step={0.1}
            value={position}
            onChange={e => seek(Number(e.target.value))}
          />
          <span>{Math.floor(position)}s</span>
        </div>
      )}
      {interactive && writable && onChange && (
        <button
          className="shared-playback-loop"
          data-object-action="playback"
          aria-label={ui('반복 재생')}
          title={ui('반복 재생')}
          aria-pressed={Boolean(item.mediaLoop)}
          onPointerDown={e => e.stopPropagation()}
          onClick={() => onChange({ mediaLoop: !item.mediaLoop })}
        >
          <span aria-hidden="true">↻</span>
        </button>
      )}
      {blocked && (
        <button
          className="shared-playback-unlock"
          data-object-action="playback"
          onPointerDown={e => e.stopPropagation()}
          onClick={() => { apply(); setBlocked(false); }}
        >
          {ui('브라우저에서 공유 재생 허용')}
        </button>
      )}
    </div>
  );
}

export default function SharedMediaContent({ item, token, interactive = true, writable = true, onChange }) {
  useUiLocale();
  const media = inspectShareUrl(item?.url);
  if (!media) return <div className="shared-media-invalid">{ui('올바른 주소가 아닙니다.')}</div>;

  if (media.mediaType === 'youtube') {
    return (
      <div
        className="shared-playback shared-youtube-independent"
        data-object-action={interactive ? 'playback' : undefined}
        onPointerDown={interactive ? e => e.stopPropagation() : undefined}
      >
        <div className="shared-media-preview">
          <iframe
            className="shared-video-player"
            src={youtubeEmbedSrc(media.embedUrl, media.url)}
            title={item.title || media.defaultTitle}
            loading="lazy"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share; compute-pressure"
            referrerPolicy="strict-origin-when-cross-origin"
            allowFullScreen
            onPointerDown={e => e.stopPropagation()}
          />
          {!interactive && <div className="shared-media-activate" aria-hidden="true" />}
        </div>
      </div>
    );
  }

  if (media.mediaType === 'video') {
    return <SharedVideoPlayer {...{ item, media, interactive, writable, onChange }} />;
  }

  return (
    <div className="shared-link-plain">
      <a href={media.url} target="_blank" rel="noopener noreferrer" onPointerDown={event => event.stopPropagation()}>
        {media.url}
      </a>
      <LinkSummary url={media.url} token={token} showFallback={false} />
    </div>
  );
}

import { ui } from '../i18n/locale.js';
import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { useLocation } from '../routing.jsx';
import {
  fetchYoutubeOembed,
  isValidYoutubeVideoId,
  moveTrack,
  parseSubtitles,
  parseYoutubeInput,
  removeTrackAt,
  restoreQueueOrder,
  shuffleQueue,
} from './youtube.js';
import './youtube.css';
import { PLAYER_OBSTACLES, launcherPosition } from './playerLayout.js';

let trackSeq = 0;
const nextUid = () => `yt-${++trackSeq}`;

function makeTrack(id, start = 0, meta = {}) {
  return {
    uid: nextUid(),
    id,
    start: Number.isFinite(start) ? start : 0,
    title: meta.title || '',
    author: meta.author || '',
    playlistId: meta.playlistId || '',
  };
}

function buildEmbedUrl(target) {
  if (!target) return '';
  const origin = encodeURIComponent(window.location.origin);
  if (target.listId && !target.id) {
    return `https://www.youtube.com/embed/videoseries?list=${encodeURIComponent(target.listId)}&enablejsapi=1&origin=${origin}&playsinline=1&autoplay=1`;
  }
  const listQuery = target.listId ? `&list=${encodeURIComponent(target.listId)}` : '';
  return `https://www.youtube.com/embed/${target.id}?enablejsapi=1&origin=${origin}&playsinline=1&autoplay=1&start=${target.start || 0}${listQuery}`;
}

export default function GlobalYoutubePlayer() {
  const fieldId = useId();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const [link, setLink] = useState('');
  const [tracks, setTracks] = useState([]);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [playerTarget, setPlayerTarget] = useState(null);
  const [pendingPlaylistAppend, setPendingPlaylistAppend] = useState(null);
  const [playlistQueue, setPlaylistQueue] = useState([]);
  const [playlistTitle, setPlaylistTitle] = useState('');
  const [playlistLoading, setPlaylistLoading] = useState(false);
  const [originalOrderUids, setOriginalOrderUids] = useState(null);
  const [repeatMode, setRepeatMode] = useState('all'); // 'all' | 'one' | 'off'
  const [queueOpen, setQueueOpen] = useState(true);
  const [error, setError] = useState('');
  const [compact, setCompact] = useState(false);
  const [captions, setCaptions] = useState(true);
  const [cues, setCues] = useState([]);
  const [line, setLine] = useState('');
  const [playing, setPlaying] = useState(false);
  const [position, setPosition] = useState(null);
  const [width, setWidth] = useState(360);
  const [safeBottom, setSafeBottom] = useState(24);
  const [launcher, setLauncher] = useState(null);
  const [captionName, setCaptionName] = useState('');
  const [trackTitle, setTrackTitle] = useState('');

  const frame = useRef(null);
  const probeFrame = useRef(null);
  const panel = useRef(null);
  const gesture = useRef(null);
  const cueRef = useRef([]);
  const captionsRef = useRef(true);
  const tracksRef = useRef(tracks);
  const activeIndexRef = useRef(activeIndex);
  const repeatModeRef = useRef(repeatMode);
  const playerTargetRef = useRef(playerTarget);
  const pendingAppendRef = useRef(pendingPlaylistAppend);
  const hydratedSessionRef = useRef('');
  const lastPlayerStateRef = useRef(null);
  const oembedAbortRef = useRef(null);
  const probeRetryRef = useRef([]);

  cueRef.current = cues;
  captionsRef.current = captions;
  tracksRef.current = tracks;
  activeIndexRef.current = activeIndex;
  repeatModeRef.current = repeatMode;
  playerTargetRef.current = playerTarget;
  pendingAppendRef.current = pendingPlaylistAppend;

  const canvas = /^\/canvases\//.test(location.pathname);
  const activeTrack = activeIndex >= 0 && activeIndex < tracks.length ? tracks[activeIndex] : null;
  const hasMedia = Boolean(playerTarget || tracks.length > 0);
  const displayTitle = trackTitle || activeTrack?.title || (playlistLoading ? ui('재생 목록 불러오는 중…') : '');

  const command = useCallback((func, args = []) => {
    frame.current?.contentWindow?.postMessage(
      JSON.stringify({ event: 'command', func, args }),
      'https://www.youtube.com',
    );
  }, []);

  const hydrateTracksMeta = useCallback((items) => {
    if (!items?.length) return;
    const need = items.filter((item) => isValidYoutubeVideoId(item.id) && !item.title);
    if (!need.length) return;
    if (!oembedAbortRef.current || oembedAbortRef.current.signal.aborted) {
      oembedAbortRef.current = new AbortController();
    }
    const { signal } = oembedAbortRef.current;

    const queue = [...need];
    const workerCount = Math.min(4, queue.length);
    for (let w = 0; w < workerCount; w++) {
      (async () => {
        while (queue.length && !signal.aborted) {
          const entry = queue.shift();
          const meta = await fetchYoutubeOembed(
            `https://www.youtube.com/watch?v=${entry.id}`,
            signal,
          );
          if (!meta || signal.aborted) continue;
          setTracks((prev) =>
            prev.map((item) =>
              item.uid === entry.uid || (item.id === entry.id && !item.title)
                ? {
                    ...item,
                    title: item.title || meta.title,
                    author: item.author || meta.author,
                  }
                : item,
            ),
          );
          if (activeIndexRef.current >= 0 && tracksRef.current[activeIndexRef.current]?.id === entry.id) {
            setTrackTitle((prevTitle) => prevTitle || meta.title);
          }
        }
      })();
    }
  }, []);

  const hydratePlaylistTitle = useCallback((listId) => {
    if (!listId) return;
    if (!oembedAbortRef.current || oembedAbortRef.current.signal.aborted) {
      oembedAbortRef.current = new AbortController();
    }
    const { signal } = oembedAbortRef.current;
    fetchYoutubeOembed(`https://www.youtube.com/playlist?list=${encodeURIComponent(listId)}`, signal).then((meta) => {
      if (meta?.title && !signal.aborted) {
        setPlaylistTitle(meta.title);
      }
    });
  }, []);

  const selectAndPlayTrack = useCallback((nextList, index) => {
    if (!nextList.length || index < 0 || index >= nextList.length) return;
    const item = nextList[index];
    lastPlayerStateRef.current = null;
    setError('');
    setCues([]);
    setCaptionName('');
    setLine('');
    setPlaying(false);
    setActiveIndex(index);
    setTrackTitle(item.title || '');
    setPlayerTarget({
      sessionId: nextUid(),
      id: item.id,
      start: item.start || 0,
      listId: null,
    });
  }, []);

  const playTrackAt = useCallback((index) => {
    selectAndPlayTrack(tracksRef.current, index);
  }, [selectAndPlayTrack]);

  const handleTrackEnded = useCallback(() => {
    const list = tracksRef.current;
    const idx = activeIndexRef.current;
    const mode = repeatModeRef.current;
    if (!list.length) return;

    if (mode === 'one') {
      lastPlayerStateRef.current = null;
      command('seekTo', [0, true]);
      command('playVideo');
      setPlaying(true);
      return;
    }

    if (idx + 1 < list.length) {
      selectAndPlayTrack(list, idx + 1);
      return;
    }

    if (mode === 'all') {
      selectAndPlayTrack(list, 0);
      return;
    }

    setPlaying(false);
  }, [command, selectAndPlayTrack]);

  useEffect(() => {
    if (!pendingPlaylistAppend && playlistQueue.length > 0) {
      const [nextPl, ...rest] = playlistQueue;
      setPlaylistQueue(rest);
      setPendingPlaylistAppend({ ...nextPl, nonce: nextUid() });
      setPlaylistLoading(true);
    }
  }, [pendingPlaylistAppend, playlistQueue]);

  useEffect(() => {
    const receive = (e) => {
      if (e.origin !== 'https://www.youtube.com') return;
      const isMain = e.source === frame.current?.contentWindow;
      const isProbe = Boolean(probeFrame.current?.contentWindow) && e.source === probeFrame.current.contentWindow;
      if (!isMain && !isProbe) return;

      let d;
      try {
        d = typeof e.data === 'string' ? JSON.parse(e.data) : e.data;
      } catch {
        return;
      }

      if (isProbe) {
        const pending = pendingAppendRef.current;
        const playlistIds = Array.isArray(d?.info?.playlist)
          ? d.info.playlist.filter(isValidYoutubeVideoId)
          : [];
        if (pending && playlistIds.length > 0) {
          const added = playlistIds.map((vid) => makeTrack(vid, 0, { playlistId: pending.listId }));
          setPendingPlaylistAppend(null);
          setPlaylistLoading(false);
          setTracks((prev) => [...prev, ...added]);
          setOriginalOrderUids(null);
          setQueueOpen(true);
          hydrateTracksMeta(added);
        }
        if (d?.event === 'onError') {
          setPendingPlaylistAppend(null);
          setPlaylistLoading(false);
        }
        return;
      }

      const target = playerTargetRef.current;
      const info = d?.info;

      if ((d?.event === 'initialDelivery' || d?.event === 'infoDelivery') && info) {
        if (
          target?.listId &&
          hydratedSessionRef.current !== target.sessionId &&
          Array.isArray(info.playlist)
        ) {
          const validIds = info.playlist.filter(isValidYoutubeVideoId);
          if (validIds.length > 0) {
            hydratedSessionRef.current = target.sessionId;
            setPlaylistLoading(false);
            const currentVideoId = info.videoData?.video_id || target.id;
            const currentTitle = typeof info.videoData?.title === 'string' ? info.videoData.title : '';
            const currentAuthor = typeof info.videoData?.author === 'string' ? info.videoData.author : '';
            let desiredIdx = Number.isInteger(info.playlistIndex) ? info.playlistIndex : -1;
            if (desiredIdx < 0 || desiredIdx >= validIds.length) {
              desiredIdx = currentVideoId ? validIds.indexOf(currentVideoId) : 0;
            }
            if (desiredIdx < 0) desiredIdx = 0;

            const registered = validIds.map((vid, idx) =>
              makeTrack(vid, idx === desiredIdx ? target.start || 0 : 0, {
                playlistId: target.listId,
                title: idx === desiredIdx && currentVideoId === vid ? currentTitle : '',
                author: idx === desiredIdx && currentVideoId === vid ? currentAuthor : '',
              }),
            );
            setTracks(registered);
            setActiveIndex(desiredIdx);
            setOriginalOrderUids(null);
            setQueueOpen(true);
            hydrateTracksMeta(registered);
          }
        }

        if (typeof info.videoData?.title === 'string' && info.videoData.title) {
          const eventVid = info.videoData.video_id;
          const curIdx = activeIndexRef.current;
          const curTrack = tracksRef.current[curIdx];
          if (!eventVid || !curTrack || curTrack.id === eventVid) {
            setTrackTitle(info.videoData.title);
            if (curTrack && !curTrack.title) {
              const titleText = info.videoData.title;
              const authorText = typeof info.videoData.author === 'string' ? info.videoData.author : '';
              setTracks((prev) =>
                prev.map((item, i) =>
                  i === curIdx && !item.title
                    ? { ...item, title: titleText, author: item.author || authorText }
                    : item,
                ),
              );
            }
          }
        }

        const t = info.currentTime;
        if (Number.isFinite(t)) {
          setLine(
            captionsRef.current
              ? cueRef.current.filter((c) => c.start <= t && c.end > t).map((c) => c.text).join('\n')
              : '',
          );
        }
      }

      const nextState =
        d?.event === 'onStateChange'
          ? d.info
          : info?.playerState !== undefined
            ? info.playerState
            : undefined;
      if (nextState !== undefined) {
        const prevState = lastPlayerStateRef.current;
        lastPlayerStateRef.current = nextState;
        setPlaying(nextState === 1);
        if (nextState === 0 && prevState !== 0) {
          handleTrackEnded();
        }
      }

      if (d?.event === 'onError') {
        setPlaying(false);
        setPlaylistLoading(false);
        setError(ui('이 영상은 삽입 재생이 제한되었거나 재생할 수 없습니다. 다른 링크를 사용해 주세요.'));
      }
    };

    window.addEventListener('message', receive);
    return () => window.removeEventListener('message', receive);
  }, [handleTrackEnded, hydrateTracksMeta]);

  // YouTube's embed policies require content to play in a visible player. Pause when
  // the panel folds into the launcher or a modal dialog hides it (see the CSS rule
  // that hides the panel under [aria-modal="true"]).
  useEffect(() => {
    if (!playing) return undefined;
    if (!open) {
      command('pauseVideo');
      return undefined;
    }
    const pauseWhenHidden = () => {
      if (document.querySelector('[aria-modal="true"]')) command('pauseVideo');
    };
    pauseWhenHidden();
    const timer = setInterval(pauseWhenHidden, 500);
    return () => clearInterval(timer);
  }, [open, playing, command]);

  useEffect(() => {
    const update = () => {
      if (!canvas) {
        setSafeBottom(24);
        setLauncher(null);
        return;
      }
      if (document.querySelector('.canvas-stage:is(.camera-moving, .camera-zooming, .panning, .camera-coasting)')) {
        return;
      }
      const obstacles = [...document.querySelectorAll(PLAYER_OBSTACLES)]
        .filter((el) => el.getClientRects().length && getComputedStyle(el).visibility !== 'hidden')
        .map((el) => el.getBoundingClientRect())
        .filter((r) => r.width > 0 && r.height > 0);
      const next = launcherPosition(innerWidth, innerHeight, obstacles);
      setLauncher((p) => (p && p.left === next.left && p.top === next.top ? p : next));
      const dock = document.querySelector('.canvas-quick-dock');
      setSafeBottom(dock ? Math.max(24, innerHeight - dock.getBoundingClientRect().top + 20) : 100);
    };
    update();
    const timer = setInterval(update, 1200);
    window.addEventListener('resize', update);
    return () => {
      clearInterval(timer);
      window.removeEventListener('resize', update);
    };
  }, [canvas]);

  useEffect(() => {
    const resize = () => {
      setWidth((w) => Math.min(w, Math.max(240, innerWidth - 24)));
      setPosition((p) =>
        p
          ? {
              x: Math.max(12, Math.min(p.x, innerWidth - Math.min(width, Math.max(240, innerWidth - 24)) - 12)),
              y: Math.max(12, Math.min(p.y, innerHeight - 160)),
            }
          : p,
      );
    };
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, [width]);

  useEffect(
    () => () => {
      oembedAbortRef.current?.abort();
      probeRetryRef.current.forEach((id) => clearTimeout(id));
    },
    [],
  );

  const startGesture = (e, type) => {
    if (e.button !== 0) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    const r = panel.current.getBoundingClientRect();
    gesture.current = { type, x: e.clientX, y: e.clientY, left: r.left, top: r.top, width: r.width };
  };

  const move = (e) => {
    const g = gesture.current;
    if (!g) return;
    if (g.type === 'resize') {
      setWidth(Math.max(240, Math.min(innerWidth - g.left - 12, g.width + e.clientX - g.x)));
    } else {
      setPosition({
        x: Math.max(12, Math.min(innerWidth - (panel.current?.offsetWidth || 240) - 12, g.left + e.clientX - g.x)),
        y: Math.max(12, Math.min(innerHeight - (panel.current?.offsetHeight || 160) - 12, g.top + e.clientY - g.y)),
      });
    }
  };

  const resetPlaybackState = () => {
    oembedAbortRef.current?.abort();
    oembedAbortRef.current = new AbortController();
    probeRetryRef.current.forEach((id) => clearTimeout(id));
    probeRetryRef.current = [];
    lastPlayerStateRef.current = null;
    hydratedSessionRef.current = '';
    setError('');
    setCues([]);
    setCaptionName('');
    setLine('');
    setPlaying(false);
    setTrackTitle('');
    setPlaylistTitle('');
    setOriginalOrderUids(null);
    setPendingPlaylistAppend(null);
    setPlaylistQueue([]);
  };

  function startFromParsed(parsed) {
    resetPlaybackState();

    const firstPlaylist = parsed.playlists[0];
    if (firstPlaylist) {
      const sessionId = nextUid();
      const seedTracks = firstPlaylist.id
        ? [makeTrack(firstPlaylist.id, firstPlaylist.start || 0, { playlistId: firstPlaylist.listId })]
        : [];
      const extraVideos = parsed.videos.map((v) => makeTrack(v.id, v.start));
      const initialList = [...seedTracks, ...extraVideos];

      setTracks(initialList);
      setActiveIndex(initialList.length > 0 ? 0 : -1);
      setPlaylistLoading(true);
      setQueueOpen(true);
      setPlayerTarget({
        sessionId,
        id: firstPlaylist.id,
        start: firstPlaylist.start || 0,
        listId: firstPlaylist.listId,
      });
      if (parsed.playlists.length > 1) {
        setPlaylistQueue(parsed.playlists.slice(1));
      }
      hydratePlaylistTitle(firstPlaylist.listId);
      if (initialList.length > 0) hydrateTracksMeta(initialList);
      return;
    }

    const nextList = parsed.videos.map((v) => makeTrack(v.id, v.start));
    setTracks(nextList);
    setActiveIndex(0);
    setPlaylistLoading(false);
    if (nextList.length > 1) setQueueOpen(true);
    setPlayerTarget({
      sessionId: nextUid(),
      id: nextList[0].id,
      start: nextList[0].start || 0,
      listId: null,
    });
    hydrateTracksMeta(nextList);
  }

  function load(e) {
    e.preventDefault();
    const parsed = parseYoutubeInput(link);
    if (!parsed) {
      setError(ui('올바른 유튜브 영상 링크를 입력해 주세요.'));
      return;
    }
    startFromParsed(parsed);
  }

  function appendToQueue() {
    const parsed = parseYoutubeInput(link);
    if (!parsed) {
      setError(ui('올바른 유튜브 영상 링크를 입력해 주세요.'));
      return;
    }
    setError('');

    if (tracks.length === 0 && !playerTarget) {
      startFromParsed(parsed);
      setLink('');
      return;
    }

    if (parsed.videos.length > 0) {
      const added = parsed.videos.map((v) => makeTrack(v.id, v.start));
      setTracks((prev) => [...prev, ...added]);
      setOriginalOrderUids(null);
      setQueueOpen(true);
      hydrateTracksMeta(added);
    }
    if (parsed.playlists.length > 0) {
      setPlaylistQueue((prev) => [...prev, ...parsed.playlists]);
      setQueueOpen(true);
    }
    setLink('');
  }

  const stop = () => {
    resetPlaybackState();
    setPlaylistLoading(false);
    setTracks([]);
    setActiveIndex(-1);
    setPlayerTarget(null);
    setOpen(false);
  };

  const clearQueue = () => {
    resetPlaybackState();
    setPlaylistLoading(false);
    setTracks([]);
    setActiveIndex(-1);
    setPlayerTarget(null);
  };

  const handleMove = (index, delta) => {
    const targetIdx = index + delta;
    if (targetIdx < 0 || targetIdx >= tracks.length) return;
    const playingUid = activeTrack?.uid;
    const nextList = moveTrack(tracks, index, targetIdx);
    setTracks(nextList);
    setOriginalOrderUids(null);
    if (playingUid) {
      const nextActive = nextList.findIndex((item) => item.uid === playingUid);
      if (nextActive >= 0) setActiveIndex(nextActive);
    }
  };

  const handleRemove = (index) => {
    const removingActive = index === activeIndex;
    const { tracks: nextList, activeIndex: nextActive } = removeTrackAt(tracks, activeIndex, index);
    setTracks(nextList);
    if (!nextList.length) {
      clearQueue();
      return;
    }
    if (removingActive) {
      selectAndPlayTrack(nextList, nextActive);
    } else {
      setActiveIndex(nextActive);
    }
  };

  const handleShuffle = () => {
    if (tracks.length < 2) return;
    if (!originalOrderUids) {
      setOriginalOrderUids(tracks.map((item) => item.uid));
    }
    const { tracks: nextList, activeIndex: nextActive } = shuffleQueue(tracks, activeIndex);
    setTracks(nextList);
    setActiveIndex(nextActive);
    setQueueOpen(true);
  };

  const handleRestoreOrder = () => {
    if (!originalOrderUids) return;
    const { tracks: nextList, activeIndex: nextActive } = restoreQueueOrder(tracks, originalOrderUids, activeIndex);
    setTracks(nextList);
    setActiveIndex(nextActive);
    setOriginalOrderUids(null);
  };

  const playPrev = () => {
    if (!tracks.length) return;
    const nextIdx = activeIndex > 0 ? activeIndex - 1 : tracks.length - 1;
    selectAndPlayTrack(tracks, nextIdx);
  };

  const playNext = () => {
    if (!tracks.length) return;
    const nextIdx = activeIndex + 1 < tracks.length ? activeIndex + 1 : 0;
    selectAndPlayTrack(tracks, nextIdx);
  };

  const cycleRepeat = () => {
    setRepeatMode((m) => (m === 'all' ? 'one' : m === 'one' ? 'off' : 'all'));
  };

  const repeatLabel =
    repeatMode === 'all' ? ui('전체 반복') : repeatMode === 'one' ? ui('한 곡 반복') : ui('반복 끄기');

  const embedSrc = buildEmbedUrl(playerTarget);
  const probeSrc = pendingPlaylistAppend
    ? `https://www.youtube.com/embed/videoseries?list=${encodeURIComponent(pendingPlaylistAppend.listId)}&enablejsapi=1&origin=${encodeURIComponent(window.location.origin)}`
    : '';

  return (
    <>
      {!open && (
        <button
          className={`youtube-launcher${playing ? ' is-playing' : ''}`}
          data-playback={playing ? 'playing' : hasMedia ? 'paused' : 'idle'}
          style={launcher ? { left: launcher.left, top: launcher.top, right: 'auto', bottom: 'auto' } : undefined}
          aria-label={ui('유튜브 플레이어 열기')}
          aria-describedby={hasMedia ? 'youtube-launcher-playback' : undefined}
          title={[playing ? ui('재생 중') : hasMedia ? ui('재생 대기 중') : ui('유튜브 플레이어'), displayTitle]
            .filter(Boolean)
            .join(' · ')}
          onClick={() => setOpen(true)}
        >
          <span aria-hidden="true">
            {playing ? (
              <span className="youtube-equalizer">
                <i />
                <i />
                <i />
                <i />
              </span>
            ) : (
              '♫'
            )}
          </span>
          {hasMedia && <span className="youtube-playback-dot" aria-hidden="true" />}
          <span id="youtube-launcher-playback" className="youtube-sr-only">
            {playing ? ui('재생 중') : hasMedia ? ui('재생 대기 중') : ''}
          </span>
        </button>
      )}

      <section
        ref={panel}
        className={`youtube-panel ${compact ? 'is-compact' : ''}`}
        aria-label={ui('유튜브 플레이어')}
        style={{
          display: open ? 'block' : 'none',
          width: Math.min(width, Math.max(240, window.innerWidth - 24)),
          ...(position ? { left: position.x, top: position.y, right: 'auto', bottom: 'auto' } : { right: 20, top: 88 }),
        }}
      >
        <header>
          <span
            className="youtube-grip"
            onPointerDown={(e) => startGesture(e, 'move')}
            onPointerMove={move}
            onPointerUp={() => {
              gesture.current = null;
            }}
            onPointerCancel={() => {
              gesture.current = null;
            }}
          >
            ⠿ YouTube
          </span>
          <button
            type="button"
            onClick={() => {
              setCompact((v) => !v);
              setWidth(compact ? 360 : 260);
            }}
            aria-pressed={compact}
            title={ui('오디오 중심의 작은 화면')}
          >
            {compact ? ui('화면 확대') : ui('작게 듣기')}
          </button>
          <button type="button" onClick={() => setOpen(false)} aria-label={ui('플레이어 접기')}>
            −
          </button>
          <button type="button" onClick={stop} aria-label={ui('재생 종료')}>
            ×
          </button>
        </header>

        {hasMedia && (
          <div className={`youtube-now-playing${playing ? ' is-playing' : ''}`} role="status">
            <span className="youtube-equalizer" aria-hidden="true">
              <i />
              <i />
              <i />
              <i />
            </span>
            <div>
              <strong>
                {playing ? ui('재생 중') : ui('재생 대기 중')}
                {tracks.length > 1 && activeIndex >= 0 ? ` · ${activeIndex + 1}/${tracks.length}` : ''}
              </strong>
              <span title={displayTitle}>{displayTitle || ui('YouTube 동영상')}</span>
            </div>
          </div>
        )}

        <form onSubmit={load}>
          <input
            id={`${fieldId}-url`}
            name="youtube-url"
            type="text"
            inputMode="url"
            aria-label={ui('유튜브 링크')}
            placeholder={ui('유튜브 영상 또는 재생목록 링크 붙여넣기')}
            value={link}
            onChange={(e) => setLink(e.target.value)}
          />
          <button type="submit">{ui('열기')}</button>
          <button
            type="button"
            className="youtube-add-button"
            onClick={appendToQueue}
            disabled={!link.trim()}
          >
            {ui('목록에 추가')}
          </button>
        </form>

        {!hasMedia && !error && (
          <p className="youtube-hint youtube-empty-hint">
            {ui("영상 또는 재생목록 링크를 붙여넣고 '열기' 또는 '목록에 추가'를 눌러주세요.")}
          </p>
        )}

        {error && (
          <p role="alert" className="youtube-error">
            {error}
          </p>
        )}

        {embedSrc && (
          <>
            <iframe
              ref={frame}
              title={ui('YouTube 동영상')}
              width="100%"
              height={compact ? 200 : Math.max(200, ((width - 24) * 9) / 16)}
              src={embedSrc}
              allow="autoplay; encrypted-media; picture-in-picture; fullscreen; compute-pressure"
              allowFullScreen
              referrerPolicy="strict-origin-when-cross-origin"
              onLoad={() => {
                const send = (event, extra = {}) =>
                  frame.current?.contentWindow?.postMessage(
                    JSON.stringify({ event, ...extra }),
                    'https://www.youtube.com',
                  );
                send('listening', { id: 'frelog-youtube' });
                command('addEventListener', ['onError']);
                command('addEventListener', ['onStateChange']);
                if (playerTarget?.listId) {
                  command('getPlaylist');
                  command('getPlaylistIndex');
                  probeRetryRef.current.forEach((id) => clearTimeout(id));
                  probeRetryRef.current = [350, 1100].map((ms) =>
                    setTimeout(() => {
                      if (hydratedSessionRef.current !== playerTarget?.sessionId) {
                        command('getPlaylist');
                      }
                    }, ms),
                  );
                }
              }}
            />

            <div className="youtube-controls">
              <button type="button" onClick={() => command(playing ? 'pauseVideo' : 'playVideo')}>
                {playing ? ui('일시정지') : ui('재생')}
              </button>
              <button
                type="button"
                aria-pressed={captions}
                onClick={() => {
                  setCaptions((v) => !v);
                  setLine('');
                }}
              >
                {ui('하단 자막')} {captions ? ui('켜짐') : ui('꺼짐')}
              </button>
              <label>
                {ui('하단 자막 불러오기')}
                <input
                  id={`${fieldId}-subtitles`}
                  name="youtube-subtitles"
                  type="file"
                  accept=".vtt,.srt"
                  onChange={async (e) => {
                    const file = e.target.files[0];
                    if (!file) return;
                    if (file.size > 2e6) {
                      setError(ui('자막 파일은 2MB 이하로 선택해 주세요.'));
                      return;
                    }
                    const parsed = parseSubtitles(await file.text());
                    setCues(parsed);
                    setCaptionName(parsed.length ? file.name : '');
                    setCaptions(true);
                    setError(parsed.length ? '' : ui('자막 파일의 시간 정보를 확인해 주세요.'));
                    e.target.value = '';
                  }}
                />
              </label>
            </div>
            {captionName && <p className="youtube-caption-source">{captionName}</p>}
          </>
        )}

        {(tracks.length > 0 || playlistLoading) && (
          <div className="youtube-playlist-card" aria-label={ui('재생 목록 ({v0}곡)', { v0: tracks.length })}>
            <div className="youtube-playlist-header">
              <div className="youtube-playlist-title">
                <strong>{ui('재생 목록 ({v0}곡)', { v0: tracks.length })}</strong>
                {playlistTitle && <span title={playlistTitle}>{playlistTitle}</span>}
              </div>
              <button
                type="button"
                className="youtube-playlist-toggle"
                onClick={() => setQueueOpen((v) => !v)}
                aria-expanded={queueOpen}
              >
                {queueOpen ? ui('목록 접기') : ui('목록 펼치기')}
              </button>
            </div>

            <div className="youtube-playlist-actions">
              <button type="button" onClick={playPrev} disabled={tracks.length < 2}>
                <span aria-hidden="true">⏮</span> {ui('이전 곡')}
              </button>
              <button type="button" onClick={playNext} disabled={tracks.length < 2}>
                {ui('다음 곡')} <span aria-hidden="true">⏭</span>
              </button>
              <button type="button" onClick={handleShuffle} disabled={tracks.length < 2}>
                <span aria-hidden="true">🔀</span> {ui('랜덤 섞기')}
              </button>
              {originalOrderUids && (
                <button type="button" onClick={handleRestoreOrder}>
                  {ui('원래 순서')}
                </button>
              )}
              <button
                type="button"
                onClick={cycleRepeat}
                aria-pressed={repeatMode !== 'off'}
                aria-label={ui('반복 모드 변경')}
                data-repeat={repeatMode}
              >
                {repeatLabel}
              </button>
              <button type="button" className="youtube-clear-queue" onClick={clearQueue}>
                {ui('목록 비우기')}
              </button>
            </div>

            {playlistLoading && (
              <p className="youtube-playlist-status" role="status">
                {ui('재생 목록 불러오는 중…')}
              </p>
            )}

            {queueOpen && tracks.length > 0 && (
              <ol className="youtube-playlist-list">
                {tracks.map((item, idx) => {
                  const isActive = idx === activeIndex;
                  return (
                    <li key={item.uid} className={`youtube-playlist-item${isActive ? ' is-active' : ''}`}>
                      <button
                        type="button"
                        className="youtube-track-select"
                        onClick={() => playTrackAt(idx)}
                        aria-current={isActive ? 'true' : undefined}
                      >
                        <span className="youtube-track-index" aria-hidden="true">
                          {isActive ? '▶' : idx + 1}
                        </span>
                        <span className="youtube-track-meta">
                          <span className="youtube-track-title">
                            {item.title || `${ui('제목 불러오는 중…')} (${item.id})`}
                          </span>
                          {item.author && <small className="youtube-track-author">{item.author}</small>}
                        </span>
                      </button>
                      <div className="youtube-track-actions">
                        <button
                          type="button"
                          disabled={idx === 0}
                          onClick={() => handleMove(idx, -1)}
                          aria-label={`${item.title || item.id} ${ui('위로 이동')}`}
                          title={ui('위로 이동')}
                        >
                          ↑
                        </button>
                        <button
                          type="button"
                          disabled={idx === tracks.length - 1}
                          onClick={() => handleMove(idx, 1)}
                          aria-label={`${item.title || item.id} ${ui('아래로 이동')}`}
                          title={ui('아래로 이동')}
                        >
                          ↓
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRemove(idx)}
                          aria-label={`${item.title || item.id} ${ui('목록에서 제거')}`}
                          title={ui('목록에서 제거')}
                        >
                          ×
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ol>
            )}
          </div>
        )}

        {embedSrc && (
          <p className="youtube-hint">
            {ui('SRT·VTT 자막을 불러오면 영상 밖, 페이지 중앙 하단에 표시됩니다. 일반 유튜브 영상의 자막은 자동으로 가져올 수 없습니다.')}
          </p>
        )}

        <button
          type="button"
          className="youtube-resize"
          aria-label={ui('플레이어 크기 조절')}
          onPointerDown={(e) => startGesture(e, 'resize')}
          onPointerMove={move}
          onPointerUp={() => {
            gesture.current = null;
          }}
          onPointerCancel={() => {
            gesture.current = null;
          }}
          onKeyDown={(e) => {
            if (['ArrowLeft', 'ArrowRight'].includes(e.key)) {
              e.preventDefault();
              setWidth((w) => Math.max(240, Math.min(innerWidth - 24, w + (e.key === 'ArrowRight' ? 20 : -20))));
            }
          }}
        >
          ◢
        </button>

        {probeSrc && (
          <iframe
            ref={probeFrame}
            key={pendingPlaylistAppend?.nonce}
            className="youtube-playlist-probe"
            title={ui('플레이어 정보')}
            width="100%"
            height="200"
            src={probeSrc}
            onLoad={() => {
              const sendProbe = (payload) =>
                probeFrame.current?.contentWindow?.postMessage(
                  JSON.stringify(payload),
                  'https://www.youtube.com',
                );
              sendProbe({ event: 'listening', id: 'frelog-youtube-probe' });
              sendProbe({ event: 'command', func: 'getPlaylist', args: [] });
            }}
          />
        )}
      </section>

      {line && captions && (
        <div className="youtube-subtitles" style={{ bottom: safeBottom }} aria-live="off">
          <span>{line}</span>
        </div>
      )}
    </>
  );
}

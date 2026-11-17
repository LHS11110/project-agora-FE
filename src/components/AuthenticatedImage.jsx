import { useEffect, useState } from 'react';
import {
  acquireAuthenticatedImage,
  peekAuthenticatedImage,
  releaseAuthenticatedImage,
} from './authenticatedImageCache.js';

/**
 * Renders API images that require Bearer auth as object URLs. Plain <img src>
 * requests cannot attach the app's Authorization header.
 */
export default function AuthenticatedImage({ src, token, alt = '', className, fallback = null, loadingFallback, ...imageProps }) {
  const source = typeof src === 'string' ? src.trim() : '';
  const key = `${source}\n${token || ''}`;
  const initialHit = source ? peekAuthenticatedImage(source, token) : null;
  const [resolved, setResolved] = useState(() => (initialHit ? { key, src: initialHit.src } : { key: '', src: '' }));
  const [failedKey, setFailedKey] = useState('');
  const liveHit = resolved.key === key ? resolved.src : (peekAuthenticatedImage(source, token)?.src || '');
  const loading = Boolean(source) && !liveHit;
  const failed = !source || failedKey === key;

  useEffect(() => {
    let cancelled = false;
    let acquired = null;
    setFailedKey('');
    const cached = source ? peekAuthenticatedImage(source, token) : null;
    setResolved(cached ? { key, src: cached.src } : { key: '', src: '' });

    if (!source) return undefined;
    if (/^(data|blob):/i.test(source)) {
      setResolved({ key, src: source });
      return undefined;
    }

    acquireAuthenticatedImage(source, token)
      .then((entry) => {
        if (cancelled) {
          releaseAuthenticatedImage(entry);
          return;
        }
        if (!entry) {
          setFailedKey(key);
          return;
        }
        acquired = entry;
        setResolved({ key, src: entry.src });
      })
      .catch(() => {
        if (!cancelled) setFailedKey(key);
      });

    return () => {
      cancelled = true;
      releaseAuthenticatedImage(acquired);
    };
  }, [key, source, token]);

  if (failed) return fallback;
  if (loading) return loadingFallback ?? fallback;
  return <img {...imageProps} className={className} src={liveHit} alt={alt} onError={() => setFailedKey(key)} />;
}

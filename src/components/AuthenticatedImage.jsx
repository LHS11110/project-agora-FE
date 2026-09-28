import { useEffect, useState } from 'react';
import { apiUrl } from '../api/client.js';

/**
 * Renders API images that require Bearer auth as object URLs. Plain <img src>
 * requests cannot attach the app's Authorization header.
 */
export default function AuthenticatedImage({ src, token, alt = '', className, fallback = null, loadingFallback, ...imageProps }) {
  const [resolved, setResolved] = useState({ key: '', src: '' });
  const [failedKey, setFailedKey] = useState('');
  const source = typeof src === 'string' ? src.trim() : '';
  const key = `${source}\n${token || ''}`;
  const loading = Boolean(source) && resolved.key !== key;
  const failed = !source || failedKey === key;

  useEffect(() => {
    let cancelled = false;
    let objectUrl = '';
    setFailedKey('');
    setResolved({ key: '', src: '' });

    if (!source) return undefined;
    if (/^(data|blob):/i.test(source)) {
      setResolved({ key, src: source });
      return undefined;
    }

    let imageUrl;
    try {
      imageUrl = new URL(apiUrl(source), window.location.href);
      const apiOrigin = new URL(apiUrl('/'), window.location.href).origin;
      if (imageUrl.origin !== apiOrigin) {
        setResolved({ key, src: imageUrl.href });
        return undefined;
      }
    } catch {
      setFailedKey(key);
      return undefined;
    }

    fetch(imageUrl.href, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
      .then((response) => {
        if (!response.ok) throw new Error(`Image request failed (${response.status})`);
        const contentType = response.headers.get('content-type') || '';
        if (contentType && !contentType.startsWith('image/') && !contentType.includes('octet-stream')) {
          throw new Error('Image endpoint returned a non-image response');
        }
        return response.blob();
      })
      .then((blob) => {
        if (cancelled || !blob.size) throw new Error('Image response was empty');
        objectUrl = URL.createObjectURL(blob);
        setResolved({ key, src: objectUrl });
      })
      .catch(() => {
        if (!cancelled) setFailedKey(key);
      });

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [key, source, token]);

  if (failed) return fallback;
  if (loading) return loadingFallback ?? fallback;
  return <img {...imageProps} className={className} src={resolved.src} alt={alt} onError={() => setFailedKey(key)} />;
}

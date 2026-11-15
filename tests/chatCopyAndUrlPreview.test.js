import test from 'node:test';
import assert from 'node:assert/strict';
import {
  fallbackUrlSummary,
  messageLinks,
  normalizePreviewPayload,
  normalizeUrlCandidate,
  safeImageUrl,
  stripTrailingPunctuation,
} from '../src/canvas/media/urlPreviewModel.js';
import { parseYoutube } from '../src/media/youtube.js';
import { youtubeEmbedSrc } from '../src/canvas/media/mediaModel.js';
import { translate } from '../src/i18n/locale.js';

test('messageLinks extracts deduplicated HTTP/HTTPS URLs cleanly while preserving balanced parens', () => {
  assert.deepEqual(
    messageLinks('Check https://example.com/post, and (https://youtu.be/dQw4w9WgXcQ?t=25) plus https://example.com/post!'),
    ['https://example.com/post', 'https://youtu.be/dQw4w9WgXcQ?t=25'],
  );
  assert.deepEqual(
    messageLinks('[Wiki](https://en.wikipedia.org/wiki/URL_(disambiguation))'),
    ['https://en.wikipedia.org/wiki/URL_(disambiguation)'],
  );
  assert.deepEqual(
    messageLinks('http://youtube.com/watch?v=dQw4w9WgXcQ&t=42'),
    ['https://youtube.com/watch?v=dQw4w9WgXcQ&t=42'],
  );
  assert.deepEqual(
    messageLinks('javascript:alert(1) ftp://example.com/file data:text/html,hi'),
    [],
  );
});

test('stripTrailingPunctuation and normalizeUrlCandidate reject unsafe protocols', () => {
  assert.equal(stripTrailingPunctuation('https://example.com/docs).'), 'https://example.com/docs');
  assert.equal(normalizeUrlCandidate('https://example.com/a_(b)).'), 'https://example.com/a_(b)');
  assert.equal(normalizeUrlCandidate('javascript:alert(1)'), '');
});

test('normalizePreviewPayload and safeImageUrl sanitize metadata fields', () => {
  assert.equal(safeImageUrl('javascript:alert(1)'), '');
  assert.equal(safeImageUrl('http://insecure.example.com/img.png', 'https:'), '');
  assert.equal(safeImageUrl('/api/assets/thumb.png', 'https:'), '/api/assets/thumb.png');
  assert.deepEqual(
    normalizePreviewPayload({
      title: '  Example Title  ',
      summary: '  Summary text ',
      site_name: 'Example',
      thumbnail: 'https://cdn.example.com/og.jpg',
    }),
    {
      title: 'Example Title',
      description: 'Summary text',
      siteName: 'Example',
      image: 'https://cdn.example.com/og.jpg',
    },
  );
  assert.equal(normalizePreviewPayload({}), null);
});

test('fallbackUrlSummary produces clean host/path info and YouTube embed URL preserves start time', () => {
  const fb = fallbackUrlSummary('https://www.example.com/docs/getting-started/');
  assert.equal(fb.host, 'example.com');
  assert.equal(fb.title, 'example.com/docs/getting-started');

  const yt = parseYoutube('https://youtu.be/dQw4w9WgXcQ?t=1m5s');
  assert.equal(yt.id, 'dQw4w9WgXcQ');
  assert.equal(yt.start, 65);
  assert.equal(
    youtubeEmbedSrc(`https://www.youtube-nocookie.com/embed/${yt.id}`, 'https://youtu.be/dQw4w9WgXcQ?t=1m5s'),
    'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?playsinline=1&rel=0&start=65',
  );
});

test('chat copy and link preview UI strings have English translations', () => {
  for (const ko of [
    '채팅 복사',
    '메시지 복사',
    '복사됨',
    '유튜브 동영상',
    '유튜브 동영상 미리보기',
    '클릭하여 원본 페이지 열기',
  ]) {
    assert.ok(!/[가-힣]/.test(translate(ko, 'en')), `Missing English translation for: ${ko}`);
  }
});

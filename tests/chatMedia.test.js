import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CHAT_IMAGE_LIMIT,
  CHAT_VIDEO_LIMIT,
  MAX_CHAT_MEDIA,
  chatMediaFileType,
  classifyChatMediaUrl,
  composeChatMessageWithMedia,
  formatChatMediaMarkdown,
  parseChatMessageMedia,
  validateChatMediaFile,
} from '../src/canvas/chat/chatMedia.js';
import en from '../src/i18n/en.js';

test('validateChatMediaFile accepts images and videos within size limits and rejects invalid files', () => {
  assert.equal(chatMediaFileType({ name: 'photo.png', type: 'image/png' }), 'image');
  assert.equal(chatMediaFileType({ name: 'anim.gif', type: 'image/gif' }), 'image');
  assert.equal(chatMediaFileType({ name: 'clip.mp4', type: 'video/mp4' }), 'video');
  assert.equal(chatMediaFileType({ name: 'clip.webm', type: '' }), 'video');
  assert.equal(chatMediaFileType({ name: 'vector.svg', type: 'image/svg+xml' }), null);
  assert.equal(chatMediaFileType({ name: 'doc.pdf', type: 'application/pdf' }), null);

  assert.deepEqual(validateChatMediaFile({ name: 'ok.jpg', type: 'image/jpeg', size: 1024 }), { ok: true, mediaType: 'image' });
  assert.deepEqual(validateChatMediaFile({ name: 'ok.mp4', type: 'video/mp4', size: 5 * 1024 * 1024 }), { ok: true, mediaType: 'video' });
  assert.equal(validateChatMediaFile({ name: 'huge.png', type: 'image/png', size: CHAT_IMAGE_LIMIT + 1 }).ok, false);
  assert.equal(validateChatMediaFile({ name: 'huge.mp4', type: 'video/mp4', size: CHAT_VIDEO_LIMIT + 1 }).ok, false);
  assert.equal(validateChatMediaFile({ name: 'script.js', type: 'text/javascript', size: 10 }).ok, false);
});

test('classifyChatMediaUrl permits internal canvas media and safe https media while rejecting unsafe URLs', () => {
  assert.deepEqual(
    classifyChatMediaUrl('/api/canvases/42/media/abc-123.png'),
    { url: '/api/canvases/42/media/abc-123.png', mediaType: 'image', internal: true },
  );
  assert.deepEqual(
    classifyChatMediaUrl('/api/canvases/42/media/clip_1.webm'),
    { url: '/api/canvases/42/media/clip_1.webm', mediaType: 'video', internal: true },
  );
  assert.deepEqual(
    classifyChatMediaUrl('https://cdn.example.com/photo.webp?w=800', 'https:'),
    { url: 'https://cdn.example.com/photo.webp?w=800', mediaType: 'image', internal: false },
  );
  assert.deepEqual(
    classifyChatMediaUrl('https://cdn.example.com/demo.mp4', 'https:'),
    { url: 'https://cdn.example.com/demo.mp4', mediaType: 'video', internal: false },
  );

  // Reject unsafe protocols, traversal, and non-media URLs
  assert.equal(classifyChatMediaUrl('javascript:alert(1)'), null);
  assert.equal(classifyChatMediaUrl('data:image/png;base64,AAAA'), null);
  assert.equal(classifyChatMediaUrl('blob:https://example.com/123'), null);
  assert.equal(classifyChatMediaUrl('/api/canvases/42/media/../secret.png'), null);
  assert.equal(classifyChatMediaUrl('https://example.com/article'), null);
  assert.equal(classifyChatMediaUrl('http://cdn.example.com/photo.png', 'https:'), null);
});

test('composeChatMessageWithMedia and parseChatMessageMedia round-trip uploaded images and videos cleanly', () => {
  assert.equal(
    formatChatMediaMarkdown('/api/canvases/7/media/a.png', 'screen [1].png'),
    '![screen 1.png](/api/canvases/7/media/a.png)',
  );

  const composed = composeChatMessageWithMedia('디자인 시안 확인해주세요', [
    { name: 'screen.png', uploadedUrl: '/api/canvases/7/media/a.png' },
    { name: 'walkthrough.mp4', uploadedUrl: '/api/canvases/7/media/b.mp4' },
  ]);
  assert.equal(
    composed,
    '디자인 시안 확인해주세요\n![screen.png](/api/canvases/7/media/a.png)\n![walkthrough.mp4](/api/canvases/7/media/b.mp4)',
  );

  const parsed = parseChatMessageMedia(composed);
  assert.equal(parsed.displayText, '디자인 시안 확인해주세요');
  assert.deepEqual(parsed.attachments, [
    { url: '/api/canvases/7/media/a.png', alt: 'screen.png', mediaType: 'image', internal: true },
    { url: '/api/canvases/7/media/b.mp4', alt: 'walkthrough.mp4', mediaType: 'video', internal: true },
  ]);
  assert.equal(parsed.mediaUrls.has('/api/canvases/7/media/a.png'), true);
  assert.equal(parsed.mediaUrls.has('/api/canvases/7/media/b.mp4'), true);
});

test('parseChatMessageMedia handles media-only messages, bare URLs, deduplication, and attachment limits', () => {
  const mediaOnly = parseChatMessageMedia('![cat.gif](https://cdn.example.com/cat.gif)');
  assert.equal(mediaOnly.displayText, '');
  assert.equal(mediaOnly.attachments.length, 1);
  assert.equal(mediaOnly.attachments[0].mediaType, 'image');

  const standaloneBare = parseChatMessageMedia('https://cdn.example.com/demo.mp4');
  assert.equal(standaloneBare.displayText, '');
  assert.equal(standaloneBare.attachments.length, 1);
  assert.equal(standaloneBare.attachments[0].mediaType, 'video');

  const inlineBare = parseChatMessageMedia('참고 이미지: https://cdn.example.com/pic.png 확인!');
  assert.equal(inlineBare.displayText, '참고 이미지: https://cdn.example.com/pic.png 확인!');
  assert.equal(inlineBare.attachments.length, 1);
  assert.equal(inlineBare.mediaUrls.has('https://cdn.example.com/pic.png'), true);

  const many = Array.from({ length: MAX_CHAT_MEDIA + 3 }, (_, i) => `![m${i}](/api/canvases/1/media/f${i}.png)`).join('\n');
  assert.equal(parseChatMessageMedia(many).attachments.length, MAX_CHAT_MEDIA);
});

test('new category and chat media UI strings have English translations', () => {
  const keys = [
    '카테고리',
    '카테고리 추가',
    '미분류',
    '이미지 또는 동영상 첨부',
    '이미지 또는 동영상을 놓아 첨부하세요',
    '업로드 중…',
    '이미지를 불러오지 못했습니다.',
    '동영상을 불러오지 못했습니다.',
    '다운로드',
  ];
  for (const key of keys) {
    assert.ok(typeof en[key] === 'string' && en[key].length > 0, `Missing en translation for: ${key}`);
  }
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  moveTrack,
  parseSubtitles,
  parseYoutube,
  parseYoutubeInput,
  parseYoutubeTarget,
  removeTrackAt,
  restoreQueueOrder,
  shuffleQueue,
} from '../src/media/youtube.js';

test('YouTube links accept exact hosts, shorts, start times and reject lookalikes', () => {
  for (const url of [
    'https://youtube.com/watch?v=dQw4w9WgXcQ',
    'https://youtu.be/dQw4w9WgXcQ',
    'https://m.youtube.com/shorts/dQw4w9WgXcQ',
  ]) {
    assert.equal(parseYoutube(url).id, 'dQw4w9WgXcQ');
  }
  assert.equal(parseYoutube('https://youtu.be/dQw4w9WgXcQ?t=1h2m3s').start, 3723);
  for (const url of [
    'javascript:alert(1)',
    'https://youtube.com.evil.test/watch?v=dQw4w9WgXcQ',
    'https://youtube.com/watch?v=invalid',
    'https://www.youtube.com/playlist?list=PLrAXtmErZgOeiKm4sgNOknGvNjby9efdf',
  ]) {
    assert.equal(parseYoutube(url), null);
  }
});

test('Playlist and multi-URL inputs parse playlists, watch+list, watch_videos, and reject invalid links', () => {
  const pl = parseYoutubeTarget('https://www.youtube.com/playlist?list=PLrAXtmErZgOeiKm4sgNOknGvNjby9efdf');
  assert.deepEqual(pl, {
    kind: 'playlist',
    listId: 'PLrAXtmErZgOeiKm4sgNOknGvNjby9efdf',
    id: null,
    start: 0,
  });

  const musicPl = parseYoutubeTarget('https://music.youtube.com/watch?v=dQw4w9WgXcQ&list=RDCLAK5uy_test123&t=45');
  assert.deepEqual(musicPl, {
    kind: 'playlist',
    listId: 'RDCLAK5uy_test123',
    id: 'dQw4w9WgXcQ',
    start: 45,
  });

  const batch = parseYoutubeInput('https://youtu.be/dQw4w9WgXcQ\nhttps://www.youtube.com/watch?v=0VH1Lim8gL8');
  assert.deepEqual(batch, {
    videos: [
      { id: 'dQw4w9WgXcQ', start: 0 },
      { id: '0VH1Lim8gL8', start: 0 },
    ],
    playlists: [],
  });

  const watchVideos = parseYoutubeTarget('https://www.youtube.com/watch_videos?video_ids=dQw4w9WgXcQ,0VH1Lim8gL8,bad');
  assert.deepEqual(watchVideos, {
    kind: 'videos',
    items: [
      { id: 'dQw4w9WgXcQ', start: 0 },
      { id: '0VH1Lim8gL8', start: 0 },
    ],
  });

  assert.equal(parseYoutubeInput('https://youtube.com.evil.test/playlist?list=PL12345'), null);
  assert.equal(parseYoutubeInput('javascript:alert(1)'), null);
});

test('Queue helpers reorder, remove, shuffle and restore original order while preserving active track', () => {
  const tracks = [
    { uid: 'u1', id: 'aaaaaaaaaaa' },
    { uid: 'u2', id: 'bbbbbbbbbbb' },
    { uid: 'u3', id: 'ccccccccccc' },
    { uid: 'u4', id: 'ddddddddddd' },
  ];

  assert.deepEqual(
    moveTrack(tracks, 2, 0).map((t) => t.uid),
    ['u3', 'u1', 'u2', 'u4'],
  );
  assert.equal(moveTrack(tracks, 0, -1), tracks);

  const removedBefore = removeTrackAt(tracks, 2, 0);
  assert.equal(removedBefore.activeIndex, 1);
  assert.deepEqual(
    removedBefore.tracks.map((t) => t.uid),
    ['u2', 'u3', 'u4'],
  );

  const removedLastActive = removeTrackAt(tracks, 3, 3);
  assert.equal(removedLastActive.activeIndex, 2);

  const originalUids = tracks.map((t) => t.uid);
  const shuffled = shuffleQueue(tracks, 1, () => 0);
  assert.equal(shuffled.tracks.length, 4);
  assert.notDeepEqual(
    shuffled.tracks.map((t) => t.uid),
    originalUids,
  );
  assert.equal(shuffled.tracks[shuffled.activeIndex].uid, 'u2');

  const withAppended = [...shuffled.tracks, { uid: 'u5', id: 'eeeeeeeeeee' }];
  const restored = restoreQueueOrder(withAppended, originalUids, shuffled.activeIndex);
  assert.deepEqual(
    restored.tracks.map((t) => t.uid),
    ['u1', 'u2', 'u3', 'u4', 'u5'],
  );
  assert.equal(restored.tracks[restored.activeIndex].uid, 'u2');
});

test('SRT and VTT cues preserve multiline plain text and ignore malformed timing', () => {
  assert.deepEqual(parseSubtitles('WEBVTT\n\n00:01.000 --> 00:03.000 align:center\n<b>Hello</b>\nworld'), [
    { start: 1, end: 3, text: 'Hello\nworld' },
  ]);
  assert.equal(parseSubtitles('1\n00:00:02,000 --> 00:00:01,000\ninvalid').length, 0);
});

test('launcher avoids bottom right canvas panels on desktop and mobile', async () => {
  const { launcherPosition } = await import('../src/media/playerLayout.js');
  for (const [width, height] of [
    [1440, 900],
    [390, 844],
  ]) {
    const obstacle = { left: width - 220, right: width, top: height - 100, bottom: height };
    const p = launcherPosition(width, height, [obstacle]);
    assert.ok(p.left + 42 <= width && p.top + 42 <= height);
    assert.ok(p.left + 42 <= obstacle.left - 10 || p.top + 42 <= obstacle.top - 10);
  }
});

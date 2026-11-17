import assert from 'node:assert/strict';
const { chromium } = await import(process.env.AGORA_E2E_PLAYWRIGHT_MODULE || 'playwright-core');

const origin = process.env.AGORA_E2E_ORIGIN || 'https://127.0.0.1:5192';
const browser = await chromium.launch({
  executablePath: '/usr/bin/google-chrome',
  args: [
    '--no-sandbox',
    ...(process.env.AGORA_E2E_HOST_RESOLVER ? [`--host-resolver-rules=${process.env.AGORA_E2E_HOST_RESOLVER}`] : []),
  ],
});

const TITLES = {
  trackA11111: { title: '첫 번째 플레이리스트 곡', author_name: 'Channel One' },
  trackB22222: { title: '두 번째 플레이리스트 곡', author_name: 'Channel Two' },
  trackC33333: { title: '세 번째 플레이리스트 곡', author_name: 'Channel Three' },
  trackD44444: { title: '네 번째 플레이리스트 곡', author_name: 'Channel Four' },
  extra555555: { title: '직접 추가한 다섯 번째 곡', author_name: 'Channel Five' },
  probeF66666: { title: '추가 재생목록 곡 1', author_name: 'Probe Channel' },
  probeG77777: { title: '추가 재생목록 곡 2', author_name: 'Probe Channel' },
};

try {
  const page = await browser.newPage({
    viewport: { width: 1440, height: 960 },
    ignoreHTTPSErrors: process.env.AGORA_E2E_INSECURE_LOCAL_TLS === '1',
    locale: 'ko-KR',
  });

  await page.addInitScript(() => sessionStorage.setItem('frelog.home-intro.v1', 'seen'));
  await page.route((u) => u.pathname.startsWith('/api/'), (r) => r.fulfill({ json: { available: true } }));

  await page.route('https://www.youtube.com/embed/**', (route) => {
    const reqUrl = new URL(route.request().url());
    const listId = reqUrl.searchParams.get('list') || '';
    const isVideoseries = reqUrl.pathname.endsWith('/videoseries');
    const singleId = !isVideoseries ? reqUrl.pathname.split('/').pop() : '';
    const isAppendProbe = listId === 'PLappendList99';

    let payload = null;
    if (listId === 'PLmainList123') {
      payload = {
        event: 'initialDelivery',
        info: {
          playlist: ['trackA11111', 'trackB22222', 'trackC33333', 'trackD44444'],
          playlistIndex: 0,
          playerState: 1,
          videoData: { video_id: 'trackA11111', title: TITLES.trackA11111.title },
        },
      };
    } else if (isAppendProbe) {
      payload = {
        event: 'initialDelivery',
        info: {
          playlist: ['probeF66666', 'probeG77777'],
          playlistIndex: 0,
          playerState: 5,
        },
      };
    } else if (singleId) {
      payload = {
        event: 'infoDelivery',
        info: {
          playerState: 1,
          videoData: {
            video_id: singleId,
            title: TITLES[singleId]?.title || singleId,
          },
        },
      };
    }

    const html = `<!doctype html><html><head><meta charset="utf-8"></head><body>Mock YT<script>
      const payload = ${JSON.stringify(payload)};
      window.addEventListener('load', () => {
        if (payload) parent.postMessage(JSON.stringify(payload), '*');
      });
    </script></body></html>`;
    return route.fulfill({ contentType: 'text/html; charset=utf-8', body: html });
  });

  await page.route('https://www.youtube.com/oembed*', (route) => {
    const reqUrl = new URL(route.request().url());
    const target = reqUrl.searchParams.get('url') || '';
    if (target.includes('list=PLmainList123')) {
      return route.fulfill({ json: { title: '테스트 메인 재생목록', author_name: 'FreLog DJ' } });
    }
    for (const [id, meta] of Object.entries(TITLES)) {
      if (target.includes(id)) {
        return route.fulfill({ json: meta });
      }
    }
    return route.fulfill({ status: 404, json: {} });
  });

  await page.goto(origin, { waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: '유튜브 플레이어 열기', exact: true }).click();

  // Verify every form control inside player has unique id and name
  const fieldAttrs = await page.locator('.youtube-panel input').evaluateAll((els) =>
    els.map((el) => ({ id: el.id, name: el.name })),
  );
  assert.ok(fieldAttrs.length > 0 && fieldAttrs.every((f) => f.id && f.name), 'YouTube inputs declare id & name');

  // 1. Load full playlist -> all 4 tracks auto-register and fetch oEmbed metadata
  await page.getByRole('textbox', { name: '유튜브 링크' }).fill('https://www.youtube.com/playlist?list=PLmainList123');
  await page.getByRole('button', { name: '열기', exact: true }).click();

  const items = page.locator('.youtube-playlist-item');
  await items.nth(3).waitFor();
  assert.equal(await items.count(), 4);
  await page.locator('.youtube-playlist-title').getByText('테스트 메인 재생목록').waitFor();
  await items.nth(1).getByText(TITLES.trackB22222.title).waitFor();
  await items.nth(3).getByText(TITLES.trackD44444.title).waitFor();

  // 2. Reorder track #2 ("두 번째 플레이리스트 곡") up to slot #1 while song #1 stays active
  await page.getByRole('button', { name: `${TITLES.trackB22222.title} 위로 이동`, exact: true }).click();
  const afterMoveOrder = await items.locator('.youtube-track-title').allTextContents();
  assert.deepEqual(afterMoveOrder, [
    TITLES.trackB22222.title,
    TITLES.trackA11111.title,
    TITLES.trackC33333.title,
    TITLES.trackD44444.title,
  ]);
  assert.ok(await items.nth(1).evaluate((el) => el.classList.contains('is-active')));

  // 3. Append single video via "목록에 추가"
  await page.getByRole('textbox', { name: '유튜브 링크' }).fill('https://youtu.be/extra555555');
  await page.getByRole('button', { name: '목록에 추가', exact: true }).click();
  assert.equal(await items.count(), 5);
  await items.nth(4).getByText(TITLES.extra555555.title).waitFor();

  // 4. Append second playlist via "목록에 추가" (probe iframe captures & merges all tracks)
  await page.getByRole('textbox', { name: '유튜브 링크' }).fill('https://www.youtube.com/playlist?list=PLappendList99');
  await page.getByRole('button', { name: '목록에 추가', exact: true }).click();
  await page.waitForFunction(() => document.querySelectorAll('.youtube-playlist-item').length === 7);

  // 5. Remove trackD44444
  await page.getByRole('button', { name: `${TITLES.trackD44444.title} 목록에서 제거`, exact: true }).click();
  assert.equal(await items.count(), 6);

  // 6. Select track C directly -> switches main iframe embed target
  await items.filter({ hasText: TITLES.trackC33333.title }).locator('.youtube-track-select').click();
  await page.waitForFunction(() => document.querySelector('.youtube-panel iframe[title="YouTube 동영상"]')?.src.includes('trackC33333'));

  // 7. Auto-advance when current video ends (onStateChange: 0)
  let trackCFrame = null;
  for (let i = 0; i < 40 && !trackCFrame; i++) {
    trackCFrame = page.frames().find((f) => f.url().includes('trackC33333'));
    if (!trackCFrame) await page.waitForTimeout(25);
  }
  await trackCFrame.evaluate(() => {
    parent.postMessage(JSON.stringify({ event: 'onStateChange', info: 0 }), '*');
  });
  await page.waitForFunction(() => document.querySelector('.youtube-panel iframe[title="YouTube 동영상"]')?.src.includes('extra555555'));

  // 8. Shuffle list ("랜덤 섞기") changes order without losing any tracks, and "원래 순서" restores
  const preShuffle = await items.locator('.youtube-track-title').allTextContents();
  await page.getByRole('button', { name: '랜덤 섞기', exact: true }).click();
  const postShuffle = await items.locator('.youtube-track-title').allTextContents();
  assert.notDeepEqual(postShuffle, preShuffle);
  assert.deepEqual([...postShuffle].sort(), [...preShuffle].sort());

  await page.getByRole('button', { name: '원래 순서', exact: true }).click();
  const restored = await items.locator('.youtube-track-title').allTextContents();
  assert.deepEqual(restored, preShuffle);

  // 9. Prev/Next controls work
  await page.getByRole('button', { name: '다음 곡', exact: true }).click();
  await page.waitForFunction(() => document.querySelector('.youtube-panel iframe[title="YouTube 동영상"]')?.src.includes('probeF66666'));
  await page.getByRole('button', { name: '이전 곡', exact: true }).click();
  await page.waitForFunction(() => document.querySelector('.youtube-panel iframe[title="YouTube 동영상"]')?.src.includes('extra555555'));

  // 10. Repeat toggle cycles through all -> one -> off
  const repeatBtn = page.getByRole('button', { name: '반복 모드 변경', exact: true });
  assert.equal(await repeatBtn.getAttribute('data-repeat'), 'all');
  await repeatBtn.click();
  assert.equal(await repeatBtn.getAttribute('data-repeat'), 'one');
  await repeatBtn.click();
  assert.equal(await repeatBtn.getAttribute('data-repeat'), 'off');

  // 11. Clear queue ("목록 비우기")
  await page.getByRole('button', { name: '목록 비우기', exact: true }).click();
  assert.equal(await items.count(), 0);
  assert.equal(await page.locator('.youtube-panel iframe[title="YouTube 동영상"]').count(), 0);

  console.log('PASS playlist auto-registration, manipulation, append, shuffle, restore, auto-advance and controls');
} finally {
  await browser.close();
}

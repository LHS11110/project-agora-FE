// Homepage motion-graphics showcase, real-canvas non-overlap, scroll-reveal, and bilingual regression test.
import assert from 'node:assert/strict';

const { chromium } = await import(process.env.AGORA_E2E_PLAYWRIGHT_MODULE || 'playwright-core');
const origin = process.env.AGORA_E2E_ORIGIN || 'https://localhost:5191';

const browser = await chromium.launch({
  executablePath: '/usr/bin/google-chrome',
  args: [
    '--no-sandbox',
    ...(process.env.AGORA_E2E_HOST_RESOLVER ? [`--host-resolver-rules=${process.env.AGORA_E2E_HOST_RESOLVER}`] : []),
  ],
});

const sceneLandmarks = [
  '.hms-s1-shape',
  '.hms-s2-executor',
  '.hms-voice-eq i',
  '.hms-s4-spotlight',
];

async function stubPublicApi(context) {
  await context.route((url) => url.pathname.startsWith('/api/'), (route) => {
    const pathname = new URL(route.request().url()).pathname;
    if (pathname === '/api/auth/me') {
      return route.fulfill({ status: 401, json: { error: 'unauthenticated' } });
    }
    return route.fulfill({ json: {} });
  });
}

async function assertSceneBoundsAndNonOverlap(page, label) {
  const report = await page.evaluate(() => {
    const stage = document.querySelector('#motion-showcase .hms-stage');
    const stageRect = stage.getBoundingClientRect();
    const cards = Array.from(document.querySelectorAll('#motion-showcase .hms-scene .hms-obj')).map((el) => ({
      cls: el.className,
      rect: el.getBoundingClientRect(),
    }));
    const outOfStage = [];
    const overlaps = [];

    for (const c of cards) {
      if (
        c.rect.left < stageRect.left - 1 ||
        c.rect.right > stageRect.right + 1 ||
        c.rect.top < stageRect.top - 1 ||
        c.rect.bottom > stageRect.bottom + 1
      ) {
        outOfStage.push({ cls: c.cls, rect: c.rect, stageRect });
      }
    }

    for (let i = 0; i < cards.length; i++) {
      for (let j = i + 1; j < cards.length; j++) {
        const a = cards[i].rect;
        const b = cards[j].rect;
        const disjoint = a.right <= b.left + 1 || b.right <= a.left + 1 || a.bottom <= b.top + 1 || b.bottom <= a.top + 1;
        if (!disjoint) {
          overlaps.push([cards[i].cls, cards[j].cls]);
        }
      }
    }

    const spotlight = document.querySelector('#motion-showcase .hms-s4-spotlight');
    let spotlightEscape = [];
    if (spotlight) {
      const sRect = spotlight.getBoundingClientRect();
      for (const sel of ['.hms-s4-code', '.hms-s4-chart']) {
        const child = spotlight.querySelector(sel);
        if (child) {
          const r = child.getBoundingClientRect();
          if (r.left < sRect.left - 1 || r.right > sRect.right + 1 || r.top < sRect.top - 1 || r.bottom > sRect.bottom + 1) {
            spotlightEscape.push({ sel, r, sRect });
          }
        }
      }
    }

    return { cardCount: cards.length, outOfStage, overlaps, spotlightEscape };
  });

  assert.ok(report.cardCount >= 2, `${label}: renders showcase objects`);
  assert.deepEqual(report.outOfStage, [], `${label}: objects stay inside canvas stage`);
  assert.deepEqual(report.overlaps, [], `${label}: objects do not overlap each other`);
  assert.deepEqual(report.spotlightEscape, [], `${label}: spotlight children stay inside spotlight frame`);
}

try {
  for (const mobile of [false, true]) {
    const viewport = mobile ? { width: 390, height: 844 } : { width: 1440, height: 900 };
    const context = await browser.newContext({
      viewport,
      ignoreHTTPSErrors: process.env.AGORA_E2E_INSECURE_LOCAL_TLS === '1',
      locale: 'ko-KR',
    });
    await stubPublicApi(context);
    await context.addInitScript(() => {
      window.sessionStorage.setItem('frelog.home-intro.v1', 'seen');
    });

    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (err) => errors.push(err.message));

    await page.goto(`${origin}/`, { waitUntil: 'networkidle' });
    await page.locator('#home-title').waitFor();

    // Hero live canvas preview animations without behind-card pulse balls and without overlapping cards
    assert.equal(await page.locator('.workspace-preview .wp-wire-pulse').count(), 0, 'hero preview has no behind-card flying wire pulses');
    assert.ok(await page.locator('.workspace-preview .wp-code-caret').count() > 0, 'hero preview code caret renders');
    assert.ok(await page.locator('.workspace-preview .wp-cursor').count() > 0, 'hero preview collaborator cursor renders');
    const heroOverlap = await page.evaluate(() => {
      const sels = ['.workspace-preview .wp-note', '.workspace-preview .wp-code', '.workspace-preview .wp-plan'];
      const rects = sels.map((s) => document.querySelector(s).getBoundingClientRect());
      const hits = [];
      for (let i = 0; i < rects.length; i++) {
        for (let j = i + 1; j < rects.length; j++) {
          const a = rects[i], b = rects[j];
          if (!(a.right <= b.left + 1 || b.right <= a.left + 1 || a.bottom <= b.top + 1 || b.bottom <= a.top + 1)) {
            hits.push([sels[i], sels[j]]);
          }
        }
      }
      return hits;
    });
    assert.deepEqual(heroOverlap, [], `${mobile ? 'mobile' : 'desktop'} hero preview cards do not overlap`);

    const showcase = page.locator('#motion-showcase');
    await showcase.scrollIntoViewIfNeeded();
    await page.waitForTimeout(450);

    const revealedCount = await showcase.locator('.home-reveal.is-revealed').count();
    assert.equal(revealedCount, await showcase.locator('.home-reveal').count(), 'all showcase blocks reveal');

    const layout = await page.evaluate(() => {
      const stage = document.querySelector('#motion-showcase .hms-stage');
      const frame = document.querySelector('#motion-showcase .hms-frame');
      const counter = document.querySelector('#motion-showcase .hms-scene-counter');
      const playToggle = document.querySelector('#motion-showcase .hms-play-toggle');
      const stageBox = stage?.getBoundingClientRect();
      const frameBox = frame?.getBoundingClientRect();
      return {
        scrollWidth: document.documentElement.scrollWidth,
        innerWidth: window.innerWidth,
        stageWidth: stageBox?.width || 0,
        frameWidth: frameBox?.width || 0,
        counterHeight: counter?.getBoundingClientRect().height || 0,
        playHeight: playToggle?.getBoundingClientRect().height || 0,
      };
    });
    assert.ok(layout.scrollWidth <= layout.innerWidth + 1, `${mobile ? 'mobile' : 'desktop'} no horizontal overflow`);
    assert.ok(layout.stageWidth <= layout.frameWidth + 1, `${mobile ? 'mobile' : 'desktop'} stage does not expand past frame`);
    assert.ok(layout.counterHeight <= 36 && layout.playHeight <= 36, `${mobile ? 'mobile' : 'desktop'} topbar pills stay single-line`);

    // Play / Pause control
    const playToggle = showcase.locator('.hms-play-toggle');
    const stage = showcase.locator('.hms-stage');
    assert.equal(await playToggle.getAttribute('aria-pressed'), 'true');
    assert.equal(await stage.evaluate((el) => el.classList.contains('is-paused')), false);

    await playToggle.click();
    assert.equal(await playToggle.getAttribute('aria-pressed'), 'false');
    assert.equal(await stage.evaluate((el) => el.classList.contains('is-paused')), true);

    await playToggle.click();
    assert.equal(await playToggle.getAttribute('aria-pressed'), 'true');
    assert.equal(await stage.evaluate((el) => el.classList.contains('is-paused')), false);

    // Chapter navigation across all 4 scenes with non-overlap & containment checks
    const tabs = showcase.locator('[role="tab"].hms-chapter');
    assert.equal(await tabs.count(), 4);
    for (let i = 0; i < 4; i++) {
      await tabs.nth(i).click();
      await page.waitForTimeout(220);
      assert.equal(await tabs.nth(i).getAttribute('aria-selected'), 'true');
      const counterText = await showcase.locator('.hms-scene-counter').innerText();
      assert.equal(counterText.trim(), `SCENE 0${i + 1} / 04`);
      assert.ok(await showcase.locator(sceneLandmarks[i]).count() > 0, `scene 0${i + 1} renders artwork`);
      await assertSceneBoundsAndNonOverlap(page, `${mobile ? 'mobile' : 'desktop'} scene 0${i + 1}`);
    }

    await page.locator('.home-start').scrollIntoViewIfNeeded();
    await page.waitForTimeout(350);
    assert.equal(
      await page.locator('.home-reveal.is-revealed').count(),
      await page.locator('.home-reveal').count(),
      'all homepage sections reveal cleanly'
    );
    assert.equal(await page.locator('.home-team-demo-cursor').count(), 1);
    assert.ok(await page.locator('.home-start-drawing svg path').count() > 0);
    const mentionAlignment = await page.evaluate(() => {
      const box = document.querySelector('#collaboration .home-team-comment').getBoundingClientRect();
      const avatar = document.querySelector('#collaboration .home-team-comment .home-team-avatar').getBoundingClientRect();
      const text = document.querySelector('#collaboration .home-team-comment p').getBoundingClientRect();
      return {
        topGapAvatar: avatar.top - box.top,
        bottomGapAvatar: box.bottom - avatar.bottom,
        leftGapAvatar: avatar.left - box.left,
        topGapText: text.top - box.top,
        bottomGapText: box.bottom - text.bottom,
        centerDelta: Math.abs((avatar.top + avatar.height / 2) - (text.top + text.height / 2)),
      };
    });
    assert.ok(
      mentionAlignment.topGapAvatar >= 8 &&
        mentionAlignment.bottomGapAvatar >= 8 &&
        mentionAlignment.leftGapAvatar >= 10 &&
        Math.abs(mentionAlignment.topGapAvatar - mentionAlignment.bottomGapAvatar) <= 2,
      `${mobile ? 'mobile' : 'desktop'} mention avatar sits evenly centered inside highlight box`
    );
    assert.ok(
      mentionAlignment.topGapText >= 8 && mentionAlignment.bottomGapText >= 8 && mentionAlignment.centerDelta <= 2,
      `${mobile ? 'mobile' : 'desktop'} mention text aligns cleanly with avatar`
    );

    const footer = page.locator('footer.home-site-footer');
    await footer.scrollIntoViewIfNeeded();
    const footerText = await footer.innerText();
    assert.ok(footerText.includes('FreLog Studio'), `${mobile ? 'mobile' : 'desktop'} footer includes studio name`);
    assert.ok(await footer.locator('a[href="/terms"]').count(), `${mobile ? 'mobile' : 'desktop'} footer links /terms`);
    assert.ok(await footer.locator('a[href="/privacy"]').count(), `${mobile ? 'mobile' : 'desktop'} footer links /privacy`);
    assert.ok(await footer.locator('a[href="/docs"]').count(), `${mobile ? 'mobile' : 'desktop'} footer links /docs`);

    // Desktop English locale toggle check
    if (!mobile) {
      await page.locator('header.home-scroll-header').scrollIntoViewIfNeeded();
      await page.getByLabel('언어 / Language').selectOption('en');
      await showcase.scrollIntoViewIfNeeded();
      await page.waitForTimeout(150);
      for (let i = 0; i < 4; i++) {
        await tabs.nth(i).click();
        const showcaseText = await showcase.innerText();
        assert.equal(/[가-힣]/.test(showcaseText), false, `English showcase scene 0${i + 1} contains no untranslated Hangul`);
      }
      assert.ok((await showcase.innerText()).includes('From raw idea to live output,'));
      const footerEn = await footer.innerText();
      assert.equal(/[가-힣]/.test(footerEn), false, 'English footer contains no untranslated Hangul');
    }

    assert.deepEqual(errors, [], `${mobile ? 'mobile' : 'desktop'}: zero runtime pageerrors`);
    await context.close();
  }

  // Fresh visit intro gating test
  const freshContext = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    ignoreHTTPSErrors: process.env.AGORA_E2E_INSECURE_LOCAL_TLS === '1',
    locale: 'ko-KR',
  });
  await stubPublicApi(freshContext);
  const freshPage = await freshContext.newPage();
  await freshPage.goto(`${origin}/`, { waitUntil: 'networkidle' });
  const skipBtn = freshPage.locator('.home-cinematic-intro button');
  if (await skipBtn.count()) {
    assert.equal(await freshPage.locator('#motion-showcase .hms-stage.is-paused').count(), 1, 'showcase stays paused during intro');
    await skipBtn.click();
    await freshPage.waitForSelector('.home-cinematic-intro', { state: 'detached', timeout: 3000 });
  }
  await freshPage.locator('#motion-showcase').scrollIntoViewIfNeeded();
  await freshPage.waitForTimeout(250);
  assert.equal(await freshPage.locator('#motion-showcase .hms-stage.is-paused').count(), 0, 'showcase runs after intro dismissed');
  await freshContext.close();

  console.log('PASS home-motion-showcase desktop, mobile, non-overlap, i18n, and intro gating');
} finally {
  await browser.close();
}

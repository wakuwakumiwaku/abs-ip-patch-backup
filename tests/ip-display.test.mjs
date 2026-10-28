import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { after, before, test } from 'node:test';

// Run the actual standalone script, never a copy of its implementation.
const source = await readFile(new URL('../ip-display.js', import.meta.url), 'utf8');
const playwright = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const browserType = process.env.BROWSER_TYPE || 'chromium';
let browser;

before(async () => {
  browser = await playwright[browserType].launch({
    headless: true,
    ...(process.env.BROWSER_EXECUTABLE ? { executablePath: process.env.BROWSER_EXECUTABLE } : {})
  });
}, { timeout: 30000 });

after(async () => {
  await browser?.close();
});

async function fixture(t, html, { host = 'badge-fixture.invalid', beforeBody = false } = {}) {
  const context = await browser.newContext({ serviceWorkers: 'block' });
  t.after(() => context.close());
  const errors = [];
  const requests = [];
  const page = await context.newPage();
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => {
    if (message.type() === 'error') errors.push(message.text());
  });
  await page.addInitScript(() => {
    const NativeObserver = window.MutationObserver;
    window.badgeHarness = { callbacks: 0, loopTripped: false, scriptErrors: [] };
    // A broken reconciliation loop must fail, not starve the browser forever.
    window.MutationObserver = class extends NativeObserver {
      constructor(callback) {
        super((records, observer) => {
          window.badgeHarness.callbacks++;
          if (window.badgeHarness.callbacks > 100) {
            window.badgeHarness.loopTripped = true;
            observer.disconnect();
            return;
          }
          callback(records, observer);
        });
      }
    };
  });
  const url = `http://${host}/ip-badge-fixture`;
  // Intercept the entire synthetic document; no server or real network is used.
  await context.route('**/*', async route => {
    if (route.request().url() === url && route.request().isNavigationRequest()) {
      // Catch synchronous bootstrap errors in-page as well as pageerror events.
      // This also works with Firefox drivers that cannot decode an empty error stack.
      const head = beforeBody ? `<script>try {\n${source.replaceAll('</script', '<\\/script')}\n} catch (error) { window.badgeHarness.scriptErrors.push(error.message); }</script>` : '';
      await route.fulfill({ contentType: 'text/html', body: `<!doctype html><head>${head}</head><body>${html}</body>` });
    } else {
      requests.push(route.request().url());
      await route.abort();
    }
  });
  await page.goto(url);
  if (!beforeBody) await page.evaluate(source);
  return { page, errors, requests };
}

async function settled(fixture) {
  const { page, errors, requests } = fixture;
  // Allow the application's mutation and the patcher's own child mutation to drain.
  await page.waitForTimeout(30);
  const first = await page.evaluate(() => ({ ...window.badgeHarness }));
  await page.waitForTimeout(30);
  const last = await page.evaluate(() => ({ ...window.badgeHarness }));
  assert.equal(last.loopTripped, false, 'badge observer must not loop');
  assert.deepEqual(last.scriptErrors, [], 'no standalone bootstrap errors');
  assert.equal(last.callbacks, first.callbacks, 'observer callbacks must reach quiescence');
  assert.deepEqual(errors, [], 'no browser exceptions or console errors');
  assert.deepEqual(requests, [], 'fixture must not attempt external requests');
  return last;
}

async function badges(page, id = 'target') {
  return page.locator(`#${id} > .injected-ip-display`).allTextContents();
}

async function primedFixture(t, html = '<h1 id="target">Audiobookshelf</h1>') {
  const f = await fixture(t, html);
  // Baseline also gets its initial scan, so repair tests reach the stale-marker bug.
  await f.page.evaluate(() => document.body.appendChild(document.createComment('application render')));
  await settled(f);
  assert.deepEqual(await badges(f.page), ['badge-fixture.invalid'], 'repair precondition: badge exists');
  await f.page.evaluate(() => { window.originalBadge = document.querySelector('#target > .injected-ip-display'); });
  return f;
}

test('patches existing heading immediately without a later application mutation', async t => {
  const f = await fixture(t, '<h1 id="target">Audiobookshelf</h1>');
  await settled(f);
  assert.deepEqual(await badges(f.page), ['badge-fixture.invalid']);
  assert.deepEqual(await f.page.locator('#target').evaluate(el => ({
    display: el.style.display, alignItems: el.style.alignItems
  })), { display: 'flex', alignItems: 'center' });
});

test('can execute in the head before document.body exists', async t => {
  const f = await fixture(t, '<h1 id="target">Audiobookshelf</h1>', { beforeBody: true });
  await settled(f);
  assert.deepEqual(await badges(f.page), ['badge-fixture.invalid']);
});

test('preserves matching selectors, case-insensitive text and nonmatching controls', async t => {
  const f = await fixture(t, `
    <h1 id="heading">Welcome to AUDIOBOOKSHELF</h1>
    <div class="logo-text" id="logo">Audiobookshelf</div>
    <div class="brand" id="brand">Audiobookshelf</div>
    <a class="navbar-brand" id="link">Audiobookshelf</a>
    <div class="server-name" id="server">Audiobookshelf</div>
    <h1 id="other-heading">Other server</h1>
    <div class="brand" id="other-brand">Other server</div>
    <h2 id="other-tag">Audiobookshelf</h2>
    <div class="navbar-brand" id="not-link">Audiobookshelf</div>`);
  // Exercise selector controls independent of initialization behavior.
  await f.page.evaluate(() => document.body.appendChild(document.createComment('render')));
  await settled(f);
  for (const id of ['heading', 'logo', 'brand', 'link', 'server']) {
    assert.deepEqual(await badges(f.page, id), ['badge-fixture.invalid'], id);
  }
  for (const id of ['other-heading', 'other-brand', 'other-tag', 'not-link']) {
    assert.deepEqual(await badges(f.page, id), [], id);
    assert.equal(await f.page.locator(`#${id}`).getAttribute('style'), null, id);
  }
  assert.equal(await f.page.locator('#brand').evaluate(el => el.style.alignItems), 'flex-start');
});

test('patches a matching target inserted after initialization', async t => {
  const f = await fixture(t, '<main></main>');
  await f.page.evaluate(() => {
    const target = document.createElement('h1');
    target.id = 'target';
    target.textContent = 'Audiobookshelf';
    document.querySelector('main').appendChild(target);
  });
  await settled(f);
  assert.deepEqual(await badges(f.page), ['badge-fixture.invalid']);
});

test('repairs an explicitly removed badge despite the old dataset marker', async t => {
  const f = await primedFixture(t);
  await f.page.evaluate(() => {
    document.querySelector('#target').dataset.ipPatched = 'true';
    window.originalBadge.remove();
  });
  await settled(f);
  assert.deepEqual(await badges(f.page), ['badge-fixture.invalid']);
});

test('repairs a native child replacement on the same target', async t => {
  const f = await primedFixture(t);
  await f.page.evaluate(() => {
    const title = document.createElement('span');
    title.textContent = 'Audiobookshelf';
    document.querySelector('#target').replaceChildren(title);
  });
  await settled(f);
  assert.deepEqual(await badges(f.page), ['badge-fixture.invalid']);
  assert.equal(await f.page.locator('#target > span').textContent(), 'Audiobookshelf');
});

test('repairs a replacement target carrying a stale dataset marker', async t => {
  const f = await primedFixture(t);
  await f.page.evaluate(() => {
    const target = document.querySelector('#target');
    const replacement = target.cloneNode(false);
    replacement.dataset.ipPatched = 'true';
    replacement.textContent = 'Audiobookshelf';
    target.replaceWith(replacement);
  });
  await settled(f);
  assert.deepEqual(await badges(f.page), ['badge-fixture.invalid']);
});

test('does not trust an initial stale marker as badge presence', async t => {
  const f = await fixture(t, '<h1 id="target" data-ip-patched="true">Audiobookshelf</h1>');
  await f.page.evaluate(() => document.body.appendChild(document.createComment('render')));
  await settled(f);
  assert.deepEqual(await badges(f.page), ['badge-fixture.invalid']);
});

test('deduplicates owned direct-child badges while retaining the original', async t => {
  const f = await primedFixture(t);
  await f.page.evaluate(() => {
    const target = document.querySelector('#target');
    target.appendChild(window.originalBadge.cloneNode(true));
    target.appendChild(window.originalBadge.cloneNode(true));
  });
  await settled(f);
  assert.deepEqual(await badges(f.page), ['badge-fixture.invalid']);
  assert.equal(await f.page.evaluate(() => document.querySelector('#target > .injected-ip-display') === window.originalBadge), true);
});

test('repairs a replaced badge containing stale text', async t => {
  const f = await primedFixture(t);
  await f.page.evaluate(() => {
    const replacement = window.originalBadge.cloneNode(false);
    replacement.textContent = 'stale address';
    window.originalBadge.replaceWith(replacement);
  });
  await settled(f);
  assert.deepEqual(await badges(f.page), ['badge-fixture.invalid']);
});

test('repeated unrelated mutations reuse one badge and callbacks settle', async t => {
  const f = await primedFixture(t);
  for (let i = 0; i < 12; i++) {
    await f.page.evaluate(() => {
      const unrelated = document.createElement('span');
      document.body.appendChild(unrelated);
      unrelated.remove();
    });
    await settled(f);
    assert.deepEqual(await badges(f.page), ['badge-fixture.invalid']);
    assert.equal(await f.page.evaluate(() => document.querySelector('#target > .injected-ip-display') === window.originalBadge), true);
  }
});

test('nested matching targets keep independent direct-child badges', async t => {
  const f = await fixture(t, '<div id="outer" class="brand"><h1 id="target">Audiobookshelf</h1></div>');
  await f.page.evaluate(() => document.body.appendChild(document.createComment('render')));
  await settled(f);
  assert.deepEqual(await badges(f.page), ['badge-fixture.invalid']);
  assert.deepEqual(await badges(f.page, 'outer'), ['badge-fixture.invalid']);
  await f.page.locator('#target > .injected-ip-display').evaluate(el => el.remove());
  await settled(f);
  assert.deepEqual(await badges(f.page), ['badge-fixture.invalid']);
  assert.deepEqual(await badges(f.page, 'outer'), ['badge-fixture.invalid']);
});

test('observes a Vue-style characterData update that makes a target match', async t => {
  const f = await fixture(t, '<h1 id="target">Loading</h1>');
  await settled(f);
  assert.deepEqual(await badges(f.page), []);
  await f.page.evaluate(() => { document.querySelector('#target').firstChild.data = 'Audiobookshelf'; });
  await settled(f);
  assert.deepEqual(await badges(f.page), ['badge-fixture.invalid']);
});

for (const [host, expected] of [
  ['localhost', '192.168.1.32'],
  ['127.0.0.1', '192.168.1.32'],
  ['192.0.2.42', '192.0.2.42'],
  ['books.example', 'books.example']
]) {
  test(`preserves hostname/fallback display for ${host}`, async t => {
    const f = await fixture(t, '<h1 id="target">Audiobookshelf</h1>', { host });
    await f.page.evaluate(() => document.body.appendChild(document.createComment('render')));
    await settled(f);
    assert.deepEqual(await badges(f.page), [expected]);
  });
}

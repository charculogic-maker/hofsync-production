#!/usr/bin/env node
/**
 * iPhone portrait: /dev-dashboard must scroll inside .app-content.
 * Landscape (>768px) already used document scroll; portrait froze (html/body overflow:hidden).
 */
import { chromium } from 'playwright';
import { writeFile } from 'node:fs/promises';

const BASE_URL = 'http://127.0.0.1:5173/index.html?v=admin-portrait-scroll';

async function openDashboard(page) {
  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.addStyleTag({
    content: '#auth-lock-screen,#auth-lock-screen.active,#dev-dashboard-boot-fallback{display:none!important;pointer-events:none!important;}',
  });
  return page.evaluate(() => {
    document.getElementById('auth-lock-screen')?.remove();
    document.getElementById('dev-dashboard-boot-fallback')?.remove();
    history.replaceState({}, '', '/dev-dashboard');
    document.documentElement.classList.add('is-dev-dashboard-html');
    document.body.classList.add('is-dev-dashboard');
    document.body.classList.remove('app-shell-sidebar', 'dev-dashboard-view');
    document.body.hidden = false;
    document.querySelectorAll('.page').forEach((pageEl) => {
      const active = pageEl.id === 'page-dev-dashboard';
      pageEl.classList.toggle('active', active);
      pageEl.hidden = !active;
      pageEl.style.display = active ? 'block' : 'none';
    });
    const shell = document.querySelector('.dev-dashboard-shell');
    if (shell) {
      const filler = document.createElement('div');
      filler.id = 'portrait-scroll-probe';
      filler.style.height = '2200px';
      filler.style.background = 'linear-gradient(#fff,#dbeafe)';
      filler.innerHTML = '<button type="button" id="portrait-scroll-target" style="margin-top:1800px;min-height:48px;width:100%;">Ziel unten</button>';
      shell.appendChild(filler);
    }
    const appContent = document.getElementById('app-content');
    const cs = (el) => (el ? getComputedStyle(el) : null);
    const htmlCs = cs(document.documentElement);
    const bodyCs = cs(document.body);
    const frameCs = cs(document.querySelector('.iphone-frame'));
    const contentCs = cs(appContent);
    return {
      htmlOverflow: htmlCs?.overflow || '',
      bodyOverflow: bodyCs?.overflow || '',
      frameOverflow: frameCs?.overflow || '',
      contentOverflowY: contentCs?.overflowY || '',
      contentClientHeight: appContent?.clientHeight || 0,
      contentScrollHeight: appContent?.scrollHeight || 0,
      pageHeight: document.getElementById('page-dev-dashboard')?.scrollHeight || 0,
    };
  });
}

async function assertScrollable(page, label) {
  const metrics = await page.evaluate(async () => {
    const appContent = document.getElementById('app-content');
    if (!appContent) return { ok: false, reason: 'app-content missing' };
    const before = Math.max(appContent.scrollTop, window.scrollY || 0);
    appContent.scrollTop = 1400;
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    let via = 'app-content';
    let after = appContent.scrollTop;
    if (after < 400) {
      window.scrollTo(0, 1400);
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      via = 'window';
      after = window.scrollY || document.documentElement.scrollTop || 0;
    }
    const target = document.getElementById('portrait-scroll-target');
    const rect = target?.getBoundingClientRect();
    const inView = Boolean(rect && rect.top < window.innerHeight && rect.bottom > 0);
    return {
      ok: after > before && after >= 400,
      via,
      before,
      after,
      clientHeight: appContent.clientHeight,
      scrollHeight: appContent.scrollHeight,
      overflowY: getComputedStyle(appContent).overflowY,
      inView,
      targetTop: rect?.top ?? null,
    };
  });
  if (!metrics.ok) {
    throw new Error(`${label} scroll failed: ${JSON.stringify(metrics)}`);
  }
  return metrics;
}

const browser = await chromium.launch();
const portrait = await browser.newPage({
  viewport: { width: 390, height: 844 },
  isMobile: true,
  hasTouch: true,
});
const portraitBefore = await openDashboard(portrait);
const portraitScroll = await assertScrollable(portrait, 'portrait');
await portrait.screenshot({
  path: '/opt/cursor/artifacts/admin-portrait-scrolled.png',
  fullPage: false,
});

const landscape = await browser.newPage({
  viewport: { width: 844, height: 390 },
  isMobile: true,
  hasTouch: true,
});
const landscapeBefore = await openDashboard(landscape);
const landscapeScroll = await assertScrollable(landscape, 'landscape');
await landscape.screenshot({
  path: '/opt/cursor/artifacts/admin-landscape-scrolled.png',
  fullPage: false,
});

const result = {
  portraitBefore,
  portraitScroll,
  landscapeBefore,
  landscapeScroll,
  pass: portraitScroll.ok
    && portraitScroll.via === 'app-content'
    && portraitScroll.inView
    && landscapeScroll.ok,
};
await writeFile('/opt/cursor/artifacts/admin-portrait-scroll-results.json', `${JSON.stringify(result, null, 2)}\n`);
console.log(JSON.stringify(result, null, 2));
if (!result.pass) {
  await browser.close();
  process.exit(1);
}
await browser.close();
console.log('Admin portrait scroll check passed.');

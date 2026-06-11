#!/usr/bin/env node
import { chromium } from 'playwright';

const browser = await chromium.launch();
const page = await browser.newPage({
  viewport: { width: 390, height: 844 },
  isMobile: true,
  hasTouch: true,
});
await page.goto('http://127.0.0.1:5173/index.html?v=52', { waitUntil: 'domcontentloaded' });
await page.evaluate(() => {
  const lock = document.getElementById('auth-lock-screen');
  if (lock) {
    lock.style.display = 'none';
    lock.classList.remove('active');
  }
});
await page.locator('#tab-mhd').click({ force: true });
await page.evaluate(() => {
  const c = document.getElementById('mhd-items-container');
  c.innerHTML =
    '<div class="mhd-card"><div class="mhd-action-row"><button class="btn-mhd-action btn-mhd-action--primary" type="button">OK</button></div></div>';
});
const result = await page.evaluate(() => {
  const save = document.getElementById('btn-save-mhd');
  const ok = document.querySelector('.btn-mhd-action--primary');
  const bar = save.closest('.sticky-action-bar');
  const sr = save.getBoundingClientRect();
  const or = ok.getBoundingClientRect();
  return {
    barPosition: getComputedStyle(bar).position,
    overlaps: sr.top < or.bottom - 2,
    saveTop: Math.round(sr.top),
    okBottom: Math.round(or.bottom),
    listPad: getComputedStyle(document.getElementById('mhd-items-container')).paddingBottom,
  };
});
console.log(result);
if (result.overlaps) process.exit(1);
await browser.close();

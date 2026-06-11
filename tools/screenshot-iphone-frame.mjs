/**
 * Legt Screenshots in ein iPhone-14-ähnliches Geräterahmen-Mockup.
 * Nur Playwright — keine zusätzlichen Bild-Bibliotheken.
 */

/**
 * @param {import('playwright').BrowserContext} context
 * @param {Buffer} screenshotBuffer
 * @param {{ label?: string }} [options]
 * @returns {Promise<Buffer>}
 */
export async function wrapInIphoneFrame(context, screenshotBuffer, options = {}) {
  const framePage = await context.newPage();
  const screenshotBase64 = screenshotBuffer.toString('base64');
  const label = options.label ? String(options.label) : '';

  await framePage.setViewportSize({ width: 480, height: 980 });
  await framePage.setContent(`<!DOCTYPE html>
<html lang="de">
<head>
<meta charset="utf-8">
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  html, body {
    width: 480px;
    height: 980px;
    background: radial-gradient(circle at 50% 0%, #3a3a3c 0%, #111112 58%);
    font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", sans-serif;
  }
  .stage {
    width: 480px;
    height: 980px;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 28px 24px 34px;
  }
  .device {
    position: relative;
    width: 390px;
    padding: 14px 12px 18px;
    border-radius: 52px;
    background: linear-gradient(145deg, #3d3d40 0%, #1d1d1f 42%, #101012 100%);
    box-shadow:
      0 28px 60px rgba(0, 0, 0, 0.55),
      inset 0 0 0 1px rgba(255, 255, 255, 0.08),
      inset 0 1px 0 rgba(255, 255, 255, 0.12);
  }
  .device::before,
  .device::after {
    content: "";
    position: absolute;
    background: rgba(255, 255, 255, 0.08);
    border-radius: 2px;
  }
  .device::before {
    left: -2px;
    top: 118px;
    width: 3px;
    height: 56px;
  }
  .device::after {
    right: -2px;
    top: 154px;
    width: 3px;
    height: 78px;
  }
  .screen-shell {
    position: relative;
    width: 366px;
    height: 792px;
    border-radius: 42px;
    overflow: hidden;
    background: #000;
    box-shadow: inset 0 0 0 2px rgba(0, 0, 0, 0.65);
  }
  .dynamic-island {
    position: absolute;
    top: 12px;
    left: 50%;
    transform: translateX(-50%);
    width: 118px;
    height: 34px;
    border-radius: 20px;
    background: #000;
    z-index: 3;
    box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.04);
  }
  .screen-shot {
    width: 366px;
    height: 792px;
    object-fit: cover;
    object-position: top center;
    display: block;
  }
  .home-indicator {
    position: absolute;
    left: 50%;
    bottom: 10px;
    transform: translateX(-50%);
    width: 132px;
    height: 5px;
    border-radius: 999px;
    background: rgba(255, 255, 255, 0.82);
    z-index: 3;
    pointer-events: none;
  }
  .device-label {
    position: absolute;
    left: 0;
    right: 0;
    bottom: -22px;
    text-align: center;
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.04em;
    color: rgba(255, 255, 255, 0.42);
    text-transform: uppercase;
  }
</style>
</head>
<body>
  <div class="stage">
    <div class="device">
      <div class="screen-shell">
        <div class="dynamic-island" aria-hidden="true"></div>
        <img class="screen-shot" alt="" src="data:image/png;base64,${screenshotBase64}">
        <div class="home-indicator" aria-hidden="true"></div>
      </div>
      ${label ? `<div class="device-label">${label.replace(/</g, '&lt;')}</div>` : ''}
    </div>
  </div>
</body>
</html>`, { waitUntil: 'load' });

  await framePage.waitForTimeout(120);
  const framed = await framePage.screenshot({ type: 'png' });
  await framePage.close();
  return framed;
}

/**
 * @param {import('playwright').Page} page
 * @param {{ fullPage?: boolean, clip?: import('playwright').PageScreenshotOptions['clip'] }} [options]
 * @returns {Promise<Buffer>}
 */
export async function captureViewportScreenshot(page, options = {}) {
  return page.screenshot({
    type: 'png',
    fullPage: options.fullPage === true,
    clip: options.clip,
  });
}

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const html = readFileSync(join(root, 'web/index.html'), 'utf8');
const js = readFileSync(join(root, 'web/customer-orders.js'), 'utf8');
const fn = readFileSync(join(root, 'functions/orderNotifications.js'), 'utf8');

describe('Packtisch Ready-Sicherheitsnetz', () => {
  it('hängt Bestätigungs-Modal mit Abholbereit-Frage ein', () => {
    assert.match(html, /id="order-notify-modal"/);
    assert.match(html, /Bestellung wirklich abholbereit\?/);
    assert.match(html, /id="order-notify-email"/);
    assert.match(html, /Abholbereit ohne Nachricht/);
    assert.match(html, /Abholbereit &amp; benachrichtigen/);
  });

  it('leitet Ready über Modal und schreibt Aktionsprotokoll', () => {
    assert.match(js, /requestMarkOrderReady/);
    assert.match(js, /openOrderNotifyModal/);
    assert.match(js, /actionLog/);
    assert.match(js, /renderOrderActionLog/);
    assert.match(js, /ready_no_notify/);
    assert.match(js, /Bestellung wirklich abholbereit/);
  });

  it('Backend respektiert skipNotify', () => {
    assert.match(fn, /wantsAnyReadyNotify/);
    assert.match(fn, /skipNotify === true/);
    assert.match(fn, /skipped: true/);
  });

  it('erlaubt Bestellbearbeitung mit Protokoll-Eintrag', () => {
    assert.match(html, /id="order-edit-modal"/);
    assert.match(html, /id="order-edit-form"/);
    assert.match(html, /Änderungen speichern/);
    assert.match(js, /openOrderEditModal/);
    assert.match(js, /saveOrderEditFromModal/);
    assert.match(js, /data-order-action="edit"/);
    assert.match(js, /edited_reopen/);
    assert.match(js, /Bestellung bearbeitet/);
    assert.match(js, /actionLog:\s*nextLog/);
  });
});

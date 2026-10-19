/**
 * Kundenbestellungen: Create-/Status-Felder müssen zu firebase.rules hasOnly passen.
 */
import { expect } from 'chai';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ordersJs = fs.readFileSync(path.join(root, 'web/customer-orders.js'), 'utf8');
const rules = fs.readFileSync(path.join(root, 'firebase.rules'), 'utf8');

function extractStringArray(source, constName) {
  const match = source.match(new RegExp(`const ${constName} = Object\\.freeze\\(\\[([\\s\\S]*?)\\]\\)`));
  expect(match, `${constName} fehlt`).to.be.ok;
  return [...match[1].matchAll(/'([^']+)'/g)].map((m) => m[1]);
}

describe('Kundenbestellungen Rules-Payload Alignment', () => {
  it('CUSTOMER_ORDER_CREATE_FIELDS matched firebase.rules create hasOnly', () => {
    const fields = extractStringArray(ordersJs, 'CUSTOMER_ORDER_CREATE_FIELDS');
    const block = rules.match(
      /match \/tenants\/\{tenantId\}\/customerOrders\/\{orderId\}[\s\S]*?allow create: if[\s\S]*?hasOnly\(\[([\s\S]*?)\]\)/,
    )?.[1] || '';
    expect(block, 'Rules create hasOnly fehlt').to.be.ok;
    const ruleFields = [...block.matchAll(/'([^']+)'/g)].map((m) => m[1]);
    expect(fields.slice().sort()).to.deep.equal(ruleFields.slice().sort());
    expect(fields).to.include.members([
      'acceptedBy',
      'readyAt',
      'status',
      'tenantId',
      'createdAt',
      'items',
    ]);
    expect(fields).to.not.include('employeeName');
  });

  it('CUSTOMER_ORDER_STATUS_UPDATE_FIELDS matched isCustomerOrderStatusUpdate', () => {
    const fields = extractStringArray(ordersJs, 'CUSTOMER_ORDER_STATUS_UPDATE_FIELDS');
    const block = rules.match(
      /function isCustomerOrderStatusUpdate\(\)[\s\S]*?affectedKeys\(\)\s*\.hasOnly\(\[([\s\S]*?)\]\)/,
    )?.[1] || '';
    expect(block, 'Rules status update hasOnly fehlt').to.be.ok;
    const ruleFields = [...block.matchAll(/'([^']+)'/g)].map((m) => m[1]);
    expect(fields.slice().sort()).to.deep.equal(ruleFields.slice().sort());
    expect(fields).to.not.include('employeeName');
  });

  it('createOrderFromForm loggt ungeschnittene Schreibfehler', () => {
    expect(ordersJs).to.include("console.error('[Orders] Schreibfehler:', error)");
    expect(ordersJs).to.match(/status:\s*'open'/);
    expect(ordersJs).to.match(/FieldValue\.serverTimestamp\(\)/);
  });
});

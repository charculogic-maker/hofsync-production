/**
 * Packtisch Create-Payload muss zu firebase.rules customerOrders passen.
 * Soft-Launch: isEmployeeOrAdmin ohne hasOnly – employeeName darf mitgeschrieben werden.
 */
import { expect } from 'chai';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const rules = fs.readFileSync(path.join(root, 'firebase.rules'), 'utf8');
const orders = fs.readFileSync(path.join(root, 'web/customer-orders.js'), 'utf8');

describe('customerOrders rules alignment', () => {
  it('erlaubt create/update nur über isEmployeeOrAdmin (kein hasOnly-Schema)', () => {
    expect(rules).to.match(
      /match \/tenants\/\{tenantId\}\/customerOrders\/\{orderId\}[\s\S]*?allow read, create, update: if isEmployeeOrAdmin\(tenantId\);/,
    );
    expect(rules).to.not.match(/function hasCustomerContact\s*\(/);
    expect(rules).to.not.match(/function isCustomerOrderStatusUpdate\s*\(/);
  });

  it('Create-Payload schreibt employeeName (außerhalb der alten Allowlist)', () => {
    expect(orders).to.match(/employeeName:\s*employee/);
    expect(orders).to.match(/collectionPath:\s*'customerOrders'/);
  });
});

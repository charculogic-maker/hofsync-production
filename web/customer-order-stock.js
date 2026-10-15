function toPositiveNumber(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric > 0 ? numeric : 0;
}

function roundThree(value) {
  return Math.round(value * 1000) / 1000;
}

export function mergeStockDeductions(deductions = []) {
  const mergedByRef = new Map();

  for (const deduction of deductions) {
    const ref = deduction?.ref;
    const key = String(ref?.path || ref?.id || '').trim();
    const amount = toPositiveNumber(deduction?.amount);
    if (!key || !amount) continue;

    const existing = mergedByRef.get(key);
    if (existing) {
      existing.amount = roundThree(existing.amount + amount);
      if (deduction.product && !existing.product.includes(deduction.product)) {
        existing.product = `${existing.product}, ${deduction.product}`;
      }
      continue;
    }

    mergedByRef.set(key, {
      ...deduction,
      ref,
      amount,
      product: deduction.product || 'Artikel',
    });
  }

  return Array.from(mergedByRef.values());
}

export function calculateNextStockOrThrow(currentStock, amount, product = 'Artikel') {
  const stock = Number(currentStock);
  const deduction = toPositiveNumber(amount);
  if (!Number.isFinite(stock)) {
    throw new Error(`Bestand für ${product} ist nicht lesbar.`);
  }
  if (!deduction) {
    throw new Error(`Abzugsmenge für ${product} fehlt.`);
  }
  if (stock + 0.0001 < deduction) {
    throw new Error(`Nicht genug Bestand für ${product}.`);
  }
  return roundThree(stock - deduction);
}

function toFiniteNumber(value, fallback = 0) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function roundTwo(value) {
  return Math.round(value * 100) / 100;
}

export function mergeDeliveryMhdRecords(records = []) {
  const mergedById = new Map();

  for (const record of records) {
    if (!record || !record.id) continue;

    const qtyFrom = toFiniteNumber(record._qtyFrom);
    const mengeFrom = toFiniteNumber(record._mengeFrom, qtyFrom);
    const qtyIncrement = toFiniteNumber(record._qtyIncrement);
    const mengeIncrement = toFiniteNumber(record._mengeIncrement, qtyIncrement);
    const existing = mergedById.get(record.id);

    if (!existing) {
      const initial = {
        ...record,
        _qtyFrom: qtyFrom,
        _mengeFrom: mengeFrom,
        _qtyIncrement: qtyIncrement,
        _mengeIncrement: mengeIncrement,
      };
      initial.qty = roundTwo(qtyFrom + qtyIncrement);
      initial.menge = roundTwo(mengeFrom + mengeIncrement);
      initial.eingangMenge = initial.menge;
      mergedById.set(record.id, initial);
      continue;
    }

    existing._qtyIncrement = roundTwo(toFiniteNumber(existing._qtyIncrement) + qtyIncrement);
    existing._mengeIncrement = roundTwo(toFiniteNumber(existing._mengeIncrement) + mengeIncrement);
    existing.qty = roundTwo(toFiniteNumber(existing._qtyFrom) + existing._qtyIncrement);
    existing.menge = roundTwo(toFiniteNumber(existing._mengeFrom) + existing._mengeIncrement);
    existing.eingangMenge = existing.menge;
  }

  return Array.from(mergedById.values());
}

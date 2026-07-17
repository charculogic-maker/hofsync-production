export function findRejectedDeliveryItemWrite(results = []) {
  if (!Array.isArray(results)) return null;
  const rejected = results.find((result) => result?.status === 'rejected');
  return rejected ? rejected.reason || new Error('MHD-Posten konnte nicht gespeichert werden.') : null;
}

export function assertDeliveryItemWritesSucceeded(results = []) {
  const reason = findRejectedDeliveryItemWrite(results);
  if (!reason) return;
  if (reason instanceof Error) throw reason;
  throw new Error('Mindestens ein MHD-Posten konnte nicht gespeichert werden.');
}

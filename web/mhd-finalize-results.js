export function summarizeDeliveryFinalizeResults(deliveryResult, mhdResults = []) {
  const settledResults = Array.isArray(mhdResults) ? mhdResults : [];
  const rejectedMhdWrites = settledResults.filter((result) => result?.status === 'rejected');
  const hasQueuedWrites = deliveryResult === 'queued'
    || settledResults.some((result) => result?.status === 'fulfilled' && result.value === 'queued');

  return {
    hasQueuedWrites,
    rejectedMhdWrites,
  };
}

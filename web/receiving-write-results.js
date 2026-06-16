export function requireSettledWriteFulfilled(result, message) {
  if (result?.status === 'fulfilled') {
    return result.value;
  }

  const error = new Error(message);
  if (result?.reason) {
    error.cause = result.reason;
  }
  throw error;
}

export function requireAllSettledWritesFulfilled(results, message) {
  return results.map((result) => requireSettledWriteFulfilled(result, message));
}

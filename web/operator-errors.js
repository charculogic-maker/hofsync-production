/**
 * Operator-facing German error messages — raw technical details stay in console.error.
 */

export function mapOperatorError(error, context = '') {
  const code = String(error?.code || error?.message || '').toLowerCase();
  const raw = error?.message || String(error || '');

  if (code.includes('permission-denied') || raw.includes('PERMISSION_DENIED')) {
    return 'Aktion nicht erlaubt. Fehlende Berechtigung.';
  }
  if (code.includes('unauthenticated') || raw.includes('UNAUTHENTICATED')) {
    return 'Anmeldung abgelaufen. Bitte erneut anmelden.';
  }
  if (code.includes('unavailable') || code.includes('network') || raw.includes('network')) {
    return 'Netzwerkfehler bei der Übertragung. Der Administrator wurde benachrichtigt.';
  }
  if (code.includes('failed-precondition') && context === 'app-check') {
    return 'App Check nicht aktiv. Bitte Seite neu laden oder Administrator kontaktieren.';
  }
  if (code.includes('deadline-exceeded') || code.includes('timeout')) {
    return 'Zeitüberschreitung bei der Anfrage. Bitte erneut versuchen.';
  }
  if (code.includes('resource-exhausted')) {
    return 'Zu viele Anfragen. Bitte kurz warten und erneut versuchen.';
  }
  if (context === 'meat-prices') {
    return 'Fleischpreis-Aktualisierung fehlgeschlagen. Bitte später erneut versuchen.';
  }
  if (context === 'delivery-note') {
    return 'KI-Analyse fehlgeschlagen. Bitte Foto erneut aufnehmen oder manuell erfassen.';
  }
  if (context === 'sync') {
    return 'Synchronisation fehlgeschlagen. Daten bleiben in der Warteschlange.';
  }
  return 'Ein technischer Fehler ist aufgetreten. Der Administrator wurde benachrichtigt.';
}

export function logAndMapOperatorError(error, context = '') {
  console.error(`[CharcuLogic OperatorError${context ? ` · ${context}` : ''}]`, error);
  return mapOperatorError(error, context);
}

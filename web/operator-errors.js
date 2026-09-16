/**
 * Operator-facing German error messages — raw technical details stay in console.error.
 */

export function mapOperatorError(error, context = '') {
  const code = String(error?.code || error?.message || '').toLowerCase();
  const raw = error?.message || String(error || '');

  if (context === 'admin-users') {
    if (code.includes('unauthenticated') || raw.includes('UNAUTHENTICATED')) {
      return 'Anmeldung abgelaufen. Bitte erneut anmelden.';
    }
    if (code.includes('app-check') || code.includes('failed-precondition')) {
      return 'Die Nutzerliste ist gerade nicht erreichbar. Bitte die Seite neu laden.';
    }
    if (
      code.includes('not-found')
      || code.includes('internal')
      || raw.includes('NOT_FOUND')
      || raw.includes('CORS')
    ) {
      return 'Die Nutzerliste ist gerade nicht erreichbar. Bitte die Seite neu laden.';
    }
    return 'Die Nutzerliste konnte gerade nicht geladen werden. Bitte die Seite neu laden.';
  }
  if (context === 'admin-user-action') {
    if (code.includes('unauthenticated') || raw.includes('UNAUTHENTICATED')) {
      return 'Anmeldung abgelaufen. Bitte erneut anmelden.';
    }
    if (raw.includes('Team-Profil') || raw.includes('kein Konto')) {
      return 'Für dieses Team-Profil gibt es noch kein Konto. Bitte zuerst ein Nutzerkonto anlegen.';
    }
    if (code.includes('failed-precondition')) {
      return 'Diese Änderung ist für das eigene Konto nicht möglich.';
    }
    return 'Die Änderung konnte nicht gespeichert werden. Bitte erneut versuchen.';
  }
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
  if (context === 'meat-label') {
    return 'Etikett konnte nicht gelesen werden. Bitte Daten manuell eintragen.';
  }
  if (context === 'sync') {
    return 'Synchronisation fehlgeschlagen. Daten bleiben in der Warteschlange.';
  }
  if (context === 'mhd') {
    return 'MHD-Änderung konnte nicht gespeichert werden. Bitte erneut versuchen.';
  }
  return 'Ein technischer Fehler ist aufgetreten. Der Administrator wurde benachrichtigt.';
}

export function logAndMapOperatorError(error, context = '') {
  console.error(`[CharcuLogic OperatorError${context ? ` · ${context}` : ''}]`, error);
  return mapOperatorError(error, context);
}

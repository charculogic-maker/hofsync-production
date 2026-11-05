const DEFAULT_BODY = 'Bitte Arbeit speichern, dann App neu laden.';

function getAdmin() {
  return require('./firebaseAdmin');
}

/**
 * Ob ein settings/appReload-Schreiben einen Push auslösen soll.
 * @param {object | undefined} before
 * @param {object | undefined} after
 */
function shouldNotifyAppReload(before, after) {
  if (!after || after.required !== true) return false;
  if (after.notifyPush === false) return false;
  const requestId = String(after.requestId || '').trim();
  if (!requestId) return false;
  const beforeId = String(before?.requestId || '').trim();
  const wasRequired = before?.required === true;
  if (wasRequired && beforeId === requestId) return false;
  return true;
}

/**
 * @param {string} tenantId
 * @param {{ title?: string, body?: string }} payload
 */
async function sendReloadPushToTenant(tenantId, payload) {
  const admin = getAdmin();
  const tokensSnap = await admin.firestore()
    .collection(`tenants/${tenantId}/pushTokens`)
    .get();
  const tokens = [];
  tokensSnap.forEach((doc) => {
    const token = String(doc.data()?.token || '').trim();
    if (token) tokens.push(token);
  });
  if (!tokens.length) return { sent: 0 };

  const title = payload.title || 'HofSync: App neu laden';
  const body = payload.body || DEFAULT_BODY;
  const chunks = [];
  for (let i = 0; i < tokens.length; i += 500) {
    chunks.push(tokens.slice(i, i + 500));
  }

  let sent = 0;
  for (const chunk of chunks) {
    try {
      const result = await admin.messaging().sendEachForMulticast({
        tokens: chunk,
        notification: { title, body: String(body).slice(0, 180) },
        data: {
          type: 'app_reload_required',
          tenantId: String(tenantId),
        },
      });
      sent += Number(result?.successCount || 0);
    } catch (error) {
      console.warn('[AppReloadPush] FCM Versand fehlgeschlagen:', error?.message || error);
    }
  }
  return { sent, tokens: tokens.length };
}

async function handleAppReloadSettingsCreated(event) {
  const admin = getAdmin();
  if (!admin.apps.length) {
    admin.initializeApp();
  }
  const after = event.data?.data();
  if (!shouldNotifyAppReload(undefined, after)) return null;
  const tenantId = event.params.tenantId;
  return sendReloadPushToTenant(tenantId, {
    body: after.message || DEFAULT_BODY,
  });
}

async function handleAppReloadSettingsUpdated(event) {
  const admin = getAdmin();
  if (!admin.apps.length) {
    admin.initializeApp();
  }
  const before = event.data?.before?.data();
  const after = event.data?.after?.data();
  if (!shouldNotifyAppReload(before, after)) return null;
  const tenantId = event.params.tenantId;
  return sendReloadPushToTenant(tenantId, {
    body: after.message || DEFAULT_BODY,
  });
}

exports.shouldNotifyAppReload = shouldNotifyAppReload;
exports.sendReloadPushToTenant = sendReloadPushToTenant;
exports.handleAppReloadSettingsCreated = handleAppReloadSettingsCreated;
exports.handleAppReloadSettingsUpdated = handleAppReloadSettingsUpdated;
exports._test = {
  shouldNotifyAppReload,
  DEFAULT_BODY,
};

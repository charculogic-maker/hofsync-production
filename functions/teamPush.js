const { onDocumentCreated } = require('firebase-functions/v2/firestore');
const admin = require('firebase-admin');

if (!admin.apps.length) {
  admin.initializeApp();
}

const DEFAULT_TEAM_GROUPS = {
  finn_stephie: { label: 'Finn & Stephie', members: ['Finn', 'Stephie'] },
  metzgerei: { label: 'Metzgerei', members: ['Nicole', 'Bettina', 'Heiko', 'Paddy'] },
  laden: { label: 'Hofladen / Theke', members: ['Stephie', 'Finn', 'Paddy'] },
};

function resolveTaskAudienceEmployees(task, config) {
  const employees = Array.isArray(config?.employees) && config.employees.length
    ? config.employees
    : ['Stephie', 'Finn', 'Nicole', 'Bettina', 'Heiko', 'Paddy'];
  const groups = config?.groups && typeof config.groups === 'object'
    ? config.groups
    : DEFAULT_TEAM_GROUPS;
  const type = task.audienceType || (task.assignedTo ? 'person' : task.context ? 'shift' : 'all');

  if (type === 'all') return employees;
  if (type === 'group' && task.audienceGroup && groups[task.audienceGroup]?.members) {
    return groups[task.audienceGroup].members;
  }
  if (type === 'persons' && Array.isArray(task.audienceMembers)) {
    return task.audienceMembers.filter((name) => employees.includes(name));
  }
  if (type === 'person' && task.assignedTo) return [task.assignedTo];
  if (type === 'shift' || type === 'next_shift') return employees;
  if (task.assignedTo) return [task.assignedTo];
  return employees;
}

exports.notifyTeamEntryCreated = onDocumentCreated(
  {
    document: 'tenants/{tenantId}/tasks/{taskId}',
    region: 'europe-west3',
  },
  async (event) => {
    const task = event.data?.data();
    if (!task || task.status !== 'open') return null;

    const tenantId = event.params.tenantId;
    const author = String(task.author || '').trim();

    const configSnap = await admin.firestore()
      .doc(`tenants/${tenantId}/settings/teamDashboard`)
      .get();
    const config = configSnap.exists ? configSnap.data() : null;
    const targets = resolveTaskAudienceEmployees(task, config)
      .filter((name) => name && name !== author);
    if (!targets.length) return null;

    const tokensSnap = await admin.firestore()
      .collection(`tenants/${tenantId}/pushTokens`)
      .get();
    const tokens = [];
    tokensSnap.forEach((doc) => {
      const data = doc.data();
      if (data?.token && targets.includes(data.employeeName)) {
        tokens.push(data.token);
      }
    });
    if (!tokens.length) return null;

    const kind = task.entryKind === 'info' ? 'Info' : 'Aufgabe';
    try {
      await admin.messaging().sendEachForMulticast({
        tokens,
        notification: {
          title: `${kind}: ${task.title || 'Team-Nachricht'}`,
          body: task.body ? String(task.body).slice(0, 180) : `Von ${author || 'Team'}`,
        },
      });
    } catch (error) {
      console.warn('[TeamPush] FCM Versand fehlgeschlagen:', error?.message || error);
    }
    return null;
  },
);

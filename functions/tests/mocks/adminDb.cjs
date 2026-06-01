const state = () => {
  if (!global.__ADMIN_DB_MOCK_STATE__) {
    global.__ADMIN_DB_MOCK_STATE__ = {
      priceRunStore: {},
      fleischpreiseWrites: [],
      credentialsDoc: null,
      pinAttemptsDoc: null,
    };
  }
  return global.__ADMIN_DB_MOCK_STATE__;
};

function docRef(path) {
  const mockState = state();

  if (path.startsWith('tenants/') && path.endsWith('/terminalCredentials/current')) {
    return {
      get: async () => ({
        exists: Boolean(mockState.credentialsDoc),
        data: () => mockState.credentialsDoc,
      }),
    };
  }

  if (path.includes('/pinAttempts/')) {
    return {
      get: async () => ({
        exists: Boolean(mockState.pinAttemptsDoc),
        data: () => mockState.pinAttemptsDoc,
      }),
      set: async (data) => {
        mockState.pinAttemptsDoc = { ...(mockState.pinAttemptsDoc || {}), ...data };
      },
      delete: async () => {
        mockState.pinAttemptsDoc = null;
      },
    };
  }

  if (path.startsWith('tenants/') && path.includes('/fleischpreise/')) {
    return {
      set: async (data) => {
        mockState.fleischpreiseWrites.push({ path, data });
      },
    };
  }

  return {
    get: async () => ({ exists: false, data: () => null }),
    set: async () => {},
    update: async () => {},
  };
}

const firestoreImpl = {
  collection: (name) => ({
    doc: (id) => {
      const mockState = state();
      if (name === 'priceRuns') {
        return {
          set: async (data) => {
            mockState.priceRunStore[id] = { ...(mockState.priceRunStore[id] || {}), ...data };
          },
          update: async (data) => {
            mockState.priceRunStore[id] = { ...(mockState.priceRunStore[id] || {}), ...data };
          },
        };
      }
      return docRef(`${name}/${id}`);
    },
  }),
  doc: (path) => docRef(path),
  runTransaction: async (fn) => {
    const tx = {
      get: async (ref) => ref.get(),
      set: async (ref, data, opts) => ref.set(data, opts),
    };
    return fn(tx);
  },
};

module.exports = {
  firestore: () => firestoreImpl,
  FieldValue: {
    serverTimestamp: () => ({ __type: 'serverTimestamp' }),
  },
  Timestamp: {
    fromMillis: (ms) => ({ toMillis: () => ms }),
  },
  __mockState: state,
};

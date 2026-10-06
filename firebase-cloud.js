import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js";
import {
  getAuth,
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signOut
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js";
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  getFirestore,
  serverTimestamp,
  setDoc,
  writeBatch
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";
import { firebaseConfig, hasFirebaseConfig } from "./firebase-config.js";

const COLLECTIONS = ["bills", "expenses", "debts"];
const SCHEMA_VERSION = 1;

let auth = null;
let db = null;
let currentUser = null;
let getLocalState = () => null;
let applyRemoteState = () => {};
let statusHandler = () => {};
let saveTimer = null;
let queuedState = null;

const remoteIds = {
  bills: new Set(),
  expenses: new Set(),
  debts: new Set()
};

function notify(state, extra = {}) {
  statusHandler({
    state,
    email: currentUser?.email || "",
    uid: currentUser?.uid || "",
    ...extra
  });
}

function hasUsefulData(state) {
  if (!state) return false;

  return Boolean(
    state.profile?.name ||
    state.profile?.email ||
    Number(state.profile?.income) > 0 ||
    state.profile?.payDay ||
    state.settings?.darkMode ||
    state.settings?.economyMode ||
    state.bills?.length ||
    state.expenses?.length ||
    state.debts?.length
  );
}

function mergeItems(localItems = [], remoteItems = []) {
  const merged = new Map();

  for (const item of localItems) {
    if (item?.id) merged.set(item.id, item);
  }

  for (const item of remoteItems) {
    if (item?.id) merged.set(item.id, item);
  }

  return [...merged.values()];
}

function mergeStates(localState, remoteState) {
  const local = localState || {};
  const remote = remoteState || {};

  return {
    profile: {
      ...(local.profile || {}),
      ...(remote.profile || {})
    },
    settings: {
      ...(local.settings || {}),
      ...(remote.settings || {})
    },
    bills: mergeItems(local.bills, remote.bills),
    expenses: mergeItems(local.expenses, remote.expenses),
    debts: mergeItems(local.debts, remote.debts)
  };
}

async function readSubcollection(uid, name) {
  const snapshot = await getDocs(collection(db, "users", uid, name));
  const items = [];

  remoteIds[name] = new Set();

  snapshot.forEach((entry) => {
    remoteIds[name].add(entry.id);
    items.push({
      ...entry.data(),
      id: entry.id
    });
  });

  return items;
}

async function readCloudState(uid) {
  const userRef = doc(db, "users", uid);
  const [userSnap, bills, expenses, debts] = await Promise.all([
    getDoc(userRef),
    readSubcollection(uid, "bills"),
    readSubcollection(uid, "expenses"),
    readSubcollection(uid, "debts")
  ]);

  const userData = userSnap.exists() ? userSnap.data() : {};

  return {
    exists: userSnap.exists() || bills.length > 0 || expenses.length > 0 || debts.length > 0,
    state: {
      profile: userData.profile || {},
      settings: userData.settings || {},
      bills,
      expenses,
      debts
    }
  };
}

async function commitOperations(operations) {
  const CHUNK_SIZE = 400;

  for (let start = 0; start < operations.length; start += CHUNK_SIZE) {
    const chunk = operations.slice(start, start + CHUNK_SIZE);
    const batch = writeBatch(db);

    for (const operation of chunk) {
      if (operation.type === "set") {
        batch.set(operation.ref, operation.data, operation.options || {});
      } else {
        batch.delete(operation.ref);
      }
    }

    await batch.commit();
  }
}

export async function saveCloudState(state) {
  if (!db || !currentUser || !state) return false;

  notify("syncing");

  const uid = currentUser.uid;
  const operations = [];

  operations.push({
    type: "set",
    ref: doc(db, "users", uid),
    data: {
      profile: state.profile || {},
      settings: state.settings || {},
      schemaVersion: SCHEMA_VERSION,
      updatedAt: serverTimestamp()
    },
    options: { merge: true }
  });

  for (const name of COLLECTIONS) {
    const localItems = Array.isArray(state[name]) ? state[name] : [];
    const localIds = new Set();

    for (const item of localItems) {
      if (!item?.id) continue;

      localIds.add(item.id);
      operations.push({
        type: "set",
        ref: doc(db, "users", uid, name, item.id),
        data: {
          ...item,
          updatedAt: serverTimestamp()
        },
        options: { merge: true }
      });
    }

    for (const remoteId of remoteIds[name]) {
      if (!localIds.has(remoteId)) {
        operations.push({
          type: "delete",
          ref: doc(db, "users", uid, name, remoteId)
        });
      }
    }

    remoteIds[name] = localIds;
  }

  await commitOperations(operations);
  notify("synced");
  return true;
}

export function queueCloudSave(state, delay = 900) {
  queuedState = JSON.parse(JSON.stringify(state || {}));

  clearTimeout(saveTimer);
  saveTimer = setTimeout(async () => {
    const stateToSave = queuedState;
    queuedState = null;

    try {
      await saveCloudState(stateToSave);
    } catch (error) {
      console.error("Falha ao sincronizar ContaComigo com Firebase:", error);
      notify("error", { message: error?.message || "Falha na sincronização." });
    }
  }, delay);
}

async function handleSignedInUser(user) {
  currentUser = user;
  notify("syncing");

  const cloud = await readCloudState(user.uid);
  const local = getLocalState();

  if (cloud.exists) {
    const merged = mergeStates(local, cloud.state);

    if (!merged.profile?.email && user.email) {
      merged.profile = {
        ...(merged.profile || {}),
        email: user.email
      };
    }

    applyRemoteState(merged);
    await saveCloudState(merged);
  } else {
    const firstState = {
      ...(local || {}),
      profile: {
        ...(local?.profile || {}),
        email: local?.profile?.email || user.email || ""
      }
    };

    applyRemoteState(firstState);
    await saveCloudState(firstState);
  }

  notify("synced");
}

export async function initCloudSync(options = {}) {
  getLocalState = options.getLocalState || getLocalState;
  applyRemoteState = options.onRemoteState || applyRemoteState;
  statusHandler = options.onStatus || statusHandler;

  if (!hasFirebaseConfig()) {
    notify("not-configured");
    return { configured: false };
  }

  const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);

  auth = getAuth(app);
  db = getFirestore(app);

  onAuthStateChanged(auth, async (user) => {
    try {
      if (!user) {
        currentUser = null;
        notify("signed-out");
        return;
      }

      await handleSignedInUser(user);
    } catch (error) {
      console.error("Falha ao iniciar nuvem do ContaComigo:", error);
      notify("error", { message: error?.message || "Falha ao acessar a nuvem." });
    }
  });

  return { configured: true };
}

export async function connectWithGoogle() {
  if (!auth) {
    throw new Error("Firebase ainda não está configurado.");
  }

  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: "select_account" });

  notify("connecting");
  return signInWithPopup(auth, provider);
}

export async function disconnectCloud() {
  if (!auth) return;
  await signOut(auth);
}

export function isCloudConnected() {
  return Boolean(currentUser);
}

export async function deleteCloudData() {
  if (!db || !currentUser) return;

  const uid = currentUser.uid;

  for (const name of COLLECTIONS) {
    const snapshot = await getDocs(collection(db, "users", uid, name));
    const operations = [];

    snapshot.forEach((entry) => {
      operations.push({
        type: "delete",
        ref: entry.ref
      });
    });

    await commitOperations(operations);
    remoteIds[name] = new Set();
  }

  await deleteDoc(doc(db, "users", uid));
  notify("signed-in-empty");
}

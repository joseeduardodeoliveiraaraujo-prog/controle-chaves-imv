import {
  collection,
  addDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  doc,
  serverTimestamp,
  query,
  where,
  orderBy,
  limit,
  startAfter,
  getCountFromServer,
  runTransaction,
  writeBatch,
} from "firebase/firestore";
import { db } from "../config/firebase";
import { removeExpiredScheduleDates } from "../utils/schedule";

const keysCollection = collection(db, "keys");

export async function addKey(keyData, nextOrdem) {
  const docRef = await addDoc(keysCollection, {
    ...keyData,
    status: "available",
    ordem: nextOrdem,
    createdAt: serverTimestamp(),
  });
  return docRef.id;
}

export async function getKeys() {
  const snapshot = await getDocs(keysCollection);
  const keys = snapshot.docs.map((d) => ({
    id: d.id,
    ...d.data(),
  }));
  return keys.sort((a, b) => (a.ordem ?? Infinity) - (b.ordem ?? Infinity));
}

export async function swapKeyOrder(id1, ordem1, id2, ordem2) {
  const batch = writeBatch(db);
  batch.update(doc(db, "keys", id1), { ordem: ordem2 });
  batch.update(doc(db, "keys", id2), { ordem: ordem1 });
  await batch.commit();
}

export async function migrateKeysOrder() {
  const snapshot = await getDocs(keysCollection);
  const keys = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));

  const needsMigration = keys.some((k) => k.ordem === undefined || k.ordem === null);
  if (!needsMigration) return;

  keys.sort((a, b) => a.id.localeCompare(b.id));

  const withOrder = keys.filter((k) => k.ordem !== undefined && k.ordem !== null);
  const withoutOrder = keys.filter((k) => k.ordem === undefined || k.ordem === null);

  const batch = writeBatch(db);

  if (withOrder.length === 0) {
    keys.forEach((key, index) => {
      batch.update(doc(db, "keys", key.id), { ordem: index });
    });
  } else {
    const maxOrdem = Math.max(...withOrder.map((k) => k.ordem));
    withoutOrder.forEach((key, index) => {
      batch.update(doc(db, "keys", key.id), { ordem: maxOrdem + index + 1 });
    });
  }

  await batch.commit();
}

export async function updateKey(id, keyData) {
  const keyRef = doc(db, "keys", id);
  await updateDoc(keyRef, keyData);
}

export async function saveKeysOrder(orderedKeys) {
  const batch = writeBatch(db);
  orderedKeys.forEach((key, index) => {
    batch.update(doc(db, "keys", key.id), { ordem: index });
  });
  await batch.commit();
}

export async function deleteKey(id) {
  await runTransaction(db, async (transaction) => {
    const keyRef = doc(db, "keys", id);
    const keyDoc = await transaction.get(keyRef);

    if (!keyDoc.exists()) {
      throw new Error("Esta chave não existe mais.");
    }

    if (keyDoc.data().status === "borrowed") {
      throw new Error(
        "Não é possível excluir esta chave enquanto ela estiver emprestada. Registre a devolução da chave antes de excluí-la."
      );
    }

    transaction.delete(keyRef);
  });

  const snapshot = await getDocs(keysCollection);
  const remaining = snapshot.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .filter((k) => k.ordem !== undefined && k.ordem !== null)
    .sort((a, b) => a.ordem - b.ordem);

  const batch = writeBatch(db);
  remaining.forEach((key, index) => {
    batch.update(doc(db, "keys", key.id), { ordem: index });
  });
  await batch.commit();
}

const peopleCollection = collection(db, "people");
const movementsCollection = collection(db, "movements");

const MOVEMENTS_PAGE_SIZE = 80;
const MAX_MOVEMENTS = 2000;
const MAX_TRIM_PER_WITHDRAWAL = 200;

function startOfLocalDay(dateStr) {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d, 0, 0, 0, 0);
}

function endOfLocalDay(dateStr) {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d, 23, 59, 59, 999);
}

function buildMovementDateConstraints(dateFrom, dateTo) {
  const constraints = [];
  if (dateFrom) constraints.push(where("borrowedAt", ">=", startOfLocalDay(dateFrom)));
  if (dateTo) constraints.push(where("borrowedAt", "<=", endOfLocalDay(dateTo)));
  return constraints;
}

export async function addPerson(personData) {
  const docRef = await addDoc(peopleCollection, {
    ...personData,
    createdAt: serverTimestamp(),
  });
  return docRef.id;
}

export async function getPeople() {
  const snapshot = await getDocs(peopleCollection);
  return snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  }));
}

export async function updatePerson(id, personData) {
  const personRef = doc(db, "people", id);
  await updateDoc(personRef, personData);
}

export async function deletePerson(id) {
  const activeByPersonQuery = query(
    movementsCollection,
    where("personId", "==", id),
    where("status", "==", "active")
  );
  const activeSnapshot = await getDocs(activeByPersonQuery);

  if (!activeSnapshot.empty) {
    throw new Error(
      "Não é possível excluir esta pessoa enquanto ela estiver com uma chave emprestada. Registre a devolução da chave antes de excluir a pessoa."
    );
  }

  const personRef = doc(db, "people", id);
  await deleteDoc(personRef);
}

export async function getActiveMovements() {
  const q = query(movementsCollection, where("status", "==", "active"));
  const snapshot = await getDocs(q);
  return snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  }));
}

async function collectOldestReturnedMovementRefs(needed) {
  let cursor = null;
  const refs = [];
  const chunkSize = 100;
  const maxScans = 20;

  for (let scan = 0; scan < maxScans && refs.length < needed; scan++) {
    let q = query(
      movementsCollection,
      orderBy("borrowedAt", "asc"),
      limit(chunkSize)
    );
    if (cursor) q = query(q, startAfter(cursor));
    const snapshot = await getDocs(q);
    if (snapshot.empty) break;

    for (const doc of snapshot.docs) {
      if (refs.length >= needed) break;
      if (doc.data().status === "returned") refs.push(doc.ref);
    }

    if (snapshot.docs.length < chunkSize) break;
    cursor = snapshot.docs[snapshot.docs.length - 1];
  }

  return refs;
}

export async function withdrawKey(
  keyId,
  keyName,
  personId,
  personName,
  expectedReturnAt,
  options = {}
) {
  const { personPhone = "", personType = "registered" } = options;

  const countSnapshot = await getCountFromServer(movementsCollection);
  const total = countSnapshot.data().count;
  const excess = total + 1 - MAX_MOVEMENTS;
  const trimNeeded = Math.min(excess, MAX_TRIM_PER_WITHDRAWAL);

  const candidates =
    trimNeeded > 0 ? await collectOldestReturnedMovementRefs(trimNeeded) : [];

  await runTransaction(db, async (transaction) => {
    const keyRef = doc(db, "keys", keyId);
    const keyDoc = await transaction.get(keyRef);

    if (!keyDoc.exists() || keyDoc.data().status !== "available") {
      throw new Error("Esta chave não está disponível para retirada.");
    }

    for (const candidateRef of candidates) {
      const candidateDoc = await transaction.get(candidateRef);
      if (candidateDoc.exists() && candidateDoc.data().status === "returned") {
        transaction.delete(candidateRef);
      }
    }

    const movementRef = doc(movementsCollection);
    transaction.set(movementRef, {
      keyId,
      keyName,
      personId,
      personName,
      personPhone: personPhone || null,
      personType,
      borrowedAt: serverTimestamp(),
      expectedReturnAt,
      returnedAt: null,
      status: "active",
    });

    transaction.update(keyRef, { status: "borrowed" });
  });
}

export async function returnKey(movementId, keyId) {
  await runTransaction(db, async (transaction) => {
    const movementRef = doc(db, "movements", movementId);
    const movementDoc = await transaction.get(movementRef);

    if (!movementDoc.exists() || movementDoc.data().status !== "active") {
      throw new Error("Esta movimentação já foi encerrada.");
    }

    const keyRef = doc(db, "keys", keyId);
    const keyDoc = await transaction.get(keyRef);

    if (!keyDoc.exists()) {
      throw new Error(
        "Esta chave não existe mais. Não é possível registrar a devolução."
      );
    }

    transaction.update(movementRef, {
      status: "returned",
      returnedAt: serverTimestamp(),
    });

    transaction.update(keyRef, { status: "available" });
  });
}

export async function getHistoryPage({
  pageSize = MOVEMENTS_PAGE_SIZE,
  after = null,
  dateFrom = "",
  dateTo = "",
} = {}) {
  const base = query(
    movementsCollection,
    orderBy("borrowedAt", "desc"),
    ...buildMovementDateConstraints(dateFrom, dateTo)
  );
  const pageQuery = after
    ? query(base, startAfter(after), limit(pageSize))
    : query(base, limit(pageSize));

  const [pageSnapshot, countSnapshot] = await Promise.all([
    getDocs(pageQuery),
    getCountFromServer(base),
  ]);

  return {
    documents: pageSnapshot.docs.map((d) => ({ id: d.id, ...d.data() })),
    lastDoc: pageSnapshot.docs.length
      ? pageSnapshot.docs[pageSnapshot.docs.length - 1]
      : null,
    count: countSnapshot.data().count,
  };
}

export async function getMovementsForSearch({ dateFrom = "", dateTo = "" } = {}) {
  const q = query(
    movementsCollection,
    orderBy("borrowedAt", "desc"),
    ...buildMovementDateConstraints(dateFrom, dateTo),
    limit(MAX_MOVEMENTS)
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
}

const roomsCollection = collection(db, "rooms");

export async function addRoom(roomData, nextOrdem) {
  const docRef = await addDoc(roomsCollection, {
    ...roomData,
    schedule: roomData.schedule ?? {},
    ordem: nextOrdem,
    createdAt: serverTimestamp(),
  });
  return docRef.id;
}

export async function getRooms() {
  const snapshot = await getDocs(roomsCollection);
  const rooms = snapshot.docs.map((d) => ({
    id: d.id,
    ...d.data(),
  }));
  rooms.sort((a, b) => (a.ordem ?? Infinity) - (b.ordem ?? Infinity));

  try {
    const batch = writeBatch(db);
    let updated = 0;
    const cleaned = rooms.map((room) => {
      const result = removeExpiredScheduleDates(room.schedule);
      if (!result.changed) return room;
      updated += 1;
      batch.update(doc(db, "rooms", room.id), {
        schedule: result.schedule,
      });
      return { ...room, schedule: result.schedule };
    });
    if (updated > 0) await batch.commit();
    return cleaned;
  } catch (err) {
    console.warn(
      "Limpeza de agendamentos expirados falhou; exibindo dados carregados.",
      err
    );
    return rooms;
  }
}

export async function updateRoom(id, roomData) {
  const roomRef = doc(db, "rooms", id);
  await updateDoc(roomRef, roomData);
}

export async function resetRoomSchedule(roomId) {
  const roomRef = doc(db, "rooms", roomId);
  await updateDoc(roomRef, { schedule: {} });
}

export async function saveRoomsOrder(orderedRooms) {
  const batch = writeBatch(db);
  orderedRooms.forEach((room, index) => {
    batch.update(doc(db, "rooms", room.id), { ordem: index });
  });
  await batch.commit();
}

export async function deleteRoom(id) {
  await runTransaction(db, async (transaction) => {
    const roomRef = doc(db, "rooms", id);
    const roomDoc = await transaction.get(roomRef);

    if (!roomDoc.exists()) {
      throw new Error("Esta sala não existe mais.");
    }

    transaction.delete(roomRef);
  });
}

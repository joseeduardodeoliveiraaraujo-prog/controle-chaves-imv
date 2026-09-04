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
  runTransaction,
  writeBatch,
} from "firebase/firestore";
import { db } from "../config/firebase";

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

export async function withdrawKey(keyId, keyName, personId, personName, expectedReturnAt) {
  await runTransaction(db, async (transaction) => {
    const keyRef = doc(db, "keys", keyId);
    const keyDoc = await transaction.get(keyRef);

    if (!keyDoc.exists() || keyDoc.data().status !== "available") {
      throw new Error("Esta chave não está disponível para retirada.");
    }

    const movementRef = doc(movementsCollection);
    transaction.set(movementRef, {
      keyId,
      keyName,
      personId,
      personName,
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

export async function getAllMovements() {
  const snapshot = await getDocs(movementsCollection);
  return snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  }));
}

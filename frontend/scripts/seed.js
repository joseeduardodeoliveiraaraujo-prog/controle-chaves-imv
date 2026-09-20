#!/usr/bin/env node
/* Seed de dados de teste para o Firestore.
 *
 * Uso:
 *   npm run seed                       # cria 100 pessoas + 1000 movimentações
 *   npm run seed -- --people=50        # sobrescreve a quantidade de pessoas
 *   npm run seed -- --movements=500    # sobrescreve a quantidade de movimentações
 *   npm run seed:clean                 # apaga somente os dados gerados pela seed
 *
 * Credenciais (Firebase Admin SDK):
 *   - Definir a variável GOOGLE_APPLICATION_CREDENTIALS apontando para o
 *     arquivo de service account, OU
 *   - Passar --credentials=./serviceAccountKey.json, OU
 *   - Ter ADC configurado via "gcloud auth application-default login".
 *
 * Os documentos usam exatamente os mesmos campos dos modelos reais do app.
 * Os IDs começam com "seed_" para permitir limpeza sem alterar dados reais.
 * Nenhuma chave é criada ou modificada: as movimentações usam as chaves
 * já existentes no Firestore.
 */

import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { cert, applicationDefault, initializeApp } from "firebase-admin";
import { getFirestore, Timestamp, FieldPath } from "firebase-admin/firestore";

// ============================================================
// Configuração (altere aqui os valores padrão)
// ============================================================

const PEOPLE_COUNT = 100;
const MOVEMENTS_COUNT = 1000;
const ACTIVE_RATIO = 0.08; // % de movimentações "active" (limitadas às chaves disponíveis)
const STUDENT_RATIO = 0.1; // % de movimentações do tipo "student"
const HISTORY_MONTHS = 5; // busca "nos últimos meses"
const NAME_PREFIX = "Professor Teste";
const STUDENT_NAME_PREFIX = "Aluno Teste";
const EMAIL_DOMAIN = "exemplo.com";
const BATCH_SIZE = 450;

const PEOPLE_ID_PREFIX = "seed_person_";
const MOVEMENT_ID_PREFIX = "seed_movement_";

const SECTORS = [
  "Direção",
  "Coordenação",
  "Secretaria",
  "Administração",
  "TI",
  "Biblioteca",
  "Manutenção",
  "Portaria",
  "Limpeza",
  "Financeiro",
];

// ============================================================
// Argumentos de linha de comando
// ============================================================

const args = process.argv.slice(2);

function parseArgs() {
  const opts = {
    clean: args.includes("--clean"),
    people: PEOPLE_COUNT,
    movements: MOVEMENTS_COUNT,
    credentials: null,
    projectId: null,
    help: args.includes("--help") || args.includes("-h"),
  };

  for (const arg of args) {
    const [flag, value] = arg.split("=");
    if (!value) continue;
    if (flag === "--people") opts.people = Number(value);
    if (flag === "--movements") opts.movements = Number(value);
    if (flag === "--credentials") opts.credentials = value;
    if (flag === "--project") opts.projectId = value;
  }

  if (Number.isNaN(opts.people) || opts.people < 1) opts.people = PEOPLE_COUNT;
  if (Number.isNaN(opts.movements) || opts.movements < 1) {
    opts.movements = MOVEMENTS_COUNT;
  }

  return opts;
}

function printHelp() {
  console.log(`
Seed de dados de teste para o Firestore

  npm run seed                  cria ${PEOPLE_COUNT} pessoas e ${MOVEMENTS_COUNT} movimentações
  npm run seed -- --people=50   sobrescreve a quantidade de pessoas
  npm run seed -- --movements=500
  npm run seed:clean            apaga somente os dados gerados pela seed

Credenciais:
  GOOGLE_APPLICATION_CREDENTIALS=<path>  (recomendado)
  --credentials=<path>
  ou ADC já configurado.

Observação: as movimentações "active" da seed aparecem como chaves
emprestadas no Painel, porém os documentos das chaves não são alterados.
Para remover tudo: "npm run seed:clean".
`);
}

// ============================================================
// Firebase Admin SDK
// ============================================================

function loadEnvVar(name) {
  const envPath = join(process.cwd(), ".env");
  if (!existsSync(envPath)) return null;
  const lines = readFileSync(envPath, "utf8").split("\n");
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    if (key === name) return trimmed.slice(eq + 1).trim();
  }
  return null;
}

function initAdmin(opts) {
  let credential;

  const credentialsPath =
    opts.credentials || process.env.GOOGLE_APPLICATION_CREDENTIALS || null;

  if (credentialsPath) {
    const serviceAccount = JSON.parse(readFileSync(credentialsPath, "utf8"));
    credential = cert(serviceAccount);
    if (!opts.projectId && serviceAccount.project_id) {
      // eslint-disable-next-line no-param-reassign
      opts.projectId = serviceAccount.project_id;
    }
  } else {
    credential = applicationDefault();
  }

  const projectId =
    opts.projectId ||
    process.env.VITE_FIREBASE_PROJECT_ID ||
    loadEnvVar("VITE_FIREBASE_PROJECT_ID");

  const initOptions = { credential };
  if (projectId) initOptions.projectId = projectId;

  initializeApp(initOptions);
}

// ============================================================
// Utilidades
// ============================================================

function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pad(value, size) {
  return String(value).padStart(size, "0");
}

function randomBorrowedDate() {
  const now = new Date();
  const maxDays = Math.round(HISTORY_MONTHS * 30.4);
  const d = new Date(now);
  d.setDate(d.getDate() - randInt(0, maxDays));
  d.setHours(randInt(8, 17), randInt(0, 59), 0, 0);
  if (d > now) return now;
  return d;
}

function expectedReturnFrom(borrowed) {
  const d = new Date(borrowed);
  d.setDate(d.getDate() + randInt(1, 7));
  d.setHours(23, 59, 59, 999);
  return d;
}

function returnedAtFrom(borrowed) {
  const now = new Date();
  const d = new Date(borrowed);
  d.setDate(d.getDate() + randInt(1, 10));
  d.setHours(randInt(8, 17), randInt(0, 59), 0, 0);
  if (d > now) return now;
  return d;
}

function padIndex(i) {
  return pad(i, PEOPLE_COUNT >= 100 ? 3 : 2);
}

function padMovementIndex(i, count) {
  const size = count >= 1000 ? 4 : count >= 100 ? 3 : 2;
  return pad(i, size);
}

function commitInBatches(collection, entries) {
  const runs = [];
  for (let start = 0; start < entries.length; start += BATCH_SIZE) {
    const chunk = entries.slice(start, start + BATCH_SIZE);
    const batch = getFirestore().batch();
    chunk.forEach(([id, data]) => {
      batch.set(collection.doc(id), data);
    });
    runs.push(batch.commit());
  }
  return Promise.all(runs);
}

// ============================================================
// Geração de pessoas
// ============================================================

function buildPeople(count) {
  const people = [];
  for (let i = 1; i <= count; i++) {
    const idx = padIndex(i);
    people.push({
      id: `${PEOPLE_ID_PREFIX}${idx}`,
      name: `${NAME_PREFIX} ${idx}`,
      phone: `919${pad(i, 8)}`,
      email: `${NAME_PREFIX.replace(/\s+/g, ".")}${idx}@${EMAIL_DOMAIN}.br`
        .replace(/\s+/g, "")
        .toLowerCase(),
      sector: SECTORS[i % SECTORS.length],
    });
  }
  return people;
}

// ============================================================
// Geração de movimentações
// ============================================================

function buildMovements(count, keys, people, studentCount) {
  const availableKeys = keys.filter((k) => k.status === "available");
  const anyKeys = keys.length > 0 ? keys : availableKeys;
  const activeLimit = availableKeys.length;

  const activeCount = Math.min(
    Math.round(count * ACTIVE_RATIO),
    activeLimit
  );

  const usedActiveKeyIds = new Set();
  const movements = [];

  for (let i = 1; i <= count; i++) {
    const isActive = i <= activeCount;
    const isStudent =
      !isActive && Math.random() < STUDENT_RATIO && studentCount > 0;

    let key;
    if (isActive) {
      const pool = availableKeys.filter((k) => !usedActiveKeyIds.has(k.id));
      if (pool.length === 0) break;
      key = pool[randInt(0, pool.length - 1)];
      usedActiveKeyIds.add(key.id);
    } else {
      key = anyKeys[randInt(0, anyKeys.length - 1)];
    }

    let person;
    if (isStudent) {
      const studentIdx = padMovementIndex(
        randInt(1, studentCount),
        studentCount
      );
      person = {
        id: "aluno-nao-cadastrado",
        name: `${STUDENT_NAME_PREFIX} ${studentIdx}`,
        phone: `9190${pad(randInt(0, 999999), 6)}`,
        personType: "student",
      };
    } else {
      const chosen = people[randInt(0, people.length - 1)];
      person = {
        id: chosen.id,
        name: chosen.name,
        phone: chosen.phone,
        personType: "registered",
      };
    }

    const borrowedAt = randomBorrowedDate();

    movements.push({
      id: `${MOVEMENT_ID_PREFIX}${padMovementIndex(i, count)}`,
      data: {
        keyId: key.id,
        keyName: key.name,
        personId: person.id,
        personName: person.name,
        personPhone: person.phone,
        personType: person.personType,
        borrowedAt: Timestamp.fromDate(borrowedAt),
        expectedReturnAt: Timestamp.fromDate(
          expectedReturnFrom(borrowedAt)
        ),
        returnedAt: isActive
          ? null
          : Timestamp.fromDate(returnedAtFrom(borrowedAt)),
        status: isActive ? "active" : "returned",
      },
    });
  }

  return { movements, activeCount };
}

// ============================================================
// Execução
// ============================================================

async function main() {
  const opts = parseArgs();

  if (opts.help) {
    printHelp();
    return;
  }

  const db = getFirestore();

  if (opts.clean) {
    await clean(db);
    return;
  }

  const keysSnapshot = await db.collection("keys").get();
  const keys = keysSnapshot.docs.map((d) => ({
    id: d.id,
    ...d.data(),
  }));

  if (keys.length === 0) {
    console.error(
      "Nenhuma chave encontrada no Firestore. Cadastre chaves antes de rodar a seed."
    );
    process.exitCode = 1;
    return;
  }

  const people = buildPeople(opts.people);
  await commitInBatches(db.collection("people"), people.map((p) => [p.id, p]));
  console.log(`Pessoas criadas: ${people.length}`);

  const studentCount = Math.max(
    1,
    Math.round(opts.movements * STUDENT_RATIO)
  );
  const { movements, activeCount } = buildMovements(
    opts.movements,
    keys,
    people,
    studentCount
  );

  await commitInBatches(
    db.collection("movements"),
    movements.map((m) => [m.id, m.data])
  );

  const returnedCount = movements.length - activeCount;
  console.log(`Movimentações criadas: ${movements.length}`);
  console.log(`  - ativas: ${activeCount}`);
  console.log(`  - devolvidas: ${returnedCount}`);
  console.log("Seed concluída com sucesso.");
}

async function clean(db) {
  const prefixes = [
    [db.collection("people"), PEOPLE_ID_PREFIX],
    [db.collection("movements"), MOVEMENT_ID_PREFIX],
  ];

  let removed = 0;

  for (const [collection, prefix] of prefixes) {
    let total = 0;
    let chunk;
    do {
      let query = collection
        .orderBy(FieldPath.documentId())
        .startAt(prefix)
        .endAt(`${prefix}\uf8ff`)
        .limit(BATCH_SIZE);
      chunk = await query.get();
      if (chunk.size === 0) break;
      const batch = db.batch();
      chunk.docs.forEach((d) => batch.delete(d.ref));
      await batch.commit();
      total += chunk.size;
    } while (chunk.size > 0);
    removed += total;
    console.log(`Removidos em "${collection.path}": ${total}`);
  }

  console.log(`Limpeza concluída. Documentos de seed removidos: ${removed}`);
}

try {
  initAdmin(parseArgs());
  main().catch((err) => {
    console.error("Erro na seed:", err);
    process.exitCode = 1;
  });
} catch (err) {
  console.error("Erro ao inicializar o Firebase:", err);
  process.exitCode = 1;
}
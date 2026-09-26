'use strict';

const DB_NAME = 'digitalHisabDB';
const DB_VERSION = 1;
const STORES = { TRANSACTIONS: 'transactions', CATEGORIES: 'categories', SETTINGS: 'settings' };

let dbPromise = null;

function openDB() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORES.TRANSACTIONS)) {
        const t = db.createObjectStore(STORES.TRANSACTIONS, { keyPath: 'id' });
        t.createIndex('date', 'date');
        t.createIndex('type', 'type');
      }
      if (!db.objectStoreNames.contains(STORES.CATEGORIES)) {
        db.createObjectStore(STORES.CATEGORIES, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(STORES.SETTINGS)) {
        db.createObjectStore(STORES.SETTINGS, { keyPath: 'key' });
      }
    };
    req.onsuccess = (e) => resolve(e.target.result);
    req.onerror = (e) => reject(e.target.error);
  });
  return dbPromise;
}

function tx(storeName, mode) {
  return openDB().then((db) => db.transaction(storeName, mode).objectStore(storeName));
}

function reqToPromise(req) {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function genId(prefix) {
  return prefix + '-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);
}

/* ---------------- Categories ---------------- */
async function addCategory({ type, mainCategory, subCategory, childCategory }) {
  const main = String(mainCategory || '').trim();
  const sub = String(subCategory || 'General').trim() || 'General';
  const child = String(childCategory || 'General').trim() || 'General';
  if (!main) throw new Error('Main Category প্রয়োজন।');
  if (type !== 'Income' && type !== 'Expense') throw new Error('Invalid category type.');

  const existing = await getCategories(true);
  const dup = existing.some((c) => c.type === type && c.mainCategory === main && c.subCategory === sub && c.childCategory === child && c.status !== 'Inactive');
  if (dup) throw new Error('এই Category ইতোমধ্যে আছে।');

  const store = await tx(STORES.CATEGORIES, 'readwrite');
  const record = { id: genId('CAT'), type, mainCategory: main, subCategory: sub, childCategory: child, status: 'Active' };
  await reqToPromise(store.add(record));
  return record;
}

async function getCategories(includeInactive) {
  const store = await tx(STORES.CATEGORIES, 'readonly');
  const all = await reqToPromise(store.getAll());
  return includeInactive ? all : all.filter((c) => c.status !== 'Inactive');
}

async function disableCategory({ type, mainCategory, subCategory, childCategory }) {
  const all = await getCategories(true);
  const match = all.find((c) => c.type === type && c.mainCategory === String(mainCategory).trim() &&
    c.subCategory === String(subCategory || 'General').trim() && c.childCategory === String(childCategory || 'General').trim());
  if (!match) throw new Error('Category পাওয়া যায়নি।');
  const store = await tx(STORES.CATEGORIES, 'readwrite');
  match.status = 'Inactive';
  await reqToPromise(store.put(match));
  return true;
}

/* ---------------- Transactions ---------------- */
function round2(n) { n = Number(n) || 0; return Math.round((n + Number.EPSILON) * 100) / 100; }

function validateTx(data) {
  if (!data) throw new Error('Invalid transaction data.');
  if (data.type !== 'Income' && data.type !== 'Expense') throw new Error('Income অথবা Expense নির্বাচন করুন।');
  if (!String(data.mainCategory || '').trim()) throw new Error('Main Category নির্বাচন করুন।');
  const amount = Number(data.amount);
  if (!isFinite(amount) || amount <= 0) throw new Error('Amount শূন্যের বেশি হতে হবে।');
}

async function addTransaction(data) {
  validateTx(data);
  const record = {
    id: genId('TXN'),
    date: data.date || new Date().toISOString().slice(0, 10),
    type: data.type,
    mainCategory: String(data.mainCategory).trim(),
    subCategory: String(data.subCategory || 'General').trim() || 'General',
    childCategory: String(data.childCategory || 'General').trim() || 'General',
    description: String(data.description || '').trim(),
    amount: round2(Number(data.amount)),
    paymentMethod: String(data.paymentMethod || 'Cash').trim() || 'Cash',
    timestamp: new Date().toISOString()
  };
  const store = await tx(STORES.TRANSACTIONS, 'readwrite');
  await reqToPromise(store.add(record));
  return record;
}

async function getTransactions() {
  const store = await tx(STORES.TRANSACTIONS, 'readonly');
  const all = await reqToPromise(store.getAll());
  return all.sort((a, b) => (a.timestamp || '').localeCompare(b.timestamp || ''));
}

async function updateTransaction(data) {
  if (!data.id) throw new Error('Transaction ID প্রয়োজন।');
  validateTx(data);
  const store = await tx(STORES.TRANSACTIONS, 'readwrite');
  const existing = await reqToPromise(store.get(data.id));
  if (!existing) throw new Error('Transaction পাওয়া যায়নি।');
  const updated = {
    ...existing,
    date: data.date || existing.date,
    type: data.type,
    mainCategory: String(data.mainCategory).trim(),
    subCategory: String(data.subCategory || 'General').trim() || 'General',
    childCategory: String(data.childCategory || 'General').trim() || 'General',
    description: String(data.description || '').trim(),
    amount: round2(Number(data.amount)),
    paymentMethod: String(data.paymentMethod || 'Cash').trim() || 'Cash'
  };
  await reqToPromise(store.put(updated));
  return updated;
}

async function deleteTransaction(id) {
  const store = await tx(STORES.TRANSACTIONS, 'readwrite');
  const existing = await reqToPromise(store.get(id));
  if (!existing) throw new Error('Transaction পাওয়া যায়নি।');
  await reqToPromise(store.delete(id));
  return true;
}

/* ---------------- Settings ---------------- */
async function getSetting(key, fallback) {
  const store = await tx(STORES.SETTINGS, 'readonly');
  const rec = await reqToPromise(store.get(key));
  return rec ? rec.value : fallback;
}
async function setSetting(key, value) {
  const store = await tx(STORES.SETTINGS, 'readwrite');
  await reqToPromise(store.put({ key, value }));
}

/* ---------------- Backup / Restore ---------------- */
async function exportAll() {
  const [transactions, categories] = await Promise.all([getTransactions(), getCategories(true)]);
  return { version: 1, exportedAt: new Date().toISOString(), transactions, categories };
}

async function importAll(data) {
  if (!data || !Array.isArray(data.transactions) || !Array.isArray(data.categories)) {
    throw new Error('Backup ফাইলটি সঠিক ফরম্যাটে নেই।');
  }
  const db = await openDB();
  await new Promise((resolve, reject) => {
    const t = db.transaction([STORES.TRANSACTIONS, STORES.CATEGORIES], 'readwrite');
    const txStore = t.objectStore(STORES.TRANSACTIONS);
    const catStore = t.objectStore(STORES.CATEGORIES);
    txStore.clear();
    catStore.clear();
    data.transactions.forEach((r) => txStore.put(r));
    data.categories.forEach((r) => catStore.put(r));
    t.oncomplete = resolve;
    t.onerror = () => reject(t.error);
  });
  return true;
}

window.DB = {
  addCategory, getCategories, disableCategory,
  addTransaction, getTransactions, updateTransaction, deleteTransaction,
  getSetting, setSetting, exportAll, importAll
};

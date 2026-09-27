'use strict';

/*
 * এই ফাইলটাই আগের IndexedDB সংস্করণের বদলে Supabase (cloud Postgres) ব্যবহার
 * করে — একই window.DB ফাংশনগুলো, তাই app.js-এ প্রায় কিছুই বদলাতে হয়নি।
 */

const supabaseClient = window.supabase.createClient(
  window.SUPABASE_CONFIG.url,
  window.SUPABASE_CONFIG.anonKey
);

/* ---------------- Auth ---------------- */
async function signUp(email, password) {
  const { data, error } = await supabaseClient.auth.signUp({ email, password });
  if (error) throw new Error(error.message);
  return data;
}
async function signIn(email, password) {
  const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
  if (error) throw new Error(error.message);
  return data;
}
async function signOut() {
  const { error } = await supabaseClient.auth.signOut();
  if (error) throw new Error(error.message);
}
async function getCurrentSession() {
  const { data } = await supabaseClient.auth.getSession();
  return data.session;
}
function onAuthStateChange(callback) {
  supabaseClient.auth.onAuthStateChange((_event, session) => callback(session));
}
async function currentUserId() {
  const session = await getCurrentSession();
  if (!session) throw new Error('লগইন প্রয়োজন।');
  return session.user.id;
}

/* ---------------- row <-> app object mapping ---------------- */
function mapCategoryFromDb(r) {
  return { id: r.id, type: r.type, mainCategory: r.main_category, subCategory: r.sub_category, childCategory: r.child_category, status: r.status };
}
function mapTransactionFromDb(r) {
  return {
    id: r.id, date: r.date, type: r.type, mainCategory: r.main_category, subCategory: r.sub_category,
    childCategory: r.child_category, description: r.description || '', amount: Number(r.amount) || 0,
    paymentMethod: r.payment_method, timestamp: r.created_at
  };
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

  const uid = await currentUserId();
  const { data, error } = await supabaseClient
    .from('categories')
    .insert({ user_id: uid, type, main_category: main, sub_category: sub, child_category: child, status: 'Active' })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return mapCategoryFromDb(data);
}

async function getCategories(includeInactive) {
  const { data, error } = await supabaseClient.from('categories').select('*').order('created_at');
  if (error) throw new Error(error.message);
  const rows = (data || []).map(mapCategoryFromDb);
  return includeInactive ? rows : rows.filter((c) => c.status !== 'Inactive');
}

async function disableCategory({ type, mainCategory, subCategory, childCategory }) {
  const all = await getCategories(true);
  const match = all.find((c) => c.type === type && c.mainCategory === String(mainCategory).trim() &&
    c.subCategory === String(subCategory || 'General').trim() && c.childCategory === String(childCategory || 'General').trim());
  if (!match) throw new Error('Category পাওয়া যায়নি।');
  const { error } = await supabaseClient.from('categories').update({ status: 'Inactive' }).eq('id', match.id);
  if (error) throw new Error(error.message);
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
  const uid = await currentUserId();
  const record = {
    user_id: uid,
    date: data.date || new Date().toISOString().slice(0, 10),
    type: data.type,
    main_category: String(data.mainCategory).trim(),
    sub_category: String(data.subCategory || 'General').trim() || 'General',
    child_category: String(data.childCategory || 'General').trim() || 'General',
    description: String(data.description || '').trim(),
    amount: round2(Number(data.amount)),
    payment_method: String(data.paymentMethod || 'Cash').trim() || 'Cash'
  };
  const { data: inserted, error } = await supabaseClient.from('transactions').insert(record).select().single();
  if (error) throw new Error(error.message);
  return mapTransactionFromDb(inserted);
}

async function getTransactions() {
  const { data, error } = await supabaseClient.from('transactions').select('*').order('created_at');
  if (error) throw new Error(error.message);
  return (data || []).map(mapTransactionFromDb);
}

async function updateTransaction(data) {
  if (!data.id) throw new Error('Transaction ID প্রয়োজন।');
  validateTx(data);
  const patch = {
    date: data.date,
    type: data.type,
    main_category: String(data.mainCategory).trim(),
    sub_category: String(data.subCategory || 'General').trim() || 'General',
    child_category: String(data.childCategory || 'General').trim() || 'General',
    description: String(data.description || '').trim(),
    amount: round2(Number(data.amount)),
    payment_method: String(data.paymentMethod || 'Cash').trim() || 'Cash'
  };
  const { data: updated, error } = await supabaseClient.from('transactions').update(patch).eq('id', data.id).select().single();
  if (error) throw new Error(error.message);
  return mapTransactionFromDb(updated);
}

async function deleteTransaction(id) {
  const { error } = await supabaseClient.from('transactions').delete().eq('id', id);
  if (error) throw new Error(error.message);
  return true;
}

/* ---------------- Backup / Restore (still handy even with cloud sync) ---------------- */
async function exportAll() {
  const [transactions, categories] = await Promise.all([getTransactions(), getCategories(true)]);
  return { version: 1, exportedAt: new Date().toISOString(), transactions, categories };
}

async function importAll(data) {
  if (!data || !Array.isArray(data.transactions) || !Array.isArray(data.categories)) {
    throw new Error('Backup ফাইলটি সঠিক ফরম্যাটে নেই।');
  }
  for (const c of data.categories) {
    try { await addCategory(c); } catch (e) { /* duplicate or invalid - skip */ }
  }
  for (const t of data.transactions) {
    try { await addTransaction(t); } catch (e) { /* invalid row - skip */ }
  }
  return true;
}

window.DB = {
  addCategory, getCategories, disableCategory,
  addTransaction, getTransactions, updateTransaction, deleteTransaction,
  exportAll, importAll,
  signUp, signIn, signOut, getCurrentSession, onAuthStateChange, currentUserId
};

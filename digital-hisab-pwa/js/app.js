'use strict';

let allTransactions = [];
let allCategories = [];
let deferredInstallPrompt = null;

document.addEventListener('DOMContentLoaded', boot);

function boot() {
  registerServiceWorker();
  setupInstallPrompt();
  setupNavigation();
  setToday();
  setupYears();
  setupEntryEvents();
  setupReportEvents();
  setupMonthlyEvents();
  setupCategoryEvents();
  setupEditEvents();
  setupBackupEvents();
  setupHelpEvents();
  loadCategories();
  loadDashboard();
}

function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('service-worker.js').catch((e) => console.warn('SW register failed', e));
  }
}

function setupInstallPrompt() {
  const btn = document.getElementById('installBtn');
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredInstallPrompt = e;
    btn.classList.remove('hidden');
  });
  btn.addEventListener('click', async () => {
    if (!deferredInstallPrompt) return;
    deferredInstallPrompt.prompt();
    await deferredInstallPrompt.userChoice;
    deferredInstallPrompt = null;
    btn.classList.add('hidden');
  });
  window.addEventListener('appinstalled', () => btn.classList.add('hidden'));
}

/* ---------------- navigation ---------------- */
function setupNavigation() {
  document.querySelectorAll('.bottomnav button[data-page]').forEach((btn) => {
    btn.addEventListener('click', () => showPage(btn.dataset.page, btn));
  });
}

function showPage(page, element) {
  document.querySelectorAll('.page').forEach((p) => p.classList.remove('active'));
  document.getElementById(page).classList.add('active');
  document.querySelectorAll('.bottomnav button').forEach((b) => b.classList.remove('active'));
  if (element) element.classList.add('active');

  if (page === 'dashboard') loadDashboard();
  if (page === 'entry') loadMainCategories('entry');
  if (page === 'reports') loadTransactions();
  if (page === 'monthly') setupYears();
  if (page === 'categories') renderCategoryTree();
  if (page === 'profile') refreshProfile();
}

function setToday() { const d = document.getElementById('date'); if (d) d.value = new Date().toISOString().slice(0, 10); }

/* ---------------- categories ---------------- */
function loadCategories() {
  DB.getCategories().then((data) => {
    allCategories = data || [];
    loadMainCategories('entry');
    loadReportFilters();
    renderCategoryTree();
  }).catch(showError);
}

function unique(values) { return [...new Set(values.filter((v) => v !== null && v !== undefined && String(v).trim() !== ''))]; }

function populateSelect(id, items, placeholder) {
  const select = document.getElementById(id);
  if (!select) return;
  select.innerHTML = '';
  const first = document.createElement('option'); first.value = ''; first.textContent = placeholder;
  select.appendChild(first);
  items.forEach((item) => { const o = document.createElement('option'); o.value = item; o.textContent = item; select.appendChild(o); });
}

function setupEntryEvents() {
  document.getElementById('type').addEventListener('change', () => loadMainCategories('entry'));
  document.getElementById('mainCategory').addEventListener('change', () => loadSubCategories('entry'));
  document.getElementById('subCategory').addEventListener('change', () => loadChildCategories('entry'));
  document.getElementById('transactionForm').addEventListener('submit', submitTransaction);
  document.getElementById('resetEntryBtn').addEventListener('click', () => setTimeout(resetEntry, 50));
}

function loadMainCategories(mode) {
  const ids = fieldIds(mode);
  const type = value(ids.type);
  const mains = unique(allCategories.filter((c) => c.type === type).map((c) => c.mainCategory));
  populateSelect(ids.main, mains, 'Select Main Category');
  populateSelect(ids.sub, [], 'Select Sub Category');
  populateSelect(ids.child, [], 'Select Child Category');
}
function loadSubCategories(mode) {
  const ids = fieldIds(mode);
  const type = value(ids.type), main = value(ids.main);
  const subs = unique(allCategories.filter((c) => c.type === type && c.mainCategory === main).map((c) => c.subCategory));
  populateSelect(ids.sub, subs, 'Select Sub Category');
  populateSelect(ids.child, [], 'Select Child Category');
}
function loadChildCategories(mode) {
  const ids = fieldIds(mode);
  const type = value(ids.type), main = value(ids.main), sub = value(ids.sub);
  const children = unique(allCategories.filter((c) => c.type === type && c.mainCategory === main && c.subCategory === sub).map((c) => c.childCategory));
  populateSelect(ids.child, children, 'Select Child Category');
}
function fieldIds(mode) {
  return mode === 'entry'
    ? { type: 'type', main: 'mainCategory', sub: 'subCategory', child: 'childCategory' }
    : { type: 'editType', main: 'editMainCategory', sub: 'editSubCategory', child: 'editChildCategory' };
}

function submitTransaction(event) {
  event.preventDefault();
  const data = {
    date: value('date'), type: value('type'), mainCategory: value('mainCategory'),
    subCategory: value('subCategory'), childCategory: value('childCategory'),
    amount: value('amount'), paymentMethod: value('paymentMethod'), description: value('description')
  };
  if (!data.type || !data.mainCategory || !data.subCategory || !data.childCategory) { showToast('⚠️ সব Category নির্বাচন করুন'); return; }
  if (!data.amount || Number(data.amount) <= 0) { showToast('⚠️ Amount সঠিকভাবে দিন'); return; }
  DB.addTransaction(data).then(() => {
    showToast('✅ হিসাব সংরক্ষণ হয়েছে');
    document.getElementById('transactionForm').reset();
    setToday(); loadMainCategories('entry'); loadDashboard();
  }).catch(showError);
}
function resetEntry() { setToday(); loadMainCategories('entry'); }

/* ---------------- dashboard ---------------- */
async function loadDashboard() {
  try {
    const transactions = await DB.getTransactions();
    const data = computeDashboard(transactions);
    setText('totalIncome', money(data.totalIncome)); setText('totalExpense', money(data.totalExpense));
    setText('balance', money(data.balance)); setText('savingsRate', data.savingsRate.toFixed(1) + '%');
    setText('todayIncome', money(data.todayIncome)); setText('todayExpense', money(data.todayExpense));
    setText('monthIncome', money(data.monthIncome)); setText('monthExpense', money(data.monthExpense));
    setText('yearIncome', money(data.yearIncome)); setText('yearExpense', money(data.yearExpense)); setText('yearBalance', money(data.yearBalance));

    Charts.drawGroupedBarChart(document.getElementById('monthlyChart'), data.monthlyLabels, [
      { name: 'Income', color: '#059669', values: data.monthlyIncome },
      { name: 'Expense', color: '#dc2626', values: data.monthlyExpense }
    ]);
    Charts.drawDoughnutChart(document.getElementById('categoryChart'), data.categoryLabels, data.categoryValues);
  } catch (e) { showError(e); }
}

function computeDashboard(rows) {
  const now = new Date();
  const todayKey = now.toISOString().slice(0, 10);
  const currentMonthKey = now.toISOString().slice(0, 7);
  const currentYear = String(now.getFullYear());

  let totalIncome = 0, totalExpense = 0, todayIncome = 0, todayExpense = 0;
  let monthIncome = 0, monthExpense = 0, yearIncome = 0, yearExpense = 0;
  const monthlyMap = {}, categoryMap = {};

  rows.forEach((r) => {
    const amount = Number(r.amount) || 0;
    if (!amount) return;
    const d = new Date(r.date);
    if (isNaN(d.getTime())) return;
    const dateKey = d.toISOString().slice(0, 10);
    const monthKey = d.toISOString().slice(0, 7);
    const yearKey = String(d.getFullYear());
    const category = r.childCategory || r.subCategory || r.mainCategory || 'Uncategorized';
    if (!monthlyMap[monthKey]) monthlyMap[monthKey] = { income: 0, expense: 0 };

    if (r.type === 'Income') {
      totalIncome += amount; monthlyMap[monthKey].income += amount;
      if (dateKey === todayKey) todayIncome += amount;
      if (monthKey === currentMonthKey) monthIncome += amount;
      if (yearKey === currentYear) yearIncome += amount;
    } else if (r.type === 'Expense') {
      totalExpense += amount; monthlyMap[monthKey].expense += amount;
      if (dateKey === todayKey) todayExpense += amount;
      if (monthKey === currentMonthKey) monthExpense += amount;
      if (yearKey === currentYear) yearExpense += amount;
      categoryMap[category] = (categoryMap[category] || 0) + amount;
    }
  });

  const monthlyLabels = [], monthlyIncome = [], monthlyExpense = [];
  for (let i = 5; i >= 0; i--) {
    const md = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = md.toISOString().slice(0, 7);
    monthlyLabels.push(md.toLocaleDateString('en-US', { month: 'short' }));
    monthlyIncome.push(monthlyMap[key] ? monthlyMap[key].income : 0);
    monthlyExpense.push(monthlyMap[key] ? monthlyMap[key].expense : 0);
  }

  const categoryLabels = Object.keys(categoryMap);
  const categoryValues = categoryLabels.map((k) => categoryMap[k]);
  const balance = totalIncome - totalExpense;
  const savingsRate = totalIncome > 0 ? (balance / totalIncome) * 100 : 0;

  return {
    totalIncome, totalExpense, balance, savingsRate,
    todayIncome, todayExpense, monthIncome, monthExpense,
    yearIncome, yearExpense, yearBalance: yearIncome - yearExpense,
    monthlyLabels, monthlyIncome, monthlyExpense, categoryLabels, categoryValues
  };
}

/* ---------------- reports ---------------- */
async function loadTransactions() {
  try { allTransactions = await DB.getTransactions(); renderTransactions(allTransactions); }
  catch (e) { showError(e); }
}

function renderTransactions(data) {
  const list = document.getElementById('transactionList');
  if (!list) return;
  list.innerHTML = '';
  if (!data || !data.length) { list.innerHTML = '<div class="empty-note">কোনো হিসাব পাওয়া যায়নি</div>'; return; }

  data.slice().reverse().forEach((t) => {
    const badgeClass = t.type === 'Income' ? 'badge-income' : 'badge-expense';
    const amtColor = t.type === 'Income' ? 'income' : 'expense';
    const div = document.createElement('div');
    div.className = 'tx-item';
    div.innerHTML = `
      <div class="tx-main">
        <span class="badge ${badgeClass}">${esc(t.type)}</span>
        <div class="tx-cat">${esc(t.mainCategory)} › ${esc(t.subCategory)} › ${esc(t.childCategory)}</div>
        <div class="tx-sub">${esc(t.date)} · ${esc(t.paymentMethod)}${t.description ? ' · ' + esc(t.description) : ''}</div>
        <div class="tx-actions">
          <button class="edit-btn" data-id="${esc(t.id)}">✏️ Edit</button>
          <button class="delete-btn" data-id="${esc(t.id)}">🗑️ Delete</button>
        </div>
      </div>
      <div class="tx-amt ${amtColor}">${money(t.amount)}</div>`;
    list.appendChild(div);
  });

  list.querySelectorAll('.edit-btn').forEach((b) => b.addEventListener('click', () => openEdit(b.dataset.id)));
  list.querySelectorAll('.delete-btn').forEach((b) => b.addEventListener('click', () => removeTransaction(b.dataset.id)));
}

function setupReportEvents() {
  document.getElementById('filterType').addEventListener('change', loadReportFilters);
  document.getElementById('filterMain').addEventListener('change', loadReportSub);
  document.getElementById('filterSub').addEventListener('change', loadReportChild);
  document.getElementById('searchBtn').addEventListener('click', applyFilters);
  document.getElementById('clearFilterBtn').addEventListener('click', clearFilters);
}
function loadReportFilters() {
  const type = value('filterType');
  const mains = unique(allCategories.filter((c) => !type || c.type === type).map((c) => c.mainCategory));
  populateSelect('filterMain', mains, 'All Main Category'); populateSelect('filterSub', [], 'All Sub Category'); populateSelect('filterChild', [], 'All Child Category');
}
function loadReportSub() {
  const type = value('filterType'), main = value('filterMain');
  const subs = unique(allCategories.filter((c) => (!type || c.type === type) && c.mainCategory === main).map((c) => c.subCategory));
  populateSelect('filterSub', subs, 'All Sub Category'); populateSelect('filterChild', [], 'All Child Category');
}
function loadReportChild() {
  const type = value('filterType'), main = value('filterMain'), sub = value('filterSub');
  const children = unique(allCategories.filter((c) => (!type || c.type === type) && c.mainCategory === main && c.subCategory === sub).map((c) => c.childCategory));
  populateSelect('filterChild', children, 'All Child Category');
}

function applyFilters() {
  const filters = { startDate: value('startDate'), endDate: value('endDate'), type: value('filterType'), mainCategory: value('filterMain'), subCategory: value('filterSub'), childCategory: value('filterChild'), paymentMethod: value('filterPayment'), search: value('search') };
  let transactions = allTransactions.slice();
  transactions = filterTransactions(transactions, filters);
  const income = transactions.filter((t) => t.type === 'Income').reduce((s, t) => s + (Number(t.amount) || 0), 0);
  const expense = transactions.filter((t) => t.type === 'Expense').reduce((s, t) => s + (Number(t.amount) || 0), 0);
  setText('reportIncome', money(income)); setText('reportExpense', money(expense)); setText('reportBalance', money(income - expense));
  renderTransactions(transactions);
}

function filterTransactions(transactions, filters) {
  if (filters.startDate) transactions = transactions.filter((t) => t.date >= String(filters.startDate));
  if (filters.endDate) transactions = transactions.filter((t) => t.date <= String(filters.endDate));
  if (filters.type) transactions = transactions.filter((t) => t.type === filters.type);
  if (filters.mainCategory) transactions = transactions.filter((t) => t.mainCategory === filters.mainCategory);
  if (filters.subCategory) transactions = transactions.filter((t) => t.subCategory === filters.subCategory);
  if (filters.childCategory) transactions = transactions.filter((t) => t.childCategory === filters.childCategory);
  if (filters.paymentMethod) transactions = transactions.filter((t) => t.paymentMethod === filters.paymentMethod);
  if (filters.search) {
    const s = String(filters.search).toLowerCase();
    transactions = transactions.filter((t) => [t.id, t.type, t.mainCategory, t.subCategory, t.childCategory, t.description, t.paymentMethod]
      .join(' ').toLowerCase().indexOf(s) !== -1);
  }
  return transactions;
}

function clearFilters() {
  ['startDate', 'endDate', 'filterType', 'filterPayment', 'search'].forEach((id) => document.getElementById(id).value = '');
  loadReportFilters(); loadTransactions();
}

/* ---------------- monthly closing ---------------- */
function setupMonthlyEvents() {
  document.getElementById('monthlyGenerateBtn').addEventListener('click', loadMonthlyReport);
  document.getElementById('printBtn').addEventListener('click', () => window.print());
}
function setupYears() {
  const select = document.getElementById('reportYear'); if (!select) return;
  select.innerHTML = '';
  const current = new Date().getFullYear();
  for (let y = current - 5; y <= current + 1; y++) {
    const o = document.createElement('option'); o.value = y; o.textContent = y; if (y === current) o.selected = true;
    select.appendChild(o);
  }
  document.getElementById('reportMonth').value = new Date().getMonth() + 1;
}
async function loadMonthlyReport() {
  const year = Number(value('reportYear')), month = Number(value('reportMonth'));
  const mm = String(month).padStart(2, '0');
  const lastDay = new Date(year, month, 0).getDate();
  const filters = { startDate: `${year}-${mm}-01`, endDate: `${year}-${mm}-${String(lastDay).padStart(2, '0')}` };
  const transactions = filterTransactions(allTransactions.length ? allTransactions.slice() : await DB.getTransactions(), filters);
  const income = transactions.filter((t) => t.type === 'Income').reduce((s, t) => s + (Number(t.amount) || 0), 0);
  const expense = transactions.filter((t) => t.type === 'Expense').reduce((s, t) => s + (Number(t.amount) || 0), 0);

  let rows = '';
  transactions.slice().reverse().forEach((t) => {
    rows += `<div class="tx-item"><div class="tx-main"><span class="badge ${t.type === 'Income' ? 'badge-income' : 'badge-expense'}">${esc(t.type)}</span>
      <div class="tx-cat">${esc(t.mainCategory)} › ${esc(t.subCategory)} › ${esc(t.childCategory)}</div>
      <div class="tx-sub">${esc(t.date)}${t.description ? ' · ' + esc(t.description) : ''}</div></div>
      <div class="tx-amt ${t.type === 'Income' ? 'income' : 'expense'}">${money(t.amount)}</div></div>`;
  });

  document.getElementById('monthlyResult').innerHTML = `
    <div class="form-card">
      <div class="stat-grid">
        <div class="stat"><h4>Total Income</h4><strong class="income">${money(income)}</strong></div>
        <div class="stat"><h4>Total Expense</h4><strong class="expense">${money(expense)}</strong></div>
        <div class="stat"><h4>Closing Balance</h4><strong class="balance">${money(income - expense)}</strong></div>
      </div>
    </div>
    <div class="tx-list">${rows || '<div class="empty-note">কোনো হিসাব পাওয়া যায়নি</div>'}</div>`;
}

/* ---------------- category management ---------------- */
function setupCategoryEvents() { document.getElementById('addCategoryBtn').addEventListener('click', addNewCategory); }
function addNewCategory() {
  const type = value('categoryType');
  const main = value('newMainCategory').trim(), sub = value('newSubCategory').trim(), child = value('newChildCategory').trim();
  if (!main || !sub || !child) { showToast('⚠️ Main, Sub এবং Child Category দিন'); return; }
  DB.addCategory({ type, mainCategory: main, subCategory: sub, childCategory: child }).then(() => {
    showToast('✅ Category added');
    ['newMainCategory', 'newSubCategory', 'newChildCategory'].forEach((id) => document.getElementById(id).value = '');
    loadCategories();
  }).catch(showError);
}
function renderCategoryTree() {
  const box = document.getElementById('categoryHierarchy'); if (!box) return;
  box.innerHTML = '';
  if (!allCategories.length) { box.innerHTML = '<div class="empty-note">এখনো কোনো Category যোগ করা হয়নি</div>'; return; }
  ['Income', 'Expense'].forEach((type) => {
    const rows = allCategories.filter((c) => c.type === type);
    if (!rows.length) return;
    const typeDiv = document.createElement('div'); typeDiv.className = 'tree-type'; typeDiv.textContent = type === 'Income' ? '💚 Income' : '🔴 Expense';
    box.appendChild(typeDiv);
    unique(rows.map((c) => c.mainCategory)).forEach((main) => {
      const mainDiv = document.createElement('div'); mainDiv.className = 'tree-main'; mainDiv.textContent = '📁 ' + main;
      box.appendChild(mainDiv);
      unique(rows.filter((c) => c.mainCategory === main).map((c) => c.subCategory)).forEach((sub) => {
        const subDiv = document.createElement('div'); subDiv.className = 'tree-sub';
        const strong = document.createElement('strong'); strong.textContent = '📂 ' + sub;
        subDiv.appendChild(strong); subDiv.appendChild(document.createElement('br'));
        rows.filter((c) => c.mainCategory === main && c.subCategory === sub).forEach((c) => {
          const chip = document.createElement('span'); chip.className = 'tree-child';
          chip.innerHTML = `• ${esc(c.childCategory)} <button data-type="${esc(c.type)}" data-main="${esc(c.mainCategory)}" data-sub="${esc(c.subCategory)}" data-child="${esc(c.childCategory)}">✕</button>`;
          subDiv.appendChild(chip);
        });
        box.appendChild(subDiv);
      });
    });
  });
  box.querySelectorAll('.tree-child button').forEach((b) => b.addEventListener('click', () =>
    removeCategory(b.dataset.type, b.dataset.main, b.dataset.sub, b.dataset.child)));
}
function removeCategory(type, main, sub, child) {
  if (!confirm('এই Child Category disable করতে চান?')) return;
  DB.disableCategory({ type, mainCategory: main, subCategory: sub, childCategory: child }).then(() => { showToast('Category disabled'); loadCategories(); }).catch(showError);
}

/* ---------------- edit modal ---------------- */
function setupEditEvents() {
  document.getElementById('editType').addEventListener('change', () => loadMainCategories('edit'));
  document.getElementById('editMainCategory').addEventListener('change', () => loadSubCategories('edit'));
  document.getElementById('editSubCategory').addEventListener('change', () => loadChildCategories('edit'));
  document.getElementById('closeEditBtn').addEventListener('click', closeEdit);
  document.getElementById('cancelEditBtn').addEventListener('click', closeEdit);
  document.getElementById('saveEditBtn').addEventListener('click', saveEdit);
  window.addEventListener('click', (e) => { if (e.target === document.getElementById('editModal')) closeEdit(); });
}
function openEdit(id) {
  const t = allTransactions.find((x) => String(x.id) === String(id));
  if (!t) { showToast('Transaction not found'); return; }
  document.getElementById('editId').value = t.id;
  document.getElementById('editDate').value = t.date;
  document.getElementById('editType').value = t.type;
  loadMainCategories('edit'); document.getElementById('editMainCategory').value = t.mainCategory;
  loadSubCategories('edit'); document.getElementById('editSubCategory').value = t.subCategory;
  loadChildCategories('edit'); document.getElementById('editChildCategory').value = t.childCategory;
  document.getElementById('editAmount').value = t.amount;
  document.getElementById('editPayment').value = t.paymentMethod;
  document.getElementById('editDescription').value = t.description || '';
  document.getElementById('editModal').style.display = 'flex';
}
function closeEdit() { document.getElementById('editModal').style.display = 'none'; }
function saveEdit() {
  const data = { id: value('editId'), date: value('editDate'), type: value('editType'), mainCategory: value('editMainCategory'), subCategory: value('editSubCategory'), childCategory: value('editChildCategory'), amount: value('editAmount'), paymentMethod: value('editPayment'), description: value('editDescription') };
  DB.updateTransaction(data).then(() => { showToast('✅ Transaction updated'); closeEdit(); loadTransactions(); loadDashboard(); }).catch(showError);
}
function removeTransaction(id) {
  if (!confirm('এই transaction delete করতে চান?')) return;
  DB.deleteTransaction(id).then(() => { showToast('🗑️ Transaction deleted'); loadTransactions(); loadDashboard(); }).catch(showError);
}

/* ---------------- backup / restore ---------------- */
function setupBackupEvents() {
  document.getElementById('exportBtn').addEventListener('click', doExport);
  document.getElementById('importBtnTrigger').addEventListener('click', () => document.getElementById('importFile').click());
  document.getElementById('importFile').addEventListener('change', doImport);
}
async function doExport() {
  try {
    const data = await DB.exportAll();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `digital-hisab-backup-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
    showToast('✅ Backup ডাউনলোড হয়েছে');
  } catch (e) { showError(e); }
}
function doImport(event) {
  const file = event.target.files[0];
  if (!file) return;
  if (!confirm('বর্তমান সব ডেটা মুছে backup ফাইল থেকে replace হবে। এগিয়ে যেতে চান?')) { event.target.value = ''; return; }
  const reader = new FileReader();
  reader.onload = async () => {
    try {
      const data = JSON.parse(reader.result);
      await DB.importAll(data);
      showToast('✅ Backup restore হয়েছে');
      loadCategories(); loadDashboard(); loadTransactions();
    } catch (e) { showError(e); }
    event.target.value = '';
  };
  reader.readAsText(file);
}

function setupHelpEvents() {
  document.getElementById('helpBtn').addEventListener('click', () => showPage('help', null));
  document.getElementById('helpBackBtn').addEventListener('click', () => showPage('profile', document.querySelector('.bottomnav button[data-page="profile"]')));
}

async function refreshProfile() {
  try { const transactions = await DB.getTransactions(); setText('profileTxCount', transactions.length); }
  catch (e) { /* ignore */ }
}

/* ---------------- utilities ---------------- */
function value(id) { const el = document.getElementById(id); return el ? el.value : ''; }
function setText(id, text) { const el = document.getElementById(id); if (el) el.textContent = text; }
function money(v) { return '৳ ' + Number(v || 0).toLocaleString('en-BD', { maximumFractionDigits: 2 }); }
function esc(v) { return String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;'); }
function showToast(message) {
  const toast = document.getElementById('toast'); if (!toast) return;
  toast.textContent = message; toast.style.display = 'block';
  clearTimeout(window.toastTimer);
  window.toastTimer = setTimeout(() => { toast.style.display = 'none'; }, 2800);
}
function showError(error) { console.error(error); showToast('❌ ' + (error && error.message ? error.message : 'Something went wrong')); }

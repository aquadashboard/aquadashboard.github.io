/* =============================================================================
   AquaDashboard — Firebase + Dashboard Logic
   Reads OOO data from Firestore and renders the dashboard.
   ============================================================================= */

// --- Firebase Configuration ---
const firebaseConfig = {
  apiKey: "AIzaSyD09Jljs6vus9q-nhsX16dteGsJQqgeHgU",
  authDomain: "aquaooo.firebaseapp.com",
  projectId: "aquaooo",
  storageBucket: "aquaooo.firebasestorage.app",
  messagingSenderId: "936035698294",
  appId: "1:936035698294:web:91a7428c24bb14920ac157",
  measurementId: "G-T0PW76LBMW"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

// --- DOM References ---
const deptSelect = document.getElementById('dept-search');
const nameInput = document.getElementById('name-search');
const body = document.getElementById('dashboard-body');
const emptyState = document.getElementById('empty-state');
const headerDate = document.getElementById('header-date');
const hcOoo = document.getElementById('hc-ooo');
const hcOffsite = document.getElementById('hc-offsite');
const overlay = document.getElementById('loading-overlay');
const page = document.getElementById('page');
const lastUpdated = document.getElementById('last-updated');

// Preferences controls
const themeToggle = document.getElementById('theme-toggle');
const zoomOutBtn = document.getElementById('zoom-out');
const zoomInBtn = document.getElementById('zoom-in');
const zoomResetBtn = document.getElementById('zoom-reset');
const viewsSelect = document.getElementById('views-select');
const viewSaveBtn = document.getElementById('view-save');
const viewDeleteBtn = document.getElementById('view-delete');


// ============================================================================
// DATA FETCHING
// ============================================================================

/**
 * Fetch the latest OOO report from Firestore.
 *
 * Firestore document structure (collection: "ooo_reports"):
 *   Document ID: YYYY-MM-DD (e.g. "2026-07-16")
 *   Fields:
 *     date       : string — "Wednesday, July 16, 2026"
 *     updated_at : Firestore Timestamp
 *     ooo_count  : number
 *     offsite_count : number
 *     departments: object — { "Engineering": [ {person, display, status}, ... ], ... }
 */
async function fetchLatestReport() {
  try {
    // Get the most recent report by ordering by date descending
    const snapshot = await db.collection('ooo_reports')
      .orderBy('updated_at', 'desc')
      .limit(1)
      .get();

    if (snapshot.empty) {
      return null;
    }

    const doc = snapshot.docs[0];
    return { id: doc.id, ...doc.data() };
  } catch (err) {
    console.error('Error fetching OOO data:', err);
    return null;
  }
}


// ============================================================================
// RENDERING
// ============================================================================

/**
 * Determine CSS class for a status display string.
 */
function statusClass(displayStr) {
  const lower = (displayStr || '').toLowerCase();
  if (lower === 'ooo') return 'status-ooo';
  if (lower.includes('offsite')) return 'status-offsite';
  if (lower.startsWith('out')) return 'status-out';
  return 'time';
}

/**
 * Determine data-status attribute value for filtering.
 */
function statusFilter(displayStr) {
  const lower = (displayStr || '').toLowerCase();
  if (lower.includes('offsite')) return 'offsite';
  return 'ooo';
}

/**
 * Render the full dashboard from report data.
 */
function renderDashboard(report) {
  // Update header
  headerDate.textContent = report.date || '';
  hcOoo.textContent = report.ooo_count || 0;
  hcOffsite.textContent = report.offsite_count || 0;

  // Updated timestamp
  if (report.updated_at) {
    const ts = report.updated_at.toDate
      ? report.updated_at.toDate()
      : new Date(report.updated_at);
    lastUpdated.textContent = ` · Last updated: ${ts.toLocaleString()}`;
  }

  const departments = report.departments || {};
  const deptNames = Object.keys(departments).sort();

  // If no data, show empty state
  if (deptNames.length === 0) {
    emptyState.style.display = '';
    return;
  }

  // Build department dropdown
  deptSelect.innerHTML = '<option value="">All Departments</option>';
  deptNames.forEach(dept => {
    const opt = document.createElement('option');
    opt.value = dept.toLowerCase();
    opt.textContent = dept;
    deptSelect.appendChild(opt);
  });

  // Build department cards
  let html = '';

  // Summary bar
  html += '<div class="summary-bar">';
  html += '<a href="https://aqualocator.github.io/" target="_blank" rel="noopener">';
  html += '&#128205;&nbsp;View AquaLocator (employee directory &amp; locator)</a>';
  html += '</div>';

  // Legend
  html += '<div class="legend">';
  html += '<span class="legend-ooo">&#9679;&nbsp;OOO</span>';
  html += '<span class="legend-offsite">&#9679;&nbsp;Offsite</span>';
  html += '<span class="legend-out">&#9679;&nbsp;Out (partial day)</span>';
  html += '</div>';

  // Departments grid
  html += '<div class="depts-grid">';

  deptNames.forEach((dept, deptIdx) => {
    const records = departments[dept] || [];

    html += `<div class="dept" data-dept="${dept.toLowerCase()}" style="animation-delay:${deptIdx * 0.06}s">`;
    html += '<div class="dept-header">';
    html += '<span class="dept-dot"></span>';
    html += `<span class="dept-name">${escapeHtml(dept)}</span>`;
    html += `<span class="dept-count">${records.length}</span>`;
    html += '</div>';
    html += '<div class="dept-table-wrap"><table>';

    records.forEach(rec => {
      const display = rec.display || 'OOO';
      const cls = statusClass(display);
      const sf = statusFilter(display);
      html += `<tr data-name="${escapeHtml((rec.person || '').toLowerCase())}" data-status="${sf}">`;
      html += `<td class="name">${escapeHtml(rec.person || '')}</td>`;
      html += `<td class="${cls}">${escapeHtml(display)}</td>`;
      html += '</tr>';
    });

    html += '</table></div></div>';
  });

  html += '</div>';

  // No-results placeholder
  html += '<p class="no-results" id="no-results" style="display:none;">No departments match your search.</p>';

  body.innerHTML = html;
}


// ============================================================================
// FILTERS
// ============================================================================

function getStatusFilterValue() {
  const sel = document.querySelector('.status-filter input[type=radio]:checked');
  return sel ? sel.value : 'all';
}

function applyFilters() {
  const deptQ = deptSelect.value.trim().toLowerCase();
  const nameQ = nameInput.value.trim().toLowerCase();
  const statusQ = getStatusFilterValue();
  const depts = document.querySelectorAll('.dept');
  let anyVisible = 0;

  depts.forEach(d => {
    const deptName = d.getAttribute('data-dept') || '';
    const deptMatch = !deptQ || deptName === deptQ;

    const rows = d.querySelectorAll('tr[data-name]');
    let visibleRows = 0;

    rows.forEach(row => {
      const rName = row.getAttribute('data-name') || '';
      const rStatus = row.getAttribute('data-status') || '';
      const nameMatch = !nameQ || rName.indexOf(nameQ) !== -1;
      const statusMatch = statusQ === 'all' || rStatus === statusQ;
      const rowMatch = nameMatch && statusMatch;
      row.style.display = rowMatch ? '' : 'none';
      if (rowMatch) visibleRows++;
    });

    // Update section count badge
    const countEl = d.querySelector('.dept-count');
    if (countEl) countEl.textContent = visibleRows;

    const show = deptMatch && visibleRows > 0;
    d.style.display = show ? '' : 'none';
    if (show) anyVisible++;
  });

  const noResults = document.getElementById('no-results');
  if (noResults) {
    noResults.style.display = (depts.length > 0 && anyVisible === 0) ? '' : 'none';
  }
  // Filter state is intentionally NOT persisted — every load starts clean:
  // All Departments, empty name search, and the "All" status pill.
}

// Filter event listeners
deptSelect.addEventListener('change', applyFilters);
nameInput.addEventListener('input', applyFilters);
document.querySelectorAll('.status-filter input[type=radio]').forEach(r => {
  r.addEventListener('change', applyFilters);
});


// ============================================================================
// UTILITIES
// ============================================================================

function escapeHtml(str) {
  const div = document.createElement('div');
  div.appendChild(document.createTextNode(str));
  return div.innerHTML;
}


// ============================================================================
// PREFERENCES (theme / zoom / saved views) — persisted in localStorage
// ============================================================================

const PREFS_KEY = 'aquaOOO.prefs';
const VIEWS_KEY = 'aquaOOO.views';
const ZOOM_MIN = 0.7;
const ZOOM_MAX = 1.8;
const ZOOM_STEP = 0.1;

function loadPrefs() {
  try { return JSON.parse(localStorage.getItem(PREFS_KEY) || '{}'); }
  catch (e) { return {}; }
}
function savePrefs(prefs) {
  try { localStorage.setItem(PREFS_KEY, JSON.stringify(prefs)); }
  catch (e) { /* storage full / disabled — ignore */ }
}
function loadViews() {
  try { return JSON.parse(localStorage.getItem(VIEWS_KEY) || '{}'); }
  catch (e) { return {}; }
}
function saveViews(views) {
  try { localStorage.setItem(VIEWS_KEY, JSON.stringify(views)); }
  catch (e) { /* ignore */ }
}

// --- Theme -----------------------------------------------------------------
function currentTheme() {
  return document.documentElement.getAttribute('data-theme') === 'dark'
    ? 'dark' : 'light';
}
function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  // ☀ (sun) means "switch to light"; ☾ (moon) means "switch to dark"
  if (themeToggle) {
    themeToggle.innerHTML = theme === 'dark' ? '☀' : '☾';
    themeToggle.title = theme === 'dark'
      ? 'Switch to light mode' : 'Switch to dark mode';
  }
  const prefs = loadPrefs();
  prefs.theme = theme;
  savePrefs(prefs);
}
function toggleTheme() {
  applyTheme(currentTheme() === 'dark' ? 'light' : 'dark');
}

// --- Zoom ------------------------------------------------------------------
function getZoom() {
  const prefs = loadPrefs();
  const z = parseFloat(prefs.zoom);
  return isNaN(z) ? 1 : Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, z));
}
function applyZoom(z) {
  z = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, Math.round(z * 100) / 100));
  document.documentElement.style.setProperty('--user-zoom', z);
  if (zoomResetBtn) zoomResetBtn.textContent = Math.round(z * 100) + '%';
  const prefs = loadPrefs();
  prefs.zoom = z;
  savePrefs(prefs);
}
function nudgeZoom(delta) { applyZoom(getZoom() + delta); }

// --- Saved views -----------------------------------------------------------
function refreshViewsDropdown(selectedName) {
  if (!viewsSelect) return;
  const views = loadViews();
  const names = Object.keys(views).sort((a, b) => a.localeCompare(b));
  viewsSelect.innerHTML = '<option value="">My Views…</option>';
  names.forEach(name => {
    const opt = document.createElement('option');
    opt.value = name;
    opt.textContent = name;
    viewsSelect.appendChild(opt);
  });
  viewsSelect.value = selectedName && views[selectedName] ? selectedName : '';
}

function saveCurrentView() {
  const name = (prompt('Name this view:') || '').trim();
  if (!name) return;
  const views = loadViews();
  const statusEl = document.querySelector('.status-filter input[type=radio]:checked');
  views[name] = {
    dept: deptSelect.value,
    name: nameInput.value,
    status: statusEl ? statusEl.value : 'all',
  };
  saveViews(views);
  refreshViewsDropdown(name);
}

function applyView(name) {
  const views = loadViews();
  const v = views[name];
  if (!v) return;
  deptSelect.value = v.dept || '';
  nameInput.value = v.name || '';
  const radio = document.querySelector(
    `.status-filter input[value="${v.status || 'all'}"]`);
  if (radio) radio.checked = true;
  applyFilters();
}

function deleteSelectedView() {
  const name = viewsSelect ? viewsSelect.value : '';
  if (!name) { alert('Pick a saved view to delete first.'); return; }
  if (!confirm(`Delete the view "${name}"?`)) return;
  const views = loadViews();
  delete views[name];
  saveViews(views);
  refreshViewsDropdown('');
}

// --- Reset all filters to their defaults after the dashboard renders -------
function resetFiltersToDefault() {
  // Every load starts clean, regardless of what was selected last visit:
  //   department = All Departments, name search = empty, status = OOO.
  deptSelect.value = '';
  nameInput.value = '';
  const oooRadio = document.querySelector('.status-filter input[value="ooo"]');
  if (oooRadio) oooRadio.checked = true;
}

function initPreferences() {
  // Theme (attribute already set pre-paint by the inline head script)
  applyTheme(currentTheme());
  if (themeToggle) themeToggle.addEventListener('click', toggleTheme);

  // Zoom
  applyZoom(getZoom());
  if (zoomInBtn) zoomInBtn.addEventListener('click', () => nudgeZoom(ZOOM_STEP));
  if (zoomOutBtn) zoomOutBtn.addEventListener('click', () => nudgeZoom(-ZOOM_STEP));
  if (zoomResetBtn) zoomResetBtn.addEventListener('click', () => applyZoom(1));
  document.addEventListener('keydown', (e) => {
    if (!(e.ctrlKey || e.metaKey)) return;
    if (e.key === '+' || e.key === '=') { e.preventDefault(); nudgeZoom(ZOOM_STEP); }
    else if (e.key === '-' || e.key === '_') { e.preventDefault(); nudgeZoom(-ZOOM_STEP); }
    else if (e.key === '0') { e.preventDefault(); applyZoom(1); }
  });

  // Saved views
  refreshViewsDropdown('');
  if (viewSaveBtn) viewSaveBtn.addEventListener('click', saveCurrentView);
  if (viewDeleteBtn) viewDeleteBtn.addEventListener('click', deleteSelectedView);
  if (viewsSelect) viewsSelect.addEventListener('change', () => {
    if (viewsSelect.value) applyView(viewsSelect.value);
  });
}


// ============================================================================
// INITIALIZATION
// ============================================================================

async function init() {
  // Preferences work independent of the data load
  initPreferences();

  const report = await fetchLatestReport();

  if (report) {
    renderDashboard(report);
    // Start every visit on a clean slate, then apply
    resetFiltersToDefault();
    applyFilters();
  } else {
    emptyState.style.display = '';
    headerDate.textContent = new Date().toLocaleDateString('en-US', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
    });
  }

  // Reveal the page
  overlay.classList.add('hidden');
  page.classList.add('visible');
}

// Kick it off
init();

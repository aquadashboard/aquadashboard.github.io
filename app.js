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
const deptSelect  = document.getElementById('dept-search');
const nameInput   = document.getElementById('name-search');
const body        = document.getElementById('dashboard-body');
const emptyState  = document.getElementById('empty-state');
const headerDate  = document.getElementById('header-date');
const hcOoo       = document.getElementById('hc-ooo');
const hcOffsite   = document.getElementById('hc-offsite');
const overlay     = document.getElementById('loading-overlay');
const page        = document.getElementById('page');
const lastUpdated = document.getElementById('last-updated');


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
  const deptQ   = deptSelect.value.trim().toLowerCase();
  const nameQ   = nameInput.value.trim().toLowerCase();
  const statusQ = getStatusFilterValue();
  const depts   = document.querySelectorAll('.dept');
  let anyVisible = 0;

  depts.forEach(d => {
    const deptName  = d.getAttribute('data-dept') || '';
    const deptMatch = !deptQ || deptName === deptQ;

    const rows = d.querySelectorAll('tr[data-name]');
    let visibleRows = 0;

    rows.forEach(row => {
      const rName   = row.getAttribute('data-name') || '';
      const rStatus = row.getAttribute('data-status') || '';
      const nameMatch   = !nameQ || rName.indexOf(nameQ) !== -1;
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
// INITIALIZATION
// ============================================================================

async function init() {
  const report = await fetchLatestReport();

  if (report) {
    renderDashboard(report);
    // Apply initial filter (OOO selected by default)
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

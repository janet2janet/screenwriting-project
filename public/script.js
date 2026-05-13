/* ═══════════════════════════════════════════════════════════
   SCREENWRITER // GAME MODE — script.js
   ═══════════════════════════════════════════════════════════ */

// ── Element config ─────────────────────────────────────────

const TYPES = {
  'scene-heading': {
    placeholder: 'INT. LOCATION - DAY',
    tooltip: '🎬 Scene headings are AUTO-CAPPED — just type normally!',
    autoUpper: true,
    nextType: 'action',
  },
  'action': {
    placeholder: 'The audience sees...',
    tooltip: '👁️ Action: describe what we see. Present tense only.',
    autoUpper: false,
    nextType: 'action',
  },
  'character': {
    placeholder: 'CHARACTER NAME',
    tooltip: '🎭 Character names are AUTO-CAPPED — just type!',
    autoUpper: true,
    nextType: 'dialogue',
  },
  'dialogue': {
    placeholder: 'What the character says...',
    tooltip: '💬 Dialogue follows a character name. Indent is automatic.',
    autoUpper: false,
    nextType: 'action',
  },
  'parenthetical': {
    placeholder: '(tone or action)',
    tooltip: '🎵 Parentheticals auto-add ( ) when you finish typing.',
    autoUpper: false,
    nextType: 'dialogue',
  },
  'transition': {
    placeholder: 'CUT TO:',
    tooltip: '⚡ Transitions are AUTO-CAPPED and right-aligned!',
    autoUpper: true,
    nextType: 'scene-heading',
  },
};

// ── State ──────────────────────────────────────────────────

let elements         = [];
let activeEl         = null;
let currentProjectId = null;
let saveTimer        = null;
let tipTimer         = null;

// ── DOM refs ───────────────────────────────────────────────

const editor          = document.getElementById('editor');
const wordCountEl     = document.getElementById('word-count');
const pageCountEl     = document.getElementById('page-count');
const elCountEl       = document.getElementById('element-count');
const saveBtn         = document.getElementById('save-indicator');
const projectsBtn     = document.getElementById('projects-btn');
const proofreadBtn    = document.getElementById('proofread-btn');
const proofPanel      = document.getElementById('proofread-panel');
const proofContent    = document.getElementById('proofread-content');
const closePanel      = document.getElementById('close-panel');
const exportPdfBtn    = document.getElementById('export-pdf-btn');
const exportDocxBtn   = document.getElementById('export-docx-btn');
const addMenu         = document.getElementById('add-menu');
const cancelAdd       = document.getElementById('cancel-add');
const tooltip         = document.getElementById('format-tooltip');
const titleInput      = document.getElementById('screenplay-title');
const projectsOverlay = document.getElementById('projects-overlay');
const closeProjects   = document.getElementById('close-projects');
const newProjectBtn   = document.getElementById('new-project-btn');
const importFileInput = document.getElementById('import-file-input');
const projectsList    = document.getElementById('projects-list');
const atPopup         = document.getElementById('at-popup');

let atPopupTimer = null;

// ── Project storage ────────────────────────────────────────

const IDX_KEY = 'sw-projects';
const projKey  = id => `sw-project-${id}`;

function getIndex() {
  try { return JSON.parse(localStorage.getItem(IDX_KEY) || '[]'); }
  catch { return []; }
}

function saveIndex(idx) {
  localStorage.setItem(IDX_KEY, JSON.stringify(idx));
}

function wordCount(els) {
  const t = els.map(e => e.text).join(' ').trim();
  return t ? t.split(/\s+/).length : 0;
}

// ── Persist current project ────────────────────────────────

function persist() {
  if (!currentProjectId) currentProjectId = Date.now();

  const data = {
    id: currentProjectId,
    title: titleInput.value || 'Untitled Screenplay',
    elements,
    ts: Date.now(),
  };

  localStorage.setItem(projKey(currentProjectId), JSON.stringify(data));

  const idx      = getIndex();
  const existing = idx.findIndex(p => p.id === currentProjectId);
  const meta     = { id: currentProjectId, title: data.title, ts: data.ts, words: wordCount(elements) };

  if (existing >= 0) idx[existing] = meta;
  else               idx.unshift(meta);
  saveIndex(idx);

  sessionStorage.setItem('sw-current-id', String(currentProjectId));
  saveBtn.className   = 'btn btn-save saved';
  saveBtn.textContent = '✓ SAVED';
}

function scheduleSave() {
  clearTimeout(saveTimer);
  saveBtn.className   = 'btn btn-save saving';
  saveBtn.textContent = '⟳ SAVING...';
  saveTimer = setTimeout(persist, 1400);
}

// ── Load a project ─────────────────────────────────────────

function loadProject(id) {
  try {
    const raw = localStorage.getItem(projKey(id));
    if (!raw) return false;
    const data = JSON.parse(raw);

    currentProjectId  = id;
    titleInput.value  = data.title || '';
    elements          = data.elements || [];

    editor.innerHTML = '';
    elements.forEach(el => editor.appendChild(makeDiv(el)));

    updateStats();
    sessionStorage.setItem('sw-current-id', String(id));
    saveBtn.className   = 'btn btn-save saved';
    saveBtn.textContent = '✓ SAVED';
    return true;
  } catch { return false; }
}

// ── New project ────────────────────────────────────────────

function startNewProject() {
  if (elements.length) persist();          // save current first

  currentProjectId = Date.now();
  titleInput.value = '';
  elements         = [];
  editor.innerHTML = '';
  sessionStorage.setItem('sw-current-id', String(currentProjectId));

  insertElement('scene-heading', null, true);
  updateStats();
  saveBtn.className   = 'btn btn-save saved';
  saveBtn.textContent = '✓ SAVED';
}

// ── Delete project ─────────────────────────────────────────

function deleteProject(id) {
  const idx   = getIndex();
  const proj  = idx.find(p => p.id === id);
  const title = proj ? proj.title : 'this screenplay';
  if (!confirm(`Delete "${title}"? This cannot be undone.`)) return;

  localStorage.removeItem(projKey(id));
  saveIndex(idx.filter(p => p.id !== id));

  if (id === currentProjectId) {
    const remaining = getIndex();
    if (remaining.length) loadProject(remaining[0].id);
    else                  startNewProject();
  }

  renderProjectsModal();
}

// ── Export project to .json file ───────────────────────────

function exportProjectFile(id) {
  // If exporting the current one, flush first
  if (id === currentProjectId) persist();

  const raw = localStorage.getItem(projKey(id));
  if (!raw) { alert('Project not found.'); return; }

  const data  = JSON.parse(raw);
  const blob  = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url   = URL.createObjectURL(blob);
  const a     = document.createElement('a');
  a.href      = url;
  a.download  = (data.title || 'screenplay').toLowerCase().replace(/\s+/g, '_') + '.screenplay.json';
  a.click();
  URL.revokeObjectURL(url);
}

// ── Import from .json file ─────────────────────────────────

function importProjectFile(file) {
  const reader    = new FileReader();
  reader.onload   = e => {
    try {
      const data = JSON.parse(e.target.result);
      if (!Array.isArray(data.elements)) throw new Error('Not a valid screenplay file.');

      if (elements.length) persist();         // save current first

      const newId  = Date.now();
      data.id      = newId;
      data.ts      = data.ts || newId;

      localStorage.setItem(projKey(newId), JSON.stringify(data));

      const idx = getIndex();
      idx.unshift({ id: newId, title: data.title || 'Imported Screenplay', ts: data.ts, words: wordCount(data.elements) });
      saveIndex(idx);

      loadProject(newId);
      closeProjectsModal();
    } catch (err) {
      alert('Could not import file: ' + err.message);
    }
  };
  reader.readAsText(file);
}

// ── Projects modal ─────────────────────────────────────────

function formatDate(ts) {
  if (!ts) return '';
  const diff = Date.now() - ts;
  if (diff < 60000)      return 'just now';
  if (diff < 3600000)    return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000)   return `${Math.floor(diff / 3600000)}h ago`;
  if (diff < 172800000)  return 'yesterday';
  return new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function esc(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function renderProjectsModal() {
  const idx = getIndex();

  if (!idx.length) {
    projectsList.innerHTML = '<div class="projects-empty">No saved screenplays yet.<br>Hit <strong>+ NEW SCREENPLAY</strong> to start one.</div>';
    return;
  }

  projectsList.innerHTML = idx.map(p => {
    const isCurrent = p.id === currentProjectId;
    return `
      <div class="project-card ${isCurrent ? 'active' : ''}">
        <div class="project-info">
          <div class="project-title">${esc(p.title || 'Untitled Screenplay')}</div>
          <div class="project-meta">${formatDate(p.ts)} · ${p.words || 0} words</div>
        </div>
        <div class="project-btns">
          ${isCurrent
            ? '<button class="btn-proj btn-proj-current" disabled>CURRENT</button>'
            : `<button class="btn-proj btn-proj-open" data-id="${p.id}">OPEN</button>`}
          <button class="btn-proj btn-proj-file" data-id="${p.id}">💾 FILE</button>
          <button class="btn-proj btn-proj-del"  data-id="${p.id}">✕</button>
        </div>
      </div>
    `;
  }).join('');

  projectsList.querySelectorAll('.btn-proj-open').forEach(btn => {
    btn.addEventListener('click', () => {
      persist();
      loadProject(Number(btn.dataset.id));
      closeProjectsModal();
    });
  });

  projectsList.querySelectorAll('.btn-proj-file').forEach(btn => {
    btn.addEventListener('click', () => exportProjectFile(Number(btn.dataset.id)));
  });

  projectsList.querySelectorAll('.btn-proj-del').forEach(btn => {
    btn.addEventListener('click', () => deleteProject(Number(btn.dataset.id)));
  });
}

function openProjectsModal() {
  persist();
  renderProjectsModal();
  projectsOverlay.classList.add('visible');
}

function closeProjectsModal() {
  projectsOverlay.classList.remove('visible');
}

projectsBtn.addEventListener('click', openProjectsModal);
closeProjects.addEventListener('click', closeProjectsModal);
projectsOverlay.addEventListener('click', e => { if (e.target === projectsOverlay) closeProjectsModal(); });

newProjectBtn.addEventListener('click', () => {
  closeProjectsModal();
  startNewProject();
});

importFileInput.addEventListener('change', e => {
  const file = e.target.files[0];
  if (file) importProjectFile(file);
  importFileInput.value = '';    // reset so same file can be re-imported
});

// ── Left sidebar ───────────────────────────────────────────

document.querySelectorAll('.sidebar-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const type  = btn.dataset.type;
    const after = activeEl && editor.contains(activeEl) ? activeEl : null;
    insertElement(type, after, true);
  });
});

// ── @ popup ────────────────────────────────────────────────

function positionAtPopup(div) {
  const sel = window.getSelection();
  let top, left;

  if (sel.rangeCount) {
    const range = sel.getRangeAt(0).cloneRange();
    range.collapse(true);
    const rects = range.getClientRects();
    if (rects.length) {
      top  = rects[0].bottom + window.scrollY + 6;
      left = rects[0].left   + window.scrollX;
    }
  }

  if (!top) {
    const rect = div.getBoundingClientRect();
    top  = rect.bottom + window.scrollY + 6;
    left = rect.left   + window.scrollX;
  }

  // Keep within viewport
  const popupW = 220;
  if (left + popupW > window.innerWidth - 12) left = window.innerWidth - popupW - 12;

  atPopup.style.top  = top + 'px';
  atPopup.style.left = left + 'px';
}

function openAtPopup(div) {
  positionAtPopup(div);
  atPopup.dataset.afterId = div.dataset.id;
  atPopup.classList.add('visible');
  clearTimeout(atPopupTimer);
  atPopupTimer = setTimeout(closeAtPopup, 6000);
}

function closeAtPopup() {
  atPopup.classList.remove('visible');
  atPopup.dataset.afterId = '';
}

atPopup.querySelectorAll('.at-popup-item').forEach(item => {
  item.addEventListener('mousedown', e => {
    e.preventDefault();           // don't blur the editor
    const type    = item.dataset.type;
    const afterId = atPopup.dataset.afterId;
    const afterDiv = afterId ? editor.querySelector(`[data-id="${afterId}"]`) : null;
    closeAtPopup();
    insertElement(type, afterDiv, true);
  });
});

// Close @ popup when clicking outside
document.addEventListener('click', e => {
  if (!atPopup.contains(e.target)) closeAtPopup();
});

// ── Create a .element div ──────────────────────────────────

function makeDiv(elData) {
  const div = document.createElement('div');
  div.className    = `element ${elData.type}`;
  div.dataset.type = elData.type;
  div.dataset.id   = String(elData.id);
  div.setAttribute('contenteditable', 'true');
  div.setAttribute('spellcheck', 'true');
  div.setAttribute('data-placeholder', TYPES[elData.type].placeholder);
  if (elData.text) div.textContent = elData.text;

  div.addEventListener('input',   onInput);
  div.addEventListener('keydown', onKeydown);
  div.addEventListener('focus',   onFocus);
  div.addEventListener('blur',    onBlur);
  return div;
}

// ── Insert element ─────────────────────────────────────────

function insertElement(type, afterDiv = null, focus = true) {
  const id   = Date.now() + Math.random();
  const data = { id, type, text: '' };
  const div  = makeDiv(data);

  if (afterDiv && editor.contains(afterDiv)) {
    afterDiv.after(div);
    const idx = elements.findIndex(e => String(e.id) === afterDiv.dataset.id);
    elements.splice(idx + 1, 0, data);
  } else {
    editor.appendChild(div);
    elements.push(data);
  }

  if (focus) { div.focus(); placeCursorAtEnd(div); }

  updateStats();
  scheduleSave();
  return div;
}

function placeCursorAtEnd(div) {
  const range = document.createRange();
  const sel   = window.getSelection();
  range.selectNodeContents(div);
  range.collapse(false);
  sel.removeAllRanges();
  sel.addRange(range);
}

// ── Auto-uppercase (cursor-safe) ───────────────────────────

function applyUppercase(div) {
  const sel = window.getSelection();
  if (!sel.rangeCount) return;
  const offset = sel.getRangeAt(0).startOffset;
  const upped  = div.textContent.toUpperCase();
  if (div.textContent === upped) return;

  div.textContent = upped;

  const node = div.firstChild;
  if (node) {
    try {
      const r = document.createRange();
      r.setStart(node, Math.min(offset, node.length));
      r.collapse(true);
      sel.removeAllRanges();
      sel.addRange(r);
    } catch (_) {}
  }
}

// ── Input handler ──────────────────────────────────────────

function onInput(e) {
  const div  = e.currentTarget;
  const type = div.dataset.type;

  // @ trigger — strip the @ and open popup
  // trimEnd() handles browsers that append a trailing \n via a <br> in contenteditable
  if (div.textContent.trimEnd().endsWith('@')) {
    div.textContent = div.textContent.trimEnd().slice(0, -1);
    placeCursorAtEnd(div);
    openAtPopup(div);

    const data = elements.find(el => String(el.id) === div.dataset.id);
    if (data) data.text = div.textContent;
    scheduleSave();
    return;
  }

  if (TYPES[type].autoUpper) applyUppercase(div);

  const data = elements.find(el => String(el.id) === div.dataset.id);
  if (data) data.text = div.textContent;

  updateStats();
  scheduleSave();
}

// ── Keydown handler ────────────────────────────────────────

function onKeydown(e) {
  const div  = e.currentTarget;
  const type = div.dataset.type;

  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    let nextType = TYPES[type].nextType;
    if (type === 'character' && !div.textContent.trim()) nextType = 'action';
    insertElement(nextType, div, true);
    return;
  }

  if (e.key === 'Backspace' && !div.textContent) {
    e.preventDefault();
    const prev = div.previousElementSibling;
    elements = elements.filter(el => String(el.id) !== div.dataset.id);
    div.remove();
    if (prev) { prev.focus(); placeCursorAtEnd(prev); }
    updateStats();
    scheduleSave();
    return;
  }

  if (e.key === 'Tab') {
    e.preventDefault();
    const keys = Object.keys(TYPES);
    const idx  = keys.indexOf(type);
    const next = e.shiftKey
      ? keys[(idx - 1 + keys.length) % keys.length]
      : keys[(idx + 1) % keys.length];

    div.className = `element ${next}`;
    div.dataset.type = next;
    div.setAttribute('data-placeholder', TYPES[next].placeholder);

    const data = elements.find(el => String(el.id) === div.dataset.id);
    if (data) data.type = next;

    if (TYPES[next].autoUpper) {
      div.textContent = div.textContent.toUpperCase();
      if (data) data.text = div.textContent;
    }

    showTip(div, TYPES[next].tooltip);
    scheduleSave();
  }
}

// ── Focus / blur ───────────────────────────────────────────

function onFocus(e) {
  activeEl = e.currentTarget;
  if (!activeEl.textContent.trim()) {
    showTip(activeEl, TYPES[activeEl.dataset.type].tooltip);
  }
}

function onBlur(e) {
  const div  = e.currentTarget;
  if (div.dataset.type !== 'parenthetical') return;

  let t = div.textContent.trim();
  if (!t) return;
  if (!t.startsWith('(')) t = '(' + t;
  if (!t.endsWith(')'))   t = t + ')';
  div.textContent = t;

  const data = elements.find(el => String(el.id) === div.dataset.id);
  if (data) data.text = t;
  scheduleSave();
}

// ── Tooltip ────────────────────────────────────────────────

function showTip(div, msg) {
  clearTimeout(tipTimer);
  const rect = div.getBoundingClientRect();
  tooltip.textContent  = msg;
  tooltip.style.top    = Math.max(4, rect.top - 38) + 'px';
  tooltip.style.left   = rect.left + 8 + 'px';
  tooltip.classList.add('show');
  tipTimer = setTimeout(() => tooltip.classList.remove('show'), 3200);
}

// ── Stats ──────────────────────────────────────────────────

function updateStats() {
  const allText = elements.map(e => e.text).join(' ');
  const words   = allText.trim() ? allText.trim().split(/\s+/).length : 0;

  const lines = elements.reduce((sum, el) => {
    const cpl = { 'scene-heading': 60, action: 60, character: 40, dialogue: 36, parenthetical: 32, transition: 50 };
    return sum + Math.max(1, Math.ceil((el.text || '').length / (cpl[el.type] || 60))) + 1;
  }, 0);

  setStatValue(wordCountEl,  words);
  setStatValue(pageCountEl,  Math.max(1, Math.ceil(lines / 55)));
  setStatValue(elCountEl,    elements.length);
}

function setStatValue(el, val) {
  const prev = parseInt(el.textContent, 10);
  el.textContent = val;
  if (val !== prev) {
    el.classList.remove('bump');
    void el.offsetWidth;
    el.classList.add('bump');
    setTimeout(() => el.classList.remove('bump'), 150);
  }
}

// ── Add menu ───────────────────────────────────────────────

addBtn.addEventListener('click', () => addMenu.classList.add('visible'));

function closeAddMenu() { addMenu.classList.remove('visible'); }

cancelAdd.addEventListener('click', closeAddMenu);
addMenu.addEventListener('click', e => { if (e.target === addMenu) closeAddMenu(); });

document.querySelectorAll('.element-card').forEach(card => {
  card.addEventListener('click', () => {
    const type  = card.dataset.type;
    const after = activeEl && editor.contains(activeEl) ? activeEl : null;
    closeAddMenu();
    insertElement(type, after, true);
  });
});

// ── Proofread ──────────────────────────────────────────────

proofreadBtn.addEventListener('click', async () => {
  if (!elements.length) { alert('Write something first!'); return; }

  proofPanel.classList.add('open');
  proofContent.innerHTML = '<div class="panel-empty">Reading your screenplay...</div>';
  proofreadBtn.classList.add('loading');
  proofreadBtn.textContent = '⟳ READING...';

  const text = elements.map(el =>
    `[${el.type.toUpperCase().replace('-', ' ')}]\n${el.text}`
  ).join('\n\n');

  try {
    const resp    = await fetch('/api/proofread', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ screenplay: text }),
    });

    proofContent.textContent = '';
    const reader  = resp.body.getReader();
    const decoder = new TextDecoder();
    let buf = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      const lines = buf.split('\n');
      buf = lines.pop();
      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const payload = line.slice(6);
        if (payload === '[DONE]') break;
        try {
          const parsed = JSON.parse(payload);
          if (parsed.text)  { proofContent.textContent += parsed.text; proofContent.scrollTop = proofContent.scrollHeight; }
          if (parsed.error) proofContent.textContent = '⚠️ ' + parsed.error;
        } catch (_) {}
      }
    }
  } catch {
    proofContent.textContent = '⚠️ Could not connect to server.\nMake sure it\'s running and ANTHROPIC_API_KEY is set in .env';
  }

  proofreadBtn.classList.remove('loading');
  proofreadBtn.textContent = '🤖 PROOFREAD';
});

closePanel.addEventListener('click', () => proofPanel.classList.remove('open'));

// ── PDF export ─────────────────────────────────────────────

exportPdfBtn.addEventListener('click', () => {
  if (!elements.length) { alert('Nothing to export!'); return; }
  if (!window.jspdf) { alert('PDF library failed to load. Check your internet connection and reload the page.'); return; }

  try {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ unit: 'pt', format: 'letter' });

    const PW = 612, PH = 792, ML = 108, MR = 72, MT = 72, MB = 72;
    const CW = PW - ML - MR, FS = 12, LH = 15;

    doc.setFont('courier', 'bold');
    doc.setFontSize(20);
    doc.text((titleInput.value || 'UNTITLED SCREENPLAY').toUpperCase(), PW / 2, PH / 2 - 30, { align: 'center' });
    doc.setFontSize(11);
    doc.setFont('courier', 'normal');
    doc.text('written with SCREENWRITER', PW / 2, PH / 2 + 10, { align: 'center' });

    doc.addPage();
    let y = MT;
    doc.setFont('courier', 'normal');
    doc.setFontSize(FS);

    const newPageIfNeeded = (need = LH * 2) => {
      if (y + need > PH - MB) { doc.addPage(); y = MT; }
    };

    elements.forEach(el => {
      if (!el.text && el.text !== '') return;
      newPageIfNeeded();

      let x = ML, mw = CW, text = el.text || '', bold = false;

      switch (el.type) {
        case 'scene-heading': bold = true; text = text.toUpperCase(); y += LH * 0.7; break;
        case 'character':     text = text.toUpperCase(); x = ML + CW * 0.36; mw = CW * 0.64; y += LH * 0.4; break;
        case 'dialogue':      x = ML + 80; mw = CW - 160; break;
        case 'parenthetical': x = ML + 120; mw = CW - 200;
          if (!text.startsWith('(')) text = '(' + text;
          if (!text.endsWith(')'))   text = text + ')';
          break;
        case 'transition':
          text = text.toUpperCase(); y += LH * 0.4;
          doc.setFont('courier', 'normal');
          x = PW - MR - doc.getTextWidth(text);
          mw = doc.getTextWidth(text) + 1;
          break;
      }

      doc.setFont('courier', bold ? 'bold' : 'normal');
      doc.splitTextToSize(text, mw).forEach(line => { newPageIfNeeded(); doc.text(line, x, y); y += LH; });
      if (['scene-heading', 'transition'].includes(el.type)) y += LH * 0.5;
    });

    const pageCount = doc.getNumberOfPages();
    for (let i = 2; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFont('courier', 'normal');
      doc.setFontSize(10);
      doc.text(`${i - 1}.`, PW - MR, MT - 20, { align: 'right' });
    }

    const filename = (titleInput.value || 'screenplay').toLowerCase().replace(/\s+/g, '_') + '.pdf';
    const blob = doc.output('blob');
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  } catch (err) {
    alert('PDF export failed: ' + err.message);
  }
});

// ── DOCX export ────────────────────────────────────────────

exportDocxBtn.addEventListener('click', async () => {
  if (!elements.length) { alert('Nothing to export!'); return; }

  exportDocxBtn.textContent = '⟳ BUILDING...';
  exportDocxBtn.disabled    = true;

  try {
    const resp = await fetch('/api/export-docx', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ elements, title: titleInput.value || 'Untitled Screenplay' }),
    });
    if (!resp.ok) throw new Error(await resp.text());

    const blob = await resp.blob();
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = (titleInput.value || 'screenplay').toLowerCase().replace(/\s+/g, '_') + '.docx';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  } catch (err) {
    alert('DOCX export failed: ' + err.message);
  }

  exportDocxBtn.textContent = '📝 DOCX';
  exportDocxBtn.disabled    = false;
});

// ── Title auto-save ────────────────────────────────────────

titleInput.addEventListener('input', scheduleSave);

// ── Global keyboard shortcuts ──────────────────────────────

document.addEventListener('keydown', e => {
  const mod = e.metaKey || e.ctrlKey;
  if (mod && e.key === 'p')                            { e.preventDefault(); proofreadBtn.click(); }
  if (mod && e.shiftKey && e.key.toLowerCase() === 'a') { e.preventDefault(); addBtn.click(); }
  if (e.key === 'Escape') {
    closeAddMenu();
    closeProjectsModal();
    closeAtPopup();
    proofPanel.classList.remove('open');
  }
});

// ── Boot ───────────────────────────────────────────────────

(function boot() {
  // Migrate old single-project format
  const oldRaw = localStorage.getItem('screenplay-v1');
  if (oldRaw) {
    try {
      const old = JSON.parse(oldRaw);
      if (old.elements && old.elements.length) {
        const migId = 1000;
        old.id = migId;
        localStorage.setItem(projKey(migId), JSON.stringify(old));
        const idx = getIndex();
        if (!idx.find(p => p.id === migId)) {
          idx.unshift({ id: migId, title: old.title || 'My First Screenplay', ts: old.ts || Date.now(), words: wordCount(old.elements) });
          saveIndex(idx);
        }
      }
      localStorage.removeItem('screenplay-v1');
    } catch (_) {}
  }

  // Restore last session
  const lastId = Number(sessionStorage.getItem('sw-current-id'));
  if (lastId && loadProject(lastId)) return;

  // Load first project in index
  const idx = getIndex();
  if (idx.length && loadProject(idx[0].id)) return;

  // Fresh start
  currentProjectId = Date.now();
  insertElement('scene-heading', null, true);
})();

updateStats();

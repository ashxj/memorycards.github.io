/**
 * FlashCards PWA — app.js
 * Full offline flashcard app with IndexedDB storage, swipe gestures,
 * flip animations, known/unknown tracking, import/export, and PWA registration.
 */

'use strict';

/* ═══════════════════════════════════════════
   DATABASE (IndexedDB with localStorage fallback)
   ═══════════════════════════════════════════ */
const DB = (() => {
  const DB_NAME    = 'flashcards_db';
  const DB_VERSION = 1;
  const STORE      = 'cards';
  let db = null;

  async function open() {
    if (db) return db;
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = e => {
        const idb = e.target.result;
        if (!idb.objectStoreNames.contains(STORE)) {
          const store = idb.createObjectStore(STORE, { keyPath: 'id', autoIncrement: true });
          store.createIndex('createdAt', 'createdAt', { unique: false });
        }
      };
      req.onsuccess = e => { db = e.target.result; resolve(db); };
      req.onerror   = () => reject(req.error);
    });
  }

  async function getAll() {
    const idb = await open();
    return new Promise((resolve, reject) => {
      const tx  = idb.transaction(STORE, 'readonly');
      const req = tx.objectStore(STORE).index('createdAt').getAll();
      req.onsuccess = () => resolve(req.result);
      req.onerror   = () => reject(req.error);
    });
  }

  async function add(card) {
    const idb = await open();
    return new Promise((resolve, reject) => {
      const tx  = idb.transaction(STORE, 'readwrite');
      const req = tx.objectStore(STORE).add(card);
      req.onsuccess = () => resolve(req.result);
      req.onerror   = () => reject(req.error);
    });
  }

  async function put(card) {
    const idb = await open();
    return new Promise((resolve, reject) => {
      const tx  = idb.transaction(STORE, 'readwrite');
      const req = tx.objectStore(STORE).put(card);
      req.onsuccess = () => resolve(req.result);
      req.onerror   = () => reject(req.error);
    });
  }

  async function remove(id) {
    const idb = await open();
    return new Promise((resolve, reject) => {
      const tx  = idb.transaction(STORE, 'readwrite');
      const req = tx.objectStore(STORE).delete(id);
      req.onsuccess = () => resolve();
      req.onerror   = () => reject(req.error);
    });
  }

  async function clear() {
    const idb = await open();
    return new Promise((resolve, reject) => {
      const tx  = idb.transaction(STORE, 'readwrite');
      const req = tx.objectStore(STORE).clear();
      req.onsuccess = () => resolve();
      req.onerror   = () => reject(req.error);
    });
  }

  async function bulkAdd(cards) {
    const idb = await open();
    return new Promise((resolve, reject) => {
      const tx    = idb.transaction(STORE, 'readwrite');
      const store = tx.objectStore(STORE);
      cards.forEach(c => store.add(c));
      tx.oncomplete = () => resolve();
      tx.onerror    = () => reject(tx.error);
    });
  }

  // localStorage fallback (used only if IndexedDB fails)
  const LS_KEY = 'flashcards_v1';
  const lsFallback = {
    getAll() { try { return JSON.parse(localStorage.getItem(LS_KEY) || '[]'); } catch { return []; } },
    save(arr){ try { localStorage.setItem(LS_KEY, JSON.stringify(arr)); } catch(e){ console.error(e); } },
    add(card){ const a = this.getAll(); const id = Date.now(); a.push({...card, id}); this.save(a); return id; },
    put(card){ const a = this.getAll(); const i = a.findIndex(c => c.id === card.id); if (i>-1) a[i]=card; this.save(a); },
    remove(id){ const a = this.getAll().filter(c => c.id !== id); this.save(a); },
    clear(){ localStorage.removeItem(LS_KEY); },
    bulkAdd(cards){ const a = this.getAll(); cards.forEach((c,i)=>a.push({...c,id:Date.now()+i})); this.save(a); }
  };

  let useLS = false;
  async function init() {
    try {
      await open();
    } catch(e) {
      console.warn('IndexedDB unavailable, using localStorage fallback.', e);
      useLS = true;
    }
  }

  return {
    init,
    async getAll()     { return useLS ? lsFallback.getAll()      : getAll(); },
    async add(c)       { return useLS ? lsFallback.add(c)        : add(c); },
    async put(c)       { return useLS ? lsFallback.put(c)        : put(c); },
    async remove(id)   { return useLS ? lsFallback.remove(id)    : remove(id); },
    async clear()      { return useLS ? lsFallback.clear()       : clear(); },
    async bulkAdd(arr) { return useLS ? lsFallback.bulkAdd(arr)  : bulkAdd(arr); }
  };
})();


/* ═══════════════════════════════════════════
   APP STATE
   ═══════════════════════════════════════════ */
const State = {
  cards:       [],   // [{id, front, back, known, createdAt}]
  order:       [],   // indices into cards[] for current display order
  cursor:      0,    // position in order[]
  flipped:     false,
  shuffled:    false,
  editingId:   null  // id of card being edited, or null for new
};

function currentCard() {
  if (!State.order.length) return null;
  return State.cards[State.order[State.cursor]];
}


/* ═══════════════════════════════════════════
   DOM REFS
   ═══════════════════════════════════════════ */
const $ = id => document.getElementById(id);
const el = {
  cardViewport:    $('card-viewport'),
  emptyState:      $('empty-state'),
  flashcard:       $('flashcard'),
  cardFrontText:   $('card-front-text'),
  cardBackText:    $('card-back-text'),
  cardCounter:     $('card-counter'),
  progressBar:     $('progress-bar'),
  navDots:         $('nav-dots'),
  btnNext:         $('btn-next'),
  btnPrev:         $('btn-prev'),
  btnAddCard:      $('btn-add-card'),
  btnShuffle:      $('btn-shuffle'),
  btnAddFirst:     $('btn-add-first'),
  btnMenu:         $('btn-menu'),
  btnKnown:        $('btn-known'),
  btnUnknown:      $('btn-unknown'),
  // Stats
  statTotal:       $('stat-total'),
  statKnown:       $('stat-known'),
  statUnknown:     $('stat-unknown'),
  menuProgressFill:$('menu-progress-fill'),
  // Menu
  menuOverlay:     $('menu-overlay'),
  sideMenu:        $('side-menu'),
  btnCloseMenu:    $('btn-close-menu'),
  // Modals
  modalCard:       $('modal-card'),
  modalCardTitle:  $('modal-card-title'),
  inputFront:      $('input-front'),
  inputBack:       $('input-back'),
  modalCardCancel: $('modal-card-cancel'),
  modalCardSave:   $('modal-card-save'),
  modalBulk:       $('modal-bulk'),
  inputBulk:       $('input-bulk'),
  modalBulkCancel: $('modal-bulk-cancel'),
  modalBulkSave:   $('modal-bulk-save'),
  modalManage:     $('modal-manage'),
  manageList:      $('manage-list'),
  modalManageClose:$('modal-manage-close'),
  modalConfirm:    $('modal-confirm'),
  confirmTitle:    $('confirm-title'),
  confirmDesc:     $('confirm-desc'),
  confirmCancel:   $('confirm-cancel'),
  confirmOk:       $('confirm-ok'),
  fileImport:      $('file-import'),
  toast:           $('toast'),
  // Menu items
  menuManage:      $('menu-manage'),
  menuImportBulk:  $('menu-import-bulk'),
  menuExport:      $('menu-export'),
  menuImportJson:  $('menu-import-json'),
  menuResetProg:   $('menu-reset-progress'),
  menuResetAll:    $('menu-reset-all'),
};


/* ═══════════════════════════════════════════
   RENDER
   ═══════════════════════════════════════════ */
function render() {
  const card = currentCard();
  const total = State.cards.length;

  if (!total) {
    el.cardViewport.classList.add('hidden');
    el.emptyState.classList.remove('hidden');
    el.cardCounter.textContent = '0 / 0';
    el.progressBar.style.width = '0%';
    renderDots();
    updateStats();
    return;
  }

  el.emptyState.classList.add('hidden');
  el.cardViewport.classList.remove('hidden');

  // Card text
  el.cardFrontText.textContent = card.front;
  el.cardBackText.textContent  = card.back;

  // Flip state
  if (State.flipped) {
    el.flashcard.classList.add('is-flipped');
  } else {
    el.flashcard.classList.remove('is-flipped');
  }

  // Known badge
  const frontFace = el.flashcard.querySelector('.card-front');
  if (card.known) { frontFace.classList.add('is-known'); }
  else            { frontFace.classList.remove('is-known'); }

  // Rating button highlights
  el.btnKnown.classList.toggle('is-selected', !!card.known);
  el.btnUnknown.classList.toggle('is-selected', !card.known && card.known === false);

  // Counter
  const pos = State.cursor + 1;
  el.cardCounter.textContent = `${pos} / ${State.order.length}`;

  // Progress bar
  el.progressBar.style.width = `${(pos / State.order.length) * 100}%`;

  // Shuffle btn highlight
  el.btnShuffle.style.color = State.shuffled ? 'var(--accent)' : '';

  renderDots();
  updateStats();
}

function renderDots() {
  const max   = 15;
  const count = Math.min(State.order.length, max);
  el.navDots.innerHTML = '';
  for (let i = 0; i < count; i++) {
    const dot = document.createElement('div');
    dot.className = 'nav-dot';
    const cardIdx = State.order[i];
    const card    = State.cards[cardIdx];
    if (i === State.cursor) dot.classList.add('active');
    if (card && card.known) dot.classList.add('known');
    el.navDots.appendChild(dot);
  }
}

function updateStats() {
  const total   = State.cards.length;
  const known   = State.cards.filter(c => c.known).length;
  const unknown = total - known;
  el.statTotal.textContent   = total;
  el.statKnown.textContent   = known;
  el.statUnknown.textContent = unknown;
  el.menuProgressFill.style.width = total ? `${(known / total) * 100}%` : '0%';
}


/* ═══════════════════════════════════════════
   NAVIGATION
   ═══════════════════════════════════════════ */
function goNext() {
  if (!State.order.length) return;
  const newCursor = (State.cursor + 1) % State.order.length;
  animateTransition('left', newCursor);
}

function goPrev() {
  if (!State.order.length) return;
  const newCursor = (State.cursor - 1 + State.order.length) % State.order.length;
  animateTransition('right', newCursor);
}

function animateTransition(direction, newCursor) {
  const card = el.flashcard;

  const exitAnim  = direction === 'left' ? 'anim-swipe-left'  : 'anim-swipe-right';
  const enterAnim = direction === 'left' ? 'anim-enter-right' : 'anim-enter-left';

  // Clean up any existing animations
  card.classList.remove('anim-swipe-left','anim-swipe-right','anim-enter-right','anim-enter-left');

  card.classList.add(exitAnim);

  card.addEventListener('animationend', function onEnd() {
    card.removeEventListener('animationend', onEnd);
    card.classList.remove(exitAnim);
    State.cursor = newCursor;
    State.flipped = false;
    render();
    // Force reflow
    void card.offsetWidth;
    card.classList.add(enterAnim);
    card.addEventListener('animationend', function onEnter() {
      card.removeEventListener('animationend', onEnter);
      card.classList.remove(enterAnim);
    });
  }, { once: true });
}

function flipCard() {
  State.flipped = !State.flipped;
  render();
}

function buildOrder() {
  const indices = State.cards.map((_, i) => i);
  if (State.shuffled) {
    // Fisher-Yates shuffle
    for (let i = indices.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [indices[i], indices[j]] = [indices[j], indices[i]];
    }
  }
  State.order  = indices;
  State.cursor = 0;
  State.flipped = false;
}

function toggleShuffle() {
  State.shuffled = !State.shuffled;
  buildOrder();
  render();
  showToast(State.shuffled ? '🔀 Shuffled' : 'Back to original order');
}


/* ═══════════════════════════════════════════
   KNOWN / UNKNOWN RATING
   ═══════════════════════════════════════════ */
async function markKnown() {
  const card = currentCard();
  if (!card) return;
  card.known = !card.known;
  await DB.put(card);
  render();
  showToast(card.known ? '✓ Marked as known' : 'Moved to learning');
}

async function markUnknown() {
  const card = currentCard();
  if (!card) return;
  card.known = false;
  await DB.put(card);
  render();
  showToast('Still learning — keep it up!');
}


/* ═══════════════════════════════════════════
   CARD CRUD
   ═══════════════════════════════════════════ */
async function loadCards() {
  State.cards = await DB.getAll();
  buildOrder();
  render();
}

async function saveCardFromModal() {
  const front = el.inputFront.value.trim();
  const back  = el.inputBack.value.trim();
  if (!front || !back) { showToast('Please fill in both sides.'); return; }

  if (State.editingId !== null) {
    // Edit existing
    const card = State.cards.find(c => c.id === State.editingId);
    if (card) {
      card.front = front;
      card.back  = back;
      await DB.put(card);
    }
    State.editingId = null;
    showToast('Card updated!');
  } else {
    // New card
    const card = { front, back, known: false, createdAt: Date.now() };
    const id   = await DB.add(card);
    card.id    = id;
    State.cards.push(card);
    showToast('Card added!');
  }

  await loadCards();
  closeModal(el.modalCard);
}

async function deleteCard(id) {
  await DB.remove(id);
  await loadCards();
  showToast('Card deleted.');
}

function openEditModal(card) {
  State.editingId       = card.id;
  el.modalCardTitle.textContent = 'Edit Card';
  el.inputFront.value   = card.front;
  el.inputBack.value    = card.back;
  closeManageModal();
  openModal(el.modalCard);
}

function openAddModal() {
  State.editingId       = null;
  el.modalCardTitle.textContent = 'New Card';
  el.inputFront.value   = '';
  el.inputBack.value    = '';
  openModal(el.modalCard);
  setTimeout(() => el.inputFront.focus(), 400);
}

async function saveBulkImport() {
  const raw  = el.inputBulk.value.trim();
  if (!raw) { showToast('Paste some cards first.'); return; }

  const lines = raw.split('\n').filter(l => l.trim());
  const cards = [];
  const now   = Date.now();

  lines.forEach((line, i) => {
    // Support tab or comma as separator (first occurrence only)
    const tabIdx   = line.indexOf('\t');
    const commaIdx = line.indexOf(',');
    let sep = -1;
    if (tabIdx > -1 && (commaIdx === -1 || tabIdx < commaIdx)) sep = tabIdx;
    else if (commaIdx > -1) sep = commaIdx;

    if (sep > -1) {
      const front = line.slice(0, sep).trim();
      const back  = line.slice(sep + 1).trim();
      if (front && back) {
        cards.push({ front, back, known: false, createdAt: now + i });
      }
    }
  });

  if (!cards.length) { showToast('No valid lines found. Use "word, translation" format.'); return; }

  await DB.bulkAdd(cards);
  await loadCards();
  closeModal(el.modalBulk);
  el.inputBulk.value = '';
  showToast(`✓ Imported ${cards.length} card${cards.length !== 1 ? 's' : ''}`);
}


/* ═══════════════════════════════════════════
   IMPORT / EXPORT JSON
   ═══════════════════════════════════════════ */
function exportJSON() {
  if (!State.cards.length) { showToast('No cards to export.'); return; }

  const data = JSON.stringify(State.cards, null, 2);
  const blob = new Blob([data], { type: 'application/json' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = `flashcards_backup_${new Date().toISOString().slice(0,10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
  showToast('Exported!');
}

function triggerImportJSON() {
  el.fileImport.click();
}

async function importJSON(file) {
  if (!file) return;
  const text = await file.text();
  let data;
  try { data = JSON.parse(text); } catch { showToast('Invalid JSON file.'); return; }
  if (!Array.isArray(data)) { showToast('JSON must be an array of cards.'); return; }

  const now   = Date.now();
  const cards = data.filter(c => c.front && c.back).map((c, i) => ({
    front:     String(c.front).trim(),
    back:      String(c.back).trim(),
    known:     !!c.known,
    createdAt: c.createdAt || (now + i)
  }));

  if (!cards.length) { showToast('No valid cards found in file.'); return; }

  await DB.bulkAdd(cards);
  await loadCards();
  showToast(`✓ Imported ${cards.length} card${cards.length !== 1 ? 's' : ''}`);
}

async function resetProgress() {
  for (const card of State.cards) {
    card.known = false;
    await DB.put(card);
  }
  await loadCards();
  showToast('Progress reset.');
}

async function resetAll() {
  await DB.clear();
  await loadCards();
  showToast('All cards deleted.');
}


/* ═══════════════════════════════════════════
   MODAL HELPERS
   ═══════════════════════════════════════════ */
function openModal(modal) {
  modal.classList.remove('hidden');
  requestAnimationFrame(() => modal.classList.add('visible'));
  document.body.style.overflow = 'hidden';
}

function closeModal(modal) {
  modal.classList.remove('visible');
  document.body.style.overflow = '';
  setTimeout(() => modal.classList.add('hidden'), 360);
}

function openManageModal() {
  renderManageList();
  openModal(el.modalManage);
}

function closeManageModal() {
  closeModal(el.modalManage);
}

function renderManageList() {
  el.manageList.innerHTML = '';
  if (!State.cards.length) {
    el.manageList.innerHTML = '<p style="text-align:center;color:var(--text-secondary);padding:24px 0;">No cards yet.</p>';
    return;
  }
  State.cards.forEach(card => {
    const item = document.createElement('div');
    item.className = 'manage-item' + (card.known ? ' is-known' : '');
    item.innerHTML = `
      <div class="manage-item-text">
        <div class="manage-item-front">${escapeHtml(card.front)}</div>
        <div class="manage-item-back">${escapeHtml(card.back)}</div>
      </div>
      <div class="manage-item-actions">
        <button class="manage-action-btn edit" aria-label="Edit" data-id="${card.id}">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
          </svg>
        </button>
        <button class="manage-action-btn delete" aria-label="Delete" data-id="${card.id}">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/>
          </svg>
        </button>
      </div>
    `;
    el.manageList.appendChild(item);
  });
}

function escapeHtml(str) {
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function openMenu() {
  el.menuOverlay.classList.remove('hidden');
  el.sideMenu.classList.remove('hidden');
  requestAnimationFrame(() => {
    el.menuOverlay.classList.add('visible');
    el.sideMenu.classList.add('visible');
  });
}

function closeMenu() {
  el.menuOverlay.classList.remove('visible');
  el.sideMenu.classList.remove('visible');
  setTimeout(() => {
    el.menuOverlay.classList.add('hidden');
    el.sideMenu.classList.add('hidden');
  }, 380);
}

/* Confirm dialog */
function confirm(title, desc, okLabel = 'Delete') {
  return new Promise(resolve => {
    el.confirmTitle.textContent = title;
    el.confirmDesc.textContent  = desc;
    el.confirmOk.textContent    = okLabel;
    openModal(el.modalConfirm);

    const onOk     = () => { cleanup(); closeModal(el.modalConfirm); resolve(true); };
    const onCancel = () => { cleanup(); closeModal(el.modalConfirm); resolve(false); };
    function cleanup() {
      el.confirmOk.removeEventListener('click', onOk);
      el.confirmCancel.removeEventListener('click', onCancel);
    }
    el.confirmOk.addEventListener('click', onOk);
    el.confirmCancel.addEventListener('click', onCancel);
  });
}


/* ═══════════════════════════════════════════
   TOAST
   ═══════════════════════════════════════════ */
let toastTimer = null;
function showToast(msg, dur = 2200) {
  clearTimeout(toastTimer);
  el.toast.textContent = msg;
  el.toast.classList.remove('hidden');
  requestAnimationFrame(() => el.toast.classList.add('show'));
  toastTimer = setTimeout(() => {
    el.toast.classList.remove('show');
    setTimeout(() => el.toast.classList.add('hidden'), 320);
  }, dur);
}


/* ═══════════════════════════════════════════
   SWIPE / TOUCH GESTURE HANDLER
   ═══════════════════════════════════════════ */
function initGestures() {
  const stage = document.getElementById('card-stage');
  let startX = 0, startY = 0, startTime = 0;
  let isDragging = false;
  const SWIPE_THRESHOLD = 50;
  const TIME_THRESHOLD  = 350;
  const DRAG_RESISTANCE = 0.4;

  stage.addEventListener('touchstart', e => {
    const t = e.touches[0];
    startX = t.clientX;
    startY = t.clientY;
    startTime = Date.now();
    isDragging = true;
    el.flashcard.classList.add('dragging');
  }, { passive: true });

  stage.addEventListener('touchmove', e => {
    if (!isDragging) return;
    const t  = e.touches[0];
    const dx = (t.clientX - startX) * DRAG_RESISTANCE;
    const dy = (t.clientY - startY) * DRAG_RESISTANCE;

    const absDx = Math.abs(t.clientX - startX);
    const absDy = Math.abs(t.clientY - startY);

    if (absDx > absDy) {
      // Horizontal drag: show preview
      el.flashcard.style.transform = `translateX(${dx}px) rotateY(${dx * 0.08}deg)`;
    } else {
      // Vertical drag
      el.flashcard.style.transform = `translateY(${dy}px)`;
    }
  }, { passive: true });

  stage.addEventListener('touchend', e => {
    if (!isDragging) return;
    isDragging = false;
    el.flashcard.classList.remove('dragging');
    el.flashcard.style.transform = '';

    const t    = e.changedTouches[0];
    const dx   = t.clientX - startX;
    const dy   = t.clientY - startY;
    const dt   = Date.now() - startTime;
    const absDx = Math.abs(dx);
    const absDy = Math.abs(dy);

    if (dt > TIME_THRESHOLD) return; // too slow, treat as tap

    if (absDx > absDy && absDx > SWIPE_THRESHOLD) {
      // Horizontal swipe
      if (dx < 0) goNext();
      else         goPrev();
    } else if (absDy > absDx && absDy > SWIPE_THRESHOLD) {
      // Vertical swipe
      if (dy < 0) {
        // Swipe up → reveal translation
        if (!State.flipped) flipCard();
      } else {
        // Swipe down → hide translation
        if (State.flipped) flipCard();
      }
    } else if (absDx < 8 && absDy < 8) {
      // Tap = flip
      if (State.cards.length) flipCard();
    }
  }, { passive: true });

  // Mouse support for desktop testing
  let mouseStart = null;
  stage.addEventListener('mousedown', e => {
    mouseStart = { x: e.clientX, y: e.clientY, t: Date.now() };
    el.flashcard.classList.add('dragging');
  });
  window.addEventListener('mouseup', e => {
    if (!mouseStart) return;
    el.flashcard.classList.remove('dragging');
    el.flashcard.style.transform = '';
    const dx = e.clientX - mouseStart.x;
    const dy = e.clientY - mouseStart.y;
    const dt = Date.now() - mouseStart.t;
    const absDx = Math.abs(dx), absDy = Math.abs(dy);
    mouseStart = null;
    if (dt > TIME_THRESHOLD) return;
    if (absDx > absDy && absDx > SWIPE_THRESHOLD) {
      if (dx < 0) goNext(); else goPrev();
    } else if (absDy > absDx && absDy > SWIPE_THRESHOLD) {
      if (dy < 0) { if (!State.flipped) flipCard(); }
      else         { if (State.flipped) flipCard(); }
    } else if (absDx < 6 && absDy < 6) {
      if (State.cards.length) flipCard();
    }
  });
  window.addEventListener('mousemove', e => {
    if (!mouseStart) return;
    const dx = (e.clientX - mouseStart.x) * DRAG_RESISTANCE;
    const dy = (e.clientY - mouseStart.y) * DRAG_RESISTANCE;
    const absDx = Math.abs(e.clientX - mouseStart.x);
    const absDy = Math.abs(e.clientY - mouseStart.y);
    if (absDx > absDy) el.flashcard.style.transform = `translateX(${dx}px) rotateY(${dx * 0.08}deg)`;
    else               el.flashcard.style.transform = `translateY(${dy}px)`;
  });
}


/* ═══════════════════════════════════════════
   KEYBOARD SHORTCUTS (desktop)
   ═══════════════════════════════════════════ */
function initKeyboard() {
  document.addEventListener('keydown', e => {
    // Skip when typing in an input
    if (e.target.tagName === 'TEXTAREA' || e.target.tagName === 'INPUT') return;
    switch(e.key) {
      case 'ArrowRight': case 'ArrowDown': goNext();  break;
      case 'ArrowLeft':  case 'ArrowUp':   goPrev();  break;
      case ' ': e.preventDefault(); flipCard(); break;
      case 'k': case 'K': markKnown(); break;
    }
  });
}


/* ═══════════════════════════════════════════
   EVENT LISTENERS
   ═══════════════════════════════════════════ */
function initEvents() {
  // Navigation
  el.btnNext.addEventListener('click', goNext);
  el.btnPrev.addEventListener('click', goPrev);
  el.btnShuffle.addEventListener('click', toggleShuffle);
  el.btnAddFirst.addEventListener('click', openAddModal);
  el.btnAddCard.addEventListener('click', openAddModal);

  // Known/unknown
  el.btnKnown.addEventListener('click', markKnown);
  el.btnUnknown.addEventListener('click', markUnknown);

  // Menu
  el.btnMenu.addEventListener('click', openMenu);
  el.btnCloseMenu.addEventListener('click', closeMenu);
  el.menuOverlay.addEventListener('click', closeMenu);

  el.menuManage.addEventListener('click', ()=>{ closeMenu(); setTimeout(openManageModal, 350); });
  el.menuImportBulk.addEventListener('click', ()=>{ closeMenu(); setTimeout(()=>openModal(el.modalBulk), 350); });
  el.menuExport.addEventListener('click', ()=>{ closeMenu(); setTimeout(exportJSON, 350); });
  el.menuImportJson.addEventListener('click', ()=>{ closeMenu(); setTimeout(triggerImportJSON, 350); });
  el.menuResetProg.addEventListener('click', async ()=>{
    closeMenu();
    const ok = await confirm('Reset Progress?', 'All "known" marks will be cleared. Cards are kept.', 'Reset');
    if (ok) resetProgress();
  });
  el.menuResetAll.addEventListener('click', async ()=>{
    closeMenu();
    const ok = await confirm('Delete All Cards?', 'This will permanently remove all your flashcards. This cannot be undone.', 'Delete All');
    if (ok) resetAll();
  });

  // Add/Edit modal
  el.modalCardCancel.addEventListener('click', ()=>{ closeModal(el.modalCard); State.editingId=null; });
  el.modalCardSave.addEventListener('click', saveCardFromModal);

  // Bulk import modal
  el.modalBulkCancel.addEventListener('click', ()=>closeModal(el.modalBulk));
  el.modalBulkSave.addEventListener('click', saveBulkImport);

  // Manage modal
  el.modalManageClose.addEventListener('click', closeManageModal);
  el.manageList.addEventListener('click', async e => {
    const editBtn   = e.target.closest('.manage-action-btn.edit');
    const deleteBtn = e.target.closest('.manage-action-btn.delete');
    if (editBtn) {
      const id   = Number(editBtn.dataset.id);
      const card = State.cards.find(c => c.id === id);
      if (card) openEditModal(card);
    }
    if (deleteBtn) {
      const id = Number(deleteBtn.dataset.id);
      const ok = await confirm('Delete Card?', 'This card will be permanently removed.', 'Delete');
      if (ok) {
        await deleteCard(id);
        renderManageList();
      }
    }
  });

  // File import
  el.fileImport.addEventListener('change', e => {
    importJSON(e.target.files[0]);
    e.target.value = '';
  });

  // Close modals on backdrop tap
  [el.modalCard, el.modalBulk, el.modalManage].forEach(modal => {
    modal.addEventListener('click', e => {
      if (e.target === modal) closeModal(modal);
    });
  });

  // Prevent page scroll on body when modal open
  document.addEventListener('touchmove', e => {
    if (document.body.style.overflow === 'hidden') e.preventDefault();
  }, { passive: false });
}


/* ═══════════════════════════════════════════
   SERVICE WORKER REGISTRATION
   ═══════════════════════════════════════════ */
function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./service-worker.js')
      .then(reg => console.log('SW registered:', reg.scope))
      .catch(err => console.warn('SW registration failed:', err));
  }
}


/* ═══════════════════════════════════════════
   BOOT
   ═══════════════════════════════════════════ */
async function boot() {
  await DB.init();
  await loadCards();
  initGestures();
  initKeyboard();
  initEvents();
  registerServiceWorker();

  // Hint overlay for first-time users
  if (!localStorage.getItem('fc_hinted') && State.cards.length) {
    localStorage.setItem('fc_hinted', '1');
  }
}

document.addEventListener('DOMContentLoaded', boot);

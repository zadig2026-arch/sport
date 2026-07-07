// ===== State & Storage =====
const LS_KEY = 'sport-v1';
const state = loadState();
let programme = null;
let currentSessionId = null;

function loadState() {
  let s;
  try {
    s = JSON.parse(localStorage.getItem(LS_KEY)) || defaultState();
  } catch {
    s = defaultState();
  }
  // Migration / garde-fous : un état sauvegardé avant l'ajout de l'historique
  // n'a pas le champ `history`, on le normalise pour éviter les crashs.
  if (!s.loads) s.loads = {};
  if (!s.checks) s.checks = {};
  if (!Array.isArray(s.weights)) s.weights = [];
  if (!Array.isArray(s.history)) s.history = [];
  return s;
}
function defaultState() {
  return {
    week: 1,
    phaseId: 'phase1',
    loads: {},      // { sessionId: { exerciseIdx: { setIdx: "60" } } } — séance en cours (tampon)
    checks: {},     // { sessionId: { exerciseIdx: { setIdx: true } } }
    weights: [],    // [{ date: "2026-04-17", kg: 69.2 }]
    history: [],    // [{ date, sessionId, sessionName, phaseId, week, exercises: [{ nom, sets: [{kg, reps}] }] }] — plus récent en tête
    lastSession: null
  };
}
function saveState() {
  localStorage.setItem(LS_KEY, JSON.stringify(state));
}

// ===== Init =====
async function init() {
  try {
    const pRes = await fetch('./data/programme.json');
    programme = await pRes.json();
  } catch (e) {
    document.body.innerHTML = '<p style="padding:20px;color:#f66">Impossible de charger les données. Sers le dossier avec un serveur HTTP (pas en file://).</p>';
    return;
  }

  renderPhaseBadge();
  setupTabs();
  setupSettings();
  setupReset();
  populateSessionSelect();
  renderSession();
  renderSuivi();
  registerSW();
  setupWakeLock();
}

// ===== Tabs =====
function setupTabs() {
  document.querySelectorAll('.tab').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById('tab-' + btn.dataset.tab).classList.add('active');
      if (btn.dataset.tab === 'suivi') renderSuivi();
    });
  });
}

// ===== Phase badge =====
function renderPhaseBadge() {
  const phase = programme?.phases.find(p => p.id === state.phaseId) || { numero: 1 };
  document.getElementById('current-phase').textContent = `Phase ${phase.numero} · S${state.week}`;
}

// ===== Session =====
function populateSessionSelect() {
  const phase = programme.phases.find(p => p.id === state.phaseId);
  const sel = document.getElementById('session-select');
  sel.innerHTML = '';
  phase.seances.forEach(s => {
    const opt = document.createElement('option');
    opt.value = s.id;
    opt.textContent = s.nom;
    sel.appendChild(opt);
  });
  currentSessionId = nextRotationSessionId(phase);
  sel.value = currentSessionId;
  sel.onchange = () => { currentSessionId = sel.value; renderSession(); };
}

// Rotation Push → Pull → Legs → Upper → Lower : propose la séance qui suit
// la dernière terminée, en rebouclant en fin de cycle.
function nextRotationSessionId(phase) {
  const rotation = phase.seances.filter(s => !s.optionnel);
  const i = rotation.findIndex(s => s.id === state.lastSession);
  if (i >= 0) return rotation[(i + 1) % rotation.length].id;
  return rotation[0]?.id || phase.seances[0].id;
}

function getCurrentSession() {
  const phase = programme.phases.find(p => p.id === state.phaseId);
  return phase.seances.find(s => s.id === currentSessionId);
}

const DEMO_BASE = 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises';
let demoIntervals = [];

function renderSession() {
  const session = getCurrentSession();
  if (!session) return;
  demoIntervals.forEach(clearInterval);
  demoIntervals = [];
  const intro = document.getElementById('session-intro');
  const phase = programme.phases.find(p => p.id === state.phaseId);
  intro.textContent = `${phase.nom} (S${phase.semaines}) — ${phase.format}`;

  const container = document.getElementById('exercises');
  container.innerHTML = '';
  session.exercices.forEach((ex, idx) => {
    container.appendChild(renderExerciseCard(ex, idx, session.id));
  });
}

function renderDemoThumb(slug, name) {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'demo-thumb';
  btn.setAttribute('aria-label', `Voir la démo de ${name}`);
  const base = `${DEMO_BASE}/${encodeURIComponent(slug)}`;
  const a = document.createElement('img');
  a.className = 'demo-frame demo-frame-a';
  a.crossOrigin = 'anonymous';
  a.src = `${base}/0.jpg`;
  a.alt = name;
  a.loading = 'lazy';
  a.decoding = 'async';
  const b = document.createElement('img');
  b.className = 'demo-frame demo-frame-b';
  b.crossOrigin = 'anonymous';
  b.src = `${base}/1.jpg`;
  b.alt = '';
  b.loading = 'lazy';
  b.decoding = 'async';
  a.onerror = () => btn.remove();
  btn.appendChild(a);
  btn.appendChild(b);
  const play = document.createElement('span');
  play.className = 'demo-play';
  play.textContent = '▶';
  btn.appendChild(play);
  const id = setInterval(() => btn.classList.toggle('flipped'), 1200);
  demoIntervals.push(id);
  btn.onclick = () => openDemoModal(slug, name);
  return btn;
}

function openDemoModal(slug, name) {
  const modal = document.createElement('div');
  modal.className = 'demo-modal';
  const content = document.createElement('div');
  content.className = 'demo-modal-content';
  content.onclick = (e) => e.stopPropagation();
  const title = document.createElement('h2');
  title.textContent = name;
  content.appendChild(title);
  const frame = document.createElement('div');
  frame.className = 'demo-modal-frame';
  const base = `${DEMO_BASE}/${encodeURIComponent(slug)}`;
  const a = document.createElement('img');
  a.className = 'demo-frame demo-frame-a';
  a.crossOrigin = 'anonymous';
  a.src = `${base}/0.jpg`;
  a.alt = name;
  const b = document.createElement('img');
  b.className = 'demo-frame demo-frame-b';
  b.crossOrigin = 'anonymous';
  b.src = `${base}/1.jpg`;
  b.alt = '';
  frame.appendChild(a);
  frame.appendChild(b);
  content.appendChild(frame);
  const hint = document.createElement('p');
  hint.className = 'demo-modal-hint';
  hint.textContent = 'Position de départ ↔ fin de mouvement';
  content.appendChild(hint);
  const close = document.createElement('button');
  close.className = 'ghost';
  close.textContent = 'Fermer';
  modal.appendChild(content);
  content.appendChild(close);
  const toggle = setInterval(() => frame.classList.toggle('flipped'), 900);
  const cleanup = () => { clearInterval(toggle); modal.remove(); };
  modal.onclick = cleanup;
  close.onclick = cleanup;
  document.body.appendChild(modal);
}

function renderExerciseCard(ex, idx, sessionId) {
  const card = document.createElement('div');
  card.className = 'exercise-card';

  const header = document.createElement('div');
  header.className = 'exercise-header';
  if (ex.demo) {
    header.appendChild(renderDemoThumb(ex.demo, ex.nom));
  }
  const h3 = document.createElement('h3');
  h3.textContent = ex.nom;
  header.appendChild(h3);
  card.appendChild(header);

  const meta = document.createElement('div');
  meta.className = 'exercise-meta';
  meta.textContent = `${ex.series} × ${ex.reps} · repos ${formatRest(ex.repos_s)}`;
  card.appendChild(meta);

  if (ex.poids_depart) {
    const start = document.createElement('div');
    start.className = 'exercise-start';
    start.textContent = `Départ recommandé : ${ex.poids_depart}`;
    card.appendChild(start);
  }

  if (ex.note) {
    const note = document.createElement('div');
    note.className = 'exercise-note';
    note.textContent = ex.note;
    card.appendChild(note);
  }

  const prev = getPreviousLoads(ex.nom);
  if (prev) {
    const p = document.createElement('div');
    p.className = 'prev-load';
    p.textContent = `Dernière fois : ${prev}`;
    card.appendChild(p);
  }

  const setsWrap = document.createElement('div');
  setsWrap.className = 'sets';
  for (let i = 0; i < ex.series; i++) {
    setsWrap.appendChild(renderSetRow(sessionId, idx, i, ex.repos_s));
  }
  card.appendChild(setsWrap);

  const restBtn = document.createElement('button');
  restBtn.className = 'rest-btn';
  restBtn.textContent = `⏱ Lancer repos ${formatRest(ex.repos_s)}`;
  restBtn.onclick = () => startRest(ex.repos_s);
  card.appendChild(restBtn);

  return card;
}

function renderSetRow(sessionId, exIdx, setIdx, restS) {
  const row = document.createElement('div');
  row.className = 'set-row';

  const lbl = document.createElement('div');
  lbl.className = 'set-label';
  lbl.textContent = `S${setIdx + 1}`;
  row.appendChild(lbl);

  const input = document.createElement('input');
  input.type = 'number';
  input.inputMode = 'decimal';
  input.step = '0.5';
  input.placeholder = 'kg';
  const savedLoad = state.loads[sessionId]?.[exIdx]?.[setIdx] || '';
  input.value = savedLoad;
  input.oninput = () => {
    state.loads[sessionId] = state.loads[sessionId] || {};
    state.loads[sessionId][exIdx] = state.loads[sessionId][exIdx] || {};
    state.loads[sessionId][exIdx][setIdx] = input.value;
    saveState();
  };
  row.appendChild(input);

  const repsInput = document.createElement('input');
  repsInput.type = 'number';
  repsInput.inputMode = 'numeric';
  repsInput.placeholder = 'reps';
  repsInput.style.maxWidth = '70px';
  const savedReps = state.loads[sessionId]?.[exIdx]?.['r' + setIdx] || '';
  repsInput.value = savedReps;
  repsInput.oninput = () => {
    state.loads[sessionId] = state.loads[sessionId] || {};
    state.loads[sessionId][exIdx] = state.loads[sessionId][exIdx] || {};
    state.loads[sessionId][exIdx]['r' + setIdx] = repsInput.value;
    saveState();
  };
  row.appendChild(repsInput);

  const check = document.createElement('button');
  check.className = 'set-check';
  check.textContent = '✓';
  const isChecked = state.checks[sessionId]?.[exIdx]?.[setIdx];
  if (isChecked) check.classList.add('checked');
  check.onclick = () => {
    state.checks[sessionId] = state.checks[sessionId] || {};
    state.checks[sessionId][exIdx] = state.checks[sessionId][exIdx] || {};
    const now = !state.checks[sessionId][exIdx][setIdx];
    state.checks[sessionId][exIdx][setIdx] = now;
    check.classList.toggle('checked', now);
    saveState();
    if (now && restS) startRest(restS);
  };
  row.appendChild(check);
  return row;
}

function getPreviousLoads(exerciseName) {
  // L'historique est trié plus-récent-en-tête : on retourne la dernière fois
  // que cet exercice (peu importe la séance) a été enregistré.
  for (const h of state.history) {
    const e = h.exercises.find(x => x.nom === exerciseName);
    if (e && e.sets.length) {
      return e.sets.map(s => s.reps ? `${s.kg}kg×${s.reps}` : `${s.kg}kg`).join(' · ');
    }
  }
  return null;
}

function formatRest(s) {
  if (!s) return '';
  const m = Math.floor(s / 60);
  const r = s % 60;
  return r === 0 ? `${m} min` : `${m}:${String(r).padStart(2, '0')}`;
}

// Finish session button
document.addEventListener('click', e => {
  if (e.target?.id === 'btn-finish-session') finishSession();
});

function finishSession() {
  const session = getCurrentSession();
  if (!session) return;

  // Construire un instantané daté de la séance à partir du tampon de saisie.
  const exercises = session.exercices.map((ex, idx) => {
    const setLoads = state.loads[session.id]?.[idx] || {};
    const sets = [];
    for (let i = 0; i < ex.series; i++) {
      const kg = setLoads[i];
      const reps = setLoads['r' + i];
      if ((kg !== undefined && kg !== '') || (reps !== undefined && reps !== '')) {
        sets.push({ kg: kg || '', reps: reps || '' });
      }
    }
    return { nom: ex.nom, sets };
  }).filter(e => e.sets.length);

  if (!exercises.length) {
    alert('Aucune charge saisie. Renseigne au moins une série avant de terminer.');
    return;
  }

  const today = new Date().toISOString().slice(0, 10);
  state.history.unshift({
    date: today,
    sessionId: session.id,
    sessionName: session.nom,
    phaseId: state.phaseId,
    week: state.week,
    exercises
  });

  // Vider le tampon de la séance : la prochaine fois démarre propre,
  // et "Dernière fois" s'alimente désormais depuis l'historique.
  delete state.loads[session.id];
  delete state.checks[session.id];
  if (!session.optionnel) state.lastSession = session.id;
  saveState();

  const phase = programme.phases.find(p => p.id === state.phaseId);
  const next = phase.seances.find(s => s.id === nextRotationSessionId(phase));
  alert(`Séance enregistrée dans l'historique ! Pense à manger ton post-training.\nProchaine séance : ${next ? next.nom : '—'}`);
  populateSessionSelect();
  renderSession();
  window.scrollTo(0, 0);
}

// ===== Rest timer =====
let restInterval = null;
function startRest(seconds) {
  const el = document.getElementById('rest-timer');
  const disp = document.getElementById('rest-display');
  let remaining = seconds;
  el.classList.remove('hidden');
  updateDisp();
  if (restInterval) clearInterval(restInterval);
  restInterval = setInterval(() => {
    remaining--;
    if (remaining <= 0) {
      clearInterval(restInterval);
      restInterval = null;
      beep();
      vibrate([200, 100, 200]);
      el.classList.add('hidden');
      return;
    }
    updateDisp();
  }, 1000);
  function updateDisp() {
    const m = Math.floor(remaining / 60);
    const s = remaining % 60;
    disp.textContent = `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }
}
document.getElementById('rest-cancel').onclick = () => {
  if (restInterval) clearInterval(restInterval);
  restInterval = null;
  document.getElementById('rest-timer').classList.add('hidden');
};

function beep() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.connect(g); g.connect(ctx.destination);
    o.frequency.value = 880;
    g.gain.value = 0.1;
    o.start();
    setTimeout(() => { o.stop(); ctx.close(); }, 250);
  } catch {}
}
function vibrate(p) { if (navigator.vibrate) navigator.vibrate(p); }

// ===== Suivi =====
function renderSuivi() {
  renderWeights();
  renderHistorique();
  drawWeightChart();
}

document.getElementById('btn-save-weight').onclick = () => {
  const v = parseFloat(document.getElementById('input-weight').value);
  if (!v || v < 30 || v > 200) {
    document.getElementById('weight-feedback').textContent = 'Poids invalide.';
    return;
  }
  const today = new Date().toISOString().slice(0, 10);
  state.weights = state.weights.filter(w => w.date !== today);
  state.weights.push({ date: today, kg: v });
  state.weights.sort((a, b) => a.date.localeCompare(b.date));
  saveState();
  document.getElementById('input-weight').value = '';
  document.getElementById('weight-feedback').textContent = computeFeedback(v);
  renderWeights();
  drawWeightChart();
};

function computeFeedback(latest) {
  const w = state.weights;
  if (w.length < 2) return `Enregistré : ${latest} kg. Pèse-toi chaque lundi.`;
  const prev = w[w.length - 2];
  const diff = +(latest - prev.kg).toFixed(1);
  const sign = diff > 0 ? '+' : '';
  if (w.length >= 3) {
    const prev2 = w[w.length - 3];
    const avgChange = (latest - prev2.kg) / 2;
    if (avgChange < 0.1) return `${sign}${diff} kg cette semaine. Stagnation → +300 kcal/j.`;
    if (avgChange > 0.8) return `${sign}${diff} kg. Trop rapide → -150 kcal/j.`;
  }
  return `${sign}${diff} kg cette semaine. Objectif : +0,3 à 0,5 kg.`;
}

function renderWeights() {
  const list = document.getElementById('weight-list');
  list.innerHTML = '';
  const recent = state.weights.slice(-8).reverse();
  if (!recent.length) {
    list.innerHTML = '<div class="muted" style="grid-column: 1/-1">Aucune pesée enregistrée.</div>';
    return;
  }
  recent.forEach(w => {
    const el = document.createElement('div');
    el.textContent = `${w.date} · ${w.kg} kg`;
    list.appendChild(el);
  });
}

function drawWeightChart() {
  const canvas = document.getElementById('weight-chart');
  if (!canvas) return;
  drawChart(
    canvas,
    state.weights.map(w => w.kg),
    state.weights.map(w => w.date.slice(5)),
    'Il faut au moins 2 pesées pour tracer le graphique'
  );
}

// Graphique en courbe générique (poids, charges...).
function drawChart(canvas, values, labels, emptyMsg) {
  const ctx = canvas.getContext('2d');
  const w = canvas.width;
  const h = canvas.height;
  ctx.clearRect(0, 0, w, h);

  if (values.length < 2) {
    ctx.fillStyle = '#8b94a0';
    ctx.font = '15px system-ui';
    ctx.textAlign = 'center';
    ctx.fillText(emptyMsg || 'Au moins 2 points pour tracer la courbe', w / 2, h / 2);
    return;
  }

  const pad = 40;
  const min = Math.min(...values) - 1;
  const max = Math.max(...values) + 1;
  const span = (max - min) || 1;
  const xStep = (w - pad * 2) / (values.length - 1);
  const yOf = v => pad + (h - pad * 2) * (1 - (v - min) / span);

  // Grille + échelle Y
  ctx.strokeStyle = '#2a3038';
  ctx.lineWidth = 1;
  for (let i = 0; i <= 4; i++) {
    const y = pad + (h - pad * 2) * (i / 4);
    ctx.beginPath();
    ctx.moveTo(pad, y);
    ctx.lineTo(w - pad, y);
    ctx.stroke();
    const val = (max - span * (i / 4)).toFixed(1);
    ctx.fillStyle = '#8b94a0';
    ctx.font = '11px system-ui';
    ctx.textAlign = 'right';
    ctx.fillText(val, pad - 6, y + 4);
  }

  // Labels X (début, milieu, fin)
  if (labels && labels.length) {
    ctx.fillStyle = '#8b94a0';
    ctx.font = '10px system-ui';
    ctx.textAlign = 'center';
    [0, Math.floor((values.length - 1) / 2), values.length - 1].forEach(i => {
      if (labels[i]) ctx.fillText(labels[i], pad + xStep * i, h - pad + 18);
    });
  }

  // Courbe
  ctx.strokeStyle = '#ff6b35';
  ctx.lineWidth = 3;
  ctx.beginPath();
  values.forEach((v, i) => {
    const x = pad + xStep * i;
    const y = yOf(v);
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  });
  ctx.stroke();

  // Points
  ctx.fillStyle = '#ffa45c';
  values.forEach((v, i) => {
    ctx.beginPath();
    ctx.arc(pad + xStep * i, yOf(v), 4, 0, Math.PI * 2);
    ctx.fill();
  });
}

// ===== Historique des séances =====
function renderHistorique() {
  const el = document.getElementById('history-list');
  if (!el) return;
  el.innerHTML = '';
  if (!state.history.length) {
    el.innerHTML = '<div class="muted">Aucune séance enregistrée. Termine une séance pour la voir apparaître ici.</div>';
    return;
  }
  state.history.forEach(h => {
    const entry = document.createElement('div');
    entry.className = 'history-entry';

    const totalSets = h.exercises.reduce((n, e) => n + e.sets.length, 0);
    const head = document.createElement('button');
    head.type = 'button';
    head.className = 'history-head';
    head.innerHTML = `
      <span class="history-info">
        <span class="history-name">${h.sessionName}</span>
        <span class="history-meta">${h.date} · ${h.exercises.length} exo${h.exercises.length > 1 ? 's' : ''} · ${totalSets} série${totalSets > 1 ? 's' : ''}</span>
      </span>
      <span class="history-chevron">▾</span>`;

    const body = document.createElement('div');
    body.className = 'history-body hidden';
    body.innerHTML = h.exercises.map(e => `
      <div class="history-ex">
        <span class="history-ex-name">${e.nom}</span>
        <span class="history-ex-sets">${e.sets.map(s => s.reps ? `${s.kg || '–'}×${s.reps}` : `${s.kg || '–'} kg`).join(' · ')}</span>
      </div>`).join('');

    head.onclick = () => {
      body.classList.toggle('hidden');
      entry.classList.toggle('open');
    };
    entry.appendChild(head);
    entry.appendChild(body);
    el.appendChild(entry);
  });
}

// ===== Settings =====
function setupSettings() {
  const modal = document.getElementById('settings-modal');
  document.getElementById('btn-settings').onclick = () => {
    document.getElementById('input-week').value = state.week;
    document.getElementById('input-phase').value = state.phaseId;
    // Version réellement installée (nom du cache du service worker actif)
    if (window.caches) {
      caches.keys().then(ks => {
        document.getElementById('app-version').textContent =
          ks.length ? `Version installée : ${ks.join(', ')}` : 'Version installée : aucune (pas de cache)';
      }).catch(() => {});
    }
    modal.classList.remove('hidden');
  };
  document.getElementById('settings-close').onclick = () => modal.classList.add('hidden');
  document.getElementById('settings-save').onclick = () => {
    state.week = parseInt(document.getElementById('input-week').value, 10) || 1;
    state.phaseId = document.getElementById('input-phase').value;
    saveState();
    renderPhaseBadge();
    populateSessionSelect();
    renderSession();
    renderSuivi();
    modal.classList.add('hidden');
  };
}

function setupReset() {
  document.getElementById('btn-reset').onclick = () => {
    if (!confirm('Effacer TOUTES les données (charges, poids, progression) ?')) return;
    localStorage.removeItem(LS_KEY);
    location.reload();
  };
}

// ===== Wake Lock (garder l'écran allumé pendant la séance) =====
let wakeLock = null;

async function requestWakeLock() {
  if (!('wakeLock' in navigator)) return; // iOS < 16.4 ou navigateur non compatible
  try {
    wakeLock = await navigator.wakeLock.request('screen');
    wakeLock.addEventListener('release', () => { wakeLock = null; });
  } catch {
    // Verrou refusé (onglet en arrière-plan, batterie faible…), on réessaiera au retour
  }
}

function setupWakeLock() {
  requestWakeLock();
  // iOS relâche le verrou dès que l'app passe en arrière-plan : on le ré-acquiert au retour
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') requestWakeLock();
  });
}

// ===== Service Worker =====
function registerSW() {
  if (!('serviceWorker' in navigator)) return;
  navigator.serviceWorker.register('./sw.js').then(reg => {
    // iOS ne vérifie pas toujours les mises à jour d'une PWA installée :
    // on force la vérification à chaque retour au premier plan.
    reg.update().catch(() => {});
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') reg.update().catch(() => {});
    });
  }).catch(() => {});
  // Quand un nouveau SW prend le contrôle (skipWaiting + claim), on recharge
  // pour servir immédiatement les fichiers frais. Les saisies sont dans
  // localStorage, rien n'est perdu.
  let reloaded = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (reloaded) return;
    reloaded = true;
    location.reload();
  });
}

// Go
init();

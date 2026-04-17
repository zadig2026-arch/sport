// ===== State & Storage =====
const LS_KEY = 'sport-v1';
const state = loadState();
let programme = null;
let nutrition = null;
let currentSessionId = null;

function loadState() {
  try {
    return JSON.parse(localStorage.getItem(LS_KEY)) || defaultState();
  } catch {
    return defaultState();
  }
}
function defaultState() {
  return {
    week: 1,
    phaseId: 'phase1',
    loads: {},      // { sessionId: { exerciseIdx: { setIdx: "60" } } }
    checks: {},     // { sessionId: { exerciseIdx: { setIdx: true } } }
    weights: [],    // [{ date: "2026-04-17", kg: 69.2 }]
    lastSession: null
  };
}
function saveState() {
  localStorage.setItem(LS_KEY, JSON.stringify(state));
}

// ===== Init =====
async function init() {
  try {
    const [pRes, nRes] = await Promise.all([
      fetch('./data/programme.json'),
      fetch('./data/nutrition.json')
    ]);
    programme = await pRes.json();
    nutrition = await nRes.json();
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
  renderNutrition();
  renderSuivi();
  registerSW();
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
  currentSessionId = state.lastSession && phase.seances.find(s => s.id === state.lastSession)
    ? state.lastSession
    : phase.seances[0].id;
  sel.value = currentSessionId;
  sel.onchange = () => { currentSessionId = sel.value; renderSession(); };
}

function getCurrentSession() {
  const phase = programme.phases.find(p => p.id === state.phaseId);
  return phase.seances.find(s => s.id === currentSessionId);
}

function renderSession() {
  const session = getCurrentSession();
  if (!session) return;
  const intro = document.getElementById('session-intro');
  const phase = programme.phases.find(p => p.id === state.phaseId);
  intro.textContent = `${phase.nom} (S${phase.semaines}) — ${phase.format}`;

  const container = document.getElementById('exercises');
  container.innerHTML = '';
  session.exercices.forEach((ex, idx) => {
    container.appendChild(renderExerciseCard(ex, idx, session.id));
  });
}

function renderExerciseCard(ex, idx, sessionId) {
  const card = document.createElement('div');
  card.className = 'exercise-card';

  const h3 = document.createElement('h3');
  h3.textContent = ex.nom;
  card.appendChild(h3);

  const meta = document.createElement('div');
  meta.className = 'exercise-meta';
  meta.textContent = `${ex.series} × ${ex.reps} · repos ${formatRest(ex.repos_s)}`;
  card.appendChild(meta);

  if (ex.note) {
    const note = document.createElement('div');
    note.className = 'exercise-note';
    note.textContent = ex.note;
    card.appendChild(note);
  }

  const prev = getPreviousLoads(ex.nom, sessionId);
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

function getPreviousLoads(exerciseName, sessionId) {
  // Look at all history entries, find latest session where this exercise was logged
  const sessionData = state.loads[sessionId];
  if (!sessionData) return null;
  // Last saved loads for this session's exercise with matching name
  const session = getCurrentSession();
  if (!session) return null;
  const idx = session.exercices.findIndex(e => e.nom === exerciseName);
  if (idx < 0) return null;
  const setLoads = sessionData[idx];
  if (!setLoads) return null;
  const parts = [];
  Object.keys(setLoads).filter(k => !k.startsWith('r')).forEach(k => {
    const kg = setLoads[k];
    const reps = setLoads['r' + k];
    if (kg) parts.push(reps ? `${kg}kg×${reps}` : `${kg}kg`);
  });
  return parts.length ? parts.join(' · ') : null;
}

function formatRest(s) {
  if (!s) return '';
  const m = Math.floor(s / 60);
  const r = s % 60;
  return r === 0 ? `${m} min` : `${m}:${String(r).padStart(2, '0')}`;
}

// Finish session button
document.addEventListener('click', e => {
  if (e.target?.id === 'btn-finish-session') {
    state.lastSession = currentSessionId;
    saveState();
    alert('Séance terminée ! Pense à manger ton post-training.');
  }
});

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
  renderRecentLoads();
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
  const ctx = canvas.getContext('2d');
  const w = canvas.width;
  const h = canvas.height;
  ctx.clearRect(0, 0, w, h);

  const data = state.weights;
  if (data.length < 2) {
    ctx.fillStyle = '#8b94a0';
    ctx.font = '16px system-ui';
    ctx.textAlign = 'center';
    ctx.fillText('Il faut au moins 2 pesées pour tracer le graphique', w / 2, h / 2);
    return;
  }

  const pad = 40;
  const min = Math.min(...data.map(d => d.kg)) - 1;
  const max = Math.max(...data.map(d => d.kg)) + 1;
  const xStep = (w - pad * 2) / (data.length - 1);

  // Grid
  ctx.strokeStyle = '#2a3038';
  ctx.lineWidth = 1;
  for (let i = 0; i <= 4; i++) {
    const y = pad + (h - pad * 2) * (i / 4);
    ctx.beginPath();
    ctx.moveTo(pad, y);
    ctx.lineTo(w - pad, y);
    ctx.stroke();
    const val = (max - (max - min) * (i / 4)).toFixed(1);
    ctx.fillStyle = '#8b94a0';
    ctx.font = '11px system-ui';
    ctx.textAlign = 'right';
    ctx.fillText(val, pad - 6, y + 4);
  }

  // Line
  ctx.strokeStyle = '#ff6b35';
  ctx.lineWidth = 3;
  ctx.beginPath();
  data.forEach((d, i) => {
    const x = pad + xStep * i;
    const y = pad + (h - pad * 2) * (1 - (d.kg - min) / (max - min));
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  });
  ctx.stroke();

  // Dots
  ctx.fillStyle = '#ffa45c';
  data.forEach((d, i) => {
    const x = pad + xStep * i;
    const y = pad + (h - pad * 2) * (1 - (d.kg - min) / (max - min));
    ctx.beginPath();
    ctx.arc(x, y, 4, 0, Math.PI * 2);
    ctx.fill();
  });
}

function renderRecentLoads() {
  const container = document.getElementById('recent-loads');
  container.innerHTML = '';
  const phase = programme.phases.find(p => p.id === state.phaseId);
  const entries = [];
  phase.seances.forEach(s => {
    s.exercices.forEach((ex, idx) => {
      const load = state.loads[s.id]?.[idx];
      if (!load) return;
      const maxKg = Math.max(...Object.keys(load).filter(k => !k.startsWith('r')).map(k => parseFloat(load[k])).filter(v => !isNaN(v)));
      if (isFinite(maxKg) && maxKg > 0) {
        entries.push({ ex: ex.nom, kg: maxKg, session: s.nom });
      }
    });
  });
  if (!entries.length) {
    container.innerHTML = '<div class="muted">Aucune charge enregistrée.</div>';
    return;
  }
  entries.sort((a, b) => b.kg - a.kg).forEach(e => {
    const row = document.createElement('div');
    row.className = 'load-row';
    row.innerHTML = `<span>${e.ex}</span><span><strong>${e.kg} kg</strong></span>`;
    container.appendChild(row);
  });
}

// ===== Settings =====
function setupSettings() {
  const modal = document.getElementById('settings-modal');
  document.getElementById('btn-settings').onclick = () => {
    document.getElementById('input-week').value = state.week;
    document.getElementById('input-phase').value = state.phaseId;
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

// ===== Nutrition =====
function renderNutrition() {
  const m = nutrition.meta.macros;
  document.getElementById('macro-kcal').textContent = nutrition.meta.cible_kcal;
  document.getElementById('macro-p').textContent = m.proteines_g + ' g';
  document.getElementById('macro-g').textContent = m.glucides_g + ' g';
  document.getElementById('macro-l').textContent = m.lipides_g + ' g';

  const meals = document.getElementById('meals');
  meals.innerHTML = '';
  nutrition.repas.forEach(r => {
    const el = document.createElement('div');
    el.className = 'meal';
    el.innerHTML = `
      <div class="meal-head">
        <span class="meal-name">${r.nom}</span>
        <span class="meal-kcal">${r.kcal} kcal</span>
      </div>
      <div class="meal-time">${r.heure}</div>
      <ul>${r.items.map(i => `<li>${i}</li>`).join('')}</ul>
    `;
    meals.appendChild(el);
  });

  const grocery = document.getElementById('grocery-list');
  grocery.innerHTML = '';
  let total = 0;
  nutrition.liste_courses_semaine.forEach(g => {
    total += g.prix_eur;
    const li = document.createElement('li');
    li.innerHTML = `
      <span>${g.item}<br><span class="qty">${g.quantite}</span></span>
      <span class="price">${g.prix_eur.toFixed(2)} €</span>
    `;
    grocery.appendChild(li);
  });
  document.getElementById('grocery-total').textContent =
    `Total estimé : ${total.toFixed(2)} € · ${nutrition.cout_hebdo_estime_eur}`;

  const bullets = document.getElementById('nutrition-principes');
  bullets.innerHTML = nutrition.principes.map(p => `<li>${p}</li>`).join('');
}

// ===== Service Worker =====
function registerSW() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  }
}

// Go
init();

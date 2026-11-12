/* Fléchettes Cup : le jeu sur la cible de l'accueil, et son classement.
   La scène 3D (scene.js) sait lancer une fléchette et dire ce qu'elle a touché ;
   ici on gère le viseur, la partie de 9 fléchettes, le score et le classement. */
(function () {
  'use strict';
  const hero = document.querySelector('.hero');
  if (!hero) return;

  const DARTS = 9;
  const SWAY = 0.027;            // amplitude du tremblement de la main, en mètres sur la cible
  const esc = s => String(s == null ? '' : s);
  const el = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text !== undefined) n.textContent = text; return n; };

  /* ==================== Classement ====================
     Par défaut il est gardé dans le navigateur du visiteur. Pour un classement commun à tous,
     indiquer l'adresse d'un service dans la page :
       <meta name="fc-classement-api" content="https://…/classement">
     GET renvoie [{ name, score }], POST reçoit { name, score }. */
  const Ranking = (function () {
    const KEY = 'fc-classement-v1', NAME_KEY = 'fc-pseudo';
    const meta = document.querySelector('meta[name="fc-classement-api"]');
    const api = meta && meta.content ? meta.content : '';
    const cleanName = n => esc(n).replace(/[\u0000-\u001F<>]/g, '').trim().slice(0, 14);
    const clean = list => (Array.isArray(list) ? list : [])
      .map(e => ({ name: cleanName(e && e.name) || 'Anonyme', score: Math.max(0, Math.min(540, Math.round(Number(e && e.score) || 0))), at: Number(e && e.at) || 0 }))
      .sort((a, b) => b.score - a.score || a.at - b.at)
      .slice(0, 50);
    function local() {
      try { return clean(JSON.parse(localStorage.getItem(KEY) || '[]')); } catch (e) { return []; }
    }
    async function load() {
      if (api) {
        try {
          const r = await fetch(api, { headers: { Accept: 'application/json' } });
          if (r.ok) return { shared: true, list: clean(await r.json()) };
        } catch (e) { /* service injoignable : on montre le classement de l'appareil */ }
      }
      return { shared: false, list: local() };
    }
    async function add(name, score) {
      const entry = { name: cleanName(name) || 'Anonyme', score, at: Date.now() };
      try {
        localStorage.setItem(KEY, JSON.stringify(clean(local().concat(entry))));
        localStorage.setItem(NAME_KEY, entry.name);
      } catch (e) { /* stockage indisponible */ }
      if (api) {
        try {
          await fetch(api, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: entry.name, score: entry.score }) });
        } catch (e) { /* il reste enregistré sur l'appareil */ }
      }
      return entry;
    }
    const lastName = () => { try { return localStorage.getItem(NAME_KEY) || ''; } catch (e) { return ''; } };
    return { load, add, lastName, cleanName };
  })();

  /* ==================== Interface ==================== */
  const layer = el('div', 'game-layer');
  layer.tabIndex = 0;
  layer.setAttribute('role', 'application');
  layer.setAttribute('aria-label', 'Cible de fléchettes. Flèches du clavier pour déplacer le viseur, Espace pour lancer.');
  const reticle = el('div', 'reticle');
  reticle.setAttribute('aria-hidden', 'true');

  const hud = el('div', 'hud');
  const hudTitle = el('p', 'tag hud-title', 'À toi de jouer');
  const hudScore = el('p', 'hud-score', '0');
  const hudPips = el('p', 'hud-pips');
  hudPips.setAttribute('aria-hidden', 'true');
  for (let i = 0; i < DARTS; i++) hudPips.appendChild(el('i'));
  const hudHint = el('p', 'hud-hint', '9 fléchettes. Le viseur tremble : lance quand il passe où tu veux.');
  const hudStatus = el('p', 'visually-hidden');
  hudStatus.setAttribute('role', 'status');
  hudStatus.setAttribute('aria-live', 'polite');
  const hudRank = el('button', 'tag hud-rank', 'Classement');
  hudRank.type = 'button';
  hud.append(hudTitle, hudScore, hudPips, hudHint, hudRank, hudStatus);

  const dialog = el('dialog', 'rank-dialog');
  dialog.setAttribute('aria-labelledby', 'rank-title');
  const dTag = el('p', 'tag rd-tag');
  const dTitle = el('h2', 'rd-title'); dTitle.id = 'rank-title';
  const dLine = el('p', 'rd-line');
  const form = el('form', 'rd-form');
  form.noValidate = true;
  const label = el('label', 'tag', 'Ton pseudo pour le classement');
  label.htmlFor = 'rank-name';
  const input = el('input');
  input.id = 'rank-name'; input.name = 'pseudo'; input.maxLength = 14; input.autocomplete = 'nickname'; input.placeholder = 'Pseudo';
  const save = el('button', 'btn btn-anis', 'Enregistrer mon score');
  save.type = 'submit';
  const row = el('div', 'rd-row');
  row.append(input, save);
  form.append(label, row);
  const listTitle = el('p', 'tag rd-list-title');
  const list = el('ol', 'rd-list');
  const note = el('p', 'rd-note');
  const actions = el('div', 'rd-actions');
  const again = el('button', 'btn btn-anis btn-big', 'Rejouer');
  again.type = 'button';
  const close = el('button', 'btn btn-outline btn-big', 'Fermer');
  close.type = 'button';
  actions.append(again, close);
  dialog.append(dTag, dTitle, dLine, form, listTitle, list, note, actions);

  /* ==================== Partie ==================== */
  const game = { thrown: 0, landed: 0, score: 0, busy: false, over: false, saved: false };
  const aim = { x: 0, y: 0, on: false, t0: performance.now(), raf: 0, cur: { x: 0, y: 0 } };

  function paintHud() {
    hudScore.textContent = String(game.score);
    Array.from(hudPips.children).forEach((p, i) => p.classList.toggle('used', i < game.thrown));
    hudTitle.textContent = game.over ? 'Partie terminée' : game.thrown === 0 ? 'À toi de jouer' : 'Score';
    hudHint.hidden = game.thrown > 0;
  }
  function reset() {
    game.thrown = 0; game.landed = 0; game.score = 0; game.busy = false; game.over = false; game.saved = false;
    if (window.FCBoard) window.FCBoard.clearShots();
    paintHud();
  }

  function placeLayer() {
    const B = window.FCBoard;
    if (!B) return;
    const hr = hero.getBoundingClientRect(), r = B.rect();
    const m = r.width * 0.09;
    layer.style.left = (r.left - hr.left - m) + 'px';
    layer.style.top = (r.top - hr.top - m) + 'px';
    layer.style.width = (r.width + 2 * m) + 'px';
    layer.style.height = (r.height + 2 * m) + 'px';
    if (!aim.on) { aim.x = r.left + r.width / 2; aim.y = r.top + r.height / 2; }
  }

  // La main tremble : le viseur tourne autour du point visé, il faut lancer au bon moment
  function reticlePos(now) {
    const B = window.FCBoard;
    const a = SWAY * (B ? B.scale() : 1000);
    const t = (now - aim.t0) / 1000;
    aim.cur.x = aim.x + a * (0.62 * Math.sin(t * 2.3) + 0.38 * Math.sin(t * 5.1 + 1.3));
    aim.cur.y = aim.y + a * (0.62 * Math.cos(t * 1.9 + 0.4) + 0.38 * Math.sin(t * 4.3));
    return aim.cur;
  }
  function loop(now) {
    aim.raf = 0;
    if (!aim.on) return;
    const hr = hero.getBoundingClientRect(), p = reticlePos(now);
    reticle.style.transform = `translate(${(p.x - hr.left).toFixed(1)}px, ${(p.y - hr.top).toFixed(1)}px)`;
    aim.raf = requestAnimationFrame(loop);
  }
  function showReticle(on) {
    aim.on = on && !game.over;
    reticle.classList.toggle('on', aim.on);
    if (aim.on && !aim.raf) aim.raf = requestAnimationFrame(loop);
  }

  function shoot() {
    const B = window.FCBoard;
    if (!B || !B.ready || game.over || game.busy || dialog.open) return;
    const p = reticlePos(performance.now());
    if (!B.throwAt(p.x, p.y)) return;
    game.busy = true;
    game.thrown += 1;
    paintHud();
  }

  document.addEventListener('fc:hit', e => {
    if (!game.busy) return;
    const d = e.detail || {};
    game.score += d.pts || 0;
    game.landed += 1;
    hudStatus.textContent = (d.pts ? d.pts + ' points, ' : 'Raté, ') + esc(d.label) + '. Score ' + game.score + '.';
    paintHud();
    if (game.landed >= DARTS) {
      game.over = true;
      showReticle(false);
      paintHud();
      setTimeout(() => openDialog('result'), 1100);
      return;
    }
    if (game.landed % 3 === 0) {
      // fin de volée : on retire les trois fléchettes avant la suivante
      setTimeout(() => { if (window.FCBoard) window.FCBoard.clearShots(); game.busy = false; }, 850);
    } else {
      game.busy = false;
    }
  });

  /* ---- Viser : à la souris, au doigt, au clavier ---- */
  layer.addEventListener('pointermove', e => {
    if (e.pointerType === 'touch' && !layer.hasPointerCapture(e.pointerId)) return;
    aim.x = e.clientX;
    aim.y = e.clientY - (e.pointerType === 'touch' ? 70 : 0);      // au doigt, le viseur reste visible au-dessus
    showReticle(true);
  });
  layer.addEventListener('pointerdown', e => {
    if (e.pointerType !== 'touch') return;
    try { layer.setPointerCapture(e.pointerId); } catch (err) { /* capture indisponible */ }
    aim.x = e.clientX; aim.y = e.clientY - 70;
    showReticle(true);
  });
  layer.addEventListener('pointerup', e => {
    if (e.pointerType === 'touch') { shoot(); showReticle(false); return; }
    if (e.button === 0) shoot();
  });
  layer.addEventListener('pointercancel', () => showReticle(false));
  layer.addEventListener('pointerleave', e => { if (e.pointerType !== 'touch') showReticle(false); });
  layer.addEventListener('focus', () => { if (layer.matches(':focus-visible')) showReticle(true); });
  layer.addEventListener('blur', () => showReticle(false));
  layer.addEventListener('keydown', e => {
    const step = e.shiftKey ? 4 : 14;
    if (e.key === 'ArrowLeft') aim.x -= step;
    else if (e.key === 'ArrowRight') aim.x += step;
    else if (e.key === 'ArrowUp') aim.y -= step;
    else if (e.key === 'ArrowDown') aim.y += step;
    else if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); showReticle(true); shoot(); return; }
    else return;
    e.preventDefault();
    showReticle(true);
  });

  /* ==================== Fenêtre de résultat et de classement ==================== */
  function verdict(score) {
    if (score === 0) return 'Zéro. LeBouseuh a enfin un adversaire à sa mesure.';
    if (score < 60) return 'On a vu pire. Tout à l’heure, juste avant toi.';
    if (score < 140) return 'Correct. Le bar ne te demandera pas de partir.';
    if (score < 220) return 'Ça commence à ressembler à quelque chose.';
    if (score < 320) return 'Sérieux. Pense au tournoi amateur.';
    return 'Niveau scène. On garde ton numéro.';
  }
  function rankRow(rank, name, score, cls, tagText) {
    const li = el('li', cls || '');
    const who = el('span', 'rd-name', name);
    if (tagText) who.appendChild(el('i', 'tag', tagText));
    li.append(el('b', 'rd-rank', rank), who, el('b', 'rd-score', String(score)));
    return li;
  }
  async function paintList(mine) {
    const data = await Ranking.load();
    list.textContent = '';
    const top = data.list.slice(0, 10);
    top.forEach((e, i) => list.appendChild(rankRow(String(i + 1), e.name, e.score, mine && e.at === mine.at ? 'me' : '')));
    if (mine) {
      const pos = data.list.findIndex(e => e.at === mine.at);
      if (pos >= 10) list.appendChild(rankRow(String(pos + 1), mine.name, mine.score, 'me'));
    }
    // il a ouvert le bal : sept fléchettes, toutes dans le bois
    list.appendChild(rankRow('', 'LeBouseuh', 0, 'host', 'Organisateur, 7 ratées'));
    listTitle.textContent = data.shared ? 'Le classement' : 'Le classement sur cet appareil';
    note.textContent = data.shared ? '' : 'Pour l’instant, les scores sont gardés sur cet appareil : le classement commun à tous les joueurs arrive.';
    note.hidden = data.shared;
    if (!top.length) list.insertBefore(el('li', 'empty', 'Personne encore. La première place est à prendre.'), list.firstChild);
  }
  function openDialog(mode) {
    const result = mode === 'result';
    dTag.textContent = result ? 'Partie terminée' : 'Fléchettes Cup';
    dTitle.textContent = result ? game.score + ' points' : 'Le classement';
    dLine.textContent = result ? verdict(game.score) : 'Neuf fléchettes, 540 points au maximum. Qui dit mieux ?';
    form.hidden = !result || game.saved;
    again.textContent = result || game.thrown ? 'Rejouer' : 'Jouer';
    input.value = Ranking.lastName();
    paintList(null);
    if (!dialog.open) { if (dialog.showModal) dialog.showModal(); else dialog.setAttribute('open', ''); }
    if (result && !game.saved) input.focus();
  }
  function closeDialog() { if (dialog.open) { if (dialog.close) dialog.close(); else dialog.removeAttribute('open'); } }

  form.addEventListener('submit', async e => {
    e.preventDefault();
    if (game.saved) return;
    game.saved = true;
    form.hidden = true;
    const entry = await Ranking.add(input.value, game.score);
    await paintList(entry);
    again.focus();
  });
  again.addEventListener('click', () => { closeDialog(); reset(); layer.focus({ preventScroll: true }); });
  close.addEventListener('click', closeDialog);
  dialog.addEventListener('click', e => { if (e.target === dialog) closeDialog(); });
  hudRank.addEventListener('click', () => openDialog(game.over ? 'result' : 'list'));

  /* ==================== Mise en route ==================== */
  function enable() {
    if (hero.contains(layer)) return;
    hero.append(layer, reticle, hud);
    document.body.appendChild(dialog);
    document.documentElement.classList.add('game');
    placeLayer();
    paintHud();
    window.addEventListener('resize', placeLayer);
  }
  if (window.FCBoard && window.FCBoard.ready) enable();
  else document.addEventListener('fc:ready', enable);
})();

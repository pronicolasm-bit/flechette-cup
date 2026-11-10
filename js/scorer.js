/* Fléchettes Cup : interface du compteur de score (le calcul est dans scorer-engine.js) */
(function () {
  'use strict';
  const S = window.FCScore;
  const host = document.getElementById('scorer');
  if (!S || !host) return;

  const KEY = 'fc-compteur-v1';
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const fr = n => (Math.round(n * 10) / 10).toLocaleString('fr-FR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });

  /* ---- État de l'écran ----
     config : derniers réglages choisis ; stack : états successifs de la partie (pour annuler) */
  let config = { type: 'x01', start: 301, doubleOut: true, legsToWin: 1, mode: 'solo', count: 2, names: ['', '', '', ''], teams: ['', ''] };
  let stack = [];
  let mult = 1;
  let wakeLock = null;

  function save() {
    try { localStorage.setItem(KEY, JSON.stringify({ config, stack: stack.slice(-150) })); } catch (e) { /* stockage indisponible : on joue quand même */ }
  }
  function load() {
    try {
      const raw = JSON.parse(localStorage.getItem(KEY) || 'null');
      if (raw && raw.config) config = Object.assign(config, raw.config);
      if (raw && Array.isArray(raw.stack)) stack = raw.stack;
    } catch (e) { stack = []; }
  }
  const game = () => stack[stack.length - 1] || null;

  /* ---- Messages furtifs ---- */
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.setAttribute('role', 'status');
  toast.setAttribute('aria-live', 'polite');
  document.body.appendChild(toast);
  let toastTimer = 0;
  function say(msg) {
    toast.textContent = msg;
    toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove('show'), 1900);
  }

  async function keepAwake() {
    try { if (navigator.wakeLock && !wakeLock) wakeLock = await navigator.wakeLock.request('screen'); } catch (e) { wakeLock = null; }
  }
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && game() && !game().finished) { wakeLock = null; keepAwake(); }
  });

  /* ==================== Réglages ==================== */
  function radio(name, value, label, small, checked) {
    return `<label><input type="radio" name="${name}" value="${value}"${checked ? ' checked' : ''}><span>${label}${small ? `<small>${small}</small>` : ''}</span></label>`;
  }
  function renderSetup() {
    const c = config;
    const game3 = c.type === 'cricket' ? 'cricket' : String(c.start);
    let names = '';
    if (c.mode === 'duo') {
      names = [0, 1].map(t => `
        <div class="team">
          <p class="team-title">Duo ${t + 1}</p>
          <div class="field"><label for="n${t * 2}">Joueur ${t * 2 + 1}</label><input id="n${t * 2}" name="n${t * 2}" value="${esc(c.names[t * 2] || '')}" maxlength="18" autocomplete="off" placeholder="Prénom"></div>
          <div class="field"><label for="n${t * 2 + 1}">Joueur ${t * 2 + 2}</label><input id="n${t * 2 + 1}" name="n${t * 2 + 1}" value="${esc(c.names[t * 2 + 1] || '')}" maxlength="18" autocomplete="off" placeholder="Prénom"></div>
        </div>`).join('');
    } else {
      for (let i = 0; i < c.count; i++) {
        names += `<div class="field"><label for="n${i}">Joueur ${i + 1}</label><input id="n${i}" name="n${i}" value="${esc(c.names[i] || '')}" maxlength="18" autocomplete="off" placeholder="Prénom"></div>`;
      }
    }
    host.innerHTML = `
      <form class="setup" novalidate>
        <fieldset>
          <legend>Le jeu</legend>
          <div class="choice">
            ${radio('game', '301', '301', 'comme à la Cup', game3 === '301')}
            ${radio('game', '501', '501', 'le format des pros', game3 === '501')}
            ${radio('game', 'cricket', 'Cricket', 'fermer 15 à 20 et le bull', game3 === 'cricket')}
          </div>
        </fieldset>
        ${c.type === 'x01' ? `
        <fieldset>
          <legend>Pour finir</legend>
          <div class="choice">
            ${radio('out', 'double', 'Double out', 'on termine sur un double', c.doubleOut)}
            ${radio('out', 'simple', 'Simple out', 'on termine comme on veut', !c.doubleOut)}
          </div>
        </fieldset>` : ''}
        <fieldset>
          <legend>Qui joue</legend>
          <div class="choice">
            ${radio('mode', 'solo', 'Chacun pour soi', '', c.mode === 'solo')}
            ${radio('mode', 'duo', 'En duo', 'deux équipes de deux', c.mode === 'duo')}
          </div>
          ${c.mode === 'solo' ? `
          <div class="choice" style="margin-top:8px">
            ${[1, 2, 3, 4].map(n => radio('count', n, n === 1 ? '1 joueur' : `${n} joueurs`, n === 1 ? 'entraînement' : '', c.count === n)).join('')}
          </div>` : ''}
        </fieldset>
        <fieldset>
          <legend>Les prénoms</legend>
          <div class="names">${names}</div>
        </fieldset>
        <fieldset>
          <legend>Manches gagnantes</legend>
          <div class="choice">
            ${[1, 2, 3].map(n => radio('legs', n, n === 1 ? 'Une manche' : `${n} manches`, '', c.legsToWin === n)).join('')}
          </div>
        </fieldset>
        <button class="btn btn-anis btn-big" type="submit">Lancer la partie</button>
      </form>`;
  }

  function readNames(form) {
    for (let i = 0; i < 4; i++) {
      const el = form.elements['n' + i];
      if (el) config.names[i] = el.value.trim();
    }
  }
  function sidesFromConfig() {
    const n = i => config.names[i] || `Joueur ${i + 1}`;
    if (config.mode === 'duo') {
      return [0, 1].map(t => ({ name: `${n(t * 2)} et ${n(t * 2 + 1)}`, players: [n(t * 2), n(t * 2 + 1)] }));
    }
    return Array.from({ length: config.count }, (_, i) => ({ name: n(i), players: [n(i)] }));
  }
  function startGame() {
    stack = [S.createGame({ type: config.type, start: config.start, doubleOut: config.doubleOut, legsToWin: config.legsToWin, sides: sidesFromConfig() })];
    mult = 1;
    save();
    keepAwake();
    render();
    // le tableau et le clavier doivent tenir à l'écran sans faire défiler
    const top = document.getElementById('compteur');
    if (top && top.scrollIntoView) top.scrollIntoView({ block: 'start' });
  }

  /* ==================== Partie ==================== */
  const MARK = ['', '/', 'X', '●'];
  function legsDots(side, g) {
    if (g.legsToWin < 2) return '';
    let s = `<span class="side-legs" aria-label="${side.legs} manche${side.legs > 1 ? 's' : ''} sur ${g.legsToWin}">`;
    for (let i = 0; i < g.legsToWin; i++) s += `<i class="${i < side.legs ? 'won' : ''}"></i>`;
    return s + '</span>';
  }
  function lastVisit(g, sideIdx) {
    for (let i = g.log.length - 1; i >= 0; i--) if (g.log[i].side === sideIdx) return g.log[i];
    return null;
  }

  function renderX01Board(g) {
    return `<div class="board-x01">${g.sides.map((side, i) => {
      const lv = lastVisit(g, i);
      const duo = side.players.length > 1;
      return `
        <div class="side${i === g.turn ? ' active' : ''}">
          ${legsDots(side, g)}
          <p class="side-name">${esc(side.name)}</p>
          <p class="side-player">${duo && i === g.turn ? 'Au tour de ' + esc(S.currentPlayer(g)) : ''}</p>
          <span class="display side-score">${g.scores[i]}</span>
          <p class="side-meta">
            <span>Moy. ${fr(S.average(side))}</span>
            <span>${lv ? (lv.bust ? 'Dernière : bust' : 'Dernière : ' + lv.total) : 'Pas encore lancé'}</span>
          </p>
        </div>`;
    }).join('')}</div>`;
  }

  function renderCricketBoard(g) {
    const head = g.sides.map((s, i) => `<th scope="col" class="${i === g.turn ? 'active' : ''}">${esc(s.name)}</th>`).join('');
    const rows = S.CRICKET_TARGETS.map(t => {
      const dead = g.marks.every(m => m[t] >= 3);
      return `<tr class="${dead ? 'dead' : ''}"><th scope="row" class="num">${t === 25 ? 'Bull' : t}</th>${g.marks.map(m =>
        `<td class="mark${m[t] >= 3 ? ' closed' : ''}" aria-label="${m[t]} sur 3">${MARK[m[t]]}</td>`).join('')}</tr>`;
    }).join('');
    const foot = g.cpoints.map((p, i) => `<td class="${i === g.turn ? 'active' : ''}">${p}</td>`).join('');
    return `<table class="cricket-table">
      <thead><tr><th class="num"><span class="visually-hidden">Numéro</span></th>${head}</tr></thead>
      <tbody>${rows}</tbody>
      <tfoot><tr><th scope="row" class="num">Pts</th>${foot}</tr></tfoot>
    </table>`;
  }

  function hint(g) {
    if (g.type !== 'x01') {
      const mine = g.marks[g.turn];
      const open = S.CRICKET_TARGETS.filter(t => mine[t] < 3).map(t => t === 25 ? 'Bull' : t);
      return open.length ? 'À fermer : ' + open.join(', ') : 'Tout est fermé : marque des points pour passer devant';
    }
    const rem = g.scores[g.turn], left = 3 - g.visit.length;
    const path = S.checkout(rem, left, g.doubleOut);
    if (path) return 'Finish possible : ' + path.map(S.dartLabel).join(', ');
    if (g.doubleOut && rem <= 170 && left < 3) return 'Pas de finish sur cette volée';
    return '';
  }

  function renderGame() {
    const g = game();
    const x01 = g.type === 'x01';
    const title = x01 ? `${g.start} ${g.doubleOut ? 'double out' : 'simple out'}` : 'Cricket';
    const slots = [0, 1, 2].map(i => {
      const d = g.visit[i];
      return `<span class="slot${d ? ' filled' : ''}">${d ? S.dartLabel(d) : ''}</span>`;
    }).join('');
    const sum = x01 ? g.visit.reduce((a, d) => a + S.dartScore(d), 0) : g.visitGain;
    const nums = x01 ? Array.from({ length: 20 }, (_, i) => i + 1) : [20, 19, 18, 17, 16, 15];
    const keys = nums.map(n => `<button type="button" class="key" data-n="${n}">${n}</button>`).join('') +
      `<button type="button" class="key${x01 ? ' wide' : ''}" data-n="25"${mult === 3 ? ' disabled' : ''}>${mult === 2 ? 'Bull 50' : '25'}</button>` +
      `<button type="button" class="key miss${x01 ? ' wide' : ''}" data-n="0">Raté</button>`;
    const who = S.currentPlayer(g);
    host.innerHTML = `
      <div class="game">
        <div class="game-bar">
          <span><strong>${title}</strong>${g.legsToWin > 1 ? `, manche ${g.legNo}` : ''}</span>
          <button type="button" class="linkish" data-act="quit">Changer de partie</button>
        </div>
        ${x01 ? renderX01Board(g) : renderCricketBoard(g)}
        <div class="turn">
          <p class="turn-who">À ${esc(who)} de lancer</p>
          <p class="turn-hint">${esc(hint(g))}</p>
        </div>
        <div class="visit" aria-label="Volée en cours">${slots}<span class="sum">${x01 ? sum : '+' + sum}</span></div>
        <div class="mult" role="group" aria-label="Zone touchée">
          <button type="button" class="key m" data-m="1" aria-pressed="${mult === 1}">Simple</button>
          <button type="button" class="key m" data-m="2" aria-pressed="${mult === 2}">Double</button>
          <button type="button" class="key m" data-m="3" aria-pressed="${mult === 3}">Triple</button>
        </div>
        <div class="keys${x01 ? '' : ' cricket'}">${keys}</div>
        <div class="pad-actions">
          <button type="button" class="key" data-act="undo"${stack.length < 2 ? ' disabled' : ''}>Annuler la fléchette</button>
          <button type="button" class="key" data-act="skip">Finir la volée</button>
        </div>
      </div>`;
  }

  function renderFinal() {
    const g = game();
    const w = g.sides[g.winner];
    const x01 = g.type === 'x01';
    const rows = g.sides.map(s => `<tr>
      <td>${esc(s.name)}</td>
      ${g.legsToWin > 1 ? `<td>${s.legs}</td>` : ''}
      <td>${fr(S.average(s))}</td>
      <td>${s.best}</td>
      <td>${s.darts}</td></tr>`).join('');
    host.innerHTML = `
      <div class="final">
        <h2 class="display final-title">${esc(w.name)}</h2>
        <p class="final-sub">${w.players.length > 1 ? 'remportent' : 'remporte'} la partie${g.sides.length === 1 ? ' en ' + w.darts + ' fléchettes' : ''}.</p>
        <table class="stats-table">
          <thead><tr><th scope="col">Joueur</th>${g.legsToWin > 1 ? '<th scope="col">Manches</th>' : ''}
            <th scope="col">${x01 ? 'Moyenne par volée' : 'Touches par volée'}</th>
            <th scope="col">Meilleure volée</th><th scope="col">Fléchettes</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
        <div class="page-actions">
          <button type="button" class="btn btn-anis btn-big" data-act="rematch">Revanche</button>
          <button type="button" class="btn btn-outline btn-big" data-act="quit">Changer les réglages</button>
          <button type="button" class="btn btn-outline btn-big" data-act="undo">Annuler la dernière fléchette</button>
        </div>
      </div>`;
  }

  function render() {
    const g = game();
    if (!g) renderSetup();
    else if (g.finished) renderFinal();
    else renderGame();
  }

  /* ==================== Actions ==================== */
  function announce(prev, g) {
    const e = g.last;
    if (!e) return;
    const name = g.sides[e.side].name;
    if (e.kind === 'bust') say(`Bust ! ${name} revient à ${g.scores[e.side]}`);
    else if (e.kind === 'leg') say(`Manche pour ${name}`);
    else if (e.kind === 'match') say(`Victoire de ${name} !`);
    else if (e.kind === 'visit' && g.type === 'x01' && e.total === 180) say('Cent quatre-vingts !');
    else if (e.kind === 'visit' && g.type === 'x01' && e.total >= 100) say(`${e.total} ! Belle volée`);
  }
  function throwDart(n) {
    const g = game();
    if (!g || g.finished) return;
    const d = { m: n === 0 ? 1 : mult, n };
    if (!S.isValidDart(d)) return;
    const next = S.throwDart(g, d);
    stack.push(next);
    mult = 1;
    announce(g, next);
    save();
    render();
  }
  function finishVisit() {
    let g = game();
    if (!g || g.finished) return;
    const side = g.turn, leg = g.legNo;
    // les fléchettes non lancées comptent comme ratées ; une seule entrée dans l'historique d'annulation
    while (!g.finished && g.turn === side && g.legNo === leg) g = S.throwDart(g, { m: 1, n: 0 });
    stack.push(g);
    mult = 1;
    save();
    render();
  }

  host.addEventListener('click', e => {
    const b = e.target.closest('button');
    if (!b || b.disabled) return;
    if (b.dataset.n !== undefined) return throwDart(Number(b.dataset.n));
    if (b.dataset.m) { mult = Number(b.dataset.m); return render(); }
    const act = b.dataset.act;
    if (act === 'undo') { if (stack.length > 1) { stack.pop(); mult = 1; save(); render(); } }
    else if (act === 'skip') finishVisit();
    else if (act === 'rematch') startGame();
    else if (act === 'quit') {
      const g = game();
      if (g && !g.finished && stack.length > 1 && !window.confirm('Arrêter la partie en cours ?')) return;
      stack = [];
      save();
      render();
    }
  });
  host.addEventListener('change', e => {
    const form = e.target.closest('form.setup');
    if (!form) return;
    readNames(form);
    const f = form.elements;
    if (e.target.name === 'game') {
      if (f.game.value === 'cricket') config.type = 'cricket';
      else { config.type = 'x01'; config.start = Number(f.game.value); }
    } else if (e.target.name === 'out') config.doubleOut = f.out.value === 'double';
    else if (e.target.name === 'mode') config.mode = f.mode.value;
    else if (e.target.name === 'count') config.count = Number(f.count.value);
    else if (e.target.name === 'legs') config.legsToWin = Number(f.legs.value);
    else return;                       // un prénom : pas besoin de redessiner
    save();
    renderSetup();
  });
  host.addEventListener('submit', e => {
    e.preventDefault();
    readNames(e.target);
    startGame();
  });

  load();
  render();
  if (game() && !game().finished) keepAwake();
})();

/* Fléchettes Cup 2 : compte à rebours, menu, alertes (la cible et l'intro sont dans scene.js) */

/* ---------- Compte à rebours ---------- */
(function countdown() {
  const target = new Date('2027-06-12T13:30:00+02:00').getTime();
  const cells = {
    j: document.querySelector('[data-count="j"]'),
    h: document.querySelector('[data-count="h"]'),
    m: document.querySelector('[data-count="m"]'),
    s: document.querySelector('[data-count="s"]')
  };
  if (!cells.j) return;

  function tick() {
    let d = Math.max(0, target - Date.now());
    const j = Math.floor(d / 864e5); d -= j * 864e5;
    const h = Math.floor(d / 36e5); d -= h * 36e5;
    const m = Math.floor(d / 6e4); d -= m * 6e4;
    const sec = Math.floor(d / 1e3);
    cells.j.textContent = String(j).padStart(3, '0');
    cells.h.textContent = String(h).padStart(2, '0');
    cells.m.textContent = String(m).padStart(2, '0');
    cells.s.textContent = String(sec).padStart(2, '0');
  }
  tick();
  setInterval(tick, 1000);
})();

/* ---------- Menu mobile ---------- */
(function menu() {
  const burger = document.querySelector('.burger');
  const anchors = document.getElementById('menu-ancres');
  if (!burger || !anchors) return;
  burger.addEventListener('click', () => {
    const open = anchors.classList.toggle('open');
    burger.setAttribute('aria-expanded', String(open));
  });
  anchors.addEventListener('click', e => {
    if (e.target.matches('a')) {
      anchors.classList.remove('open');
      burger.setAttribute('aria-expanded', 'false');
    }
  });
})();

/* ---------- Alertes (front seul en phase 1) ---------- */
(function alertes() {
  const form = document.querySelector('.alert-form');
  if (!form) return;
  form.addEventListener('submit', e => {
    e.preventDefault();
    const input = form.querySelector('input[type="email"]');
    if (!input.value || !input.checkValidity()) {
      input.focus();
      return;
    }
    form.querySelector('.form-row').hidden = true;
    form.querySelector('.form-hint').hidden = true;
    form.querySelector('.form-done').hidden = false;
  });
})();

/* ---------- Retour à la cible ---------- */
(function retourCible() {
  const hero = document.querySelector('.hero');
  if (!hero || !('IntersectionObserver' in window)) return;
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'back-board';
  b.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="10" fill="#160444"/><circle cx="12" cy="12" r="6.2" fill="#D9FBB3"/><circle cx="12" cy="12" r="2.6" fill="#160444"/></svg>La cible';
  document.body.appendChild(b);
  new IntersectionObserver(es => b.classList.toggle('show', !es[0].isIntersecting), { threshold: 0.12 }).observe(hero);
  b.addEventListener('click', () => {
    if (window.FCBoard && window.FCBoard.returnHome) window.FCBoard.returnHome();
    else window.scrollTo({ top: 0 });
  });
})();

/* ---------- Dans la page : chiffres qui montent, cartes d'équipes qui s'inclinent ---------- */
(function motifs() {
  const root = document.documentElement;
  root.classList.add('js');
  const calm = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const watch = 'IntersectionObserver' in window && !calm;

  // Les chiffres de l'édition 1 montent jusqu'à leur valeur, dans leur écriture d'origine
  const nums = Array.from(document.querySelectorAll('.stat-num'));
  if (watch && nums.length) {
    const run = el => {
      const text = el.textContent;
      const m = text.match(/^([\d\s\u00A0\u202F]*\d(?:,\d+)?)(.*)$/);
      if (!m) return;
      const raw = m[1].replace(/[\s\u00A0\u202F]/g, '');
      const decimals = raw.indexOf(',') >= 0 ? raw.length - raw.indexOf(',') - 1 : 0;
      const end = parseFloat(raw.replace(',', '.'));
      if (!isFinite(end)) return;
      const t0 = performance.now(), dur = 1100;
      const fmt = v => v.toLocaleString('fr-FR', { minimumFractionDigits: decimals, maximumFractionDigits: decimals }).replace(/\u202F/g, '\u00A0');
      (function step(now) {
        const k = Math.min(1, (now - t0) / dur);
        if (k >= 1) { el.textContent = text; return; }
        el.textContent = fmt(end * (1 - Math.pow(1 - k, 3))) + m[2];
        requestAnimationFrame(step);
      })(t0);
    };
    const io2 = new IntersectionObserver(es => es.forEach(e => {
      if (!e.isIntersecting) return;
      run(e.target);
      io2.unobserve(e.target);
    }), { threshold: 0.6 });
    nums.forEach(n => io2.observe(n));
  }

  // Cartes des équipes
  if (!calm && window.matchMedia && window.matchMedia('(hover: hover)').matches) {
    document.querySelectorAll('.team').forEach(card => {
      const v = card.querySelector('.team-visual');
      if (!v) return;
      card.addEventListener('pointermove', e => {
        const r = v.getBoundingClientRect();
        const x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
        v.style.setProperty('--ry', ((x - 0.5) * 16).toFixed(1) + 'deg');
        v.style.setProperty('--rx', ((0.5 - y) * 14).toFixed(1) + 'deg');
      });
      card.addEventListener('pointerleave', () => { v.style.setProperty('--rx', '0deg'); v.style.setProperty('--ry', '0deg'); });
    });
  }
})();

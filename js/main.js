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

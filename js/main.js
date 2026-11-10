/* Fléchettes Cup 2 : cible SVG, compte à rebours, menu, alertes */

/* ---------- Cible de fléchettes ---------- */
(function dartboard() {
  const host = document.getElementById('dartboard');
  if (!host) return;

  const NUMBERS = [20, 1, 18, 4, 13, 6, 10, 15, 2, 17, 3, 19, 7, 16, 8, 11, 14, 9, 12, 5];
  const C = 500;                       // centre
  const R = { board: 500, numbers: 462, doubleOut: 420, doubleIn: 396, tripleOut: 258, tripleIn: 234, bullOuter: 40, bullInner: 17 };
  const CREAM = '#EDE4CE', BLACK = '#181512', RED = '#C8372D', GREEN = '#1D7A46', RIM = '#121212', WIRE = '#C9C9C9';

  function polar(r, aDeg) {
    const a = (aDeg - 90) * Math.PI / 180;
    return [C + r * Math.cos(a), C + r * Math.sin(a)];
  }
  function wedge(r0, r1, a0, a1) {
    const [x0, y0] = polar(r1, a0), [x1, y1] = polar(r1, a1);
    const [x2, y2] = polar(r0, a1), [x3, y3] = polar(r0, a0);
    const large = (a1 - a0) > 180 ? 1 : 0;
    return `M${x0} ${y0}A${r1} ${r1} 0 ${large} 1 ${x1} ${y1}L${x2} ${y2}A${r0} ${r0} 0 ${large} 0 ${x3} ${y3}Z`;
  }

  let s = `<svg viewBox="0 0 ${C * 2} ${C * 2}" role="img" aria-label="Cible de fléchettes">`;
  s += `<circle cx="${C}" cy="${C}" r="${R.board}" fill="${RIM}"/>`;

  for (let i = 0; i < 20; i++) {
    const a0 = i * 18 - 9, a1 = a0 + 18;
    const dark = i % 2 === 0;                 // secteur du 20 : noir
    const main = dark ? BLACK : CREAM;
    const ring = dark ? RED : GREEN;          // double/triple : rouge sur noir, vert sur crème
    s += `<path d="${wedge(R.bullOuter, R.tripleIn, a0, a1)}" fill="${main}"/>`;
    s += `<path d="${wedge(R.tripleIn, R.tripleOut, a0, a1)}" fill="${ring}"/>`;
    s += `<path d="${wedge(R.tripleOut, R.doubleIn, a0, a1)}" fill="${main}"/>`;
    s += `<path d="${wedge(R.doubleIn, R.doubleOut, a0, a1)}" fill="${ring}"/>`;
  }

  // fils
  for (let i = 0; i < 20; i++) {
    const [x, y] = polar(R.doubleOut, i * 18 - 9);
    s += `<line x1="${C}" y1="${C}" x2="${x}" y2="${y}" stroke="${WIRE}" stroke-width="1.4" opacity="0.8"/>`;
  }
  [R.doubleOut, R.doubleIn, R.tripleOut, R.tripleIn].forEach(r => {
    s += `<circle cx="${C}" cy="${C}" r="${r}" fill="none" stroke="${WIRE}" stroke-width="1.4" opacity="0.8"/>`;
  });

  // bull
  s += `<circle cx="${C}" cy="${C}" r="${R.bullOuter}" fill="${GREEN}" stroke="${WIRE}" stroke-width="1.4"/>`;
  s += `<circle cx="${C}" cy="${C}" r="${R.bullInner}" fill="${RED}" stroke="${WIRE}" stroke-width="1.4"/>`;

  // numéros
  NUMBERS.forEach((n, i) => {
    const [x, y] = polar(R.numbers, i * 18);
    s += `<text x="${x}" y="${y}" fill="#E8E8E8" font-size="44" font-weight="700" text-anchor="middle" dominant-baseline="central" font-family="Archivo, sans-serif">${n}</text>`;
  });

  s += '</svg>';
  host.innerHTML = s;
})();

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

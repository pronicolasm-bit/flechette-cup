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

/* ---------- Intro en vue subjective : on est la fléchette ----------
   1. visée   : la cible au loin, la pointe en amorce, léger tremblement
   2. lancer  : la cible fonce vers nous, lignes de vitesse
   3. impact  : flash, secousse, la fléchette est plantée
   4. recul   : la caméra se cale sur la cible, l'habillage se pose      */
(function intro() {
  const root = document.documentElement;
  if (!root.classList.contains('intro')) return;

  const $ = s => document.querySelector(s);
  const board = $('.board-wrap'), tip = $('.pov-tip'), lines = $('.speedlines');
  const pattern = $('.hero-pattern'), flash = $('.impact-flash'), stage = $('.hero-stage');
  const skip = $('.skip-intro');

  const running = new Set();
  let over = false;

  function play(el, frames, opts) {
    const a = el.animate(frames, Object.assign({ fill: 'forwards' }, opts));
    running.add(a);
    return a.finished.catch(() => {});
  }
  const wait = ms => new Promise(r => setTimeout(r, ms));

  function end() {
    if (over) return;
    over = true;
    running.forEach(a => a.cancel());
    root.classList.remove('intro', 'intro-impact', 'intro-pose');
    clearTimeout(window.__introSafety);
    ['wheel', 'touchmove', 'keydown'].forEach(ev => window.removeEventListener(ev, onUserSkip));
  }
  function onUserSkip(e) {
    if (e.type === 'keydown' && e.key !== 'Escape') return;
    end();
  }
  skip.addEventListener('click', end);
  ['wheel', 'touchmove', 'keydown'].forEach(ev => window.addEventListener(ev, onUserSkip, { passive: true }));

  const S0 = 0.09;          // la cible vue du pas de tir
  const S1 = 3.2;           // à l'impact, le bull remplit l'écran
  const AIM = 1050, FLY = 1150, BACK = 950;

  // Trajectoire : zoom exponentiel accéléré + cloche + la fléchette qui se redresse
  const fly = [];
  const N = 30;
  for (let k = 0; k <= N; k++) {
    const t = k / N;
    const p = Math.pow(t, 1.8);
    const s = S0 * Math.pow(S1 / S0, p);
    const arc = -7 * Math.sin(Math.PI * t) * (1 - t * 0.5);
    const drift = 1.6 * Math.sin(Math.PI * t * 1.5) * (1 - t);
    const rot = -14 * Math.pow(1 - t, 2);
    fly.push({ offset: t, transform: `translate(${drift.toFixed(2)}vw, ${arc.toFixed(2)}vh) rotate(${rot.toFixed(2)}deg) scale(${s.toFixed(4)})` });
  }

  async function run() {
    /* 1. visée */
    play(tip, [
      { transform: 'translate(0, 6vh)' },
      { transform: 'translate(-0.7vw, 0.4vh)', offset: 0.35 },
      { transform: 'translate(0.5vw, -0.4vh)', offset: 0.7 },
      { transform: 'translate(0, 0)' }
    ], { duration: AIM, easing: 'ease-out' });
    play(pattern, [
      { transform: 'scale(0.5) rotate(-10deg)' },
      { transform: 'scale(1.8) rotate(26deg)' }
    ], { duration: AIM + FLY, easing: 'cubic-bezier(0.7, 0, 0.9, 0.5)' });
    await play(board, [
      { transform: `translate(0, 0) rotate(-14deg) scale(${S0})` },
      { transform: `translate(1.1vw, -0.9vh) rotate(-14deg) scale(${S0})`, offset: 0.3 },
      { transform: `translate(-0.9vw, 0.6vh) rotate(-14deg) scale(${S0})`, offset: 0.62 },
      { transform: `translate(0.3vw, -0.3vh) rotate(-14deg) scale(${S0})`, offset: 0.85 },
      { transform: `translate(0, 0) rotate(-14deg) scale(${S0})` }
    ], { duration: AIM, easing: 'ease-in-out' });
    if (over) return;

    /* 2. lancer */
    play(lines, [
      { opacity: 0, transform: 'scale(0.7)' },
      { opacity: 1, transform: 'scale(2.8)' }
    ], { duration: FLY, easing: 'cubic-bezier(0.6, 0, 1, 0.6)' });
    play(tip, [
      { transform: 'translate(0, 0)' },
      { transform: 'translate(0.35vw, -1.2vh)', offset: 0.3 },
      { transform: 'translate(-0.3vw, -3vh)', offset: 0.6 },
      { transform: 'translate(0.2vw, -5vh)', offset: 0.85 },
      { transform: 'translate(0, -7vh)' }
    ], { duration: FLY, easing: 'ease-in' });
    await play(board, fly, { duration: FLY, easing: 'linear' });
    if (over) return;

    /* 3. impact */
    root.classList.add('intro-impact');
    play(tip, [
      { transform: 'translate(0, -7vh) scale(1)', opacity: 1 },
      { transform: 'translate(0, -30vh) scale(0.1)', opacity: 0 }
    ], { duration: 110, easing: 'ease-in' });
    play(flash, [{ opacity: 0 }, { opacity: 0.92, offset: 0.2 }, { opacity: 0 }], { duration: 360 });
    play(lines, [{ opacity: 1, transform: 'scale(2.8)' }, { opacity: 0, transform: 'scale(3.2)' }], { duration: 240 });
    play(stage, [
      { transform: 'translate(0, 0)' },
      { transform: 'translate(14px, -10px)', offset: 0.12 },
      { transform: 'translate(-11px, 8px)', offset: 0.3 },
      { transform: 'translate(7px, -5px)', offset: 0.5 },
      { transform: 'translate(-4px, 3px)', offset: 0.72 },
      { transform: 'translate(0, 0)' }
    ], { duration: 440, easing: 'ease-out' });
    await wait(170);
    if (over) return;

    /* 4. recul de caméra, calé sur la cible */
    play(pattern, [
      { transform: 'scale(1.8) rotate(26deg)' },
      { transform: 'scale(1) rotate(0deg)' }
    ], { duration: BACK, easing: 'cubic-bezier(0.16, 1, 0.3, 1)' });
    await play(board, [
      { transform: `scale(${S1})` },
      { transform: 'scale(1)' }
    ], { duration: BACK, easing: 'cubic-bezier(0.16, 1, 0.3, 1)' });
    if (over) return;

    root.classList.add('intro-pose');
    await wait(1700);
    end();
  }

  // On attend la police pour que les chiffres de la cible ne sautent pas en plein vol
  const fontsReady = document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve();
  Promise.race([fontsReady, wait(700)]).then(run);
})();

/* Fléchettes Cup 2 : la cible en 3D, dans le décor et la lumière du teaser de l'édition 1.
   Intro : un montage en champ-contrechamp. Les plans du teaser où LeBouseuh vise et lance
   alternent avec notre mur, où ses fléchettes arrivent toutes à côté de la cible, certaines
   en clouant une section du site (« Raté ! »). La caméra vient ensuite se caler sur la cible,
   restée vide : le visiteur peut jouer (viseur, partie et classement sont dans game.js). */
(function () {
  'use strict';

  const root = document.documentElement;
  const hero = document.querySelector('.hero');
  const wrap = document.querySelector('.board-wrap');
  const host = document.getElementById('dartboard');
  if (!hero || !wrap || !host) return;

  const TAU = Math.PI * 2, DEG = Math.PI / 180;

  /* ---------- Son ----------
     Tout est synthétisé (aucun fichier à charger) : le souffle de la fléchette, le choc
     dans le sisal, le choc plus sec dans le bois. Un navigateur ne laisse jouer du son
     qu'après un geste du visiteur : c'est le lancer qui l'active. */
  const Sound = (function () {
    const KEY = 'fc-son';
    let ctx = null, muted = false;
    try { muted = localStorage.getItem(KEY) === '0'; } catch (e) { /* stockage indisponible */ }
    function unlock() {
      if (muted) return null;
      try {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return null;
        if (!ctx) ctx = new AC();
        if (ctx.state === 'suspended') ctx.resume();
      } catch (e) { ctx = null; }
      return ctx;
    }
    function noise(c, dur) {
      const n = Math.max(1, Math.floor(c.sampleRate * dur));
      const buf = c.createBuffer(1, n, c.sampleRate), d = buf.getChannelData(0);
      for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
      const src = c.createBufferSource();
      src.buffer = buf;
      return src;
    }
    function thunk(wood, level) {
      const c = ctx;
      if (!c || muted) return;
      const t = c.currentTime, v = level === undefined ? 1 : level;
      const out = c.createGain();
      out.gain.value = 0.9 * v;
      out.connect(c.destination);
      // le corps du choc : une note grave qui s'effondre
      const o = c.createOscillator(), og = c.createGain();
      o.type = 'sine';
      o.frequency.setValueAtTime(wood ? 240 : 150, t);
      o.frequency.exponentialRampToValueAtTime(wood ? 110 : 52, t + (wood ? 0.07 : 0.1));
      og.gain.setValueAtTime(0.9, t);
      og.gain.exponentialRampToValueAtTime(0.001, t + (wood ? 0.12 : 0.2));
      o.connect(og); og.connect(out);
      o.start(t); o.stop(t + 0.25);
      // l'attaque : un souffle très bref, étouffé dans le sisal, plus claquant dans le bois
      const n = noise(c, 0.08), f = c.createBiquadFilter(), ng = c.createGain();
      f.type = 'lowpass';
      f.frequency.value = wood ? 3200 : 1300;
      ng.gain.setValueAtTime(wood ? 0.7 : 0.5, t);
      ng.gain.exponentialRampToValueAtTime(0.001, t + (wood ? 0.05 : 0.07));
      n.connect(f); f.connect(ng); ng.connect(out);
      n.start(t);
    }
    function whoosh(dur, level) {
      const c = ctx;
      if (!c || muted) return;
      const t = c.currentTime, v = level === undefined ? 1 : level;
      const n = noise(c, dur + 0.05), f = c.createBiquadFilter(), g = c.createGain();
      f.type = 'bandpass';
      f.Q.value = 0.9;
      f.frequency.setValueAtTime(320, t);
      f.frequency.exponentialRampToValueAtTime(2100, t + dur);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.22 * v, t + dur * 0.8);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      n.connect(f); f.connect(g); g.connect(c.destination);
      n.start(t);
    }
    return {
      unlock, thunk, whoosh,
      isMuted: () => muted,
      setMuted(m) {
        muted = !!m;
        try { localStorage.setItem(KEY, muted ? '0' : '1'); } catch (e) { /* tant pis */ }
        if (!muted) unlock();
      }
    };
  })();
  const NUMBERS = [20, 1, 18, 4, 13, 6, 10, 15, 2, 17, 3, 19, 7, 16, 8, 11, 14, 9, 12, 5];
  // Cotes réelles d'une cible, en mètres
  const BOARD_R = 0.2255;
  const DIM = { numbers: 0.1985, dOut: 0.170, dIn: 0.162, tOut: 0.107, tIn: 0.099, bullO: 0.0159, bullI: 0.00635 };

  function mulberry32(a) {
    return function () {
      a |= 0; a = a + 0x6D2B79F5 | 0;
      let t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }

  function noiseTile(rnd, n) {
    const tile = document.createElement('canvas');
    tile.width = tile.height = n;
    const tg = tile.getContext('2d');
    const id = tg.createImageData(n, n);
    for (let i = 0; i < n * n; i++) {
      const v = rnd() * 255 | 0;
      id.data[i * 4] = id.data[i * 4 + 1] = id.data[i * 4 + 2] = v;
      id.data[i * 4 + 3] = 255;
    }
    tg.putImageData(id, 0, 0);
    return tile;
  }

  /* ---------- Texture de la cible : sisal, impacts, chiffres en fil d'acier ----------
     flat = true : version autonome (fils et éclairage peints) pour le repli sans WebGL */
  function drawBoardTexture(size, flat) {
    const c = document.createElement('canvas');
    c.width = c.height = size;
    const g = c.getContext('2d');
    const R = size / 2, M = R / BOARD_R, k = size / 2048;
    const px = m => m * M;
    const rnd = mulberry32(20270612);

    g.translate(R, R);

    const band = (r0, r1, a0, a1, color) => {
      g.beginPath();
      g.arc(0, 0, r1, a0, a1);
      g.arc(0, 0, r0, a1, a0, true);
      g.closePath();
      g.fillStyle = color;
      g.fill();
    };
    const disc = (r, color) => { g.beginPath(); g.arc(0, 0, r, 0, TAU); g.fillStyle = color; g.fill(); };

    // Support et couronne des chiffres
    disc(R, '#141311');

    // Secteurs
    for (let i = 0; i < 20; i++) {
      const a0 = (i * 18 - 9 - 90) * DEG, a1 = a0 + 18 * DEG;
      const dark = i % 2 === 0;
      const main = dark ? '#191715' : '#D6C49A';
      const acc = dark ? '#A51D15' : '#0A5A2F';
      band(px(DIM.bullO), px(DIM.tIn), a0, a1, main);
      band(px(DIM.tIn), px(DIM.tOut), a0, a1, acc);
      band(px(DIM.tOut), px(DIM.dIn), a0, a1, main);
      band(px(DIM.dIn), px(DIM.dOut), a0, a1, acc);
    }
    disc(px(DIM.bullO), '#0A5A2F');
    disc(px(DIM.bullI), '#A51D15');

    // Grain du sisal : bruit fin + marbrure large
    const tile = noiseTile(rnd, 256);
    g.save();
    g.beginPath(); g.arc(0, 0, R, 0, TAU); g.clip();
    g.globalCompositeOperation = 'overlay';
    g.globalAlpha = 0.5;
    g.fillStyle = g.createPattern(tile, 'repeat');
    g.fillRect(-R, -R, size, size);
    g.globalCompositeOperation = 'soft-light';
    g.globalAlpha = 0.38;
    g.scale(7, 7);
    g.fillRect(-R / 7, -R / 7, size / 7, size / 7);
    g.restore();

    // Extrémités des fibres : petites touches claires et sombres
    g.save();
    const specks = Math.round(30000 * k * k);
    for (let i = 0; i < specks; i++) {
      const rr = Math.sqrt(rnd()) * px(DIM.dOut), a = rnd() * TAU;
      const s = (0.8 + rnd() * 1.8) * k;
      g.fillStyle = rnd() < 0.55 ? 'rgba(45,30,8,0.22)' : 'rgba(255,248,225,0.13)';
      g.fillRect(rr * Math.cos(a), rr * Math.sin(a), s, s * (0.6 + rnd()));
    }
    g.restore();

    // Impacts d'anciennes fléchettes, concentrés là où tout le monde vise
    const gauss = () => Math.sqrt(-2 * Math.log(1 - rnd())) * Math.cos(TAU * rnd());
    const tripleR = (DIM.tIn + DIM.tOut) / 2;
    const clusters = [
      { x: 0, y: -tripleR, s: 0.013, n: 110 },                                   // triple 20
      { x: 0, y: 0, s: 0.012, n: 60 },                                           // bull
      { x: tripleR * Math.sin(198 * DEG), y: -tripleR * Math.cos(198 * DEG), s: 0.013, n: 45 }, // triple 19
      { x: 0, y: 0, s: 0.085, n: 120 }
    ];
    clusters.forEach(cl => {
      for (let i = 0; i < cl.n; i++) {
        const x = px(cl.x + gauss() * cl.s), y = px(cl.y + gauss() * cl.s);
        if (Math.hypot(x, y) > px(DIM.dOut)) continue;
        const r = (0.9 + rnd() * 1.1) * 1.25 * k;
        g.beginPath(); g.arc(x, y, r, 0, TAU); g.fillStyle = 'rgba(0,0,0,0.6)'; g.fill();
        g.beginPath(); g.arc(x + r * 0.7, y + r * 0.7, r * 0.8, 0, TAU); g.fillStyle = 'rgba(255,255,255,0.10)'; g.fill();
      }
    });

    // Usure : le sisal s'éclaircit et se feutre là où tout le monde vise, la crasse s'accumule au bord
    g.save();
    g.beginPath(); g.arc(0, 0, px(DIM.dOut), 0, TAU); g.clip();
    [[0, -tripleR, 0.036, 0.2], [0, 0, 0.03, 0.16], [tripleR * Math.sin(198 * DEG), -tripleR * Math.cos(198 * DEG), 0.03, 0.13]].forEach(w => {
      const gr = g.createRadialGradient(px(w[0]), px(w[1]), 0, px(w[0]), px(w[1]), px(w[2]));
      gr.addColorStop(0, `rgba(214,200,170,${w[3]})`); gr.addColorStop(1, 'rgba(214,200,170,0)');
      g.fillStyle = gr; g.fillRect(-R, -R, size, size);
    });
    g.restore();
    const grime = g.createRadialGradient(0, 0, R * 0.5, 0, 0, R);
    grime.addColorStop(0, 'rgba(0,0,0,0)'); grime.addColorStop(1, 'rgba(0,0,0,0.3)');
    disc(R, grime);

    // Fils : ombre portée (toujours), métal peint (repli seulement)
    const wires = () => {
      [DIM.dOut, DIM.dIn, DIM.tOut, DIM.tIn, DIM.bullO, DIM.bullI].forEach(r => {
        g.beginPath(); g.arc(0, 0, px(r), 0, TAU); g.stroke();
      });
      for (let i = 0; i < 20; i++) {
        const a = (i * 18 - 9 - 90) * DEG;
        g.beginPath();
        g.moveTo(px(DIM.bullO) * Math.cos(a), px(DIM.bullO) * Math.sin(a));
        g.lineTo(px(DIM.dOut + 0.004) * Math.cos(a), px(DIM.dOut + 0.004) * Math.sin(a));
        g.stroke();
      }
    };
    g.save();
    g.strokeStyle = 'rgba(0,0,0,0.55)';
    g.lineWidth = 4 * k;
    g.shadowColor = 'rgba(0,0,0,0.7)';
    g.shadowBlur = 7 * k;
    g.shadowOffsetX = 2.5 * k;
    g.shadowOffsetY = 3.5 * k;
    wires();
    g.restore();
    if (flat) {
      g.save();
      g.strokeStyle = '#C9C9D0'; g.lineWidth = 3 * k; wires();
      g.translate(-0.7 * k, -0.7 * k);
      g.strokeStyle = 'rgba(255,255,255,0.75)'; g.lineWidth = 1 * k; wires();
      g.restore();
    }

    // Chiffres en fil d'acier, orientés vers l'extérieur comme sur une vraie cible
    g.save();
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.font = `300 ${px(0.031)}px Archivo, "Helvetica Neue", Arial, sans-serif`;
    NUMBERS.forEach((n, i) => {
      g.save();
      g.rotate(i * 18 * DEG);
      g.translate(0, -px(DIM.numbers));
      const grad = g.createLinearGradient(0, -px(0.015), 0, px(0.015));
      grad.addColorStop(0, '#F2F2F5'); grad.addColorStop(0.5, '#B9B9C1'); grad.addColorStop(1, '#8A8A94');
      g.shadowColor = 'rgba(0,0,0,0.85)'; g.shadowBlur = 5 * k; g.shadowOffsetX = 2 * k; g.shadowOffsetY = 3 * k;
      g.fillStyle = grad;
      g.fillText(String(n), 0, 0);
      g.restore();
    });
    g.restore();

    // Cerclage acier
    g.save();
    const rim = g.createLinearGradient(-R, -R, R, R);
    rim.addColorStop(0, '#E9E9EE'); rim.addColorStop(0.35, '#8B8B95'); rim.addColorStop(0.6, '#D5D5DC'); rim.addColorStop(1, '#55555E');
    g.strokeStyle = rim; g.lineWidth = 9 * k;
    g.beginPath(); g.arc(0, 0, R - 5 * k, 0, TAU); g.stroke();
    g.restore();

    if (flat) {
      const light = g.createRadialGradient(-R * 0.35, -R * 0.4, R * 0.05, 0, 0, R * 1.05);
      light.addColorStop(0, 'rgba(255,255,255,0.16)');
      light.addColorStop(0.5, 'rgba(255,255,255,0)');
      light.addColorStop(1, 'rgba(0,0,0,0.38)');
      disc(R, light);
    }
    return c;
  }

  function drawBump(size) {
    const c = document.createElement('canvas');
    c.width = c.height = size;
    const g = c.getContext('2d');
    const tile = noiseTile(mulberry32(77), 256);
    g.fillStyle = g.createPattern(tile, 'repeat');
    g.scale(1.6, 1.6);
    g.fillRect(0, 0, size, size);
    return c;
  }

  /* ---------- Repli sans WebGL : la même cible, peinte à plat ---------- */
  function fallback2D() {
    root.classList.add('no-gl');
    root.classList.remove('intro', 'intro-impact', 'intro-pose');
    clearTimeout(window.__introSafety);
    const c = drawBoardTexture(1400, true);
    c.style.cssText = 'width:100%;height:100%;display:block;border-radius:50%';
    host.appendChild(c);
  }

  /* ---------- Ce que les fléchettes de LeBouseuh viennent clouer : les sections du site ----------
     Aucune ne touche la cible : elles se plantent toutes dans le bois autour, et la cible reste
     libre pour le jeu du visiteur.
     pos  : centre du papier dans le plan du tableau, en mètres (x à droite, y en haut)
     posP : variante pour un écran en hauteur, où la place est au-dessus et en dessous de la cible
     pin  : point où la fléchette transperce le papier, par rapport à son centre
     aim  : inclinaison finale de la fléchette (piqué, lacet) en degrés */
  const ITEMS = [
    { id: 'billetterie', href: '#billetterie', label: 'Billetterie : 12 juin 2027', w: 0.176, h: 0.070, rot: 4, pos: [0.385, 0.228], posP: [-0.125, 0.505], pin: [0.004, 0.024], aim: [-17, 12], fins: [0x6A2CF0, 0x4A16D6] },
    { id: 'photo', href: '#best-of', label: 'Édition 1 : les vainqueurs', w: 0.122, h: 0.146, rot: -5, pos: [-0.378, 0.168], posP: [0.200, 0.398], pin: [0, 0.063], aim: [-20, -14], fins: [0xFE628A, 0xD10146] },
    { id: 'boutique', href: '#boutique', label: 'Boutique', w: 0.094, h: 0.120, rot: -5, pos: [0.334, 0.058], posP: [-0.192, -0.372], pin: [0, 0.050], aim: [-15, 20], fins: [0x25DA4E, 0xB7E83A] },
    { id: 'equipes', href: '#equipes', label: 'Les équipes', w: 0.126, h: 0.090, rot: 4, pos: [-0.352, -0.036], posP: [-0.150, 0.340], pin: [0, 0.034], aim: [-12, -22], fins: [0xFF5A1F, 0xF48227] },
    { id: 'score', href: 'jouer.html', label: 'Règles et compteur de score', w: 0.098, h: 0.084, rot: 6, pos: [0.474, 0.010], posP: [0.052, 0.500], pin: [0, 0.033], aim: [-19, -18], fins: [0xDD2991, 0x8A1466] },
    { id: 'amateur', href: '#tournoi-amateur', label: 'Tournoi amateur', w: 0.110, h: 0.074, rot: -6, pos: [-0.398, -0.214], posP: [0.192, -0.346], pin: [0, 0.028], aim: [-26, 16], fins: [0x00D1FF, 0x1487B8] },
    { id: 'programme', href: '#programme', label: 'Programme et infos pratiques', w: 0.094, h: 0.094, rot: 8, pos: [0.378, -0.186], posP: [0.018, -0.338], pin: [0, 0.034], aim: [-21, -6], fins: [0xFFCA00, 0xFF366D], round: true }
  ];
  const TEAM_GRADS = [['#F48227', '#F7CB3E'], ['#25DA4E', '#F0F048'], ['#446DBB', '#323950'], ['#F03B2B', '#FF6D00'],
    ['#FE628A', '#D10146'], ['#00D1FF', '#124E67'], ['#FFCA00', '#FF366D'], ['#DD2991', '#630053']];
  const PX_PER_M = 5200;
  const DISPLAY = px => `italic 800 extra-condensed ${px}px Archivo, "Arial Narrow", Impact, sans-serif`;
  const TEXT = (px, w) => `${w || 600} ${px}px Archivo, "Helvetica Neue", Arial, sans-serif`;

  function fitText(g, text, x, y, maxW, align) {
    const w = g.measureText(text).width;
    const sx = Math.min(1, maxW / w);
    g.save();
    g.translate(x, y);
    g.scale(sx, 1);
    g.textAlign = align || 'left';
    g.fillText(text, 0, 0);
    g.restore();
  }
  function grain(g, W, H, alpha, seed) {
    const tile = noiseTile(mulberry32(seed), 128);
    g.save();
    g.globalCompositeOperation = 'overlay';
    g.globalAlpha = alpha;
    g.fillStyle = g.createPattern(tile, 'repeat');
    g.fillRect(0, 0, W, H);
    g.restore();
    // usure : bords légèrement assombris
    const edge = g.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.3, W / 2, H / 2, Math.hypot(W, H) * 0.56);
    edge.addColorStop(0, 'rgba(0,0,0,0)');
    edge.addColorStop(1, 'rgba(40,20,0,0.16)');
    g.fillStyle = edge;
    g.fillRect(0, 0, W, H);
  }

  const DRAW = {
    billetterie(g, W, H) {
      g.fillStyle = '#ECE7DC'; g.fillRect(0, 0, W, H);
      const stub = W * 0.2;
      g.fillStyle = '#5B1DDA'; g.fillRect(0, 0, stub, H);
      g.save();
      g.translate(stub * 0.58, H / 2); g.rotate(-Math.PI / 2);
      g.fillStyle = '#FFFFFF'; g.font = DISPLAY(H * 0.36); g.textBaseline = 'middle';
      fitText(g, 'BILLETTERIE', 0, 0, H * 0.86, 'center');
      g.restore();
      g.fillStyle = 'rgba(20,6,60,0.55)';
      for (let y = H * 0.06; y < H; y += H * 0.085) { g.beginPath(); g.arc(stub, y, H * 0.016, 0, TAU); g.fill(); }
      const x0 = stub + W * 0.045, maxW = W - x0 - W * 0.05;
      g.fillStyle = '#160444';
      g.textBaseline = 'alphabetic';
      g.font = TEXT(H * 0.1, 700);
      fitText(g, 'FLÉCHETTES CUP  ÉDITION 2', x0, H * 0.2, maxW);
      g.font = DISPLAY(H * 0.56);
      fitText(g, '12 JUIN 2027', x0 - H * 0.02, H * 0.68, maxW);
      const rnd = mulberry32(12);
      let bx = x0;
      while (bx < x0 + maxW * 0.5) {
        const bw = (1 + Math.floor(rnd() * 3)) * H * 0.008;
        g.fillRect(bx, H * 0.76, bw, H * 0.15);
        bx += bw + (1 + Math.floor(rnd() * 3)) * H * 0.008;
      }
      g.font = TEXT(H * 0.085, 600);
      g.textBaseline = 'middle';
      fitText(g, 'OUVERTURE MARS 2027', W - W * 0.05, H * 0.84, maxW * 0.44, 'right');
      grain(g, W, H, 0.22, 3);
    },

    equipes(g, W, H) {
      g.fillStyle = '#1B0550'; g.fillRect(0, 0, W, H);
      g.fillStyle = '#FFFFFF'; g.textBaseline = 'alphabetic';
      g.font = DISPLAY(H * 0.3);
      fitText(g, 'LES ÉQUIPES', W * 0.07, H * 0.33, W * 0.6);
      g.fillStyle = '#D9FBB3'; g.font = TEXT(H * 0.085, 600); g.textBaseline = 'middle';
      fitText(g, '8 DUOS', W * 0.93, H * 0.22, W * 0.24, 'right');
      const gx = W * 0.07, gy = H * 0.44, gw = W * 0.86, gh = H * 0.46, gap = W * 0.018;
      const cw = (gw - gap * 3) / 4, ch = (gh - gap) / 2;
      TEAM_GRADS.forEach((c, i) => {
        const x = gx + (i % 4) * (cw + gap), y = gy + Math.floor(i / 4) * (ch + gap);
        const gr = g.createLinearGradient(0, y, 0, y + ch);
        gr.addColorStop(0, c[0]); gr.addColorStop(1, c[1]);
        g.fillStyle = gr; g.fillRect(x, y, cw, ch);
      });
      grain(g, W, H, 0.2, 5);
    },

    photo(g, W, H, img) {
      g.fillStyle = '#F4F1EA'; g.fillRect(0, 0, W, H);
      grain(g, W, H, 0.16, 7);
      const m = W * 0.065, pw = W - 2 * m, ph = pw;
      const top = m * 1.05;
      if (img) {
        const s = Math.max(pw / img.width, ph / img.height);
        const sw = pw / s, sh = ph / s;
        g.drawImage(img, (img.width - sw) / 2, (img.height - sh) * 0.55, sw, sh, m, top, pw, ph);
      } else {
        const bg = g.createLinearGradient(m, top, m + pw, top + ph);
        bg.addColorStop(0, '#5012D4'); bg.addColorStop(1, '#210666');
        g.fillStyle = bg; g.fillRect(m, top, pw, ph);
      }
      const gloss = g.createLinearGradient(m, top, m + pw, top + ph);
      gloss.addColorStop(0, 'rgba(255,255,255,0.14)'); gloss.addColorStop(0.4, 'rgba(255,255,255,0)');
      g.fillStyle = gloss; g.fillRect(m, top, pw, ph);
      g.strokeStyle = 'rgba(0,0,0,0.25)'; g.lineWidth = W * 0.004; g.strokeRect(m, top, pw, ph);
      g.fillStyle = '#2A2440'; g.textBaseline = 'middle';
      g.font = `italic 500 ${W * 0.07}px Archivo, "Helvetica Neue", Arial, sans-serif`;
      fitText(g, 'Les vainqueurs de l’édition 1', W / 2, top + ph + (H - top - ph) / 2, pw, 'center');
    },

    boutique(g, W, H) {
      g.fillStyle = '#F1EDE3'; g.fillRect(0, 0, W, H);
      // un maillot, aux couleurs d'une équipe
      const cx = W / 2, jy = H * 0.19, jw = W * 0.74, jh = H * 0.44;
      const P = (u, v) => [cx + (u - 0.5) * jw, jy + v * jh];
      const pts = [[0.30, 0], [0.70, 0], [0.79, 0.07], [1, 0.16], [0.93, 0.36], [0.82, 0.31], [0.82, 1], [0.18, 1], [0.18, 0.31], [0.07, 0.36], [0, 0.16], [0.21, 0.07]];
      const gr = g.createLinearGradient(0, jy, 0, jy + jh);
      gr.addColorStop(0, '#F48227'); gr.addColorStop(1, '#F7CB3E');
      g.beginPath();
      pts.forEach((p, i) => { const q = P(p[0], p[1]); if (i) g.lineTo(q[0], q[1]); else g.moveTo(q[0], q[1]); });
      g.closePath(); g.fillStyle = gr; g.fill();
      g.beginPath(); g.arc(cx, jy, jw * 0.13, 0, Math.PI); g.fillStyle = '#F1EDE3'; g.fill();
      g.fillStyle = 'rgba(255,255,255,0.92)'; g.textBaseline = 'middle';
      g.font = DISPLAY(jh * 0.3);
      fitText(g, 'FC 27', cx, jy + jh * 0.56, jw * 0.42, 'center');
      g.fillStyle = '#160444'; g.textBaseline = 'alphabetic';
      g.font = DISPLAY(H * 0.2);
      fitText(g, 'BOUTIQUE', cx, H * 0.83, W * 0.8, 'center');
      g.font = TEXT(H * 0.052, 600);
      fitText(g, 'MAILLOTS OFFICIELS', cx, H * 0.905, W * 0.8, 'center');
      g.fillStyle = '#C8102E'; g.font = TEXT(H * 0.042, 700);
      fitText(g, 'ÉDITION LIMITÉE', cx, H * 0.955, W * 0.8, 'center');
      grain(g, W, H, 0.2, 9);
    },

    amateur(g, W, H) {
      g.fillStyle = '#D6F8AC'; g.fillRect(0, 0, W, H);
      // petite cible
      const tx = W * 0.8, ty = H * 0.42, tr = H * 0.3;
      ['#1B0550', '#D6F8AC', '#1B0550', '#D6F8AC', '#5B1DDA'].forEach((c, i) => {
        g.beginPath(); g.arc(tx, ty, tr * (1 - i * 0.21), 0, TAU); g.fillStyle = c; g.fill();
      });
      g.fillStyle = '#1B0550'; g.textBaseline = 'alphabetic';
      g.font = DISPLAY(H * 0.36);
      fitText(g, 'TOURNOI', W * 0.07, H * 0.4, W * 0.5);
      fitText(g, 'AMATEUR', W * 0.07, H * 0.72, W * 0.52);
      g.font = TEXT(H * 0.095, 700);
      fitText(g, 'INSCRIS TON DUO', W * 0.075, H * 0.89, W * 0.6);
      grain(g, W, H, 0.2, 11);
    },

    score(g, W, H) {
      // une petite ardoise de marque, comme celles du meuble
      g.fillStyle = '#3A2413'; g.fillRect(0, 0, W, H);
      const f = W * 0.045;
      g.fillStyle = '#1B2420'; g.fillRect(f, f, W - 2 * f, H - 2 * f);
      const dust = g.createRadialGradient(W * 0.4, H * 0.45, 0, W * 0.4, H * 0.45, W * 0.6);
      dust.addColorStop(0, 'rgba(235,238,228,0.10)'); dust.addColorStop(1, 'rgba(235,238,228,0)');
      g.fillStyle = dust; g.fillRect(f, f, W - 2 * f, H - 2 * f);
      g.fillStyle = 'rgba(240,240,230,0.92)'; g.textBaseline = 'alphabetic';
      g.font = `italic 500 ${H * 0.4}px Archivo, "Helvetica Neue", Arial, sans-serif`;
      fitText(g, '301', W / 2, H * 0.5, W * 0.6, 'center');
      g.fillRect(W * 0.24, H * 0.56, W * 0.52, H * 0.012);
      g.fillStyle = '#D9FBB3';
      g.font = DISPLAY(H * 0.19);
      fitText(g, 'RÈGLES ET SCORE', W / 2, H * 0.77, W * 0.78, 'center');
      g.fillStyle = 'rgba(240,240,230,0.85)';
      g.font = TEXT(H * 0.075, 600);
      fitText(g, 'COMPTE TES POINTS', W / 2, H * 0.89, W * 0.7, 'center');
      grain(g, W, H, 0.16, 15);
    },

    programme(g, W, H) {
      // sous-bock
      g.clearRect(0, 0, W, H);
      const c = W / 2;
      g.beginPath(); g.arc(c, c, c, 0, TAU); g.fillStyle = '#EFE9DC'; g.fill();
      g.beginPath(); g.arc(c, c, c * 0.9, 0, TAU); g.strokeStyle = '#5B1DDA'; g.lineWidth = W * 0.05; g.stroke();
      g.beginPath(); g.arc(c, c, c * 0.8, 0, TAU); g.strokeStyle = '#160444'; g.lineWidth = W * 0.008; g.stroke();
      g.fillStyle = '#160444'; g.textBaseline = 'alphabetic';
      g.font = TEXT(W * 0.075, 700);
      fitText(g, '12.06.2027', c, W * 0.36, W * 0.5, 'center');
      g.font = DISPLAY(W * 0.25);
      fitText(g, 'PROGRAMME', c, W * 0.6, W * 0.68, 'center');
      g.font = TEXT(W * 0.062, 700);
      fitText(g, 'ET INFOS PRATIQUES', c, W * 0.71, W * 0.56, 'center');
      // auréole de verre
      g.beginPath(); g.arc(c * 1.12, c * 0.92, c * 0.6, 0, TAU);
      g.strokeStyle = 'rgba(120,70,20,0.16)'; g.lineWidth = W * 0.022; g.stroke();
      g.save();
      g.beginPath(); g.arc(c, c, c, 0, TAU); g.clip();
      grain(g, W, H, 0.26, 13);
      g.restore();
    }
  };

  /* ---------- Textures du décor ---------- */
  /* Enduit terracotta usé. size : côté de la texture en pixels ; meters : ce qu'elle couvre.
     plain : sans les dégâts (pour le reste du mur, où elle est répétée). */
  function plasterTexture(size, meters, plain) {
    const col = document.createElement('canvas'); col.width = col.height = size;
    const bmp = document.createElement('canvas'); bmp.width = bmp.height = size;
    const g = col.getContext('2d'), b = bmp.getContext('2d');
    const rnd = mulberry32(plain ? 9090 : 1605);
    const M = size / meters;                                   // pixels par mètre
    const at = (x, y) => [(x / meters + 0.5) * size, (0.5 - (y - 0.2) / meters) * size];   // le panneau est centré en y = 0,2
    g.fillStyle = '#7E4326'; g.fillRect(0, 0, size, size);
    b.fillStyle = '#808080'; b.fillRect(0, 0, size, size);
    // nuages de teinte : l'enduit n'est jamais uniforme
    for (let i = 0; i < (plain ? 60 : 150); i++) {
      const x = rnd() * size, y = rnd() * size, r = (0.08 + rnd() * 0.3) * size;
      const gr = g.createRadialGradient(x, y, 0, x, y, r);
      const dark = rnd() < 0.6;
      gr.addColorStop(0, dark ? `rgba(48,20,10,${0.05 + rnd() * 0.1})` : `rgba(214,140,84,${0.04 + rnd() * 0.07})`);
      gr.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = gr; g.fillRect(0, 0, size, size);
    }
    // grain fin, en couleur et en relief
    const tile = noiseTile(rnd, 256);
    [[g, 0.1, 1], [g, 0.2, 7], [b, 0.22, 1], [b, 0.3, 6]].forEach(([ctx, a, s]) => {
      ctx.save();
      ctx.globalCompositeOperation = 'overlay'; ctx.globalAlpha = a;
      ctx.fillStyle = ctx.createPattern(tile, 'repeat');
      ctx.scale(s, s); ctx.fillRect(0, 0, size / s, size / s);
      ctx.restore();
    });
    // coups de taloche, rayures, traces de frottement
    for (let i = 0; i < (plain ? 30 : 110); i++) {
      const x = rnd() * size, y = rnd() * size, len = (0.02 + rnd() * 0.14) * size, a = rnd() * Math.PI;
      const light = rnd() < 0.35;
      g.strokeStyle = light ? `rgba(226,170,120,${0.05 + rnd() * 0.1})` : `rgba(40,16,8,${0.06 + rnd() * 0.12})`;
      g.lineWidth = 0.6 + rnd() * 1.8;
      g.beginPath(); g.moveTo(x, y);
      g.quadraticCurveTo(x + Math.cos(a) * len * 0.5 + (rnd() - 0.5) * 30, y + Math.sin(a) * len * 0.5 + (rnd() - 0.5) * 30, x + Math.cos(a) * len, y + Math.sin(a) * len);
      g.stroke();
    }
    if (plain) return { col, bmp };

    // éclats : le plâtre blanc apparaît sous la peinture, en creux
    const fleck = (x, y, r) => {
      g.beginPath(); b.beginPath();
      const n = 5 + Math.floor(rnd() * 4), a0 = rnd() * TAU;
      for (let k = 0; k < n; k++) {
        const a = a0 + k / n * TAU, rr = r * (0.5 + rnd() * 0.7);
        const px = x + Math.cos(a) * rr, py = y + Math.sin(a) * rr;
        if (k) { g.lineTo(px, py); b.lineTo(px, py); } else { g.moveTo(px, py); b.moveTo(px, py); }
      }
      g.closePath(); b.closePath();
      g.fillStyle = rnd() < 0.8 ? '#E4D8C6' : '#B79C82'; g.fill();
      b.fillStyle = '#2A2A2A'; b.fill();
    };
    const gauss = () => Math.sqrt(-2 * Math.log(1 - rnd())) * Math.cos(TAU * rnd());
    // la grande balafre en haut à droite, comme dans le teaser, et quelques impacts plus anciens
    const scars = [[0.50, 0.37, 0.12, 0.035, 150, -0.35], [0.56, 0.20, 0.05, 0.05, 40, 0], [-0.33, -0.25, 0.05, 0.03, 46, 0.2], [0.30, -0.22, 0.04, 0.04, 22, 0], [-0.52, 0.30, 0.05, 0.05, 18, 0]];
    scars.forEach(sc => {
      const c = at(sc[0], sc[1]), ca = Math.cos(sc[5]), sa = Math.sin(sc[5]);
      for (let i = 0; i < sc[4]; i++) {
        const u = gauss() * sc[2] * M, v = gauss() * sc[3] * M;
        fleck(c[0] + u * ca - v * sa, c[1] + u * sa + v * ca, (0.0015 + rnd() * rnd() * 0.008) * M);
      }
    });
    for (let i = 0; i < 34; i++) fleck(rnd() * size, rnd() * size, (0.0008 + rnd() * 0.0022) * M);
    // une fissure qui part de la balafre
    const c0 = at(0.38, 0.42);
    g.strokeStyle = 'rgba(236,224,206,0.8)'; g.lineWidth = 1.6; b.strokeStyle = '#303030'; b.lineWidth = 2.4;
    [g, b].forEach(ctx => {
      const r2 = mulberry32(77);
      ctx.beginPath(); ctx.moveTo(c0[0], c0[1]);
      let x = c0[0], y = c0[1];
      for (let k = 0; k < 16; k++) { x += (0.012 + r2() * 0.012) * M; y += (r2() - 0.62) * 0.012 * M; ctx.lineTo(x, y); }
      ctx.stroke();
    });
    return { col, bmp };
  }

  /* Un impact frais dans l'enduit : quelques éclats de plâtre autour d'un trou */
  function chipTexture(seed) {
    const S = 128;
    const c = document.createElement('canvas'); c.width = c.height = S;
    const g = c.getContext('2d');
    const rnd = mulberry32(seed);
    const gauss = () => Math.sqrt(-2 * Math.log(1 - rnd())) * Math.cos(TAU * rnd());
    for (let i = 0; i < 15; i++) {
      const x = S / 2 + gauss() * S * 0.12, y = S / 2 + gauss() * S * 0.12, r = 1.5 + rnd() * rnd() * 8;
      g.beginPath();
      const n = 5 + Math.floor(rnd() * 3), a0 = rnd() * TAU;
      for (let k = 0; k < n; k++) {
        const a = a0 + k / n * TAU, rr = r * (0.5 + rnd() * 0.7);
        if (k) g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); else g.moveTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
      }
      g.closePath();
      g.fillStyle = rnd() < 0.8 ? '#E4D8C6' : '#B79C82';
      g.fill();
    }
    g.beginPath(); g.arc(S / 2, S / 2, 3, 0, TAU); g.fillStyle = '#1A0E08'; g.fill();
    return c;
  }

  /* Bois : cernes déformés par un bruit, fil serré, lames de teintes un peu différentes */
  function woodTexture(seed) {
    const W = 512, H = 1024, PLANKS = 4;
    const c = document.createElement('canvas'); c.width = W; c.height = H;
    const g = c.getContext('2d');
    const rnd = mulberry32(seed);
    const G = 64, grid = new Float32Array(G * G);
    for (let i = 0; i < G * G; i++) grid[i] = rnd();
    const vn = (x, y) => {
      const xi = Math.floor(x), yi = Math.floor(y);
      let fx = x - xi, fy = y - yi;
      fx = fx * fx * (3 - 2 * fx); fy = fy * fy * (3 - 2 * fy);
      const a = grid[((yi % G + G) % G) * G + ((xi % G + G) % G)], b = grid[((yi % G + G) % G) * G + (((xi + 1) % G + G) % G)];
      const d = grid[(((yi + 1) % G + G) % G) * G + ((xi % G + G) % G)], e = grid[(((yi + 1) % G + G) % G) * G + (((xi + 1) % G + G) % G)];
      return a + (b - a) * fx + (d - a) * fy + (a - b - d + e) * fx * fy;
    };
    const tone = [], shift = [];
    for (let k = 0; k < PLANKS; k++) { tone.push((rnd() - 0.5) * 0.16); shift.push(rnd() * 40); }
    const img = g.createImageData(W, H), px = img.data;
    for (let y = 0; y < H; y++) {
      const v = y / H;
      for (let x = 0; x < W; x++) {
        const u = x / W * PLANKS, k = Math.floor(u), pu = u - k, s = shift[k];
        const warp = vn(pu * 2.2 + s, v * 2.4 + s) * 1.6 + vn(pu * 7 + s, v * 5) * 0.35;
        const rings = 0.5 + 0.5 * Math.sin((pu * 5.5 + warp * 3.4 + s) * Math.PI * 2);
        const fibre = vn(pu * 90 + s, v * 7) - 0.5;
        const pores = vn(pu * 220 + s, v * 60) > 0.8 ? -0.1 : 0;
        let t = 0.42 + 0.3 * Math.pow(rings, 1.6) + 0.26 * fibre + pores + tone[k] + 0.1 * (vn(pu * 1.3 + s, v * 1.1) - 0.5);
        const seam = Math.min(pu, 1 - pu) * (W / PLANKS);           // distance au joint, en pixels
        if (seam < 2.2) t -= 0.42 * (1 - seam / 2.2);
        t = Math.max(0, Math.min(1, t));
        const i = (y * W + x) * 4;
        px[i] = 40 + 96 * t; px[i + 1] = 21 + 58 * t; px[i + 2] = 11 + 32 * t; px[i + 3] = 255;
      }
    }
    g.putImageData(img, 0, 0);
    return c;
  }

  function posterTexture(colors, word, seed) {
    const W = 512, H = 683;
    const c = document.createElement('canvas'); c.width = W; c.height = H;
    const g = c.getContext('2d');
    const gr = g.createLinearGradient(0, 0, 0, H);
    gr.addColorStop(0, colors[0]); gr.addColorStop(1, colors[1]);
    g.fillStyle = gr; g.fillRect(0, 0, W, H);
    g.fillStyle = 'rgba(0,0,0,0.12)';
    for (let i = 0; i < 13; i++) {
      const a0 = Math.PI * (0.05 + i / 13 * 0.9), a1 = a0 + Math.PI * 0.035;
      g.beginPath(); g.moveTo(W / 2, -40);
      g.lineTo(W / 2 + Math.cos(a0) * 1200, -40 + Math.sin(a0) * 1200);
      g.lineTo(W / 2 + Math.cos(a1) * 1200, -40 + Math.sin(a1) * 1200);
      g.closePath(); g.fill();
    }
    g.fillStyle = '#FFFFFF'; g.textBaseline = 'alphabetic';
    g.save(); g.translate(W * 0.08, H * 0.84); g.rotate(-0.07);
    g.font = DISPLAY(150); fitText(g, word, 0, 0, W * 0.84);
    g.font = TEXT(26, 700); fitText(g, 'FLÉCHETTES CUP 2026', 4, 44, W * 0.8);
    g.restore();
    grain(g, W, H, 0.2, seed);
    return c;
  }

  function haloTexture(inner, outer) {
    const c = document.createElement('canvas'); c.width = c.height = 128;
    const g = c.getContext('2d');
    const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    gr.addColorStop(0, inner); gr.addColorStop(0.25, outer); gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
    return c;
  }

  /* ---------- Scène 3D ---------- */
  function build() {
    const THREE = window.THREE;
    const mobile = Math.min(window.innerWidth, window.innerHeight) < 700;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    renderer.setPixelRatio(dpr);
    renderer.outputEncoding = THREE.sRGBEncoding;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 0.96;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.setClearColor(0x000000, 0);

    const canvas = renderer.domElement;
    canvas.className = 'scene';
    canvas.setAttribute('aria-hidden', 'true');
    hero.insertBefore(canvas, hero.querySelector('.hero-stage'));

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(50, 1, 0.006, 14);
    const aniso = renderer.capabilities.getMaxAnisotropy();
    const canvasTex = (c, repeat) => {
      const t = new THREE.CanvasTexture(c);
      t.encoding = THREE.sRGBEncoding;
      t.anisotropy = aniso;
      if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat[0], repeat[1]); }
      return t;
    };
    const dataTex = (c, repeat) => { const t = canvasTex(c, repeat); t.encoding = THREE.LinearEncoding; return t; };

    // Reflets : un pub sombre, quelques sources chaudes, une lueur froide dans un coin
    const envC = document.createElement('canvas');
    envC.width = 512; envC.height = 256;
    const eg = envC.getContext('2d');
    const sky = eg.createLinearGradient(0, 0, 0, 256);
    sky.addColorStop(0, '#1A120E'); sky.addColorStop(0.5, '#0B0706'); sky.addColorStop(1, '#040303');
    eg.fillStyle = sky; eg.fillRect(0, 0, 512, 256);
    eg.fillStyle = '#FFD9A0'; eg.fillRect(330, 18, 120, 46);
    eg.fillStyle = '#FFB868'; eg.fillRect(70, 34, 50, 26);
    eg.fillStyle = '#FF9A48'; eg.fillRect(210, 100, 36, 26);
    eg.fillStyle = '#2FB8AE'; eg.fillRect(20, 150, 60, 30);
    const envT = new THREE.CanvasTexture(envC);
    envT.mapping = THREE.EquirectangularReflectionMapping;
    envT.encoding = THREE.sRGBEncoding;
    const pmrem = new THREE.PMREMGenerator(renderer);
    scene.environment = pmrem.fromEquirectangular(envT).texture;
    envT.dispose(); pmrem.dispose();

    /* --- Lumières : celles du teaser de l'édition 1 ---
       Une source chaude et rasante, en haut à droite : les fléchettes plantées dans le mur
       projettent de longues ombres, et le côté gauche tombe dans le noir. */
    const lights = [];
    const mkSpot = (intensity, x, y, z) => {
      const l = new THREE.SpotLight(0xFFCB96, intensity, 0, 0.36, 0.92, 1);
      l.position.set(x, y, z);
      l.target.position.set(0.24, 0.05, 0);
      l.castShadow = true;
      l.shadow.mapSize.set(mobile ? 1024 : 2048, mobile ? 1024 : 2048);
      l.shadow.camera.near = 0.6; l.shadow.camera.far = 4.2;
      l.shadow.bias = -0.0004;
      l.shadow.normalBias = 0.0009;
      scene.add(l, l.target);
      lights.push(l);
    };
    // deux sources voisines plutôt qu'une : leurs ombres se recouvrent en dégradé, comme une vraie lampe
    mkSpot(2.25, 1.50, 1.08, 0.74);
    mkSpot(1.45, 1.70, 0.92, 0.84);
    // un peu de face, pour que la cible et les papiers restent lisibles côté ombre
    const frontFill = new THREE.SpotLight(0xFFE2C4, 0.3, 0, 0.5, 1, 1);
    frontFill.position.set(-0.3, 0.5, 2.4);
    frontFill.target.position.set(0, 0, 0);
    // les ombres ne sont pas noires : elles tirent vers le froid, comme sur le film
    const cold = new THREE.AmbientLight(0x123438, 0.42);
    const tvGlow = new THREE.PointLight(0x35D8C8, 0.7, 2.6, 1.4);       // la lueur d'un écran, en bas à gauche
    tvGlow.position.set(-1.5, -0.55, 0.55);
    const sconceL = new THREE.PointLight(0xFFB769, 0.8, 2.6, 1.5);
    sconceL.position.set(-2.45, 0.5, 0.22);
    const sconceR = new THREE.PointLight(0xFFB769, 0.8, 2.6, 1.5);
    sconceR.position.set(2.45, 0.5, 0.22);
    scene.add(frontFill.target);
    [frontFill, cold, tvGlow, sconceL, sconceR].forEach(l => { scene.add(l); lights.push(l); });
    lights.forEach(l => l.layers.enable(1));

    /* --- Le décor : le mur du pub --- */
    const WALL_Z = -0.040;                 // la cible est accrochée à même le mur
    // le pan de mur où est la cible : un enduit terracotta usé, avec sa balafre
    const PANEL = 2.4;
    const plaster = plasterTexture(mobile ? 1024 : 2048, PANEL);
    const panel = new THREE.Mesh(new THREE.PlaneGeometry(PANEL, PANEL), new THREE.MeshStandardMaterial({
      map: canvasTex(plaster.col), bumpMap: dataTex(plaster.bmp), bumpScale: 0.0013,
      roughness: 0.9, metalness: 0, envMapIntensity: 0.3
    }));
    panel.position.set(0, 0.2, WALL_Z);
    panel.receiveShadow = true;
    scene.add(panel);
    // le reste du mur, plus rouge et plus sombre
    const farWall = plasterTexture(512, 1.2, true);
    const wallW = 9, wallH = 3.8;
    const wall = new THREE.Mesh(new THREE.PlaneGeometry(wallW, wallH), new THREE.MeshStandardMaterial({
      map: canvasTex(farWall.col, [wallW / 1.2, wallH / 1.2]), bumpMap: dataTex(farWall.bmp, [wallW / 1.2, wallH / 1.2]), bumpScale: 0.002,
      color: 0x8A5A52, roughness: 0.92, metalness: 0, envMapIntensity: 0.25
    }));
    wall.position.set(0, -0.15, WALL_Z - 0.004);
    wall.receiveShadow = true;
    scene.add(wall);

    const woodA = woodTexture(21), woodB = woodTexture(22);
    // bois sombre verni : le relief suit le fil, une couche brillante accroche la lumière
    const wood = (tint, repeat, canvasSrc) => new THREE.MeshPhysicalMaterial({
      map: canvasTex(canvasSrc || woodA, repeat || [1, 1]), bumpMap: dataTex(canvasSrc || woodA, repeat || [1, 1]), bumpScale: 0.0009,
      color: tint, roughness: 0.55, metalness: 0, clearcoat: 0.35, clearcoatRoughness: 0.4, envMapIntensity: 0.45
    });
    const darkWood = wood(0x4A342A, [0.4, 2.2], woodB);
    // les montants en bois qui encadrent le pan de mur
    [-1, 1].forEach(side => {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.13, 2.9, 0.09), darkWood);
      post.position.set(side * (PANEL / 2 + 0.03), 0.1, WALL_Z + 0.045);
      post.castShadow = true; post.receiveShadow = true;
      scene.add(post);
    });
    // la tablette sous la cible, couverte de débris, et le lambris en dessous
    const ledge = new THREE.Group();
    const shelf = new THREE.Mesh(new THREE.BoxGeometry(PANEL + 0.2, 0.036, 0.16), wood(0x513828, [5, 0.2], woodA));
    shelf.position.set(0, -0.018, WALL_Z + 0.08);
    shelf.castShadow = true; shelf.receiveShadow = true;
    ledge.add(shelf);
    const below = new THREE.Mesh(new THREE.PlaneGeometry(wallW, 1.6), wood(0x3E2C24, [wallW / 0.46, 1.7], woodB));
    below.position.set(0, -0.036 - 0.8, WALL_Z + 0.012);
    below.receiveShadow = true;
    ledge.add(below);
    (function debris() {
      const rnd = mulberry32(515);
      const mat = new THREE.MeshStandardMaterial({ color: 0xD9CBB8, roughness: 0.95 });
      const dust = new THREE.MeshStandardMaterial({ color: 0x9A6A48, roughness: 0.95 });
      for (let i = 0; i < 26; i++) {
        const s = 0.004 + rnd() * 0.012;
        const chunk = new THREE.Mesh(new THREE.BoxGeometry(s, s * (0.4 + rnd() * 0.5), s * (0.6 + rnd() * 0.8)), rnd() < 0.7 ? mat : dust);
        chunk.position.set((rnd() * 2 - 1) * 0.62, s * 0.2, WALL_Z + 0.02 + rnd() * 0.12);
        chunk.rotation.set(rnd() * 0.6, rnd() * Math.PI, rnd() * 0.6);
        chunk.castShadow = true; chunk.receiveShadow = true;
        ledge.add(chunk);
      }
    })();
    scene.add(ledge);

    // appliques murales, avec leur halo
    const brass = new THREE.MeshStandardMaterial({ color: 0xB08A3C, metalness: 1, roughness: 0.3, envMapIntensity: 1.3 });
    const halo = canvasTex(haloTexture('rgba(255,236,200,1)', 'rgba(255,170,80,0.35)'));
    [-2.45, 2.45].forEach(x => {
      const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.045, 16, 12), new THREE.MeshBasicMaterial({ color: 0xFFE2B5, toneMapped: false }));
      bulb.position.set(x, 0.5, WALL_Z + 0.12);
      scene.add(bulb);
      const base = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.035, 0.1, 12), brass);
      base.position.set(x, 0.42, WALL_Z + 0.1);
      scene.add(base);
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: halo, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, toneMapped: false, opacity: 0.8 }));
      sp.position.set(x, 0.5, WALL_Z + 0.14);
      sp.scale.set(0.9, 0.9, 1);
      scene.add(sp);
    });

    // cadres aux murs, de part et d'autre
    [[1.62, 0.30, 0.44, 0.59, TEAM_GRADS[1], 'MICHOU', 41], [2.12, 0.02, 0.36, 0.48, TEAM_GRADS[4], 'INOX', 42], [-1.60, 0.36, 0.36, 0.48, TEAM_GRADS[0], 'LEBOUSEUH', 43], [-2.08, -0.02, 0.3, 0.4, TEAM_GRADS[3], 'DOMINGO', 44]].forEach(f => {
      const frame = new THREE.Mesh(new THREE.BoxGeometry(f[2] + 0.05, f[3] + 0.05, 0.03), new THREE.MeshStandardMaterial({ color: 0x15100C, roughness: 0.5, envMapIntensity: 0.6 }));
      frame.position.set(f[0], f[1], WALL_Z + 0.015);
      frame.castShadow = true;
      scene.add(frame);
      const pic = new THREE.Mesh(new THREE.PlaneGeometry(f[2], f[3]), new THREE.MeshStandardMaterial({ map: canvasTex(posterTexture(f[4], f[5], f[6])), color: 0x9A9088, roughness: 0.4, envMapIntensity: 0.6 }));
      pic.position.set(f[0], f[1], WALL_Z + 0.031);
      scene.add(pic);
    });

    /* --- La cible --- */
    const board = new THREE.Group();
    const tex = canvasTex(drawBoardTexture(mobile ? 2048 : 3072, false));
    const face = new THREE.Mesh(
      new THREE.CircleGeometry(BOARD_R, 128),
      new THREE.MeshStandardMaterial({ map: tex, bumpMap: dataTex(drawBump(1024)), bumpScale: 0.0012, roughness: 0.97, metalness: 0, envMapIntensity: 0.2 })
    );
    face.position.z = 0.0004;
    face.receiveShadow = true;
    board.add(face);
    const body = new THREE.Mesh(
      new THREE.CylinderGeometry(BOARD_R, BOARD_R, 0.038, 96),
      new THREE.MeshStandardMaterial({ color: 0x0D0C0B, roughness: 0.92, envMapIntensity: 0.2 })
    );
    body.rotation.x = Math.PI / 2;
    body.position.z = -0.019;
    body.castShadow = true;
    board.add(body);
    const steel = new THREE.MeshStandardMaterial({ color: 0xC9C9D2, metalness: 1, roughness: 0.32, envMapIntensity: 1.6 });
    const WIRE = 0.00075;
    [DIM.dOut, DIM.dIn, DIM.tOut, DIM.tIn, DIM.bullO, DIM.bullI].forEach(r => {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(r, WIRE, 8, 160), steel);
      ring.position.z = 0.0011;
      board.add(ring);
    });
    const spokeLen = DIM.dOut + 0.004 - DIM.bullO;
    const spokeGeo = new THREE.CylinderGeometry(WIRE, WIRE, spokeLen, 6);
    for (let i = 0; i < 20; i++) {
      const a = (i * 18 - 9) * DEG;
      const mid = DIM.bullO + spokeLen / 2;
      const spoke = new THREE.Mesh(spokeGeo, steel);
      spoke.position.set(Math.sin(a) * mid, Math.cos(a) * mid, 0.0011);
      spoke.rotation.z = -a;
      board.add(spoke);
    }
    // l'anneau de fil qui porte les chiffres, et le bourrelet du bord
    const numberRing = new THREE.Mesh(new THREE.TorusGeometry(0.2148, 0.0009, 8, 180), steel);
    numberRing.position.z = 0.0013;
    board.add(numberRing);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(BOARD_R - 0.0015, 0.0042, 12, 160),
      new THREE.MeshStandardMaterial({ color: 0x141312, roughness: 0.55, metalness: 0.1, envMapIntensity: 0.8 }));
    rim.position.z = -0.0012;
    rim.castShadow = true;
    board.add(rim);
    scene.add(board);

    /* --- Les papiers : tenus par un seul point, ils se soulèvent en s'éloignant de la fléchette --- */
    const creaseC = document.createElement('canvas');
    creaseC.width = creaseC.height = 256;
    (function () {
      const cg = creaseC.getContext('2d'), rnd = mulberry32(88);
      cg.fillStyle = cg.createPattern(noiseTile(rnd, 128), 'repeat');
      cg.globalAlpha = 0.35; cg.fillRect(0, 0, 256, 256);
      cg.globalAlpha = 1; cg.fillStyle = 'rgba(128,128,128,0.72)'; cg.fillRect(0, 0, 256, 256);
      for (let k = 0; k < 5; k++) {                       // quelques plis
        const y0 = rnd() * 256, y1 = y0 + (rnd() - 0.5) * 120;
        cg.strokeStyle = 'rgba(40,40,40,0.5)'; cg.lineWidth = 2.5;
        cg.beginPath(); cg.moveTo(0, y0); cg.lineTo(256, y1); cg.stroke();
        cg.strokeStyle = 'rgba(230,230,230,0.5)'; cg.lineWidth = 2;
        cg.beginPath(); cg.moveTo(0, y0 + 3); cg.lineTo(256, y1 + 3); cg.stroke();
      }
    })();
    const crease = dataTex(creaseC);
    const papers = ITEMS.map((it, n) => {
      const W = Math.round(it.w * PX_PER_M), H = Math.round(it.h * PX_PER_M);
      const c = document.createElement('canvas');
      c.width = W; c.height = H;
      DRAW[it.id](c.getContext('2d'), W, H);
      const map = canvasTex(c);

      const geo = it.round ? new THREE.CircleGeometry(it.w / 2, 64) : new THREE.PlaneGeometry(it.w, it.h, 20, 14);
      const pos = geo.attributes.position;
      for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i), y = pos.getY(i);
        const d2 = (x - it.pin[0]) * (x - it.pin[0]) + (y - it.pin[1]) * (y - it.pin[1]);
        pos.setZ(i, 0.0026 + n * 0.0002 + 0.6 * d2 + 0.0011 * Math.sin(x * 58 + n * 2.1) * Math.cos(y * 44 + n) + 0.0006 * Math.sin((x + y) * 130 + n));
      }
      geo.computeVertexNormals();

      const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({
        map, bumpMap: crease, bumpScale: 0.0007, roughness: it.id === 'photo' ? 0.45 : 0.82, metalness: 0, envMapIntensity: 0.28, side: THREE.DoubleSide,
        emissive: 0xFFFFFF, emissiveMap: map, emissiveIntensity: 0.035
      }));
      mesh.rotation.z = it.rot * DEG;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      scene.add(mesh);

      return { it, mesh, map, canvas: c, pinWorld: new THREE.Vector3(), x: 0, y: 0, z0: 0, k: 1 };
    });
    const OFF_Z = WALL_Z + 0.0008;                    // la surface du mur
    let layout = function (portrait) {
      papers.forEach(p => {
        const it = p.it, c = portrait && it.posP ? it.posP : it.pos;
        const r = it.rot * DEG, cr = Math.cos(r), sr = Math.sin(r);
        const k = p.k = portrait ? 1 : 1.22;          // en paysage il y a la place d'agrandir les papiers
        p.x = c[0]; p.y = c[1]; p.z0 = OFF_Z;
        p.mesh.position.set(p.x, p.y, p.z0);
        p.mesh.scale.setScalar(k);
        p.pinWorld.set(p.x + k * (it.pin[0] * cr - it.pin[1] * sr), p.y + k * (it.pin[0] * sr + it.pin[1] * cr), OFF_Z - 0.008);
      });
    };

    /* --- Les fléchettes : pointe à l'origine, corps vers +Z, elles volent vers -Z --- */
    const alongZ = (geo, z) => { geo.rotateX(Math.PI / 2); geo.translate(0, 0, z); return geo; };
    const lathe = (pts, z) => alongZ(new THREE.LatheGeometry(pts.map(p => new THREE.Vector2(p[0], p[1])), 36), z);

    const pointGeo = lathe([[0.00008, 0], [0.0005, 0.010], [0.0010, 0.026], [0.00115, 0.034]], 0);
    const barrelGeo = lathe([[0.00115, 0], [0.0021, 0.002], [0.0030, 0.007], [0.0035, 0.014], [0.0037, 0.024], [0.0037, 0.036],
      [0.0035, 0.044], [0.0030, 0.049], [0.0024, 0.052]], 0.034);
    // gravure du fût : fines rainures et deux bagues anodisées, en texture et en relief
    const gripC = document.createElement('canvas'); gripC.width = 8; gripC.height = 512;
    const gripB = document.createElement('canvas'); gripB.width = 8; gripB.height = 512;
    const gc = gripC.getContext('2d'), gb = gripB.getContext('2d');
    gc.fillStyle = '#B9BAC2'; gc.fillRect(0, 0, 8, 512);
    gb.fillStyle = '#B0B0B0'; gb.fillRect(0, 0, 8, 512);
    for (let y = 90; y < 400; y += 9) {
      if ((y > 170 && y < 200) || (y > 300 && y < 330)) continue;
      gc.fillStyle = '#4C4D55'; gc.fillRect(0, y, 8, 4);
      gb.fillStyle = '#202020'; gb.fillRect(0, y, 8, 4);
    }
    const gripMap = canvasTex(gripC), gripBump = dataTex(gripB);

    const shaftGeo = lathe([[0.0024, 0], [0.0026, 0.002], [0.0021, 0.006], [0.0018, 0.03], [0.0016, 0.05], [0.0019, 0.052], [0.0012, 0.056], [0.0009, 0.084]], 0.086);
    const finShape = new THREE.Shape();
    finShape.moveTo(0.0009, 0.118);
    finShape.quadraticCurveTo(0.010, 0.124, 0.0185, 0.137);
    finShape.lineTo(0.0205, 0.158);
    finShape.quadraticCurveTo(0.0195, 0.166, 0.0150, 0.168);
    finShape.lineTo(0.0009, 0.162);
    finShape.closePath();
    const finGeos = [0, 1].map(tone => [0, 2].map(q => {
      const geo = new THREE.ShapeGeometry(finShape, 10);
      geo.rotateX(Math.PI / 2);
      geo.rotateZ((45 + (q + tone) * 90) * DEG);
      return geo;
    }));
    const ribC = document.createElement('canvas'); ribC.width = ribC.height = 64;
    const ribB = document.createElement('canvas'); ribB.width = ribB.height = 64;
    const rg = ribC.getContext('2d'), rb = ribB.getContext('2d');
    rg.fillStyle = '#FFFFFF'; rg.fillRect(0, 0, 64, 64);
    rb.fillStyle = '#909090'; rb.fillRect(0, 0, 64, 64);
    for (let x = 0; x < 64; x += 8) {
      rg.fillStyle = 'rgba(0,0,0,0.16)'; rg.fillRect(x, 0, 3, 64);
      rb.fillStyle = '#303030'; rb.fillRect(x, 0, 3, 64);
    }
    const ribs = canvasTex(ribC, [70, 70]), ribsBump = dataTex(ribB, [70, 70]);

    const pointMat = new THREE.MeshStandardMaterial({ color: 0x8E8F97, metalness: 1, roughness: 0.22, envMapIntensity: 2.2 });
    const tungsten = new THREE.MeshStandardMaterial({ map: gripMap, bumpMap: gripBump, bumpScale: 0.0006, metalness: 1, roughness: 0.3, envMapIntensity: 2.2 });

    const shadowOnly = new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false });
    function makeDart(colors) {
      const d = new THREE.Group();
      // avant (pointe, fût) et arrière (tige, ailettes) sont séparés : une fois la fléchette
      // plantée, l'arrière dépasse vers la caméra et sort de la zone de netteté
      const front = new THREE.Group(), rear = new THREE.Group(), proxy = new THREE.Group();
      front.add(new THREE.Mesh(pointGeo, pointMat));
      front.add(new THREE.Mesh(barrelGeo, tungsten));
      rear.add(new THREE.Mesh(shaftGeo, new THREE.MeshStandardMaterial({ color: colors[1], metalness: 0.8, roughness: 0.28, envMapIntensity: 1.8 })));
      proxy.add(new THREE.Mesh(shaftGeo, shadowOnly));
      colors.forEach((color, tone) => {
        // plastique brillant : couleur dense, vernis en surface, nervures en relief
        const mat = new THREE.MeshPhysicalMaterial({
          color: new THREE.Color(color).multiplyScalar(0.6), map: ribs, bumpMap: ribsBump, bumpScale: 0.0005,
          roughness: 0.42, metalness: 0, clearcoat: 0.8, clearcoatRoughness: 0.25, side: THREE.DoubleSide,
          emissive: color, emissiveIntensity: 0.24, envMapIntensity: 0.3
        });
        finGeos[tone].forEach(geo => { rear.add(new THREE.Mesh(geo, mat)); proxy.add(new THREE.Mesh(geo, shadowOnly)); });
      });
      // l'arrière flouté est rendu à part : ces doublures invisibles gardent son ombre dans la scène
      d.add(front, rear, proxy);
      d.traverse(o => { if (o.isMesh) o.castShadow = true; });
      d.userData.front = front;
      d.userData.rear = rear;
      d.scale.setScalar(1.25);   // un peu plus grande que nature : c'est l'accessoire vedette
      scene.add(d);
      return d;
    }
    const darts = papers.map(p => makeDart(p.it.fins));

    /* --- La pluie de fléchettes : celles qui n'ont rien cloué du tout ---
       Plantées n'importe où dans l'enduit, dans tous les sens, chacune avec son éclat de plâtre. */
    const STRAY_FINS = [[0xEDEDED, 0x1C1C1C], [0xD63A2F, 0xF0F0F0], [0x1FA3A0, 0x0E5E5C], [0x1C1C1C, 0x555555], [0xEDEDED, 0xD63A2F], [0x2E8B57, 0xEDEDED]];
    const chipMaps = [1, 2, 3].map(n => canvasTex(chipTexture(300 + n)));
    const strays = [];
    for (let i = 0; i < (mobile ? 10 : 16); i++) {
      const chip = new THREE.Mesh(new THREE.PlaneGeometry(0.062, 0.062), new THREE.MeshStandardMaterial({
        map: chipMaps[i % 3], transparent: true, depthWrite: false, roughness: 1, envMapIntensity: 0.2
      }));
      chip.receiveShadow = true;
      chip.rotation.z = i * 2.4;
      scene.add(chip);
      strays.push({ dart: makeDart(STRAY_FINS[i % STRAY_FINS.length]), chip, pinWorld: new THREE.Vector3(), aim: [0, 0] });
    }
    // une fléchette qui a fini sur la tablette
    const fallen = makeDart(STRAY_FINS[1]);
    fallen.position.set(0.50, 0.012, WALL_Z + 0.05);
    fallen.rotation.set(0.06, Math.PI / 2 - 0.3, 0);
    ledge.add(fallen);

    const baseLayout = layout;
    layout = function (portrait) {
      baseLayout(portrait);
      ledge.position.y = portrait ? -0.60 : -0.325;
      // positions tirées au sort, toujours les mêmes, en évitant la cible et les papiers
      const rnd = mulberry32(portrait ? 2027 : 612);
      const X = portrait ? 0.29 : 0.62, Y0 = portrait ? -0.55 : -0.29, Y1 = portrait ? 0.57 : 0.40;
      const taken = [];
      const onPaper = (x, y, m) => papers.some(p => Math.abs(x - p.x) < p.k * p.it.w / 2 + m && Math.abs(y - p.y) < p.k * p.it.h / 2 + m);
      strays.forEach(s => {
        let x = 0, y = 0, pitch = 0, yaw = 0;
        for (let tries = 0; tries < 200; tries++) {
          x = (rnd() * 2 - 1) * X; y = Y0 + rnd() * (Y1 - Y0);
          // la plupart piquent du nez, quelques-unes pendent presque à la verticale
          pitch = rnd() < 0.2 ? -(52 + rnd() * 16) : -(8 + rnd() * 32);
          yaw = (rnd() * 2 - 1) * 44;
          // où la queue se projette sur le mur, vue de face
          const L = 0.24, tx = x - L * Math.sin(yaw * DEG) * Math.cos(pitch * DEG), ty = y - L * Math.sin(pitch * DEG);
          const mx = (x + tx) / 2, my = (y + ty) / 2;
          if (Math.min(Math.hypot(x, y), Math.hypot(tx, ty), Math.hypot(mx, my)) < BOARD_R + 0.03) continue;
          if (onPaper(x, y, 0.03) || onPaper(tx, ty, 0.03) || onPaper(mx, my, 0.03)) continue;
          if (taken.some(t => Math.hypot(x - t[0], y - t[1]) < 0.075)) continue;
          break;
        }
        taken.push([x, y]);
        s.pinWorld.set(x, y, OFF_Z - 0.008);
        s.chip.position.set(x, y, OFF_Z + 0.0004);
        s.aim = [pitch, yaw];
      });
    };
    layout(false);



    /* --- Rendu façon photo ---
       Flou de profondeur : ce qui est proche de la caméra (calque 1) est rendu à part, flouté,
       puis recomposé ; la mise au point reste sur la cible.
       Halo : les hautes lumières bavent un peu, comme sur un capteur. */
    const rtOpts = { minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, format: THREE.RGBAFormat };
    const rtA = new THREE.WebGLRenderTarget(4, 4, Object.assign({ depthBuffer: true }, rtOpts));
    const rtB = new THREE.WebGLRenderTarget(4, 4, Object.assign({ depthBuffer: false }, rtOpts));
    const rtG1 = new THREE.WebGLRenderTarget(4, 4, Object.assign({ depthBuffer: true }, rtOpts));
    const rtG2 = new THREE.WebGLRenderTarget(4, 4, Object.assign({ depthBuffer: false }, rtOpts));
    rtA.texture.encoding = THREE.sRGBEncoding;
    rtG1.texture.encoding = THREE.sRGBEncoding;
    const VERT = 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }';
    const BLUR = [
      'uniform sampler2D tMap; uniform vec2 dir; uniform float gain; varying vec2 vUv;',
      'void main(){',
      '  vec4 c = texture2D(tMap, vUv) * 0.1964825501511404;',
      '  c += (texture2D(tMap, vUv + dir * 1.411764705882353) + texture2D(tMap, vUv - dir * 1.411764705882353)) * 0.2969069646728344;',
      '  c += (texture2D(tMap, vUv + dir * 3.2941176470588234) + texture2D(tMap, vUv - dir * 3.2941176470588234)) * 0.09447039785044732;',
      '  c += (texture2D(tMap, vUv + dir * 5.176470588235294) + texture2D(tMap, vUv - dir * 5.176470588235294)) * 0.010381362401148057;',
      '  gl_FragColor = c * gain;',
      '}'
    ].join('\n');
    const BRIGHT = [
      'uniform sampler2D tMap; uniform float thr; varying vec2 vUv;',
      'void main(){',
      '  vec4 c = texture2D(tMap, vUv);',
      '  float l = max(c.r, max(c.g, c.b));',
      '  gl_FragColor = vec4(c.rgb * smoothstep(thr, 1.0, l), 1.0);',
      '}'
    ].join('\n');
    const pass = (fragmentShader, extra) => new THREE.ShaderMaterial(Object.assign({
      uniforms: { tMap: { value: null }, dir: { value: new THREE.Vector2() }, gain: { value: 1 }, thr: { value: 0.9 } },
      vertexShader: VERT, fragmentShader, depthTest: false, depthWrite: false, blending: THREE.NoBlending
    }, extra));
    const blurMat = pass(BLUR);
    const brightMat = pass(BRIGHT);
    const overMat = pass(BLUR, {            // recomposition du premier plan flouté (alpha prémultiplié)
      transparent: true, blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor,
      blendSrcAlpha: THREE.OneFactor, blendDstAlpha: THREE.OneMinusSrcAlphaFactor
    });
    const addMat = pass(BLUR, { transparent: true, blending: THREE.AdditiveBlending });
    const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), blurMat);
    quad.frustumCulled = false;
    const quadScene = new THREE.Scene();
    quadScene.add(quad);
    const quadCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const size = new THREE.Vector2();

    function resize(w, h) {
      renderer.setSize(w, h, false);
      renderer.getDrawingBufferSize(size);
      rtA.setSize(Math.max(2, Math.round(size.x / 2)), Math.max(2, Math.round(size.y / 2)));
      rtB.setSize(rtA.width, rtA.height);
      rtG1.setSize(Math.max(2, Math.round(size.x / 4)), Math.max(2, Math.round(size.y / 4)));
      rtG2.setSize(rtG1.width, rtG1.height);
    }
    function fullscreen(material, source, target, dx, dy, gain) {
      quad.material = material;
      material.uniforms.tMap.value = source.texture;
      material.uniforms.dir.value.set(dx, dy);
      material.uniforms.gain.value = gain === undefined ? 1 : gain;
      renderer.setRenderTarget(target);
      if (target === null) renderer.autoClear = false;
      renderer.render(quadScene, quadCam);
      renderer.autoClear = true;
    }

    /* Rendu d'une image. blurPx > 0 : les objets du calque 1 sont floutés d'autant (en pixels CSS). */
    function render(blurPx) {
      camera.layers.set(0);
      renderer.setRenderTarget(null);
      renderer.render(scene, camera);
      renderer.shadowMap.autoUpdate = false;

      if (blurPx > 0) {
        camera.layers.set(1);
        renderer.setRenderTarget(rtA);
        renderer.render(scene, camera);
        const s = blurPx * dpr / 2 / 3.2;
        fullscreen(blurMat, rtA, rtB, s / rtA.width, 0);
        fullscreen(overMat, rtB, null, 0, s / rtA.height);
      }

      camera.layers.enableAll();
      renderer.setRenderTarget(rtG1);
      renderer.render(scene, camera);
      const gx = 1.1 / rtG1.width, gy = 1.1 / rtG1.height;
      fullscreen(brightMat, rtG1, rtG2, 0, 0);
      fullscreen(blurMat, rtG2, rtG1, gx, 0);
      fullscreen(blurMat, rtG1, rtG2, 0, gy);
      fullscreen(blurMat, rtG2, rtG1, gx * 2.4, 0);
      fullscreen(addMat, rtG1, null, 0, gy * 2.4, 0.3);

      renderer.shadowMap.autoUpdate = true;
      camera.layers.set(0);
    }

    return { THREE, renderer, scene, camera, canvas, papers, darts, strays, render, resize, layout: p => layout(p), makeDart, offZ: OFF_Z };

  }

  /* ---------- Mise en scène ---------- */
  function start(S) {
    const { THREE, camera, canvas, papers, darts } = S;
    const V = (x, y, z) => new THREE.Vector3(x, y, z);
    const FWD = V(0, 0, -1), UP = V(0, 1, 0);
    const skip = document.querySelector('.skip-intro');
    const reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const clamp01 = x => Math.max(0, Math.min(1, x));
    const smooth = x => { x = clamp01(x); return x * x * (3 - 2 * x); };
    const easeInOut = x => x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2;
    const easeOut = (x, p) => 1 - Math.pow(1 - x, p);
    const dirFrom = (pitch, yaw, out) => out.set(Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), -Math.cos(yaw) * Math.cos(pitch));
    const buzz = ms => { try { if (navigator.vibrate) navigator.vibrate(ms); } catch (e) { /* pas de vibreur */ } };

    // Netteté d'une fléchette : 'sharp' tout net, 'blur' tout flou (elle passe près de la caméra),
    // 'planted' l'avant net et l'arrière légèrement flou (il dépasse vers la caméra)
    const DOF_PLANTED = 0.9;
    function setDepth(d, mode) {
      d.userData.front.traverse(o => o.layers.set(mode === 'blur' ? 1 : 0));
      d.userData.rear.traverse(o => o.layers.set(mode === 'sharp' ? 0 : 1));
    }

    const isPortrait = () => { const r = hero.getBoundingClientRect(); return r.width / r.height < 0.8; };
    S.layout(isPortrait());
    // toutes les fléchettes de LeBouseuh : d'abord celles qui clouent un papier, puis les autres
    const strays = S.strays;
    const allDarts = darts.concat(strays.map(st => st.dart));
    const N = allDarts.length, NP = papers.length;
    const ends = papers.map(p => p.pinWorld).concat(strays.map(st => st.pinWorld));
    const dirEnds = allDarts.map(() => V());
    function refreshAims() {
      papers.forEach((p, i) => dirFrom(p.it.aim[0] * DEG, p.it.aim[1] * DEG, dirEnds[i]));
      strays.forEach((st, j) => dirFrom(st.aim[0] * DEG, st.aim[1] * DEG, dirEnds[NP + j]));
    }
    refreshAims();

    const tA = V(), tB = V();
    function pathPos(from, to, arc, e, out) {
      out.lerpVectors(from, to, e);
      out.y += arc * 4 * e * (1 - e);
      return out;
    }
    function pathDir(from, to, arc, e, out) {
      const d = 0.002;
      pathPos(from, to, arc, Math.min(1, e + d), tA);
      pathPos(from, to, arc, Math.max(0, e - d), tB);
      return out.subVectors(tA, tB).normalize();
    }
    const tip = V(), dir = V(), tmp = V(), corner = V();
    function setDart(d, tipPos, direction, pitchExtra, yawExtra, roll) {
      d.position.copy(tipPos);
      d.quaternion.setFromUnitVectors(FWD, direction);
      if (pitchExtra) d.rotateX(pitchExtra);
      if (yawExtra) d.rotateY(yawExtra);
      if (roll) d.rotateZ(roll);
      d.updateMatrixWorld(true);
    }

    /* --- Cadrage au repos ---
       La cible 3D se superpose à son emplacement dans la page. La caméra se décale un peu
       avec le pointeur en continuant de viser le même point : le relief se voit, le cadrage tient. */
    const FOV_END = 34;
    const base = V(), aimAt = V();
    const camEnd = { pos: V(), quat: new THREE.Quaternion() };
    const REST = { x: 0.2, y: 0.2 };
    const par = { x: REST.x, y: REST.y, tx: REST.x, ty: REST.y };
    const m4 = new THREE.Matrix4();
    const view = { w: 1, h: 1 };
    function poseAt(px, py, pos, quat) {
      pos.set(base.x - px * 0.065, base.y + py * 0.042, base.z);
      m4.lookAt(pos, aimAt, UP);
      quat.setFromRotationMatrix(m4);
    }
    function fit() {
      const hr = hero.getBoundingClientRect(), wr = wrap.getBoundingClientRect();
      view.w = hr.width; view.h = hr.height;
      S.layout(hr.width / hr.height < 0.8);
      refreshAims();
      S.resize(hr.width, hr.height);
      camera.aspect = hr.width / hr.height;
      const wpp = 2 * BOARD_R / wr.width;
      const cx = wr.left - hr.left + wr.width / 2, cy = wr.top - hr.top + wr.height / 2;
      const d = 2 * BOARD_R * hr.height / (2 * Math.tan(FOV_END * DEG / 2) * wr.width);
      base.set(-(cx - hr.width / 2) * wpp, (cy - hr.height / 2) * wpp, d);
      aimAt.set(base.x, base.y, 0);
      poseAt(REST.x, REST.y, camEnd.pos, camEnd.quat);
    }

    /* --- Un lien par papier, calé sur sa projection à l'écran --- */
    const nav = document.createElement('nav');
    nav.className = 'hotspots';
    nav.setAttribute('aria-label', 'Accès aux sections depuis le tableau');
    const lifts = papers.map(() => ({ v: 0, t: 0 }));
    const links = papers.map((p, i) => {
      const a = document.createElement('a');
      a.className = 'hotspot';
      a.href = p.it.href;
      a.setAttribute('aria-label', p.it.label);
      const hover = on => { lifts[i].t = on ? 1 : 0; requestTick(); };
      a.addEventListener('pointerenter', e => { if (e.pointerType !== 'touch') hover(true); });
      a.addEventListener('pointerleave', () => hover(false));
      a.addEventListener('focus', () => hover(true));
      a.addEventListener('blur', () => hover(false));
      a.addEventListener('click', e => { e.preventDefault(); openSection(i); });
      nav.appendChild(a);
      return a;
    });
    hero.appendChild(nav);
    function placeLinks() {
      papers.forEach((p, i) => {
        // position de repos du papier : la zone cliquable ne suit pas le soulèvement du survol
        const r = p.it.rot * DEG, cr = Math.cos(r), sr = Math.sin(r);
        let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
        [[-1, -1], [1, -1], [1, 1], [-1, 1]].forEach(c => {
          const lx = c[0] * p.k * p.it.w / 2, ly = c[1] * p.k * p.it.h / 2;
          corner.set(p.x + lx * cr - ly * sr, p.y + lx * sr + ly * cr, p.z0 + 0.004).project(camera);
          const x = (corner.x * 0.5 + 0.5) * view.w, y = (-corner.y * 0.5 + 0.5) * view.h;
          x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y);
        });
        const s = links[i].style;
        s.left = x0 + 'px'; s.top = y0 + 'px'; s.width = (x1 - x0) + 'px'; s.height = (y1 - y0) + 'px';
      });
    }
    // survol : le papier se décolle du bois
    function setLift(p, v) {
      p.mesh.position.z = p.z0 + v * 0.013;
      p.mesh.rotation.x = -v * 0.07;
      p.mesh.material.emissiveIntensity = 0.035 + v * 0.1;
    }

    /* --- Étiquette qui jaillit à un point de la scène : le score d'un lancer, ou « Raté ! » --- */
    function popLabel(world, big, small, cls) {
      corner.copy(world).project(camera);
      const el = document.createElement('span');
      el.className = 'hit-label' + (cls ? ' ' + cls : '');
      el.style.left = ((corner.x * 0.5 + 0.5) * view.w) + 'px';
      el.style.top = ((-corner.y * 0.5 + 0.5) * view.h) + 'px';
      const b = document.createElement('strong');
      b.textContent = big;
      el.appendChild(b);
      if (small) el.appendChild(document.createTextNode(small));
      hero.appendChild(el);
      setTimeout(() => el.remove(), 1700);
    }

    function applyRest() {
      allDarts.forEach((d, i) => { d.visible = true; setDepth(d, 'planted'); setDart(d, ends[i], dirEnds[i]); });
      strays.forEach(st => { st.chip.visible = true; });
      papers.forEach((p, i) => {
        p.mesh.visible = true;
        p.mesh.scale.setScalar(p.k);
        p.mesh.rotation.z = p.it.rot * DEG;
        setLift(p, lifts[i].v);
      });
      canvas.style.filter = '';
    }
    let restBlur = DOF_PLANTED;
    function drawRest() {
      poseAt(par.x, par.y, camera.position, camera.quaternion);
      camera.fov = FOV_END;
      camera.updateProjectionMatrix();
      camera.updateMatrixWorld(true);
      S.render(restBlur);
      placeLinks();
    }

    /* --- Boucle au repos : ne tourne que lorsqu'il y a quelque chose à animer --- */
    let over = !root.classList.contains('intro');
    let raf = 0, ticking = false, zoom = null, heroVisible = true;
    function requestTick() {
      if (ticking || !over) return;
      ticking = true;
      requestAnimationFrame(tick);
    }
    function tick(now) {
      ticking = false;
      if (!over) return;
      let moving = false;
      lifts.forEach((l, i) => {
        const d = l.t - l.v;
        if (Math.abs(d) > 0.004) { l.v += d * 0.24; moving = true; } else l.v = l.t;
        setLift(papers[i], l.v);
      });
      if (stepThrows(now)) moving = true;
      if (zoom) {
        if (zoom.t0 === null) zoom.t0 = now;
        const k = clamp01((now - zoom.t0) / zoom.dur);
        const e = zoom.ease(k);
        if (zoom.veilAt !== undefined && k >= zoom.veilAt) veil.classList.add('on');
        camera.position.lerpVectors(zoom.p0, zoom.p1, e);
        camera.quaternion.copy(zoom.q0).slerp(zoom.q1, e);
        camera.fov = FOV_END;
        camera.updateProjectionMatrix();
        camera.updateMatrixWorld(true);
        S.render(DOF_PLANTED);
        if (k >= 1) {
          const done = zoom.done;
          zoom = null;
          if (done) done();
        }
        requestTick();
        return;
      }
      const dx = par.tx - par.x, dy = par.ty - par.y;
      if (Math.abs(dx) + Math.abs(dy) > 0.003) { par.x += dx * 0.1; par.y += dy * 0.1; moving = true; }
      drawRest();
      if (moving) requestTick();
    }

    window.addEventListener('pointermove', e => {
      if (!over || zoom || !heroVisible || e.pointerType === 'touch') return;
      par.tx = REST.x + ((e.clientX / window.innerWidth) * 2 - 1) * 0.6;
      par.ty = REST.y + ((e.clientY / window.innerHeight) * 2 - 1) * 0.5;
      requestTick();
    }, { passive: true });
    document.documentElement.addEventListener('pointerleave', () => { par.tx = REST.x; par.ty = REST.y; requestTick(); });
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(es => { heroVisible = es[0].isIntersecting; }, { threshold: 0.05 }).observe(hero);
    }
    window.addEventListener('resize', () => { fit(); if (over) { applyRest(); drawRest(); } });

    /* --- Ouvrir une section : la caméra plonge dans le papier, puis on est sur son contenu --- */
    const veil = document.createElement('div');
    veil.className = 'veil';
    veil.setAttribute('aria-hidden', 'true');
    document.body.appendChild(veil);
    const topbarH = () => parseFloat(getComputedStyle(root).getPropertyValue('--topbar-h')) || 62;
    function jumpTo(y) {
      try { window.scrollTo({ top: y, behavior: 'instant' }); } catch (e) { window.scrollTo(0, y); }
    }
    function openSection(i) {
      const paper = papers[i], it = paper.it;
      const otherPage = it.href.charAt(0) !== '#';
      const target = otherPage ? null : document.querySelector(it.href);
      if (!otherPage && !target) return;
      const land = () => {
        if (otherPage) { window.location.href = it.href; return; }
        jumpTo(target.getBoundingClientRect().top + window.scrollY - topbarH());
        try { history.pushState(null, '', it.href); } catch (e) { /* cadre isolé : pas d'historique */ }
        if (target.focus) { target.setAttribute('tabindex', '-1'); target.focus({ preventScroll: true }); }
      };
      if (!over || reduced || zoom) { land(); return; }
      const dist = Math.max(0.2, (paper.k * Math.max(it.h, it.w * view.h / view.w) / 0.5) / (2 * Math.tan(FOV_END * DEG / 2)));
      zoom = {
        t0: null, dur: 560, veilAt: 0.4, ease: x => x * x * (1.6 - 0.6 * x),
        p0: camera.position.clone(), q0: camera.quaternion.clone(),
        p1: V(paper.x, paper.y, paper.z0 + dist), q1: new THREE.Quaternion(),
        done: () => {
          land();
          if (otherPage) return;                       // le voile reste jusqu'au changement de page
          lifts.forEach(l => { l.v = 0; l.t = 0; });
          par.x = par.tx = REST.x; par.y = par.ty = REST.y;
          applyRest();
          drawRest();
          veil.classList.remove('on');
        }
      };
      requestTick();
    }

    /* --- Bouton du son --- */
    const soundBtn = document.createElement('button');
    soundBtn.type = 'button';
    soundBtn.className = 'sound-toggle';
    function paintSound() {
      const on = !Sound.isMuted();
      soundBtn.setAttribute('aria-pressed', String(on));
      soundBtn.textContent = on ? 'Son activé' : 'Son coupé';
    }
    soundBtn.addEventListener('click', () => { Sound.setMuted(!Sound.isMuted()); paintSound(); if (!Sound.isMuted()) Sound.thunk(false, 0.6); });
    paintSound();
    hero.appendChild(soundBtn);
    // un navigateur ne joue du son qu'après un geste : le premier contact avec la page l'active
    const unlockOnce = () => { Sound.unlock(); window.removeEventListener('pointerdown', unlockOnce); window.removeEventListener('keydown', unlockOnce); };
    window.addEventListener('pointerdown', unlockOnce);
    window.addEventListener('keydown', unlockOnce);

    /* --- Les lancers du visiteur (le jeu lui-même est dans game.js) --- */
    const SHOT = 380;                              // durée de vol, en millisecondes
    const shots = [];
    let playerDarts = null;
    function scoreAt(x, y) {
      const r = Math.hypot(x, y);
      if (r > BOARD_R) return { label: 'Dans le bois', pts: 0, onBoard: false };
      if (r <= DIM.bullI) return { label: 'Bull', pts: 50, onBoard: true };
      if (r <= DIM.bullO) return { label: '25', pts: 25, onBoard: true };
      if (r > DIM.dOut) return { label: 'Hors zone', pts: 0, onBoard: true };
      let a = Math.atan2(x, y) / DEG;
      if (a < 0) a += 360;
      const n = NUMBERS[Math.round(a / 18) % 20];
      if (r >= DIM.tIn && r <= DIM.tOut) return { label: 'Triple ' + n, pts: 3 * n, onBoard: true };
      if (r >= DIM.dIn) return { label: 'Double ' + n, pts: 2 * n, onBoard: true };
      return { label: 'Simple ' + n, pts: n, onBoard: true };
    }
    function stepThrows(now) {
      let active = false;
      restBlur = DOF_PLANTED;
      shots.forEach(sh => {
        if (sh.t0 === null) sh.t0 = now;
        const el = now - sh.t0;
        if (el < SHOT) {
          const u = el / SHOT, e = Math.pow(u, 1.2);
          pathPos(sh.from, sh.to, 0.03, e, tip);
          pathDir(sh.from, sh.to, 0.03, e, dir);
          dir.lerp(sh.dirEnd, smooth((u - 0.35) / 0.65)).normalize();
          setDart(sh.dart, tip, dir, 2.5 * DEG * Math.sin(TAU * 2.4 * u) * (1 - u), 0, TAU * easeOut(u, 2));
          const near = u < 0.4;
          setDepth(sh.dart, near ? 'blur' : 'planted');
          if (near) restBlur = Math.max(restBlur, 5 * (1 - u / 0.4) + DOF_PLANTED);
          active = true;
          return;
        }
        if (!sh.hit) {
          sh.hit = true;
          Sound.thunk(!sh.sc.onBoard, 0.9);
          buzz(14);
          popLabel(sh.to, sh.sc.pts ? String(sh.sc.pts) : 'Raté', sh.sc.label);
          document.dispatchEvent(new CustomEvent('fc:hit', { detail: { pts: sh.sc.pts, label: sh.sc.label, onBoard: sh.sc.onBoard } }));
        }
        const th = (el - SHOT) / 1000;
        const vib = th < 1 ? Math.exp(-th / 0.2) * Math.sin(TAU * 11 * th) : 0;
        setDepth(sh.dart, 'planted');
        setDart(sh.dart, sh.to, sh.dirEnd, 5.5 * DEG * vib, 2.2 * DEG * vib);
        if (th < 1) active = true;
      });
      return active;
    }
    function clearShots() {
      shots.forEach(s => { s.dart.visible = false; });
      shots.length = 0;
      requestTick();
    }
    // Lance une fléchette vers un point de l'écran. Renvoie false si le lancer est impossible.
    function throwAtClient(clientX, clientY) {
      if (!over || zoom) return false;
      const hr = hero.getBoundingClientRect();
      tmp.set(((clientX - hr.left) / hr.width) * 2 - 1, -(((clientY - hr.top) / hr.height) * 2 - 1), 0.5)
        .unproject(camera).sub(camera.position).normalize();
      if (tmp.z > -0.05) return false;
      const k = -camera.position.z / tmp.z;
      const x = camera.position.x + tmp.x * k, y = camera.position.y + tmp.y * k;
      if (!playerDarts) {
        playerDarts = [0, 1, 2].map(() => { const d = S.makeDart([0xE8FFC4, 0xB7F277]); d.visible = false; return d; });
      }
      if (shots.length === 3) clearShots();
      const sc = scoreAt(x, y);
      const dart = playerDarts[shots.length];
      dart.visible = true;
      setDepth(dart, 'blur');
      const from = V(0.09 + Math.random() * 0.07, -0.17, 0.15).add(camera.position);
      setDart(dart, from, FWD);
      shots.push({
        dart, t0: null, hit: false, sc, from,
        to: V(x, y, (sc.onBoard ? 0 : S.offZ) - 0.008),
        dirEnd: dirFrom((-13 - Math.random() * 9) * DEG, (Math.random() * 30 - 15) * DEG, V())
      });
      Sound.unlock();
      Sound.whoosh(SHOT / 1000, 0.8);
      requestTick();
      return true;
    }

    // retour arrière depuis une autre page : le navigateur peut ressortir celle-ci telle qu'on l'a quittée
    window.addEventListener('pageshow', e => {
      if (!e.persisted || !over) return;
      zoom = null;
      veil.classList.remove('on');
      applyRest();
      drawRest();
    });

    /* --- Ce que le reste de la page peut demander à la cible --- */
    const api = window.FCBoard = {
      ready: false,
      misses: N,                       // le nombre de fléchettes que LeBouseuh a mises à côté
      throwAt: throwAtClient,
      clearShots,
      // la zone de jeu à l'écran, et l'échelle de la cible (pixels par mètre)
      rect: () => wrap.getBoundingClientRect(),
      scale: () => wrap.getBoundingClientRect().width / (2 * BOARD_R),
      // retour à la cible depuis le reste de la page : on recule depuis tout près
      returnHome() {
        if (!over || reduced) { jumpTo(0); return; }
        veil.classList.add('on');
        setTimeout(() => {
          jumpTo(0);
          applyRest();
          poseAt(REST.x, REST.y, camEnd.pos, camEnd.quat);
          zoom = {
            t0: null, dur: 900, ease: x => easeOut(x, 3),
            p0: V(aimAt.x, aimAt.y, base.z * 0.42), q0: new THREE.Quaternion(),
            p1: camEnd.pos.clone(), q1: camEnd.quat.clone(),
            done: () => { par.x = par.tx = REST.x; par.y = par.ty = REST.y; drawRest(); }
          };
          veil.classList.remove('on');
          requestTick();
        }, 240);
      }
    };
    function announceReady() {
      if (api.ready) return;
      api.ready = true;
      document.dispatchEvent(new CustomEvent('fc:ready'));
    }

    root.classList.add('gl');      // la classe change la taille de la cible : on mesure après
    fit();

    // La photo des vainqueurs arrive dans le polaroid dès qu'elle est chargée
    const photo = papers.find(p => p.it.id === 'photo');
    if (photo) {
      const img = new Image();
      img.onload = () => {
        try {
          const probe = document.createElement('canvas');
          probe.width = probe.height = 2;
          const pg = probe.getContext('2d');
          pg.drawImage(img, 0, 0, 2, 2);
          pg.getImageData(0, 0, 1, 1);
        } catch (e) { return; }
        DRAW.photo(photo.canvas.getContext('2d'), photo.canvas.width, photo.canvas.height, img);
        photo.map.needsUpdate = true;
        if (over) requestTick();
      };
      img.src = 'assets/vainqueurs-edition-1.jpg';
    }

    if (over) { applyRest(); drawRest(); announceReady(); return; }

    /* --- Intro : LeBouseuh ouvre le bal ---
       Un montage en champ-contrechamp. Côté LeBouseuh, les vrais plans du teaser de l'édition 1 :
       il vise, il lance, il s'énerve, il relance. Côté mur, notre scène : à chaque fois les
       fléchettes arrivent à côté de la cible, certaines en clouant un élément du site.
       Puis la caméra s'approche de la cible, restée vide : c'est au visiteur de jouer.
       Si le film ne peut pas être lu, on enchaîne simplement les plans du mur. */
    const portrait = isPortrait();
    const WIDE_Z = portrait ? 3.5 : 2.6;
    const FOV_WIDE = 40;
    const camA = { pos: V(portrait ? 0.10 : 0.30, 0.10, WIDE_Z), quat: new THREE.Quaternion() };
    const camB = { pos: V(portrait ? 0.06 : 0.18, 0.07, WIDE_Z * 0.82), quat: new THREE.Quaternion() };
    const lookWide = V(0, portrait ? 0.02 : 0.14, 0), lookNear = V(0, 0.04, 0);
    m4.lookAt(camA.pos, lookWide, UP); camA.quat.setFromRotationMatrix(m4);
    m4.lookAt(camB.pos, lookNear, UP); camB.quat.setFromRotationMatrix(m4);

    const FLIGHT = 480, BACK = 1250;
    // l'ordre des lancers : une fléchette qui cloue un papier, puis deux qui ne clouent rien, et ainsi de suite
    const order = [];
    (function () {
      let pi = 0, si = NP;
      while (pi < NP || si < N) {
        if (pi < NP) order.push(pi++);
        for (let k = 0; k < 2 && si < N; k++) order.push(si++);
      }
    })();
    // trois salves, une après chaque plan de lancer ; dans une salve le rythme est irrégulier : il s'acharne
    const cutA = Math.round(N * 0.22), cutB = Math.round(N * 0.52);
    const salvos = [order.slice(0, cutA), order.slice(cutA, cutB), order.slice(cutB)];
    const launch = new Array(N), hits = new Array(N), salvoStart = [], salvoEnd = [];
    (function () {
      const rnd = mulberry32(1612);
      let acc = 300;
      salvos.forEach((g, k) => {
        salvoStart[k] = acc;
        g.forEach((i, j) => {
          acc += j === 0 ? 0 : 90 + rnd() * 100 + (i < NP ? 40 : 0);
          launch[i] = acc; hits[i] = acc + FLIGHT;
        });
        salvoEnd[k] = acc + FLIGHT + 430;
        acc = salvoEnd[k] + 120;
      });
    })();
    const T_BACK = salvoEnd[2] + 120, T_POSE = T_BACK + BACK - 200, T_END = T_POSE + 450;
    const starts = allDarts.map(() => V());
    const aired = allDarts.map(() => false), landed = allDarts.map(() => false);
    let posed = false, missed = 0;

    // Le déroulé : plan de LeBouseuh (secondes dans le film), puis salve sur le mur
    const steps = [
      { film: [0, 1.96], pos: ['55%', '45%'] },      // il vise, puis il lance
      { salvo: 0 },
      { film: [1.96, 2.96], pos: ['50%'] },          // il relance, rageur
      { salvo: 1 },
      { film: [2.96, 3.80], pos: ['62%'] },          // en contre-plongée, n'importe comment
      { salvo: 2 }
    ];
    let stepIdx = 0, filmDead = false, filmStall = 0, filmLast = -1;
    const saveData = navigator.connection && navigator.connection.saveData;
    const film = document.createElement('video');
    film.className = 'intro-film';
    film.muted = true; film.defaultMuted = true; film.playsInline = true; film.preload = 'auto';
    film.setAttribute('muted', ''); film.setAttribute('playsinline', ''); film.setAttribute('aria-hidden', 'true');
    film.tabIndex = -1;
    film.addEventListener('error', () => { filmDead = true; });
    const filmSrc = !film.canPlayType ? '' :
      film.canPlayType('video/mp4; codecs="avc1.42E01E"') ? 'assets/intro-lebouseuh.mp4' :
      film.canPlayType('video/webm; codecs="vp9"') ? 'assets/intro-lebouseuh.webm' : '';
    if (saveData || !filmSrc) filmDead = true;
    else { film.src = filmSrc; hero.appendChild(film); }

    // le carton de l'intro : qui lance, et où il en est
    const card = document.createElement('div');
    card.className = 'intro-card';
    card.setAttribute('aria-hidden', 'true');
    const cardTag = document.createElement('span'); cardTag.className = 'tag'; cardTag.textContent = 'Au lancer';
    const cardName = document.createElement('b'); cardName.textContent = 'LeBouseuh';
    const cardCount = document.createElement('span'); cardCount.className = 'tag ic-count'; cardCount.textContent = N + ' fléchettes en main';
    card.append(cardTag, cardName, cardCount);
    hero.appendChild(card);

    function end() {
      if (over) return;
      over = true;
      cancelAnimationFrame(raf);
      clearTimeout(window.__introSafety);
      root.classList.remove('intro', 'intro-impact', 'intro-pose');
      ['wheel', 'touchmove', 'keydown'].forEach(ev => window.removeEventListener(ev, onUserSkip));
      card.remove();
      try { film.pause(); } catch (e) { /* rien à arrêter */ }
      film.remove();
      par.x = par.tx = REST.x; par.y = par.ty = REST.y;
      applyRest();
      drawRest();
      announceReady();
    }
    let touchY = null;
    function onUserSkip(e) {
      if (e.type === 'keydown' && e.key !== 'Escape') return;
      if (e.type === 'touchmove') {
        // un doigt qui tremble en touchant l'écran n'est pas un défilement
        const y = e.touches && e.touches[0] ? e.touches[0].clientY : null;
        if (touchY === null || y === null || Math.abs(y - touchY) < 28) return;
      }
      end();
    }
    window.addEventListener('touchstart', e => { touchY = e.touches && e.touches[0] ? e.touches[0].clientY : null; }, { passive: true });
    if (skip) skip.addEventListener('click', end);
    ['wheel', 'touchmove', 'keydown'].forEach(ev => window.addEventListener(ev, onUserSkip, { passive: true }));

    clearTimeout(window.__introSafety);        // la scène est lancée : c'est elle qui termine l'intro
    allDarts.forEach(d => { d.visible = false; });
    strays.forEach(st => { st.chip.visible = false; });
    papers.forEach(p => { p.mesh.visible = false; });

    // L'horloge du mur avance au rythme des images affichées, avec un pas plafonné :
    // sur un appareil lent l'intro ralentit, elle ne saute pas d'un coup à la fin
    let t = 0, lastNow = null, drawn = false;

    /* Un plan du film. Renvoie true tant qu'il occupe l'écran. */
    function playFilm(step, dt) {
      if (filmDead) return false;
      const from = step.film[0], to = step.film[1];
      if (!step.on) {
        step.on = true;
        filmStall = 0; filmLast = -1;
        // les plans se suivent dans le fichier : on reprend simplement la lecture là où elle s'était
        // arrêtée, sans jamais repositionner la vidéo (certains serveurs ne le permettent pas)
        const pr = film.play();
        if (pr && pr.catch) pr.catch(() => { filmDead = true; });
      }
      // le film n'avance pas (lecture automatique refusée, réseau trop lent) : on s'en passe.
      // On compte en temps d'images, plafonné, pour qu'une page momentanément figée ne le condamne pas.
      if (film.currentTime === filmLast) filmStall += dt; else { filmStall = 0; filmLast = film.currentTime; }
      if (filmStall > 2200) filmDead = true;
      if (filmDead || film.currentTime >= to - 0.05) {
        film.pause();
        film.classList.remove('on');
        return false;
      }
      // on ne montre le film qu'une fois entré dans le plan : pas d'image résiduelle du plan précédent
      if (film.currentTime >= from + 0.02) {
        const mid = step.pos.length > 1 && film.currentTime > 1.08 ? step.pos[1] : step.pos[0];
        film.style.objectPosition = mid + ' 50%';
        film.classList.add('on');
      }
      return true;
    }

    function frame(now) {
      if (over) return;
      const dt = lastNow === null ? 0 : Math.min(now - lastNow, 60);
      lastNow = now;

      /* Où en est-on du déroulé ? */
      // le mur est dessiné une première fois avant tout : ce premier rendu peut figer la page un instant,
      // autant que ce soit avant le film que pendant
      if (!drawn) { drawn = true; drawWall(0); raf = requestAnimationFrame(frame); return; }
      let step = steps[stepIdx];
      while (step && step.film) {
        if (playFilm(step, dt)) { raf = requestAnimationFrame(frame); return; }
        stepIdx += 1;
        step = steps[stepIdx];
        // on arrive sur le mur alors que les fléchettes sont déjà en l'air
        if (step && step.salvo !== undefined) t = Math.max(t, salvoStart[step.salvo] + 200);
      }
      t += dt;
      if (step && step.salvo !== undefined && step.salvo < 2 && t >= salvoEnd[step.salvo]) {
        stepIdx += 1;
        if (steps[stepIdx] && steps[stepIdx].film && !filmDead) { raf = requestAnimationFrame(frame); return; }
      }
      drawWall(t);
      if (t >= T_END) { end(); return; }
      raf = requestAnimationFrame(frame);
    }

    /* Le plan du mur à l'instant t */
    function drawWall(t) {
      const s = t / 1000;
      let blur = 0;

      // la caméra : plan large qui se resserre doucement, puis elle vient se caler sur la cible
      const kv = clamp01(t / T_BACK), kb = clamp01((t - T_BACK) / BACK);
      if (kb <= 0) {
        camera.position.lerpVectors(camA.pos, camB.pos, easeInOut(kv));
        camera.quaternion.copy(camA.quat).slerp(camB.quat, easeInOut(kv));
        camera.fov = FOV_WIDE;
        // caméra à l'épaule
        camera.position.x += 0.004 * Math.sin(TAU * 0.31 * s);
        camera.position.y += 0.003 * Math.sin(TAU * 0.43 * s + 1);
      } else {
        camera.position.lerpVectors(camB.pos, camEnd.pos, easeInOut(kb));
        camera.quaternion.copy(camB.quat).slerp(camEnd.quat, easeInOut(kb));
        camera.fov = FOV_WIDE + (FOV_END - FOV_WIDE) * easeInOut(kb);
      }

      // les fléchettes de LeBouseuh
      let shake = 0;
      for (let i = 0; i < N; i++) {
        if (t < launch[i]) continue;
        const d = allDarts[i];
        if (t < hits[i]) {
          const u = (t - launch[i]) / FLIGHT;
          const e = Math.pow(u, 1.15);
          if (!aired[i]) {
            aired[i] = true;
            // elles partent de sa main, juste à côté de nous
            starts[i].set(0.20 + 0.05 * Math.sin(i * 2.3), -0.15, -0.28).add(camera.position);
            Sound.whoosh(FLIGHT / 1000, i < NP ? 0.6 : 0.35);
          }
          d.visible = true;
          pathPos(starts[i], ends[i], 0.11, e, tip);
          pathDir(starts[i], ends[i], 0.11, e, dir);
          dir.lerp(dirEnds[i], smooth((u - 0.5) / 0.5)).normalize();
          setDart(d, tip, dir, 2.5 * DEG * Math.sin(TAU * 2.4 * u) * (1 - u), 0, TAU * 1.5 * easeOut(u, 2));
          const near = u < 0.22;
          setDepth(d, near ? 'blur' : 'sharp');
          if (near) blur = Math.max(blur, 5 * (1 - u / 0.22) + 1);
          continue;
        }
        const th = (t - hits[i]) / 1000;
        if (!landed[i]) {
          landed[i] = true;
          missed += 1;
          Sound.thunk(true, i < NP ? 0.85 : 0.6);
          if (i < NP) { buzz(10); popLabel(ends[i], 'Raté !', '', 'miss-label'); }
          else strays[i - NP].chip.visible = true;
          cardCount.textContent = missed === N ? N + ' fléchettes, 0 point' : missed + (missed > 1 ? ' ratées' : ' ratée');
          if (missed === N) card.classList.add('done');
        }
        // la fléchette vibre dans le mur, et le papier qu'elle cloue se déplie d'un coup
        const vib = Math.exp(-th / 0.2) * Math.sin(TAU * 11 * th);
        d.visible = true;
        setDepth(d, kb > 0.35 ? 'planted' : 'sharp');
        setDart(d, ends[i], dirEnds[i], 5.5 * DEG * vib, 2.2 * DEG * vib);
        shake += (i < NP ? 0.0035 : 0.0016) * Math.exp(-th / 0.085) * Math.sin(71 * th + i);
        if (i >= NP) continue;
        const p = papers[i];
        p.mesh.visible = true;
        p.mesh.scale.setScalar(p.k * easeOut(clamp01(th / 0.13), 2));
        p.mesh.rotation.z = p.it.rot * DEG + 5 * DEG * Math.exp(-th / 0.22) * Math.sin(TAU * 5 * th);
        p.mesh.rotation.x = -0.5 * Math.exp(-th / 0.16) * Math.cos(TAU * 4 * th);
      }
      camera.position.x += shake;
      camera.position.y += shake * 0.7;
      if (kb > 0.35) blur = Math.max(blur, DOF_PLANTED * kb);

      if (!posed && t >= T_POSE) {
        posed = true;
        root.classList.add('intro-pose');
        // les liens sont posés avec le cadrage de repos, même si la caméra finit encore de se caler
        const p = camera.position.clone(), q = camera.quaternion.clone(), f = camera.fov;
        camera.position.copy(camEnd.pos); camera.quaternion.copy(camEnd.quat); camera.fov = FOV_END;
        camera.updateProjectionMatrix(); camera.updateMatrixWorld(true);
        placeLinks();
        camera.position.copy(p); camera.quaternion.copy(q); camera.fov = f;
      }

      camera.updateProjectionMatrix();
      camera.updateMatrixWorld(true);
      S.render(blur);
    }
    raf = requestAnimationFrame(frame);
  }

  /* ---------- Démarrage ---------- */
  const wait = ms => new Promise(r => setTimeout(r, ms));
  const fonts = document.fonts && document.fonts.load
    ? Promise.race([
      Promise.all([
        document.fonts.load('300 64px Archivo', '20'),
        document.fonts.load('600 32px Archivo', 'FLÉCHETTES'),
        document.fonts.load('italic 500 32px Archivo', 'Les vainqueurs'),
        document.fonts.load('italic 800 extra-condensed 64px Archivo', '12 JUIN'),
        document.fonts.load('800 extra-condensed 64px Archivo', 'CUP')
      ]),
      wait(1200)
    ]).catch(() => {})
    : Promise.resolve();

  fonts.then(() => {
    let S = null;
    try {
      if (window.THREE) S = build();
    } catch (err) {
      S = null;
      if (window.console) console.error('Scène 3D indisponible :', err);
      const stale = hero.querySelector('canvas.scene');
      if (stale) stale.remove();
    }
    if (!S) { fallback2D(); return; }
    start(S);
  });
})();

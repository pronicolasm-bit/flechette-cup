/* Fléchettes Cup 2 : la cible dans son bar, et l'intro 3D en vue subjective.
   On chevauche la première fléchette (caméra derrière les ailettes, mise au point
   sur la cible) : visée, armé, vol, impact sur le ticket de la billetterie.
   La caméra se détache et recule pour se caler sur l'emplacement de la cible dans
   la page, pendant que les autres fléchettes viennent clouer chacune une section
   du site. Chaque papier est ensuite un lien vers sa section. */
(function () {
  'use strict';

  const root = document.documentElement;
  const hero = document.querySelector('.hero');
  const wrap = document.querySelector('.board-wrap');
  const host = document.getElementById('dartboard');
  if (!hero || !wrap || !host) return;

  const TAU = Math.PI * 2, DEG = Math.PI / 180;
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

  /* ---------- Ce que les fléchettes viennent clouer : les sections du site ----------
     Chaque fléchette arrive à un endroit qui a un sens :
       la date (billetterie)  dans le secteur 12, pour le 12 juin
       les équipes            en plein centre
       les vainqueurs         dans le triple 20
       le tournoi amateur et le compteur de score : ratées, plantées dans le bois à côté de la cible
     at  : point d'impact de la fléchette dans le plan de la cible, en mètres (x à droite, y en haut)
     atP : variante pour un écran en hauteur, où il n'y a de la place qu'au-dessus et en dessous
     pin : ce même point vu depuis le centre du papier (là où le papier est transpercé)
     off : la fléchette a manqué la cible, le papier est sur le fond du meuble
     aim : inclinaison finale de la fléchette (piqué, lacet) en degrés */
  const SECTOR = (number, radius) => {
    const a = NUMBERS.indexOf(number) * 18 * DEG;
    return [Math.sin(a) * radius, Math.cos(a) * radius];
  };
  const ITEMS = [
    { id: 'billetterie', href: '#billetterie', label: 'Billetterie : 12 juin 2027', w: 0.176, h: 0.070, rot: 4, at: SECTOR(12, 0.070), pin: [0.080, 0], aim: [-14, 9], fins: [0x6A2CF0, 0x4A16D6] },
    { id: 'equipes', href: '#equipes', label: 'Les équipes', w: 0.126, h: 0.090, rot: -3, at: [0, 0], pin: [0, 0.041], aim: [-17, -6], fins: [0xFF5A1F, 0xF48227] },
    { id: 'photo', href: '#best-of', label: 'Édition 1 : les vainqueurs', w: 0.122, h: 0.146, rot: -5, at: SECTOR(20, 0.103), pin: [-0.055, -0.067], aim: [-17, 4], fins: [0xFE628A, 0xD10146] },
    { id: 'boutique', href: '#boutique', label: 'Boutique', w: 0.094, h: 0.120, rot: -6, at: SECTOR(6, 0.135), pin: [0, 0.050], aim: [-16, 9], fins: [0x25DA4E, 0xB7E83A] },
    { id: 'programme', href: '#programme', label: 'Programme et infos pratiques', w: 0.094, h: 0.094, rot: 8, at: SECTOR(19, 0.135), pin: [0, 0.034], aim: [-16, 28], fins: [0xFFCA00, 0xFF366D], round: true },
    { id: 'amateur', href: '#tournoi-amateur', label: 'Tournoi amateur', w: 0.110, h: 0.074, rot: -7, at: [-0.268, -0.080], atP: [-0.100, -0.250], pin: [0, 0.028], aim: [-27, 18], fins: [0x00D1FF, 0x1487B8], off: true },
    { id: 'score', href: 'jouer.html', label: 'Règles et compteur de score', w: 0.098, h: 0.084, rot: 6, at: [0.276, -0.020], atP: [0.110, -0.248], pin: [0, 0.033], aim: [-24, -20], fins: [0xDD2991, 0x8A1466], off: true }
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

  /* ---------- Textures du bar ---------- */
  function brickTextures() {
    const W = 2048, H = 1056, COLS = 8, ROWS = 11;
    const bw = W / COLS, bh = H / ROWS, mortar = 9;
    const col = document.createElement('canvas'); col.width = W; col.height = H;
    const bmp = document.createElement('canvas'); bmp.width = W; bmp.height = H;
    const g = col.getContext('2d'), b = bmp.getContext('2d');
    const rnd = mulberry32(404);
    g.fillStyle = '#3B342F'; g.fillRect(0, 0, W, H);
    b.fillStyle = '#2A2A2A'; b.fillRect(0, 0, W, H);
    for (let r = 0; r < ROWS; r++) {
      const off = (r % 2) * bw / 2;
      for (let c = -1; c < COLS; c++) {
        const x = c * bw + off + mortar / 2, y = r * bh + mortar / 2;
        const hue = 10 + rnd() * 12, sat = 26 + rnd() * 14;
        let lig = 21 + rnd() * 10;
        const roll = rnd();
        if (roll < 0.12) lig -= 8; else if (roll > 0.9) lig += 7;
        const draw = (xx) => {
          const gr = g.createLinearGradient(xx, y, xx, y + bh);
          gr.addColorStop(0, `hsl(${hue},${sat}%,${lig + 3}%)`);
          gr.addColorStop(1, `hsl(${hue},${sat}%,${lig - 3}%)`);
          g.fillStyle = gr;
          g.fillRect(xx, y, bw - mortar, bh - mortar);
          const v = 150 + rnd() * 50 | 0;
          b.fillStyle = `rgb(${v},${v},${v})`;
          b.fillRect(xx, y, bw - mortar, bh - mortar);
        };
        draw(x);
        if (x + bw > W) draw(x - W);      // raccord horizontal
        // éclats
        for (let k = 0; k < 3; k++) {
          if (rnd() < 0.5) continue;
          const ex = x + rnd() * (bw - mortar), ey = rnd() < 0.5 ? y : y + bh - mortar;
          g.fillStyle = '#3B342F'; b.fillStyle = '#2A2A2A';
          const er = 3 + rnd() * 7;
          g.beginPath(); g.arc(ex, ey, er, 0, TAU); g.fill();
          b.beginPath(); b.arc(ex, ey, er, 0, TAU); b.fill();
        }
      }
    }
    const tile = noiseTile(rnd, 256);
    [[g, 0.5, 1], [g, 0.3, 5], [b, 0.5, 1]].forEach(([ctx, a, s]) => {
      ctx.save();
      ctx.globalCompositeOperation = 'overlay'; ctx.globalAlpha = a;
      ctx.fillStyle = ctx.createPattern(tile, 'repeat');
      ctx.scale(s, s); ctx.fillRect(0, 0, W / s, H / s);
      ctx.restore();
    });
    return { col, bmp, tileW: 1.72, tileH: 0.825 };
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

  function chalkTexture(names, seed) {
    const W = 512, H = 1024, F = 34;
    const c = document.createElement('canvas'); c.width = W; c.height = H;
    const g = c.getContext('2d');
    const rnd = mulberry32(seed);
    g.fillStyle = '#3A2413'; g.fillRect(0, 0, W, H);
    g.fillStyle = '#1B2420'; g.fillRect(F, F, W - 2 * F, H - 2 * F);
    // traces de chiffon
    for (let i = 0; i < 26; i++) {
      const x = F + rnd() * (W - 2 * F), y = F + rnd() * (H - 2 * F), r = 60 + rnd() * 130;
      const gr = g.createRadialGradient(x, y, 0, x, y, r);
      gr.addColorStop(0, `rgba(230,235,225,${0.03 + rnd() * 0.05})`); gr.addColorStop(1, 'rgba(230,235,225,0)');
      g.fillStyle = gr; g.fillRect(F, F, W - 2 * F, H - 2 * F);
    }
    // l'écriture à la craie, sur un calque qu'on grignote ensuite
    const t = document.createElement('canvas'); t.width = W; t.height = H;
    const tg = t.getContext('2d');
    const chalk = (txt, x, y, px, align) => {
      tg.font = `italic 500 ${px}px Archivo, "Helvetica Neue", Arial, sans-serif`;
      tg.textAlign = align || 'center'; tg.textBaseline = 'middle';
      for (let k = 0; k < 3; k++) {
        tg.fillStyle = `rgba(238,238,228,${0.5 + rnd() * 0.3})`;
        tg.save();
        tg.translate(x + (rnd() - 0.5) * 2.5, y + (rnd() - 0.5) * 2.5);
        tg.rotate((rnd() - 0.5) * 0.05);
        tg.fillText(txt, 0, 0);
        tg.restore();
      }
    };
    const line = (x0, y0, x1, y1) => {
      tg.strokeStyle = 'rgba(238,238,228,0.75)'; tg.lineWidth = 3.5; tg.lineCap = 'round';
      tg.beginPath(); tg.moveTo(x0, y0 + (rnd() - 0.5) * 4); tg.lineTo(x1, y1 + (rnd() - 0.5) * 4); tg.stroke();
    };
    chalk('301', W / 2, 120, 92);
    line(140, 172, W - 140, 176);
    chalk(names[0], W * 0.3, 240, 34);
    chalk(names[1], W * 0.7, 240, 34);
    line(W / 2, 215, W / 2, 800);
    line(70, 272, W - 70, 270);
    let a = 301, bScore = 301;
    for (let r = 0; r < 7; r++) {
      const y = 330 + r * 66;
      chalk(String(a), W * 0.3, y, 44);
      chalk(String(bScore), W * 0.7, y, 44);
      if (r < 6) { line(W * 0.3 - 46, y, W * 0.3 + 46, y - 6); line(W * 0.7 - 46, y, W * 0.7 + 46, y - 6); }
      a = Math.max(2, a - (26 + Math.floor(rnd() * 60)));
      bScore = Math.max(2, bScore - (26 + Math.floor(rnd() * 60)));
    }
    chalk('GAME ON !', W / 2, 880, 50);
    tg.globalCompositeOperation = 'destination-out';
    tg.globalAlpha = 0.5;
    // le bruit est opaque : on ne retire qu'une partie des pixels, façon grain de craie
    const mask = document.createElement('canvas'); mask.width = mask.height = 128;
    const mg = mask.getContext('2d');
    const id = mg.createImageData(128, 128);
    for (let i = 0; i < 128 * 128; i++) { id.data[i * 4 + 3] = rnd() < 0.42 ? 255 : 0; }
    mg.putImageData(id, 0, 0);
    tg.fillStyle = tg.createPattern(mask, 'repeat');
    tg.fillRect(0, 0, W, H);
    g.drawImage(t, 0, 0);
    return c;
  }

  function neonTexture() {
    const W = 1024, H = 288;
    const c = document.createElement('canvas'); c.width = W; c.height = H;
    const g = c.getContext('2d');
    g.fillStyle = '#000'; g.fillRect(0, 0, W, H);
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.lineJoin = 'round'; g.lineCap = 'round';
    g.font = DISPLAY(190);
    const draw = (style, lw, blur, glow) => {
      g.strokeStyle = style; g.lineWidth = lw; g.shadowColor = glow; g.shadowBlur = blur;
      g.save(); g.translate(W / 2, H / 2 + 8); g.scale(0.9, 1); g.strokeText('FLÉCHETTES CUP', 0, 0); g.restore();
    };
    draw('#6A2CF0', 16, 60, '#6A2CF0');
    draw('#8F5BFF', 10, 30, '#8F5BFF');
    draw('#F3ECFF', 3.5, 8, '#C9B0FF');
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
    renderer.toneMappingExposure = 1.0;
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

    // Reflets : l'ambiance d'un bar, sombre, avec des sources chaudes et un néon violet
    const envC = document.createElement('canvas');
    envC.width = 512; envC.height = 256;
    const eg = envC.getContext('2d');
    const sky = eg.createLinearGradient(0, 0, 0, 256);
    sky.addColorStop(0, '#1A1210'); sky.addColorStop(0.5, '#0C0808'); sky.addColorStop(1, '#050304');
    eg.fillStyle = sky; eg.fillRect(0, 0, 512, 256);
    eg.fillStyle = '#FFE2B0'; eg.fillRect(60, 20, 120, 44);
    eg.fillStyle = '#FFC98A'; eg.fillRect(300, 30, 60, 30);
    eg.fillStyle = '#FFB060'; eg.fillRect(430, 96, 40, 30);
    eg.fillStyle = '#7A45FF'; eg.fillRect(200, 70, 110, 26);
    eg.fillStyle = '#FFE8C8'; eg.fillRect(120, 150, 50, 16);
    const envT = new THREE.CanvasTexture(envC);
    envT.mapping = THREE.EquirectangularReflectionMapping;
    envT.encoding = THREE.sRGBEncoding;
    const pmrem = new THREE.PMREMGenerator(renderer);
    scene.environment = pmrem.fromEquirectangular(envT).texture;
    envT.dispose(); pmrem.dispose();

    /* --- Lumières --- */
    const lights = [];
    // Le spot du pas de tir, braqué sur la cible. Deux sources voisines plutôt qu'une :
    // leurs ombres se recouvrent en dégradé, comme la pénombre d'une vraie lampe.
    const mkSpot = (intensity, x, y, z) => {
      const l = new THREE.SpotLight(0xFFE2BC, intensity, 0, 0.31, 0.88, 1);
      l.position.set(x, y, z);
      l.target.position.set(0, -0.04, 0);
      l.castShadow = true;
      l.shadow.mapSize.set(mobile ? 1024 : 2048, mobile ? 1024 : 2048);
      l.shadow.camera.near = 1.2; l.shadow.camera.far = 3.6;
      l.shadow.bias = -0.0004;
      l.shadow.normalBias = 0.0009;
      scene.add(l, l.target);
      lights.push(l);
    };
    mkSpot(1.65, -0.60, 1.12, 1.86);
    mkSpot(1.15, -0.40, 1.28, 1.94);
    const lampGlow = new THREE.PointLight(0xFFC27A, 0.75, 1.5, 1.6);
    lampGlow.position.set(0, 0.42, 0.24);
    const neonGlow = new THREE.PointLight(0x7A45FF, 1.3, 2.6, 1.5);
    neonGlow.position.set(0, 0.78, 0.28);
    const sconceL = new THREE.PointLight(0xFFB769, 1.15, 2.6, 1.5);
    sconceL.position.set(-2.05, 0.5, 0.22);
    const sconceR = new THREE.PointLight(0xFFB769, 1.15, 2.6, 1.5);
    sconceR.position.set(2.05, 0.5, 0.22);
    // un peu de lumière de la salle renvoyée par la droite, pour ne pas boucher les ombres
    const fill = new THREE.PointLight(0xFFD0A0, 0.32, 5, 1.2);
    fill.position.set(1.0, -0.35, 1.3);
    const hemi = new THREE.HemisphereLight(0x9C8AD8, 0x1C0E0A, 0.15);
    [lampGlow, neonGlow, sconceL, sconceR, fill, hemi].forEach(l => { scene.add(l); lights.push(l); });
    lights.forEach(l => l.layers.enable(1));

    /* --- Le bar --- */
    const WALL_Z = -0.075;
    const bricks = brickTextures();
    const wallW = 9, wallH = 3.8;
    const rep = [wallW / bricks.tileW, wallH / bricks.tileH];
    const wall = new THREE.Mesh(new THREE.PlaneGeometry(wallW, wallH), new THREE.MeshStandardMaterial({
      map: canvasTex(bricks.col, rep), bumpMap: dataTex(bricks.bmp, rep), bumpScale: 0.006,
      roughness: 0.94, metalness: 0, envMapIntensity: 0.25
    }));
    wall.position.set(0, -0.15, WALL_Z);
    wall.receiveShadow = true;
    scene.add(wall);

    const woodA = woodTexture(21), woodB = woodTexture(22);
    // bois verni : le relief suit le fil, une couche brillante accroche la lumière du spot
    const wood = (tint, repeat, canvasSrc) => new THREE.MeshPhysicalMaterial({
      map: canvasTex(canvasSrc || woodA, repeat || [1, 1]), bumpMap: dataTex(canvasSrc || woodA, repeat || [1, 1]), bumpScale: 0.0009,
      color: tint, roughness: 0.6, metalness: 0, clearcoat: 0.3, clearcoatRoughness: 0.4, envMapIntensity: 0.35
    });
    // soubassement en lambris et sa cimaise
    const wains = new THREE.Mesh(new THREE.PlaneGeometry(wallW, 1.3), wood(0x8E7866, [wallW / 0.46, 1.3 / 0.92]));
    wains.position.set(0, -0.78 - 0.65, WALL_Z + 0.02);
    wains.receiveShadow = true;
    scene.add(wains);
    const rail = new THREE.Mesh(new THREE.BoxGeometry(wallW, 0.055, 0.05), wood(0x7E6856, [12, 0.1]));
    rail.position.set(0, -0.78, WALL_Z + 0.03);
    scene.add(rail);

    // le meuble à fléchettes : fond en bois, portes ouvertes avec leurs ardoises
    const CAB = 0.66;
    const cabMat = wood(0xB09A88, [1.5, 0.75], woodB);
    const cab = new THREE.Mesh(new THREE.BoxGeometry(CAB, CAB, 0.037), cabMat);
    cab.position.set(0, 0, WALL_Z + 0.0185);
    cab.castShadow = true; cab.receiveShadow = true;
    scene.add(cab);
    [[0, CAB / 2 + 0.014, CAB + 0.056, 0.028], [0, -CAB / 2 - 0.014, CAB + 0.056, 0.028]].forEach(d => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(d[2], d[3], 0.07), cabMat);
      m.position.set(d[0], d[1], WALL_Z + 0.035);
      m.castShadow = true; m.receiveShadow = true;
      scene.add(m);
    });
    [['LEBOUSEUH', 'MICHOU', 31, -1], ['DOMINGO', 'INOX', 32, 1]].forEach(d => {
      const pivot = new THREE.Group();
      pivot.position.set(d[3] * CAB / 2, 0, WALL_Z + 0.04);
      pivot.rotation.y = -d[3] * 0.34;
      const mats = [cabMat, cabMat, cabMat, cabMat,
        new THREE.MeshStandardMaterial({ map: canvasTex(chalkTexture([d[0], d[1]], d[2])), roughness: 0.9, envMapIntensity: 0.2 }), cabMat];
      const door = new THREE.Mesh(new THREE.BoxGeometry(CAB / 2, CAB, 0.02), mats);
      door.position.x = d[3] * CAB / 4;
      door.castShadow = true; door.receiveShadow = true;
      pivot.add(door);
      scene.add(pivot);
    });

    // l'applique en laiton au-dessus du meuble
    const brass = new THREE.MeshStandardMaterial({ color: 0xB08A3C, metalness: 1, roughness: 0.3, envMapIntensity: 1.3 });
    const shade = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.5, 20), brass);
    shade.rotation.z = Math.PI / 2;
    shade.position.set(0, 0.485, 0.2);
    scene.add(shade);
    const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.011, 0.011, 0.44, 10), new THREE.MeshBasicMaterial({ color: 0xFFE9C4, toneMapped: false }));
    tube.rotation.z = Math.PI / 2;
    tube.position.set(0, 0.462, 0.2);
    scene.add(tube);
    [-0.14, 0.14].forEach(x => {
      const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.28, 8), brass);
      arm.rotation.x = Math.PI / 2;
      arm.position.set(x, 0.485, WALL_Z + 0.14);
      scene.add(arm);
    });

    // le néon
    const neon = new THREE.Mesh(new THREE.PlaneGeometry(0.98, 0.275), new THREE.MeshBasicMaterial({
      map: canvasTex(neonTexture()), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false
    }));
    neon.position.set(0, 0.78, WALL_Z + 0.03);
    scene.add(neon);

    // appliques murales, avec leur halo
    const halo = canvasTex(haloTexture('rgba(255,236,200,1)', 'rgba(255,170,80,0.35)'));
    [-2.05, 2.05].forEach(x => {
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

    // étagère à bouteilles, à gauche
    const shelfMat = wood(0x7C6656, [2.4, 0.2]);
    [[-1.3, 0.02], [-1.3, 0.47]].forEach((s, row) => {
      const shelf = new THREE.Mesh(new THREE.BoxGeometry(1.05, 0.03, 0.17), shelfMat);
      shelf.position.set(s[0], s[1], WALL_Z + 0.085);
      scene.add(shelf);
      const rnd = mulberry32(60 + row);
      const prof = [[0, 0], [0.034, 0], [0.036, 0.008], [0.036, 0.15], [0.031, 0.185], [0.014, 0.22], [0.0125, 0.27], [0.015, 0.274], [0.015, 0.285], [0, 0.285]]
        .map(p => new THREE.Vector2(p[0], p[1]));
      const bottleGeo = new THREE.LatheGeometry(prof, 20);
      const glassCols = [0x2B1608, 0x12331C, 0x3A1E0A, 0x20303A, 0x0E0E10, 0x4A2A10];
      for (let i = 0; i < 8; i++) {
        const sc = 0.82 + rnd() * 0.3;
        const bottle = new THREE.Mesh(bottleGeo, new THREE.MeshStandardMaterial({
          color: glassCols[Math.floor(rnd() * glassCols.length)], roughness: 0.07, metalness: 0.1,
          transparent: true, opacity: 0.9, envMapIntensity: 2.2
        }));
        const bx = s[0] - 0.46 + i * 0.13 + (rnd() - 0.5) * 0.03;
        bottle.position.set(bx, s[1] + 0.015, WALL_Z + 0.085 + (rnd() - 0.5) * 0.04);
        bottle.scale.set(sc, 0.9 + rnd() * 0.3, sc);
        scene.add(bottle);
        const label = new THREE.Mesh(new THREE.CylinderGeometry(0.0368 * sc, 0.0368 * sc, 0.06, 18, 1, true),
          new THREE.MeshStandardMaterial({ color: [0xE9E2D0, 0xC9A64A, 0x7A1F1F, 0xE9E2D0][Math.floor(rnd() * 4)], roughness: 0.8 }));
        label.position.set(bx, s[1] + 0.015 + 0.085 * bottle.scale.y, bottle.position.z);
        scene.add(label);
      }
    });

    // affiches encadrées, à droite
    [[1.1, 0.22, 0.44, 0.59, TEAM_GRADS[1], 'MICHOU', 41], [1.66, 0.02, 0.36, 0.48, TEAM_GRADS[4], 'INOX', 42], [1.38, -0.42, 0.3, 0.4, TEAM_GRADS[0], 'LEBOUSEUH', 43]].forEach(f => {
      const frame = new THREE.Mesh(new THREE.BoxGeometry(f[2] + 0.05, f[3] + 0.05, 0.03), new THREE.MeshStandardMaterial({ color: 0x15100C, roughness: 0.5, envMapIntensity: 0.6 }));
      frame.position.set(f[0], f[1], WALL_Z + 0.015);
      scene.add(frame);
      const pic = new THREE.Mesh(new THREE.PlaneGeometry(f[2], f[3]), new THREE.MeshStandardMaterial({ map: canvasTex(posterTexture(f[4], f[5], f[6])), color: 0xB8B0A8, roughness: 0.4, envMapIntensity: 0.6 }));
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
        emissive: 0xFFFFFF, emissiveMap: map, emissiveIntensity: 0
      }));
      mesh.rotation.z = it.rot * DEG;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      scene.add(mesh);

      return { it, mesh, map, canvas: c, pinWorld: new THREE.Vector3(), x: 0, y: 0, z0: 0 };
    });
    const OFF_Z = WALL_Z + 0.0375;                    // surface du fond du meuble
    function layout(portrait) {
      papers.forEach(p => {
        const it = p.it, at = portrait && it.atP ? it.atP : it.at;
        const r = it.rot * DEG, cr = Math.cos(r), sr = Math.sin(r);
        p.x = at[0] - (it.pin[0] * cr - it.pin[1] * sr);
        p.y = at[1] - (it.pin[0] * sr + it.pin[1] * cr);
        p.z0 = it.off ? OFF_Z : 0;
        p.mesh.position.set(p.x, p.y, p.z0);
        p.pinWorld.set(at[0], at[1], p.z0 - 0.008);
      });
    }
    layout(false);

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

    return { THREE, renderer, scene, camera, canvas, papers, darts, render, resize, layout };

  }

  /* ---------- Mise en scène ---------- */
  function start(S) {
    const { THREE, camera, canvas, papers, darts } = S;
    const V = (x, y, z) => new THREE.Vector3(x, y, z);
    const FWD = V(0, 0, -1), UP = V(0, 1, 0);
    const flash = document.querySelector('.impact-flash');
    const skip = document.querySelector('.skip-intro');
    const reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const clamp01 = x => Math.max(0, Math.min(1, x));
    const smooth = x => { x = clamp01(x); return x * x * (3 - 2 * x); };
    const easeInOut = x => x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2;
    const easeOut = (x, p) => 1 - Math.pow(1 - x, p);
    const dirFrom = (pitch, yaw, out) => out.set(Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), -Math.cos(yaw) * Math.cos(pitch));

    // Netteté d'une fléchette : 'sharp' tout net, 'blur' tout flou (elle passe près de la caméra),
    // 'planted' l'avant net et l'arrière légèrement flou (il dépasse vers la caméra)
    const DOF_PLANTED = 1.5;
    function setDepth(d, mode) {
      d.userData.front.traverse(o => o.layers.set(mode === 'blur' ? 1 : 0));
      d.userData.rear.traverse(o => o.layers.set(mode === 'sharp' ? 0 : 1));
    }

    const isPortrait = () => { const r = hero.getBoundingClientRect(); return r.width / r.height < 0.8; };
    S.layout(isPortrait());
    const N = darts.length;
    const ends = papers.map(p => p.pinWorld);
    const dirEnds = papers.map(p => dirFrom(p.it.aim[0] * DEG, p.it.aim[1] * DEG, V()));

    // Caméra embarquée : en trois quarts arrière, décalée sur le côté et un peu au-dessus,
    // comme sur l'affiche. On voit les ailettes au premier plan, la tige et le fût qui
    // pointent vers la cible, nette au fond.
    const RIG_POS = V(0.070, 0.046, 0.272);
    const RIG_LOOK = V(0, 0, -3);
    const LOOK_TARGET = 0.6;
    const TARGET = ends[0];

    // Trajectoire de la fléchette que l'on incarne
    const P0 = V(TARGET.x * 0.35 + 0.012, TARGET.y - 0.16, 2.18);   // pointe pendant la visée
    const PW = V(TARGET.x * 0.35 + 0.006, TARGET.y - 0.18, 2.30);   // pointe en fin d'armé
    const ARC = 0.13;                                               // flèche de la cloche, en mètres

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

    const dir0 = pathDir(PW, TARGET, ARC, 0, V());
    const PITCH_W = Math.asin(dir0.y), YAW_W = Math.atan2(dir0.x, -dir0.z);
    const PITCH_AIM = Math.atan2(TARGET.y - P0.y, P0.z) + 3 * DEG, YAW_AIM = Math.atan2(TARGET.x - P0.x, P0.z);

    const tip = V(), dir = V(), tmp = V(), tmp2 = V();
    function setDart(d, tipPos, direction, pitchExtra, yawExtra, roll) {
      d.position.copy(tipPos);
      d.quaternion.setFromUnitVectors(FWD, direction);
      if (pitchExtra) d.rotateX(pitchExtra);
      if (yawExtra) d.rotateY(yawExtra);
      if (roll) d.rotateZ(roll);
      d.updateMatrixWorld(true);
    }
    const rigQ = new THREE.Quaternion();
    function povCamera(direction) {
      // repère de la fléchette sans son roulis ni ses vibrations : la caméra reste stable
      const d = darts[0];
      rigQ.setFromUnitVectors(FWD, direction);
      camera.position.copy(RIG_POS).multiplyScalar(d.scale.x).applyQuaternion(rigQ).add(d.position);
      camera.up.set(0, 1, 0);
      tmp2.copy(RIG_LOOK).applyQuaternion(rigQ).add(d.position).sub(camera.position).normalize();
      tmp.copy(TARGET).sub(camera.position).normalize();
      tmp2.lerp(tmp, LOOK_TARGET).normalize().add(camera.position);
      camera.lookAt(tmp2);
    }

    /* --- Cadrage au repos ---
       La cible 3D se superpose à son emplacement dans la page. La caméra se décale un peu
       avec le pointeur en continuant de viser le même point : le relief se voit, le cadrage tient. */
    const FOV_POV = 50, FOV_END = 34;
    const base = V(), aimAt = V();
    const camEnd = { pos: V(), quat: new THREE.Quaternion() };
    const REST = { x: 0.32, y: 0.26 };
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
    nav.setAttribute('aria-label', 'Accès aux sections depuis la cible');
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
    const corner = V();
    function placeLinks() {
      papers.forEach((p, i) => {
        // position de repos du papier : la zone cliquable ne suit pas le soulèvement du survol
        const r = p.it.rot * DEG, cr = Math.cos(r), sr = Math.sin(r);
        let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
        [[-1, -1], [1, -1], [1, 1], [-1, 1]].forEach(c => {
          const lx = c[0] * p.it.w / 2, ly = c[1] * p.it.h / 2;
          corner.set(p.x + lx * cr - ly * sr, p.y + lx * sr + ly * cr, p.z0 + 0.004).project(camera);
          const x = (corner.x * 0.5 + 0.5) * view.w, y = (-corner.y * 0.5 + 0.5) * view.h;
          x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y);
        });
        const s = links[i].style;
        s.left = x0 + 'px'; s.top = y0 + 'px'; s.width = (x1 - x0) + 'px'; s.height = (y1 - y0) + 'px';
      });
    }
    // survol : le papier se décolle de la cible
    function setLift(p, v) {
      p.mesh.position.z = p.z0 + v * 0.013;
      p.mesh.rotation.x = -v * 0.07;
      p.mesh.material.emissiveIntensity = v * 0.1;
    }

    function applyRest() {
      darts.forEach((d, i) => { d.visible = true; setDepth(d, 'planted'); setDart(d, ends[i], dirEnds[i]); });
      papers.forEach((p, i) => { p.mesh.rotation.z = p.it.rot * DEG; setLift(p, lifts[i].v); });
      canvas.style.filter = '';
    }
    function drawRest() {
      poseAt(par.x, par.y, camera.position, camera.quaternion);
      camera.fov = FOV_END;
      camera.updateProjectionMatrix();
      camera.updateMatrixWorld(true);
      S.render(DOF_PLANTED);
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
      par.tx = REST.x + ((e.clientX / window.innerWidth) * 2 - 1) * 0.9;
      par.ty = REST.y + ((e.clientY / window.innerHeight) * 2 - 1) * 0.8;
      requestTick();
    }, { passive: true });
    document.documentElement.addEventListener('pointerleave', () => { par.tx = REST.x; par.ty = REST.y; requestTick(); });
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(es => { heroVisible = es[0].isIntersecting; }, { threshold: 0.05 }).observe(hero);
    }
    window.addEventListener('resize', () => { fit(); if (over) drawRest(); });

    /* --- Ouvrir une section : la caméra plonge dans le papier, puis on est sur son contenu --- */
    const veil = document.createElement('div');
    veil.className = 'veil';
    veil.setAttribute('aria-hidden', 'true');
    document.body.appendChild(veil);
    const topbarH = () => parseFloat(getComputedStyle(root).getPropertyValue('--topbar-h')) || 72;
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
      const dist = Math.max(0.2, (Math.max(it.h, it.w * view.h / view.w) / 0.5) / (2 * Math.tan(FOV_END * DEG / 2)));
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
    // retour arrière depuis une autre page : le navigateur peut ressortir celle-ci telle qu'on l'a quittée
    window.addEventListener('pageshow', e => {
      if (!e.persisted || !over) return;
      zoom = null;
      veil.classList.remove('on');
      applyRest();
      drawRest();
    });
    // Retour à la cible depuis le reste de la page : on recule depuis tout près
    window.FCBoard = {
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

    fit();
    root.classList.add('gl');

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

    if (over) { applyRest(); drawRest(); return; }

    /* --- Séquence d'intro --- */
    const AIM = 1150, WIND = 420, FLY = 920, HOLD = 190, BACK = 1300;
    const T_WIND = AIM, T_FLY = T_WIND + WIND, T_HIT = T_FLY + FLY, T_BACK = T_HIT + HOLD;
    const VOLLEY = 430;                                             // durée de vol des fléchettes suivantes
    const launch = darts.map((d, i) => i === 0 ? T_FLY : T_BACK + 280 + (i - 1) * 185 + (papers[i].it.off ? 240 : 0));
    const hits = darts.map((d, i) => i === 0 ? T_HIT : launch[i] + VOLLEY);
    const T_POSE = hits[N - 1] + 260, T_END = T_POSE + 900;
    let struck = false, posed = false;
    const camHit = { pos: V(), quat: new THREE.Quaternion() };

    // Les fléchettes suivantes partent de derrière la caméra et traversent le champ
    const OFFSETS = [null, V(-0.28, -0.22, 0.20), V(-0.32, 0.06, 0.22), V(0.30, -0.16, 0.22), V(-0.12, -0.32, 0.20), V(-0.30, -0.24, 0.20), V(0.32, 0.12, 0.22)];
    const starts = darts.map((d, i) => i === 0 ? PW : V());

    function end() {
      if (over) return;
      over = true;
      cancelAnimationFrame(raf);
      clearTimeout(window.__introSafety);
      root.classList.remove('intro', 'intro-impact', 'intro-pose');
      ['wheel', 'touchmove', 'keydown'].forEach(ev => window.removeEventListener(ev, onUserSkip));
      par.x = par.tx = REST.x; par.y = par.ty = REST.y;
      applyRest();
      drawRest();
    }
    function onUserSkip(e) {
      if (e.type === 'keydown' && e.key !== 'Escape') return;
      end();
    }
    if (skip) skip.addEventListener('click', end);
    ['wheel', 'touchmove', 'keydown'].forEach(ev => window.addEventListener(ev, onUserSkip, { passive: true }));

    setDepth(darts[0], 'blur');
    for (let i = 1; i < N; i++) darts[i].visible = false;

    const t0 = performance.now();
    function frame(now) {
      if (over) return;
      const t = now - t0, s = t / 1000;
      let blur = 0, motion = 0;

      /* La fléchette que l'on incarne */
      if (t < T_FLY) {
        // Visée puis armé : la main tremble un peu, puis recule
        const w = easeInOut(clamp01((t - T_WIND) / WIND));
        const calm = 1 - w;
        const sx = (0.0055 * Math.sin(TAU * 0.62 * s) + 0.0026 * Math.sin(TAU * 1.7 * s + 1.1)) * calm;
        const sy = (0.0045 * Math.sin(TAU * 0.48 * s + 0.6) + 0.0022 * Math.sin(TAU * 2.1 * s)) * calm;
        tip.lerpVectors(P0, PW, w);
        tip.x += sx; tip.y += sy;
        const pitch = PITCH_AIM + (PITCH_W - PITCH_AIM) * w + 0.5 * DEG * Math.sin(TAU * 0.9 * s) * calm;
        const yaw = YAW_AIM + (YAW_W - YAW_AIM) * w + 0.4 * DEG * Math.sin(TAU * 0.7 * s + 2) * calm;
        setDart(darts[0], tip, dirFrom(pitch, yaw, dir));
        camera.fov = FOV_POV;
        povCamera(dir);
        blur = 3.4;
      } else if (t < T_HIT) {
        // Vol : elle accélère, monte, redescend, tourne sur elle-même et tangue en se stabilisant
        const u = (t - T_FLY) / FLY;
        const e = Math.pow(u, 1.55);
        pathPos(PW, TARGET, ARC, e, tip);
        tip.x += 0.012 * Math.sin(TAU * e) * (1 - e);
        pathDir(PW, TARGET, ARC, e, dir);
        dir.lerp(dirEnds[0], smooth((u - 0.55) / 0.45)).normalize();
        const damp = Math.pow(1 - u, 1.6);
        setDart(darts[0], tip, dir,
          3.2 * DEG * Math.sin(TAU * 3.1 * u) * damp, 1.6 * DEG * Math.sin(TAU * 2.3 * u + 1) * damp,
          TAU * 2 * easeOut(u, 2));
        camera.fov = FOV_POV + 8 * u * u;
        povCamera(dir);
        blur = 3.4 - 1.4 * e;
        motion = 2.2 * u * u * u;
      } else if (!struck) {
        struck = true;
        setDepth(darts[0], 'planted');
        setDart(darts[0], TARGET, dirEnds[0]);
        povCamera(dirEnds[0]);
        camHit.pos.copy(camera.position);
        camHit.quat.copy(camera.quaternion);
        for (let i = 1; i < N; i++) starts[i].copy(camEnd.pos).add(OFFSETS[i]);
        root.classList.add('intro-impact');
        if (flash && flash.animate) flash.animate([{ opacity: 0 }, { opacity: 0.35, offset: 0.18 }, { opacity: 0 }], { duration: 300 });
      }

      if (t >= T_HIT) {
        blur = DOF_PLANTED;
        /* Les fléchettes suivantes : chacune vient clouer sa section */
        for (let i = 1; i < N; i++) {
          if (t < launch[i] || t >= hits[i]) continue;
          const u = (t - launch[i]) / VOLLEY;
          const e = Math.pow(u, 1.2);
          darts[i].visible = true;
          pathPos(starts[i], ends[i], 0.035, e, tip);
          pathDir(starts[i], ends[i], 0.035, e, dir);
          dir.lerp(dirEnds[i], smooth((u - 0.35) / 0.65)).normalize();
          setDart(darts[i], tip, dir, 2.5 * DEG * Math.sin(TAU * 2.4 * u) * (1 - u), 0, TAU * easeOut(u, 2));
          // proche de la caméra, elle est hors de la zone de netteté
          const near = u < 0.42;
          setDepth(darts[i], near ? 'blur' : 'planted');
          if (near) blur = Math.max(blur, 5 * (1 - u / 0.42) + DOF_PLANTED);
        }

        /* Vibration des fléchettes plantées, sursaut des papiers, secousses de caméra */
        let shake = 0;
        for (let i = 0; i < N; i++) {
          if (t < hits[i]) continue;
          const th = (t - hits[i]) / 1000;
          const vib = Math.exp(-th / 0.2) * Math.sin(TAU * 11 * th);
          darts[i].visible = true;
          setDepth(darts[i], 'planted');
          setDart(darts[i], ends[i], dirEnds[i], 5.5 * DEG * vib, 2.2 * DEG * vib);
          papers[i].mesh.rotation.z = papers[i].it.rot * DEG + 1.4 * DEG * Math.exp(-th / 0.16) * Math.sin(TAU * 8 * th);
          shake += (i === 0 ? 0.006 : 0.0022) * Math.exp(-th / 0.085) * Math.sin(71 * th + i);
        }

        /* La caméra se détache et recule jusqu'au cadrage de repos */
        const kb = clamp01((t - T_BACK) / BACK);
        camera.position.lerpVectors(camHit.pos, camEnd.pos, easeInOut(kb));
        camera.quaternion.copy(camHit.quat).slerp(camEnd.quat, easeInOut(clamp01(kb * 1.5)));
        camera.fov = (FOV_POV + 8) + (FOV_END - FOV_POV - 8) * easeInOut(kb);
        camera.position.x += shake;
        camera.position.y += shake * 0.7;

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
        if (t >= T_END) { end(); return; }
      }

      canvas.style.filter = motion > 0.2 ? `blur(${motion.toFixed(2)}px)` : '';
      camera.updateProjectionMatrix();
      camera.updateMatrixWorld(true);
      S.render(blur);
      raf = requestAnimationFrame(frame);
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

/* Fléchettes Cup 2 : cible réaliste et intro 3D en vue subjective.
   On est la première fléchette : visée, armé, vol, impact sur le ticket.
   La caméra se détache et recule pour se caler exactement sur l'emplacement
   de la cible dans la page, pendant que les autres fléchettes viennent
   clouer chacune leur papier (logo, photo, sticker, carte du live). */
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

  /* ---------- Les éléments fixés à la cible : de vrais papiers, dessinés en texture ----------
     Positions en mètres dans le plan de la cible (x vers la droite, y vers le haut).
     pin : point où la fléchette transperce le papier, par rapport à son centre.
     aim : inclinaison finale de la fléchette (piqué, lacet) en degrés. */
  const ITEMS = [
    { id: 'ticket', w: 0.190, h: 0.076, x: 0.116, y: 0.112, rot: -5, pin: [0.004, 0.027], aim: [-20, 14], fins: [0x6A2CF0, 0x4A16D6] },
    { id: 'logo', w: 0.126, h: 0.094, x: -0.126, y: 0.122, rot: 5, pin: [0.002, 0.036], aim: [-16, -20], fins: [0xF48227, 0xF7B531] },
    { id: 'photo', w: 0.150, h: 0.178, x: -0.136, y: -0.098, rot: 6, pin: [0, 0.079], aim: [-24, 10], fins: [0xFE628A, 0xD10146] },
    { id: 'badge', w: 0.098, h: 0.098, x: 0.171, y: -0.040, rot: -8, pin: [0, 0.036], aim: [-15, -24], fins: [0x25DA4E, 0xB7E83A], round: true },
    { id: 'live', w: 0.172, h: 0.054, x: 0.060, y: -0.187, rot: 3, pin: [-0.004, 0.018], aim: [-22, 22], fins: [0x00D1FF, 0x1487B8] }
  ];
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
    ticket(g, W, H) {
      g.fillStyle = '#ECE7DC'; g.fillRect(0, 0, W, H);
      const stub = W * 0.2;
      g.fillStyle = '#5B1DDA'; g.fillRect(0, 0, stub, H);
      g.save();
      g.translate(stub * 0.58, H / 2); g.rotate(-Math.PI / 2);
      g.fillStyle = '#FFFFFF'; g.font = DISPLAY(H * 0.36); g.textBaseline = 'middle';
      fitText(g, 'ÉDITION 2', 0, 0, H * 0.84, 'center');
      g.restore();
      g.fillStyle = 'rgba(20,6,60,0.55)';
      for (let y = H * 0.06; y < H; y += H * 0.085) { g.beginPath(); g.arc(stub, y, H * 0.016, 0, TAU); g.fill(); }
      const x0 = stub + W * 0.045, maxW = W - x0 - W * 0.05;
      g.fillStyle = '#160444';
      g.textBaseline = 'alphabetic';
      g.font = TEXT(H * 0.105, 700);
      fitText(g, 'FLÉCHETTES CUP', x0, H * 0.2, maxW * 0.6);
      g.font = TEXT(H * 0.085, 500);
      fitText(g, 'N° 000 002', W - W * 0.05, H * 0.2, maxW * 0.35, 'right');
      g.font = DISPLAY(H * 0.56);
      fitText(g, '12 JUIN 2027', x0 - H * 0.02, H * 0.68, maxW);
      const rnd = mulberry32(12);
      let bx = x0;
      while (bx < W - W * 0.05) {
        const bw = (1 + Math.floor(rnd() * 3)) * H * 0.008;
        g.fillRect(bx, H * 0.76, bw, H * 0.15);
        bx += bw + (1 + Math.floor(rnd() * 3)) * H * 0.008;
      }
      grain(g, W, H, 0.22, 3);
    },

    logo(g, W, H) {
      g.fillStyle = '#D6F8AC'; g.fillRect(0, 0, W, H);
      g.save();
      g.transform(1, -0.07, 0, 1, 0, H * 0.05);
      g.fillStyle = '#1B0550';
      g.textBaseline = 'alphabetic';
      g.font = `800 extra-condensed ${H * 0.25}px Archivo, "Arial Narrow", Impact, sans-serif`;
      fitText(g, 'FLECHETTES', W * 0.12, H * 0.36, W * 0.6);
      g.font = `800 extra-condensed ${H * 0.62}px Archivo, "Arial Narrow", Impact, sans-serif`;
      fitText(g, 'CUP', W * 0.105, H * 0.86, W * 0.56);
      g.beginPath();
      g.moveTo(W * 0.70, H * 0.60); g.lineTo(W * 0.90, H * 0.67); g.lineTo(W * 0.70, H * 0.76);
      g.closePath(); g.fill();
      g.restore();
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
        g.drawImage(img, (img.width - sw) / 2, (img.height - sh) * 0.3, sw, sh, m, top, pw, ph);
      } else {
        const bg = g.createLinearGradient(m, top, m + pw, top + ph);
        bg.addColorStop(0, '#5012D4'); bg.addColorStop(1, '#210666');
        g.fillStyle = bg; g.fillRect(m, top, pw, ph);
        g.fillStyle = '#FFFFFF'; g.font = DISPLAY(pw * 0.3); g.textBaseline = 'middle';
        fitText(g, 'E & R', m + pw / 2, top + ph / 2, pw * 0.8, 'center');
      }
      // léger reflet du papier photo
      const gloss = g.createLinearGradient(m, top, m + pw, top + ph);
      gloss.addColorStop(0, 'rgba(255,255,255,0.16)'); gloss.addColorStop(0.4, 'rgba(255,255,255,0)');
      g.fillStyle = gloss; g.fillRect(m, top, pw, ph);
      g.strokeStyle = 'rgba(0,0,0,0.25)'; g.lineWidth = W * 0.004; g.strokeRect(m, top, pw, ph);
      g.fillStyle = '#2A2440'; g.textBaseline = 'middle';
      g.font = `italic 500 ${W * 0.062}px Archivo, "Helvetica Neue", Arial, sans-serif`;
      fitText(g, 'Elian & Raska, vainqueurs 2026', W / 2, top + ph + (H - top - ph) / 2, pw, 'center');
    },

    badge(g, W, H) {
      g.clearRect(0, 0, W, H);
      g.beginPath(); g.arc(W / 2, H / 2, W / 2, 0, TAU); g.fillStyle = '#D6F8AC'; g.fill();
      g.beginPath(); g.arc(W / 2, H / 2, W * 0.455, 0, TAU);
      g.strokeStyle = '#1B0550'; g.lineWidth = W * 0.012; g.stroke();
      g.fillStyle = '#1B0550'; g.textBaseline = 'alphabetic';
      g.font = DISPLAY(W * 0.36);
      fitText(g, '3 000', W / 2, H * 0.56, W * 0.66, 'center');
      g.font = DISPLAY(W * 0.2);
      fitText(g, 'PLACES', W / 2, H * 0.75, W * 0.56, 'center');
      grain(g, W, H, 0.18, 9);
    },

    live(g, W, H) {
      g.fillStyle = '#0D0328'; g.fillRect(0, 0, W, H);
      g.fillStyle = '#F03B2B';
      g.beginPath(); g.arc(W * 0.075, H * 0.3, H * 0.085, 0, TAU); g.fill();
      g.fillStyle = '#E3E3E3'; g.textBaseline = 'middle';
      g.font = TEXT(H * 0.2, 700);
      fitText(g, 'EN LIVE SUR', W * 0.12, H * 0.31, W * 0.5);
      g.fillStyle = '#CFF99A';
      g.font = DISPLAY(H * 0.5);
      fitText(g, 'TWITCH.TV/LEBOUSEUH', W * 0.05, H * 0.7, W * 0.9);
      grain(g, W, H, 0.14, 11);
    }
  };

  /* ---------- Scène 3D ---------- */
  function build() {
    const THREE = window.THREE;
    const mobile = Math.min(window.innerWidth, window.innerHeight) < 700;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.outputEncoding = THREE.sRGBEncoding;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 0.98;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.setClearColor(0x000000, 0);

    const canvas = renderer.domElement;
    canvas.className = 'scene';
    canvas.setAttribute('aria-hidden', 'true');
    hero.insertBefore(canvas, hero.querySelector('.hero-stage'));

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(50, 1, 0.006, 30);

    // Environnement de studio pour les reflets du métal
    const envC = document.createElement('canvas');
    envC.width = 512; envC.height = 256;
    const eg = envC.getContext('2d');
    const sky = eg.createLinearGradient(0, 0, 0, 256);
    sky.addColorStop(0, '#3A2A78'); sky.addColorStop(0.5, '#120634'); sky.addColorStop(1, '#05020F');
    eg.fillStyle = sky; eg.fillRect(0, 0, 512, 256);
    eg.fillStyle = '#FFFFFF'; eg.fillRect(40, 24, 150, 70);
    eg.fillStyle = '#FFF4DD'; eg.fillRect(300, 10, 90, 40);
    eg.fillStyle = '#7A45FF'; eg.fillRect(350, 90, 120, 90);
    eg.fillStyle = '#D9FBB3'; eg.fillRect(210, 150, 70, 26);
    const envT = new THREE.CanvasTexture(envC);
    envT.mapping = THREE.EquirectangularReflectionMapping;
    envT.encoding = THREE.sRGBEncoding;
    const pmrem = new THREE.PMREMGenerator(renderer);
    scene.environment = pmrem.fromEquirectangular(envT).texture;
    envT.dispose(); pmrem.dispose();

    // Lumières : une source principale en haut à gauche, un remplissage violet
    const key = new THREE.DirectionalLight(0xFFF6E8, 2.1);
    key.position.set(-0.55, 0.85, 1.9);
    key.castShadow = true;
    key.shadow.mapSize.set(mobile ? 1024 : 2048, mobile ? 1024 : 2048);
    key.shadow.camera.left = -0.46; key.shadow.camera.right = 0.46;
    key.shadow.camera.top = 0.46; key.shadow.camera.bottom = -0.46;
    key.shadow.camera.near = 0.4; key.shadow.camera.far = 4.5;
    key.shadow.bias = -0.0004;
    key.shadow.normalBias = 0.0009;
    key.shadow.radius = 4;
    scene.add(key);
    scene.add(new THREE.HemisphereLight(0xCDBBFF, 0x1B0A44, 0.42));

    // Cible
    const board = new THREE.Group();
    const tex = new THREE.CanvasTexture(drawBoardTexture(mobile ? 2048 : 4096, false));
    tex.encoding = THREE.sRGBEncoding;
    tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
    const bump = new THREE.CanvasTexture(drawBump(1024));
    const face = new THREE.Mesh(
      new THREE.CircleGeometry(BOARD_R, 128),
      new THREE.MeshStandardMaterial({ map: tex, bumpMap: bump, bumpScale: 0.0012, roughness: 0.97, metalness: 0, envMapIntensity: 0.22 })
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

    // Fils d'acier en relief
    const steel = new THREE.MeshStandardMaterial({ color: 0xC9C9D2, metalness: 1, roughness: 0.32, envMapIntensity: 1.25 });
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
    scene.add(board);

    // Le mur ne se voit pas (la page reste visible derrière), il reçoit juste les ombres
    const wall = new THREE.Mesh(new THREE.PlaneGeometry(4, 4), new THREE.ShadowMaterial({ opacity: 0.42 }));
    wall.position.z = -0.038;
    wall.receiveShadow = true;
    scene.add(wall);

    // Papiers : tenus par un seul point, ils se soulèvent en s'éloignant de la fléchette
    const papers = ITEMS.map((it, n) => {
      const W = Math.round(it.w * PX_PER_M), H = Math.round(it.h * PX_PER_M);
      const c = document.createElement('canvas');
      c.width = W; c.height = H;
      DRAW[it.id](c.getContext('2d'), W, H);
      const map = new THREE.CanvasTexture(c);
      map.encoding = THREE.sRGBEncoding;
      map.anisotropy = renderer.capabilities.getMaxAnisotropy();

      const geo = it.round ? new THREE.CircleGeometry(it.w / 2, 64) : new THREE.PlaneGeometry(it.w, it.h, 20, 14);
      const pos = geo.attributes.position;
      for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i), y = pos.getY(i);
        const d2 = (x - it.pin[0]) * (x - it.pin[0]) + (y - it.pin[1]) * (y - it.pin[1]);
        pos.setZ(i, 0.0026 + n * 0.0002 + 0.42 * d2 + 0.0005 * Math.sin(x * 64 + n * 2.1) * Math.cos(y * 48 + n));
      }
      geo.computeVertexNormals();

      const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({
        map, roughness: it.id === 'photo' ? 0.55 : 0.86, metalness: 0, envMapIntensity: 0.3, side: THREE.DoubleSide
      }));
      mesh.position.set(it.x, it.y, 0);
      mesh.rotation.z = it.rot * DEG;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      scene.add(mesh);

      const r = it.rot * DEG;
      const pinWorld = new THREE.Vector3(
        it.x + it.pin[0] * Math.cos(r) - it.pin[1] * Math.sin(r),
        it.y + it.pin[0] * Math.sin(r) + it.pin[1] * Math.cos(r),
        -0.008
      );
      return { it, mesh, map, canvas: c, pinWorld };
    });

    // Fléchettes : pointe à l'origine, corps vers +Z, elles volent vers -Z
    const alongZ = (geo, z) => { geo.rotateX(Math.PI / 2); geo.translate(0, 0, z); return geo; };
    const pointGeo = alongZ(new THREE.CylinderGeometry(0.00115, 0.00012, 0.034, 16), 0.017);
    const prof = [[0.0011, 0], [0.0029, 0.006], [0.0034, 0.009]];
    for (let y = 0.011; y < 0.038; y += 0.0019) {
      prof.push([0.0034, y], [0.0034, y + 0.0010], [0.0029, y + 0.0012], [0.0029, y + 0.0017]);
    }
    prof.push([0.0034, 0.040], [0.0033, 0.046], [0.0024, 0.050]);
    const barrelGeo = alongZ(new THREE.LatheGeometry(prof.map(p => new THREE.Vector2(p[0], p[1])), 40), 0.034);
    const shaftGeo = alongZ(new THREE.CylinderGeometry(0.0010, 0.0024, 0.068, 16), 0.118);
    const finShape = new THREE.Shape();
    finShape.moveTo(0.0012, 0.112);
    finShape.lineTo(0.0165, 0.126);
    finShape.lineTo(0.0195, 0.149);
    finShape.lineTo(0.0170, 0.158);
    finShape.lineTo(0.0012, 0.152);
    finShape.closePath();
    const finGeos = [0, 1].map(tone => [0, 2].map(q => {
      const geo = new THREE.ShapeGeometry(finShape);
      geo.rotateX(Math.PI / 2);
      geo.rotateZ((45 + (q + tone) * 90) * DEG);
      return geo;
    }));
    const ribC = document.createElement('canvas');
    ribC.width = ribC.height = 64;
    const rg = ribC.getContext('2d');
    rg.fillStyle = '#FFFFFF'; rg.fillRect(0, 0, 64, 64);
    rg.fillStyle = 'rgba(0,0,0,0.14)';
    for (let x = 0; x < 64; x += 8) rg.fillRect(x, 0, 3, 64);
    const ribs = new THREE.CanvasTexture(ribC);
    ribs.wrapS = ribs.wrapT = THREE.RepeatWrapping;
    ribs.repeat.set(60, 60);
    ribs.encoding = THREE.sRGBEncoding;

    const pointMat = new THREE.MeshStandardMaterial({ color: 0xD8D8DE, metalness: 1, roughness: 0.2, envMapIntensity: 1.5 });
    const tungsten = new THREE.MeshStandardMaterial({ color: 0x9A9BA3, metalness: 1, roughness: 0.27, envMapIntensity: 1.4 });

    function makeDart(colors) {
      const d = new THREE.Group();
      d.add(new THREE.Mesh(pointGeo, pointMat));
      d.add(new THREE.Mesh(barrelGeo, tungsten));
      d.add(new THREE.Mesh(shaftGeo, new THREE.MeshStandardMaterial({ color: colors[1], metalness: 0.55, roughness: 0.35, envMapIntensity: 1 })));
      colors.forEach((color, tone) => {
        // albédo assombri + émission : la couleur reste saturée sous la lumière principale
        const mat = new THREE.MeshStandardMaterial({
          color: new THREE.Color(color).multiplyScalar(0.42), map: ribs, roughness: 0.7, metalness: 0, side: THREE.DoubleSide,
          emissive: color, emissiveIntensity: 0.38, envMapIntensity: 0.15
        });
        finGeos[tone].forEach(geo => d.add(new THREE.Mesh(geo, mat)));
      });
      d.traverse(o => { if (o.isMesh) o.castShadow = true; });
      d.scale.setScalar(1.3);   // un peu plus grande que nature : c'est l'accessoire vedette
      scene.add(d);
      return d;
    }
    const darts = papers.map(p => makeDart(p.it.fins));

    return { THREE, renderer, scene, camera, canvas, papers, darts };
  }

  /* ---------- Mise en scène ---------- */
  function start(S) {
    const { THREE, renderer, scene, camera, canvas, papers, darts } = S;
    const V = (x, y, z) => new THREE.Vector3(x, y, z);
    const FWD = V(0, 0, -1);
    const lines = document.querySelector('.speedlines');
    const flash = document.querySelector('.impact-flash');
    const skip = document.querySelector('.skip-intro');

    const clamp01 = x => Math.max(0, Math.min(1, x));
    const smooth = x => { x = clamp01(x); return x * x * (3 - 2 * x); };
    const easeInOut = x => x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2;
    const easeOut = (x, p) => 1 - Math.pow(1 - x, p);
    const dirFrom = (pitch, yaw, out) => out.set(Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), -Math.cos(yaw) * Math.cos(pitch));

    const N = darts.length;
    const ends = papers.map(p => p.pinWorld);
    const dirEnds = papers.map(p => dirFrom(p.it.aim[0] * DEG, p.it.aim[1] * DEG, V()));

    // Caméra embarquée sur la première fléchette : au-dessus de la tige,
    // le regard partagé entre l'axe de la fléchette et le point visé
    const RIG_POS = V(0, 0.024, 0.100);
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
    function setDart(d, tipPos, direction, pitchExtra, yawExtra) {
      d.position.copy(tipPos);
      d.quaternion.setFromUnitVectors(FWD, direction);
      if (pitchExtra) d.rotateX(pitchExtra);
      if (yawExtra) d.rotateY(yawExtra);
      d.updateMatrixWorld(true);
    }
    function povCamera() {
      const d = darts[0];
      camera.position.copy(d.localToWorld(tmp.copy(RIG_POS)));
      camera.up.set(0, 1, 0);
      d.localToWorld(tmp2.copy(RIG_LOOK)).sub(camera.position).normalize();
      tmp.copy(TARGET).sub(camera.position).normalize();
      tmp2.lerp(tmp, LOOK_TARGET).normalize().add(camera.position);
      camera.lookAt(tmp2);
    }

    // Cadrage final : la cible 3D se superpose exactement à son emplacement dans la page
    const FOV_POV = 50, FOV_END = 34;
    const camEnd = { pos: V(), quat: new THREE.Quaternion() };
    function fit() {
      const hr = hero.getBoundingClientRect(), wr = wrap.getBoundingClientRect();
      renderer.setSize(hr.width, hr.height, false);
      camera.aspect = hr.width / hr.height;
      const wpp = 2 * BOARD_R / wr.width;
      const cx = wr.left - hr.left + wr.width / 2, cy = wr.top - hr.top + wr.height / 2;
      const d = 2 * BOARD_R * hr.height / (2 * Math.tan(FOV_END * DEG / 2) * wr.width);
      camEnd.pos.set(-(cx - hr.width / 2) * wpp, (cy - hr.height / 2) * wpp, d);
    }

    function renderFinal() {
      darts.forEach((d, i) => { d.visible = true; setDart(d, ends[i], dirEnds[i]); });
      papers.forEach(p => { p.mesh.rotation.z = p.it.rot * DEG; });
      camera.position.copy(camEnd.pos);
      camera.quaternion.copy(camEnd.quat);
      camera.fov = FOV_END;
      camera.updateProjectionMatrix();
      canvas.style.filter = '';
      renderer.render(scene, camera);
    }

    fit();
    root.classList.add('gl');

    let over = !root.classList.contains('intro');
    let raf = 0;
    window.addEventListener('resize', () => { fit(); if (over) renderFinal(); });

    // La vraie photo des vainqueurs remplace le visuel provisoire dès qu'elle est disponible
    const photo = papers.find(p => p.it.id === 'photo');
    if (photo) {
      const img = new Image();
      img.onload = () => {
        DRAW.photo(photo.canvas.getContext('2d'), photo.canvas.width, photo.canvas.height, img);
        photo.map.needsUpdate = true;
        if (over) renderFinal();
      };
      img.src = 'assets/vainqueurs-edition-1.jpg';
    }

    if (over) { renderFinal(); return; }

    /* --- Séquence --- */
    const AIM = 1050, WIND = 400, FLY = 900, HOLD = 170, BACK = 1250;
    const T_WIND = AIM, T_FLY = T_WIND + WIND, T_HIT = T_FLY + FLY, T_BACK = T_HIT + HOLD;
    const VOLLEY = 430;                                             // durée de vol des fléchettes suivantes
    const launch = darts.map((d, i) => i === 0 ? T_FLY : T_BACK + 330 + (i - 1) * 215);
    const hits = darts.map((d, i) => i === 0 ? T_HIT : launch[i] + VOLLEY);
    const T_POSE = hits[N - 1] + 260, T_END = T_POSE + 900;
    const done = darts.map(() => false);
    let posed = false;
    const camHit = { pos: V(), quat: new THREE.Quaternion() };

    // Les fléchettes suivantes partent de derrière la caméra et traversent le champ
    const OFFSETS = [null, V(-0.30, -0.24, 0.22), V(-0.26, 0.20, 0.18), V(0.32, -0.20, 0.24), V(0.20, -0.30, 0.20)];
    const starts = darts.map((d, i) => i === 0 ? PW : V());

    function end() {
      if (over) return;
      over = true;
      cancelAnimationFrame(raf);
      clearTimeout(window.__introSafety);
      root.classList.remove('intro', 'intro-impact', 'intro-pose');
      if (lines) { lines.style.opacity = ''; lines.style.transform = ''; }
      ['wheel', 'touchmove', 'keydown'].forEach(ev => window.removeEventListener(ev, onUserSkip));
      renderFinal();
    }
    function onUserSkip(e) {
      if (e.type === 'keydown' && e.key !== 'Escape') return;
      end();
    }
    if (skip) skip.addEventListener('click', end);
    ['wheel', 'touchmove', 'keydown'].forEach(ev => window.addEventListener(ev, onUserSkip, { passive: true }));

    for (let i = 1; i < N; i++) darts[i].visible = false;

    const t0 = performance.now();
    function frame(now) {
      if (over) return;
      const t = now - t0, s = t / 1000;
      let blur = 0;

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
        povCamera();
      } else if (t < T_HIT) {
        // Vol : elle accélère, monte, redescend, et tangue en se stabilisant
        const u = (t - T_FLY) / FLY;
        const e = Math.pow(u, 1.55);
        pathPos(PW, TARGET, ARC, e, tip);
        tip.x += 0.012 * Math.sin(TAU * e) * (1 - e);
        pathDir(PW, TARGET, ARC, e, dir);
        dir.lerp(dirEnds[0], smooth((u - 0.5) / 0.5)).normalize();
        const damp = Math.pow(1 - u, 1.6);
        setDart(darts[0], tip, dir, 3.2 * DEG * Math.sin(TAU * 3.1 * u) * damp, 1.6 * DEG * Math.sin(TAU * 2.3 * u + 1) * damp);
        camera.fov = FOV_POV + 9 * u * u;
        povCamera();
        blur = 2.6 * u * u * u;
        if (lines) {
          lines.style.opacity = String(0.85 * u * u);
          lines.style.transform = `scale(${0.8 + 1.8 * u * u})`;
        }
      } else if (!done[0]) {
        done[0] = true;
        setDart(darts[0], TARGET, dirEnds[0]);
        povCamera();
        camHit.pos.copy(camera.position);
        camHit.quat.copy(camera.quaternion);
        for (let i = 1; i < N; i++) starts[i].copy(camEnd.pos).add(OFFSETS[i]);
        root.classList.add('intro-impact');
        if (flash && flash.animate) flash.animate([{ opacity: 0 }, { opacity: 0.6, offset: 0.18 }, { opacity: 0 }], { duration: 360 });
        if (lines && lines.animate) lines.animate([{ opacity: 0.85 }, { opacity: 0 }], { duration: 260 });
        if (lines) lines.style.opacity = '0';
      }

      if (t >= T_HIT) {
        /* Les fléchettes suivantes : chacune vient clouer son papier */
        for (let i = 1; i < N; i++) {
          if (t < launch[i]) continue;
          if (t < hits[i]) {
            const u = (t - launch[i]) / VOLLEY;
            const e = Math.pow(u, 1.2);
            darts[i].visible = true;
            pathPos(starts[i], ends[i], 0.035, e, tip);
            pathDir(starts[i], ends[i], 0.035, e, dir);
            dir.lerp(dirEnds[i], smooth((u - 0.35) / 0.65)).normalize();
            setDart(darts[i], tip, dir, 2.5 * DEG * Math.sin(TAU * 2.4 * u) * (1 - u));
          } else {
            done[i] = true;
          }
        }

        /* Vibration des fléchettes plantées, sursaut des papiers, secousses de caméra */
        let shake = 0;
        for (let i = 0; i < N; i++) {
          if (t < hits[i]) continue;
          const th = (t - hits[i]) / 1000;
          const vib = Math.exp(-th / 0.2) * Math.sin(TAU * 11 * th);
          darts[i].visible = true;
          setDart(darts[i], ends[i], dirEnds[i], 5.5 * DEG * vib, 2.2 * DEG * vib);
          papers[i].mesh.rotation.z = papers[i].it.rot * DEG + 1.4 * DEG * Math.exp(-th / 0.16) * Math.sin(TAU * 8 * th);
          shake += (i === 0 ? 0.006 : 0.0022) * Math.exp(-th / 0.085) * Math.sin(71 * th + i);
        }

        /* La caméra se détache et recule jusqu'au cadrage final */
        const kb = clamp01((t - T_BACK) / BACK);
        camera.position.lerpVectors(camHit.pos, camEnd.pos, easeOut(kb, 3.4));
        camera.quaternion.copy(camHit.quat).slerp(camEnd.quat, easeOut(clamp01(kb * 1.9), 2.4));
        camera.fov = (FOV_POV + 9) + (FOV_END - FOV_POV - 9) * easeOut(kb, 2.2);
        camera.position.x += shake;
        camera.position.y += shake * 0.7;

        if (!posed && t >= T_POSE) { posed = true; root.classList.add('intro-pose'); }
        if (t >= T_END) { end(); return; }
      }

      canvas.style.filter = blur > 0.15 ? `blur(${blur.toFixed(2)}px)` : '';
      camera.updateProjectionMatrix();
      renderer.render(scene, camera);
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
    }
    if (!S) { fallback2D(); return; }
    start(S);
  });
})();

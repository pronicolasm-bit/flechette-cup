/* Fléchettes Cup : carte des bars à fléchettes.
   Trois sources fusionnées : la liste de l'équipe (data/bars.json), les lieux
   référencés sur OpenStreetMap (import pré-calculé dans data/bars-osm.json, ou
   recherche à la demande), et les propositions du visiteur (sur son appareil). */
(function () {
  'use strict';

  /* Le fond de carte et le service Overpass publics d'OpenStreetMap ne sont pas faits
     pour encaisser un gros trafic : avant une vraie mise en ligne, remplacer TILE_URL
     par un fournisseur de tuiles dédié, et la recherche Overpass par l'import
     pré-calculé (scripts/import-osm-bars.mjs) ou un service à soi. */
  const TILE_URL = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
  const TILE_ATTRIBUTION = '<a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">© contributeurs OpenStreetMap</a>';
  const OVERPASS_URL = 'https://overpass-api.de/api/interpreter';

  const FRANCE = [46.7, 2.5];
  const SEARCH_MIN_ZOOM = 10;
  const LIST_MAX = 80;
  const KEY_MINE = 'fc-bars-propositions-v1';
  const KEY_OSM_SESSION = 'fc-bars-osm-session-v1';

  const $ = id => document.getElementById(id);
  const mapEl = $('map'), listEl = $('bar-list'), statusEl = $('bars-status');
  const zoneBtn = $('btn-zone'), banner = $('map-banner');
  const dialog = $('propose-dialog'), form = $('propose-form'), errorEl = $('propose-error');
  if (!mapEl || !listEl) return;

  if (!window.L) {
    statusEl.textContent = 'La carte n\'a pas pu se charger. Recharge la page pour réessayer.';
    return;
  }
  const L = window.L;

  /* ---------- État ---------- */
  const data = { equipe: [], osm: [], mine: [] };
  let bakedOsm = false;          // true si l'import pré-calculé contient des lieux
  let filter = 'tous';
  let query = '';
  let userPos = null;            // { lat, lon } après « Autour de moi »
  let notice = '';               // message ponctuel affiché dans la ligne de statut
  let placing = false;
  let pending = null;            // position choisie pour la proposition en cours
  let selectedId = null;
  let searching = false;
  const markers = new Map();

  /* ---------- Petits outils ---------- */
  const el = (tag, cls, text) => {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text !== undefined && text !== null) n.textContent = text;
    return n;
  };
  const fold = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  const validCoord = (lat, lon) => Number.isFinite(lat) && Number.isFinite(lon) && Math.abs(lat) <= 90 && Math.abs(lon) <= 180;
  function km(aLat, aLon, bLat, bLon) {
    const R = 6371, rad = Math.PI / 180;
    const dLat = (bLat - aLat) * rad, dLon = (bLon - aLon) * rad;
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(aLat * rad) * Math.cos(bLat * rad) * Math.sin(dLon / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(h));
  }
  const kmLabel = d => d < 1 ? `${Math.max(50, Math.round(d * 20) * 50)} m` : `${d.toLocaleString('fr-FR', { maximumFractionDigits: d < 10 ? 1 : 0 })} km`;

  const toast = el('div', 'toast');
  toast.setAttribute('role', 'status');
  toast.setAttribute('aria-live', 'polite');
  document.body.appendChild(toast);
  let toastTimer = 0;
  function say(msg) {
    toast.textContent = msg;
    toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove('show'), 3200);
  }

  /* ---------- Sources ---------- */
  const BOARDS = { steel: 'Cibles traditionnelles', soft: 'Cibles électroniques', both: 'Cibles traditionnelles et électroniques' };
  const OSM_KIND = { pub: 'Pub', bar: 'Bar', cafe: 'Café', restaurant: 'Restaurant', sports_centre: 'Salle de sport', club: 'Club', social_club: 'Club' };

  function fromOsmElement(e) {
    const t = e.tags || {};
    const lat = Number(e.lat !== undefined ? e.lat : e.center && e.center.lat);
    const lon = Number(e.lon !== undefined ? e.lon : e.center && e.center.lon);
    if (!validCoord(lat, lon)) return null;
    const street = [t['addr:housenumber'], t['addr:street']].filter(Boolean).join(' ');
    return {
      id: `osm-${e.type}-${e.id}`,
      source: 'osm',
      name: (t.name || '').trim() || 'Lieu sans nom',
      kind: OSM_KIND[t.amenity] || OSM_KIND[t.leisure] || OSM_KIND[t.club] || 'Lieu',
      city: t['addr:city'] || '',
      address: street,
      lat, lon
    };
  }
  function cleanBar(b, source, i) {
    if (!b || typeof b !== 'object') return null;
    const lat = Number(b.lat), lon = Number(b.lon);
    if (!validCoord(lat, lon)) return null;
    return {
      id: String(b.id || `${source}-${i}`),
      source,
      partner: source === 'equipe' && !!b.partner,
      name: String(b.name || '').trim() || 'Lieu sans nom',
      kind: String(b.kind || (source === 'mine' ? 'Proposition' : 'Bar')),
      city: String(b.city || ''),
      address: String(b.address || ''),
      boards: BOARDS[b.boards] ? b.boards : '',
      count: Number.isInteger(b.count) && b.count > 0 ? b.count : null,
      note: String(b.note || ''),
      lat, lon
    };
  }
  async function loadJSON(url) {
    try {
      const res = await fetch(url, { cache: 'no-cache' });
      if (!res.ok) return null;
      return await res.json();
    } catch (e) { return null; }      // fichier absent, ou page ouverte en file://
  }
  function loadMine() {
    try {
      const raw = JSON.parse(localStorage.getItem(KEY_MINE) || '[]');
      return Array.isArray(raw) ? raw.map((b, i) => cleanBar(b, 'mine', i)).filter(Boolean) : [];
    } catch (e) { return []; }
  }
  function saveMine() {
    try { localStorage.setItem(KEY_MINE, JSON.stringify(data.mine)); return true; } catch (e) { return false; }
  }
  function loadOsmSession() {
    try {
      const raw = JSON.parse(sessionStorage.getItem(KEY_OSM_SESSION) || '[]');
      return Array.isArray(raw) ? raw.map((b, i) => cleanBar(b, 'osm', i)).filter(Boolean) : [];
    } catch (e) { return []; }
  }
  function saveOsmSession() {
    try { sessionStorage.setItem(KEY_OSM_SESSION, JSON.stringify(data.osm)); } catch (e) { /* tant pis : on recherchera de nouveau */ }
  }
  const allBars = () => data.equipe.concat(data.osm, data.mine);

  /* ---------- Carte ---------- */
  const map = L.map(mapEl, { center: FRANCE, zoom: 6, minZoom: 5, zoomControl: true });
  L.tileLayer(TILE_URL, { maxZoom: 19, attribution: TILE_ATTRIBUTION }).addTo(map);
  const layer = L.layerGroup().addTo(map);
  let meMarker = null, pendingMarker = null;

  const PIN_STYLE = {
    partner: { fill: '#D9FBB3', stroke: '#160444', dot: '#160444', dash: '' },
    equipe: { fill: '#E3E3E3', stroke: '#160444', dot: '#5B1DDA', dash: '' },
    osm: { fill: '#5B1DDA', stroke: '#FFFFFF', dot: '#FFFFFF', dash: '' },
    mine: { fill: '#160444', stroke: '#D9FBB3', dot: '#D9FBB3', dash: ' stroke-dasharray="4 3"' }
  };
  const styleKey = b => b.source === 'equipe' ? (b.partner ? 'partner' : 'equipe') : b.source;
  function pinIcon(key) {
    const s = PIN_STYLE[key];
    // SVG construit uniquement à partir de constantes : aucune donnée extérieure ici
    const svg = `<svg viewBox="0 0 30 38" aria-hidden="true" focusable="false"><path d="M15 1.5C7.5 1.5 2 7 2 14.2 2 23.6 15 36.5 15 36.5S28 23.6 28 14.2C28 7 22.5 1.5 15 1.5Z" fill="${s.fill}" stroke="${s.stroke}" stroke-width="2.4"${s.dash}/><circle cx="15" cy="14" r="6.2" fill="none" stroke="${s.dot}" stroke-width="2"/><circle cx="15" cy="14" r="2.3" fill="${s.dot}"/></svg>`;
    return L.divIcon({ className: 'pin', html: svg, iconSize: [30, 38], iconAnchor: [15, 37], popupAnchor: [0, -34] });
  }
  const ICONS = { partner: pinIcon('partner'), equipe: pinIcon('equipe'), osm: pinIcon('osm'), mine: pinIcon('mine') };

  function badgeFor(b) {
    if (b.source === 'equipe') return b.partner ? el('span', 'badge partner', 'Partenaire des qualifs') : el('span', 'badge', 'Sélection de l\'équipe');
    if (b.source === 'osm') return el('span', 'badge', 'OpenStreetMap');
    return el('span', 'badge mine', 'Ta proposition');
  }
  function placeLine(b) {
    return [b.address, b.city].filter(Boolean).join(', ');
  }
  function popupFor(b) {
    const box = el('div');
    box.appendChild(el('p', 'pop-name', b.name));
    const badges = el('p', 'pop-badges');
    badges.appendChild(badgeFor(b));
    box.appendChild(badges);
    const where = placeLine(b);
    box.appendChild(el('p', 'pop-meta', where ? `${b.kind}, ${where}` : b.kind));
    const extra = [b.boards ? BOARDS[b.boards] : '', b.count ? `${b.count} cible${b.count > 1 ? 's' : ''}` : ''].filter(Boolean).join(', ');
    if (extra) box.appendChild(el('p', 'pop-meta', extra));
    if (b.note) box.appendChild(el('p', 'pop-meta', b.note));
    const actions = el('p');
    actions.style.margin = '0';
    const link = el('a', 'pop-link', 'Voir sur OpenStreetMap');
    link.href = `https://www.openstreetmap.org/?mlat=${b.lat}&mlon=${b.lon}#map=18/${b.lat}/${b.lon}`;
    link.target = '_blank';
    link.rel = 'noopener';
    actions.appendChild(link);
    if (b.source === 'mine') {
      const del = el('button', 'pop-del', 'Supprimer');
      del.type = 'button';
      del.addEventListener('click', () => removeMine(b.id));
      actions.appendChild(del);
    }
    box.appendChild(actions);
    return box;
  }

  function drawMarkers() {
    layer.clearLayers();
    markers.clear();
    allBars().forEach(b => {
      const m = L.marker([b.lat, b.lon], { icon: ICONS[styleKey(b)], title: b.name, alt: b.name, keyboard: false });
      m.bindPopup(() => popupFor(b), { maxWidth: 280 });
      m.on('popupopen', () => { selectedId = b.id; markCurrent(); });
      m.on('popupclose', () => { if (selectedId === b.id) { selectedId = null; markCurrent(); } });
      m.addTo(layer);
      markers.set(b.id, m);
    });
  }

  /* ---------- Liste ---------- */
  const EMPTY = {
    tous: 'Aucune adresse affichée pour l\'instant. Zoome sur ta ville puis lance « Chercher dans cette zone », ou utilise « Autour de moi ».',
    partenaires: 'Les bars partenaires des qualifications seront annoncés ici.',
    osm: 'Aucun lieu OpenStreetMap chargé. Zoome sur ta ville puis lance « Chercher dans cette zone ».',
    mine: 'Tu n\'as encore proposé aucun bar. Utilise le bouton « Proposer un bar », puis touche la carte à son emplacement.'
  };
  function matches(b) {
    if (filter === 'partenaires' && !(b.source === 'equipe' && b.partner)) return false;
    if (filter === 'osm' && b.source !== 'osm') return false;
    if (filter === 'mine' && b.source !== 'mine') return false;
    if (!query) return true;
    return fold(`${b.name} ${b.city} ${b.address}`).includes(query);
  }
  function markCurrent() {
    listEl.querySelectorAll('.bar-btn').forEach(btn => {
      if (btn.dataset.id === selectedId) btn.setAttribute('aria-current', 'true');
      else btn.removeAttribute('aria-current');
    });
  }
  function renderList() {
    const c = map.getCenter();
    const ref = userPos || { lat: c.lat, lon: c.lng };
    const found = allBars().filter(matches)
      .map(b => ({ b, d: km(ref.lat, ref.lon, b.lat, b.lon) }))
      .sort((x, y) => x.d - y.d);
    const shown = found.slice(0, LIST_MAX);

    listEl.textContent = '';
    if (!shown.length) {
      const empty = el('li', 'bar-empty', query ? 'Aucune adresse ne correspond à ta recherche. Essaie un autre nom, ou propose ce bar.' : EMPTY[filter]);
      listEl.appendChild(empty);
    }
    shown.forEach(({ b, d }) => {
      const li = el('li', 'bar-item');
      const btn = el('button', 'bar-btn');
      btn.type = 'button';
      btn.dataset.id = b.id;
      btn.appendChild(el('span', 'bar-name', b.name));
      const meta = el('span', 'bar-meta');
      meta.appendChild(badgeFor(b));
      const where = [b.kind, b.city || b.address].filter(Boolean).join(', ');
      meta.appendChild(document.createTextNode(where));
      if (userPos) {
        meta.appendChild(document.createTextNode(', à '));
        meta.appendChild(el('span', 'bar-dist', kmLabel(d)));
      }
      btn.appendChild(meta);
      btn.addEventListener('click', () => focusBar(b.id));
      li.appendChild(btn);
      listEl.appendChild(li);
    });
    markCurrent();
    renderStatus(found.length, shown.length);
  }
  function renderStatus(total, shown) {
    if (notice) { statusEl.textContent = notice; return; }
    if (!total) {
      statusEl.textContent = (!bakedOsm && map.getZoom() < SEARCH_MIN_ZOOM && filter !== 'mine' && filter !== 'partenaires')
        ? 'Zoome sur ta ville pour chercher les lieux référencés.'
        : '';
      return;
    }
    const base = `${total} adresse${total > 1 ? 's' : ''}`;
    const order = userPos ? ', les plus proches de toi d\'abord' : ', les plus proches du centre de la carte d\'abord';
    statusEl.textContent = total > shown ? `${base}, ${shown} affichées${order}.` : `${base}${total > 1 ? order : ''}.`;
  }
  function focusBar(id) {
    const m = markers.get(id);
    if (!m) return;
    const target = m.getLatLng();
    const zoom = Math.max(map.getZoom(), 15);
    map.once('moveend', () => m.openPopup());
    map.flyTo(target, zoom, { duration: 0.6 });
    if (window.matchMedia('(max-width: 860px)').matches) mapEl.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }

  function updateZoneButton() {
    zoneBtn.hidden = bakedOsm || placing || map.getZoom() < SEARCH_MIN_ZOOM;
    zoneBtn.disabled = searching;
    zoneBtn.textContent = searching ? 'Recherche en cours' : 'Chercher dans cette zone';
  }
  function refresh() {
    drawMarkers();
    renderList();
    updateZoneButton();
  }

  /* ---------- Recherche OpenStreetMap à la demande ---------- */
  async function searchZone() {
    if (searching || bakedOsm) return;
    const b = map.getBounds();
    const box = [b.getSouth(), b.getWest(), b.getNorth(), b.getEast()].map(n => n.toFixed(5)).join(',');
    const q = `[out:json][timeout:25];(nwr["sport"~"(^|;)darts($|;)"](${box});nwr["darts"="yes"](${box}););out center tags 300;`;
    searching = true;
    notice = 'Recherche des lieux référencés dans cette zone.';
    updateZoneButton();
    renderList();

    const ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const timer = setTimeout(() => ctrl && ctrl.abort(), 30000);
    try {
      const res = await fetch(`${OVERPASS_URL}?data=${encodeURIComponent(q)}`, ctrl ? { signal: ctrl.signal } : undefined);
      if (res.status === 429) {
        notice = 'Le service de recherche est très sollicité. Réessaie dans une minute.';
      } else if (!res.ok) {
        notice = 'La recherche a mis trop de temps à répondre. Zoome un peu plus et réessaie.';
      } else {
        const json = await res.json();
        const found = (json.elements || []).map(fromOsmElement).filter(Boolean);
        const known = new Set(data.osm.map(x => x.id));
        const fresh = found.filter(x => !known.has(x.id) && known.add(x.id));
        data.osm = data.osm.concat(fresh);
        saveOsmSession();
        if (!found.length) notice = 'Aucun lieu référencé dans cette zone. Tu en connais un ? Propose-le avec « Proposer un bar ».';
        else if (!fresh.length) notice = `Rien de nouveau ici : les ${found.length} lieu${found.length > 1 ? 'x' : ''} de cette zone sont déjà sur la carte.`;
        else notice = `${fresh.length} lieu${fresh.length > 1 ? 'x' : ''} ajouté${fresh.length > 1 ? 's' : ''} à la carte.`;
      }
    } catch (e) {
      notice = e && e.name === 'AbortError'
        ? 'La recherche a mis trop de temps à répondre. Zoome un peu plus et réessaie.'
        : 'Impossible de joindre le service de recherche. Vérifie ta connexion et réessaie.';
    }
    clearTimeout(timer);
    searching = false;
    refresh();
  }

  /* ---------- Autour de moi ---------- */
  function locate() {
    if (!navigator.geolocation) {
      notice = 'Ton navigateur ne donne pas accès à ta position. Déplace la carte sur ta ville.';
      renderList();
      return;
    }
    const btn = $('btn-locate');
    btn.disabled = true;
    notice = 'Recherche de ta position.';
    renderList();
    navigator.geolocation.getCurrentPosition(pos => {
      btn.disabled = false;
      userPos = { lat: pos.coords.latitude, lon: pos.coords.longitude };
      if (meMarker) meMarker.remove();
      meMarker = L.marker([userPos.lat, userPos.lon], {
        icon: L.divIcon({ className: '', html: '<div class="me-dot"></div>', iconSize: [18, 18], iconAnchor: [9, 9] }),
        interactive: false, keyboard: false, zIndexOffset: -100
      }).addTo(map);
      notice = '';
      map.setView([userPos.lat, userPos.lon], 13, { animate: false });
      mapEl.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      if (!bakedOsm) searchZone(); else renderList();
    }, err => {
      btn.disabled = false;
      notice = err && err.code === 1
        ? 'Tu as refusé l\'accès à ta position. Autorise-la dans ton navigateur, ou déplace la carte sur ta ville.'
        : 'Ta position est introuvable pour le moment. Déplace la carte sur ta ville.';
      renderList();
    }, { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 });
  }

  /* ---------- Proposer un bar ---------- */
  function setPlacing(on) {
    placing = on;
    mapEl.classList.toggle('placing', on);
    banner.hidden = !on;
    if (!on && pendingMarker) { pendingMarker.remove(); pendingMarker = null; }
    updateZoneButton();
  }
  function startPlacing() {
    map.closePopup();
    setPlacing(true);
    mapEl.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }
  function openDialog(latlng) {
    pending = { lat: latlng.lat, lon: latlng.lng };
    if (pendingMarker) pendingMarker.remove();
    pendingMarker = L.marker(latlng, { icon: ICONS.mine, interactive: false, keyboard: false }).addTo(map);
    form.reset();
    errorEl.hidden = true;
    errorEl.textContent = '';
    if (typeof dialog.showModal === 'function') dialog.showModal();
    else dialog.setAttribute('open', '');
    form.elements.name.focus();
  }
  function closeDialog() {
    if (typeof dialog.close === 'function' && dialog.open) dialog.close();
    else dialog.removeAttribute('open');
  }
  function fail(msg, field) {
    errorEl.textContent = msg;
    errorEl.hidden = false;
    if (field) field.focus();
  }
  function submitProposal(e) {
    e.preventDefault();
    const f = form.elements;
    const name = f.name.value.trim();
    if (!name) return fail('Indique le nom du bar pour l\'enregistrer.', f.name);
    let count = null;
    if (f.count.value.trim() !== '') {
      count = Number(f.count.value);
      if (!Number.isInteger(count) || count < 1 || count > 50) return fail('Le nombre de cibles doit être un nombre entier entre 1 et 50. Laisse le champ vide si tu ne sais pas.', f.count);
    }
    if (!pending) return fail('L\'emplacement est perdu. Ferme cette fenêtre et touche de nouveau la carte.');
    const bar = cleanBar({
      id: `mine-${Date.now()}`, name, city: f.city.value.trim(), address: f.address.value.trim(),
      boards: f.boards.value, count, note: f.note.value.trim(), lat: pending.lat, lon: pending.lon
    }, 'mine', 0);
    data.mine.push(bar);
    const stored = saveMine();
    pending = null;
    closeDialog();
    setPlacing(false);
    notice = '';
    refresh();
    const m = markers.get(bar.id);
    if (m) m.openPopup();
    say(stored
      ? 'Bar enregistré sur cet appareil. Il n\'est pas encore transmis à l\'équipe.'
      : 'Bar ajouté à la carte, mais ton navigateur refuse de l\'enregistrer : il disparaîtra en quittant la page.');
  }
  function removeMine(id) {
    data.mine = data.mine.filter(b => b.id !== id);
    saveMine();
    map.closePopup();
    refresh();
    say('Proposition supprimée.');
  }

  /* ---------- Événements ---------- */
  map.on('click', e => { if (placing) openDialog(e.latlng); });
  map.on('moveend', () => {
    updateZoneButton();
    if (!userPos) renderList(); else renderStatus(allBars().filter(matches).length, Math.min(LIST_MAX, allBars().filter(matches).length));
  });
  zoneBtn.addEventListener('click', searchZone);
  $('btn-locate').addEventListener('click', locate);
  $('btn-propose').addEventListener('click', startPlacing);
  $('btn-cancel-place').addEventListener('click', () => setPlacing(false));
  $('btn-propose-cancel').addEventListener('click', () => { closeDialog(); });
  dialog.addEventListener('close', () => { pending = null; setPlacing(false); });
  form.addEventListener('submit', submitProposal);
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && placing && !dialog.open) setPlacing(false); });
  $('bar-search').addEventListener('input', e => { query = fold(e.target.value.trim()); notice = ''; renderList(); });
  document.querySelectorAll('.chip[data-filter]').forEach(chip => {
    chip.addEventListener('click', () => {
      filter = chip.dataset.filter;
      document.querySelectorAll('.chip[data-filter]').forEach(c => c.setAttribute('aria-pressed', String(c === chip)));
      notice = '';
      renderList();
    });
  });
  window.addEventListener('resize', () => map.invalidateSize());

  /* ---------- Démarrage ---------- */
  data.mine = loadMine();
  data.osm = loadOsmSession();
  refresh();
  Promise.all([loadJSON('data/bars.json'), loadJSON('data/bars-osm.json')]).then(([team, osm]) => {
    if (team && Array.isArray(team.bars)) data.equipe = team.bars.map((b, i) => cleanBar(b, 'equipe', i)).filter(Boolean);
    if (osm && Array.isArray(osm.bars) && osm.bars.length) {
      bakedOsm = true;
      data.osm = osm.bars.map((b, i) => cleanBar(b, 'osm', i)).filter(Boolean);
    }
    refresh();
  });
})();

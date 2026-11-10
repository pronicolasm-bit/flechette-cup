#!/usr/bin/env node
/* Import des lieux de fléchettes référencés sur OpenStreetMap, pour la France.

   Usage (Node 18 ou plus récent, avec un accès Internet) :
     node scripts/import-osm-bars.mjs

   Le script interroge le service Overpass une seule fois et écrit data/bars-osm.json.
   Dès que ce fichier contient des lieux, la page bars.html les affiche d'emblée et
   n'interroge plus Overpass depuis le navigateur des visiteurs : c'est le mode à
   utiliser en production. À relancer de temps en temps pour rafraîchir les données.

   Données © contributeurs OpenStreetMap, licence ODbL : l'attribution est affichée
   sur la carte et dans la page, ne pas la retirer. */

import { writeFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const OUT = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'data', 'bars-osm.json');

// Plusieurs instances publiques : on passe à la suivante si l'une ne répond pas
const ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter'
];

const QUERY = `[out:json][timeout:180];
area["ISO3166-1"="FR"][admin_level=2]->.fr;
(
  nwr["sport"~"(^|;)darts($|;)"](area.fr);
  nwr["darts"="yes"](area.fr);
);
out center tags;`;

// Même correspondance que dans js/bars.js : à garder alignée
const KIND = { pub: 'Pub', bar: 'Bar', cafe: 'Café', restaurant: 'Restaurant', sports_centre: 'Salle de sport', club: 'Club', social_club: 'Club' };

function toBar(e) {
  const t = e.tags || {};
  const lat = Number(e.lat ?? e.center?.lat);
  const lon = Number(e.lon ?? e.center?.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  return {
    id: `osm-${e.type}-${e.id}`,
    name: (t.name || '').trim() || 'Lieu sans nom',
    kind: KIND[t.amenity] || KIND[t.leisure] || KIND[t.club] || 'Lieu',
    city: t['addr:city'] || '',
    address: [t['addr:housenumber'], t['addr:street']].filter(Boolean).join(' '),
    lat: Number(lat.toFixed(6)),
    lon: Number(lon.toFixed(6))
  };
}

async function ask(endpoint) {
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': 'import-bars-flechettes/1.0' },
    body: 'data=' + encodeURIComponent(QUERY),
    signal: AbortSignal.timeout(240000)
  });
  if (!res.ok) throw new Error(`réponse ${res.status}`);
  return res.json();
}

let json = null;
for (const endpoint of ENDPOINTS) {
  try {
    console.log(`Interrogation de ${endpoint}`);
    json = await ask(endpoint);
    break;
  } catch (err) {
    console.warn(`  échec : ${err.message}`);
  }
}
if (!json) {
  console.error('Aucun service Overpass n\'a répondu. Le fichier existant est laissé tel quel. Réessaie plus tard.');
  process.exit(1);
}

const seen = new Set();
const bars = (json.elements || [])
  .map(toBar)
  .filter(b => b && !seen.has(b.id) && seen.add(b.id))
  .sort((a, b) => a.city.localeCompare(b.city, 'fr') || a.name.localeCompare(b.name, 'fr'));

if (!bars.length) {
  console.error('La requête a répondu, mais sans aucun lieu. Le fichier existant est laissé tel quel.');
  process.exit(1);
}

await mkdir(dirname(OUT), { recursive: true });
await writeFile(OUT, JSON.stringify({ updated: new Date().toISOString().slice(0, 10), source: 'OpenStreetMap (ODbL)', bars }, null, 1) + '\n');
const unnamed = bars.filter(b => b.name === 'Lieu sans nom').length;
console.log(`${bars.length} lieux écrits dans ${OUT} (dont ${unnamed} sans nom).`);

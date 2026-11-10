/* Fléchettes Cup : moteur de score, sans interface.
   Fonctions pures : chaque action renvoie un nouvel état, l'ancien n'est jamais modifié.
   Utilisable dans le navigateur (window.FCScore) comme dans Node (module.exports). */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.FCScore = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const CRICKET_TARGETS = [20, 19, 18, 17, 16, 15, 25];
  const clone = o => JSON.parse(JSON.stringify(o));

  /* Une fléchette : m = multiplicateur (1 simple, 2 double, 3 triple), n = secteur (1 à 20, 25 pour le bull, 0 raté) */
  function isValidDart(d) {
    if (!d || ![1, 2, 3].includes(d.m)) return false;
    if (d.n === 0) return true;
    if (d.n === 25) return d.m <= 2;
    return Number.isInteger(d.n) && d.n >= 1 && d.n <= 20;
  }
  const dartScore = d => d.m * d.n;
  function dartLabel(d) {
    if (d.n === 0) return 'Raté';
    if (d.n === 25) return d.m === 2 ? 'Bull' : '25';
    return (d.m === 3 ? 'T' : d.m === 2 ? 'D' : '') + d.n;
  }

  /* config : { type: 'x01' | 'cricket', start: 301 | 501, doubleOut: bool, legsToWin: n,
                sides: [{ name, players: [noms] }] }  (un camp = un joueur ou un duo) */
  function createGame(config) {
    const type = config.type === 'cricket' ? 'cricket' : 'x01';
    const sides = (config.sides || []).map((s, i) => ({
      name: (s.name || '').trim() || `Joueur ${i + 1}`,
      players: (s.players && s.players.length ? s.players : [s.name]).map((p, j) => (p || '').trim() || `Joueur ${j + 1}`),
      next: 0,            // prochain joueur du camp à lancer (duos : à tour de rôle)
      legs: 0,
      darts: 0,           // fléchettes lancées sur tout le match
      points: 0,          // points marqués sur tout le match (x01), ou touches utiles (cricket)
      best: 0             // meilleure volée
    }));
    if (sides.length < 1) throw new Error('Il faut au moins un joueur');
    const game = {
      type,
      start: type === 'x01' ? (config.start === 501 ? 501 : 301) : 0,
      doubleOut: type === 'x01' ? config.doubleOut !== false : false,
      legsToWin: Math.max(1, Math.min(9, config.legsToWin || 1)),
      sides,
      legNo: 1,
      starter: 0,
      finished: false,
      winner: null,
      last: null          // dernier événement, pour l'affichage : { kind, side, ... }
    };
    startLeg(game);
    return game;
  }

  function startLeg(g) {
    g.turn = g.starter;
    g.visit = [];
    g.log = [];                                   // volées terminées de la manche
    if (g.type === 'x01') {
      g.scores = g.sides.map(() => g.start);
      g.visitStart = g.start;
    } else {
      g.marks = g.sides.map(() => ({ 20: 0, 19: 0, 18: 0, 17: 0, 16: 0, 15: 0, 25: 0 }));
      g.cpoints = g.sides.map(() => 0);
      g.visitGain = 0;
    }
  }

  const currentPlayer = g => { const s = g.sides[g.turn]; return s.players[s.next % s.players.length]; };

  function endVisit(g, bust) {
    const side = g.sides[g.turn];
    const total = bust ? 0 : (g.type === 'x01' ? g.visit.reduce((a, d) => a + dartScore(d), 0) : g.visitGain);
    g.log.push({ side: g.turn, player: currentPlayer(g), darts: g.visit, total, bust: !!bust });
    if (g.type === 'x01' && !bust) side.best = Math.max(side.best, total);
    side.next = (side.next + 1) % side.players.length;
    g.turn = (g.turn + 1) % g.sides.length;
    g.visit = [];
    if (g.type === 'x01') g.visitStart = g.scores[g.turn];
    else g.visitGain = 0;
  }

  function winLeg(g) {
    const side = g.sides[g.turn];
    const winnerIdx = g.turn;
    side.legs += 1;
    const total = g.type === 'x01' ? g.visit.reduce((a, d) => a + dartScore(d), 0) : g.visitGain;
    g.log.push({ side: g.turn, player: currentPlayer(g), darts: g.visit, total, bust: false, win: true });
    if (g.type === 'x01') side.best = Math.max(side.best, total);
    if (side.legs >= g.legsToWin) {
      g.finished = true;
      g.winner = winnerIdx;
      g.visit = [];
      g.last = { kind: 'match', side: winnerIdx };
      return;
    }
    side.next = (side.next + 1) % side.players.length;
    g.legNo += 1;
    g.starter = (g.starter + 1) % g.sides.length;   // on alterne celui qui commence
    startLeg(g);
    g.last = { kind: 'leg', side: winnerIdx };
  }

  /* Lance une fléchette. Renvoie le nouvel état ; state.last décrit ce qui vient de se passer :
     'dart' (rien de spécial), 'visit' (volée terminée), 'bust', 'leg' (manche gagnée), 'match'. */
  function throwDart(state, dart) {
    if (state.finished) return state;
    if (!isValidDart(dart)) throw new Error('Fléchette invalide');
    const g = clone(state);
    const side = g.sides[g.turn];
    const d = { m: dart.n === 0 ? 1 : dart.m, n: dart.n };
    g.visit.push(d);
    side.darts += 1;
    g.last = { kind: 'dart', side: g.turn, dart: d };

    if (g.type === 'x01') {
      const rem = g.scores[g.turn] - dartScore(d);
      const bust = rem < 0 || (g.doubleOut && (rem === 1 || (rem === 0 && d.m !== 2)));
      if (bust) {
        // la volée est annulée : on rend les points déjà comptés pendant cette volée
        const scoredThisVisit = g.visitStart - g.scores[g.turn];
        side.points -= scoredThisVisit;
        g.scores[g.turn] = g.visitStart;
        const who = g.turn;
        endVisit(g, true);
        g.last = { kind: 'bust', side: who };
        return g;
      }
      g.scores[g.turn] = rem;
      side.points += dartScore(d);
      if (rem === 0) { winLeg(g); return g; }
      if (g.visit.length === 3) {
        const who = g.turn, total = g.visit.reduce((a, x) => a + dartScore(x), 0);
        endVisit(g, false);
        g.last = { kind: 'visit', side: who, total };
      }
      return g;
    }

    // Cricket : trois touches pour fermer un numéro, puis il rapporte tant qu'un adversaire ne l'a pas fermé
    if (CRICKET_TARGETS.includes(d.n)) {
      const mine = g.marks[g.turn];
      for (let k = 0; k < d.m; k++) {
        if (mine[d.n] < 3) {
          mine[d.n] += 1;
          side.points += 1;
          g.visitGain += 1;
        } else if (g.marks.some((mk, i) => i !== g.turn && mk[d.n] < 3)) {
          g.cpoints[g.turn] += d.n;
          side.points += 1;
          g.visitGain += 1;
        }
      }
    }
    const closedAll = CRICKET_TARGETS.every(t => g.marks[g.turn][t] >= 3);
    const leads = g.cpoints.every((p, i) => i === g.turn || g.cpoints[g.turn] >= p);
    if (closedAll && leads) { winLeg(g); return g; }
    if (g.visit.length === 3) {
      const who = g.turn, total = g.visitGain;
      side.best = Math.max(side.best, total);
      endVisit(g, false);
      g.last = { kind: 'visit', side: who, total };
    }
    return g;
  }

  /* Moyenne par volée de trois fléchettes (x01) ou touches par volée (cricket) */
  function average(side) {
    return side.darts ? (side.points / side.darts) * 3 : 0;
  }

  /* Proposition de finish pour un reste donné, avec le nombre de fléchettes encore en main.
     Renvoie une liste de fléchettes, ou null s'il n'y a pas de finish possible. */
  const DOUBLE_PREF = [20, 16, 8, 10, 18, 12, 4, 6, 14, 2, 25, 9, 7, 5, 3, 1, 19, 17, 15, 13, 11];
  const SETUP = [];
  for (let n = 20; n >= 1; n--) SETUP.push({ m: 3, n });
  SETUP.push({ m: 2, n: 25 }, { m: 1, n: 25 });
  for (let n = 20; n >= 1; n--) SETUP.push({ m: 1, n });
  for (let n = 20; n >= 1; n--) SETUP.push({ m: 2, n });

  function finishingDart(rem, doubleOut) {
    if (doubleOut) {
      if (rem === 50) return { m: 2, n: 25 };
      if (rem % 2 === 0 && rem >= 2 && rem <= 40) return { m: 2, n: rem / 2 };
      return null;
    }
    if (rem >= 1 && rem <= 20) return { m: 1, n: rem };
    if (rem === 25) return { m: 1, n: 25 };
    if (rem === 50) return { m: 2, n: 25 };
    if (rem % 3 === 0 && rem <= 60) return { m: 3, n: rem / 3 };
    if (rem % 2 === 0 && rem <= 40) return { m: 2, n: rem / 2 };
    return null;
  }
  function finishRank(d) {
    if (d.m !== 2) return 0;
    const i = DOUBLE_PREF.indexOf(d.n);
    return i < 0 ? 99 : i;
  }

  function checkout(rem, dartsLeft, doubleOut) {
    if (!(rem > 0) || rem > 170 || dartsLeft < 1) return null;
    const one = finishingDart(rem, doubleOut);
    if (one) return [one];
    if (dartsLeft < 2) return null;
    let best = null;
    const consider = (path) => {
      const cost = path.length * 1000 + finishRank(path[path.length - 1]) * 10 + SETUP.findIndex(s => s.m === path[0].m && s.n === path[0].n) * 0.1;
      if (!best || cost < best.cost) best = { cost, path };
    };
    for (const a of SETUP) {
      const r1 = rem - dartScore(a);
      if (r1 < 2 && doubleOut) continue;
      if (r1 < 1) continue;
      const f = finishingDart(r1, doubleOut);
      if (f) consider([a, f]);
    }
    if (best || dartsLeft < 3) return best ? best.path : null;
    for (const a of SETUP) {
      const r1 = rem - dartScore(a);
      if (r1 < 3) continue;
      for (const b of SETUP) {
        const r2 = r1 - dartScore(b);
        if (r2 < 1 || (doubleOut && r2 < 2)) continue;
        const f = finishingDart(r2, doubleOut);
        if (f) consider([a, b, f]);
      }
    }
    return best ? best.path : null;
  }

  return { CRICKET_TARGETS, createGame, throwDart, currentPlayer, average, checkout, dartLabel, dartScore, isValidDart };
});

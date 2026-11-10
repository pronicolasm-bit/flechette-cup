/* Tests du moteur de score : node --test tests/ */
const test = require('node:test');
const assert = require('node:assert/strict');
const S = require('../js/scorer-engine.js');

const T = n => ({ m: 3, n }), D = n => ({ m: 2, n }), s = n => ({ m: 1, n }), MISS = { m: 1, n: 0 };
const play = (g, darts) => darts.reduce((st, d) => S.throwDart(st, d), g);
const duel = (extra) => S.createGame(Object.assign({ type: 'x01', start: 301, doubleOut: true, legsToWin: 1, sides: [{ name: 'A' }, { name: 'B' }] }, extra));

test('une volée de 180 retire 180 et passe la main', () => {
  let g = duel({ start: 501 });
  g = play(g, [T(20), T(20), T(20)]);
  assert.equal(g.scores[0], 321);
  assert.equal(g.turn, 1);
  assert.equal(g.last.kind, 'visit');
  assert.equal(g.last.total, 180);
  assert.equal(g.sides[0].best, 180);
});

test('dépasser le score est un bust : la volée entière est annulée', () => {
  let g = duel();
  g = play(g, [T(20), T(20), T(20)]);          // A : 121
  g = play(g, [MISS, MISS, MISS]);             // B
  g = play(g, [T(20), s(20)]);                 // A : 41
  g = S.throwDart(g, T(20));                   // 41 - 60 < 0
  assert.equal(g.last.kind, 'bust');
  assert.equal(g.scores[0], 121);
  assert.equal(g.turn, 1);
});

test('en double out, rester à 1 ou finir sans double est un bust', () => {
  // A fait 180 puis T20 T20 : il resterait 1 après la 2e fléchette, donc bust dès cette fléchette
  let g = duel();
  g = play(g, [T(20), T(20), T(20), MISS, MISS, MISS, T(20), T(20)]);
  assert.equal(g.last.kind, 'bust');
  assert.equal(g.scores[0], 121);
  assert.equal(g.turn, 1);
  let h = duel();
  h = play(h, [T(20), T(20), T(20), MISS, MISS, MISS, T(20), T(19), MISS, MISS, MISS, MISS]); // A : 301-180-117 = 4
  assert.equal(h.scores[0], 4);
  const noDouble = S.throwDart(h, s(4));
  assert.equal(noDouble.last.kind, 'bust');
  assert.equal(noDouble.scores[0], 4);
  const withDouble = S.throwDart(h, D(2));
  assert.equal(withDouble.finished, true);
  assert.equal(withDouble.winner, 0);
});

test('le bull compte comme un double pour finir', () => {
  let g = duel();
  g = play(g, [T(20), T(20), T(20), MISS, MISS, MISS, T(17), s(20)]);   // A : 301-180-51-20 = 50
  assert.equal(g.scores[0], 50);
  g = S.throwDart(g, { m: 2, n: 25 });
  assert.equal(g.finished, true);
});

test('en simple out, on finit sur n\'importe quelle fléchette', () => {
  let g = duel({ doubleOut: false });
  g = play(g, [T(20), T(20), T(20), MISS, MISS, MISS, T(20), T(20), s(1)]);
  assert.equal(g.finished, true);
  assert.equal(g.winner, 0);
});

test('les manches : le premier à legsToWin gagne, et celui qui commence alterne', () => {
  let g = duel({ legsToWin: 2, doubleOut: false });
  const win = [T(20), T(20), T(20), MISS, MISS, MISS, T(20), T(20), s(1)];
  g = play(g, win);
  assert.equal(g.finished, false);
  assert.equal(g.sides[0].legs, 1);
  assert.equal(g.legNo, 2);
  assert.equal(g.turn, 1, 'B commence la deuxième manche');
  assert.deepEqual(g.scores, [301, 301]);
  g = play(g, [MISS, MISS, MISS].concat(win));
  assert.equal(g.finished, true);
  assert.equal(g.winner, 0);
});

test('en duo, les deux joueurs d\'un camp lancent à tour de rôle', () => {
  let g = S.createGame({ type: 'x01', start: 301, sides: [{ name: 'Duo 1', players: ['Léa', 'Tom'] }, { name: 'Duo 2', players: ['Inès', 'Sam'] }] });
  const order = [];
  for (let i = 0; i < 6; i++) { order.push(S.currentPlayer(g)); g = play(g, [MISS, MISS, MISS]); }
  assert.deepEqual(order, ['Léa', 'Inès', 'Tom', 'Sam', 'Léa', 'Inès']);
});

test('la moyenne tient compte des volées bust (0 point, fléchettes comptées)', () => {
  let g = duel();
  g = play(g, [T(20), T(20), T(20)]);                 // 180 en 3
  assert.equal(Math.round(S.average(g.sides[0])), 180);
  g = play(g, [MISS, MISS, MISS, T(20), T(20)]);      // A : 121 - 60 = 61, puis 61 - 60 = 1, bust en double out
  assert.equal(g.last.kind, 'bust');
  assert.equal(g.scores[0], 121);
  assert.equal(g.sides[0].darts, 5);
  assert.equal(g.sides[0].points, 180, 'les 60 points de la volée bust sont rendus');
});

test('l\'état d\'origine n\'est jamais modifié', () => {
  const g = duel();
  const copy = JSON.stringify(g);
  S.throwDart(g, T(20));
  assert.equal(JSON.stringify(g), copy);
});

test('fléchettes invalides refusées', () => {
  assert.equal(S.isValidDart({ m: 3, n: 25 }), false);
  assert.equal(S.isValidDart({ m: 1, n: 21 }), false);
  assert.throws(() => S.throwDart(duel(), { m: 3, n: 25 }));
});

test('finish : propositions classiques', () => {
  const label = p => p.map(S.dartLabel).join(' ');
  assert.equal(label(S.checkout(170, 3, true)), 'T20 T20 Bull');
  assert.equal(label(S.checkout(40, 3, true)), 'D20');
  assert.equal(label(S.checkout(32, 1, true)), 'D16');
  assert.equal(label(S.checkout(100, 3, true)), 'T20 D20');
  assert.equal(S.checkout(169, 3, true), null);
  assert.equal(S.checkout(100, 1, true), null);
  assert.equal(S.checkout(1, 3, true), null);
  // toute proposition doit tomber juste et finir par un double
  for (let rem = 2; rem <= 170; rem++) {
    const p = S.checkout(rem, 3, true);
    if (!p) continue;
    assert.equal(p.reduce((a, d) => a + S.dartScore(d), 0), rem, `reste ${rem}`);
    assert.equal(p[p.length - 1].m, 2, `reste ${rem} finit par un double`);
    assert.ok(p.every(S.isValidDart));
  }
  // les restes sans finish en trois fléchettes sont bien les sept connus
  const impossible = [];
  for (let rem = 2; rem <= 170; rem++) if (!S.checkout(rem, 3, true)) impossible.push(rem);
  assert.deepEqual(impossible, [159, 162, 163, 165, 166, 168, 169]);
});

test('cricket : trois touches ferment, le surplus marque si l\'adversaire est ouvert', () => {
  let g = S.createGame({ type: 'cricket', sides: [{ name: 'A' }, { name: 'B' }] });
  g = play(g, [T(20), s(20), s(5)]);            // A ferme le 20 puis marque 20 ; le 5 ne compte pas
  assert.equal(g.marks[0][20], 3);
  assert.equal(g.cpoints[0], 20);
  assert.equal(g.turn, 1);
  g = play(g, [T(20), T(20), MISS]);            // B ferme le 20 : son surplus ne marque pas (A a fermé)
  assert.equal(g.marks[1][20], 3);
  assert.equal(g.cpoints[1], 0);
  g = play(g, [T(20), MISS, MISS]);             // le 20 est fermé par tous : plus de points
  assert.equal(g.cpoints[0], 20);
});

test('cricket : il faut tout fermer et mener aux points pour gagner', () => {
  let g = S.createGame({ type: 'cricket', sides: [{ name: 'A' }, { name: 'B' }] });
  // B prend de l'avance aux points sur le 20
  g = play(g, [MISS, MISS, MISS]);
  g = play(g, [T(20), T(20), T(20)]);           // B : 20 fermé + 120 points
  // A ferme tout, mais reste derrière aux points
  g = play(g, [T(20), T(19), T(18)]);
  g = play(g, [MISS, MISS, MISS]);
  g = play(g, [T(17), T(16), T(15)]);
  g = play(g, [MISS, MISS, MISS]);
  g = play(g, [D(25), s(25), MISS]);
  assert.equal(S.CRICKET_TARGETS.every(t => g.marks[0][t] === 3), true);
  assert.equal(g.finished, false, 'tout fermé mais derrière aux points : pas encore gagné');
  // A ne peut plus marquer sur le 20 (fermé par B) : il marque sur le 19, que B n'a pas fermé
  g = play(g, [MISS, MISS, MISS]);
  g = play(g, [T(19), T(19), T(19)]);           // 9 x 19 = 171 > 120
  assert.equal(g.finished, true);
  assert.equal(g.winner, 0);
});

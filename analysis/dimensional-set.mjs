// Szirtes Dimensional Set for the ring-road traffic model.
// Builds the dimensional matrix M = [B | A], computes C = -(A^-1 B)^T with exact
// fractions (Szirtes eq. 8-8 with q = 0), and checks M * U^T = 0 (eq. 8-14).
// Run: node analysis/dimensional-set.mjs

// --- exact rational arithmetic ---------------------------------------------
const gcd = (a, b) => (b === 0n ? (a < 0n ? -a : a) : gcd(b, a % b));
const fr = (n, d = 1n) => {
  n = BigInt(n); d = BigInt(d);
  if (d < 0n) { n = -n; d = -d; }
  const g = gcd(n, d) || 1n;
  return { n: n / g, d: d / g };
};
const add = (x, y) => fr(x.n * y.d + y.n * x.d, x.d * y.d);
const mul = (x, y) => fr(x.n * y.n, x.d * y.d);
const neg = x => fr(-x.n, x.d);
const div = (x, y) => fr(x.n * y.d, x.d * y.n);
const isZero = x => x.n === 0n;
const show = x => (x.d === 1n ? `${x.n}` : `${x.n}/${x.d}`);

function inverse(A) {
  const n = A.length;
  const M = A.map((row, i) => [...row, ...A.map((_, j) => fr(i === j ? 1 : 0))]);
  for (let c = 0; c < n; c++) {
    let p = c;
    while (p < n && isZero(M[p][c])) p++;
    if (p === n) throw new Error('A matrix is singular');
    [M[c], M[p]] = [M[p], M[c]];
    const piv = M[c][c];
    M[c] = M[c].map(x => div(x, piv));
    for (let r = 0; r < n; r++) {
      if (r === c || isZero(M[r][c])) continue;
      const f = M[r][c];
      M[r] = M[r].map((x, k) => add(x, neg(mul(f, M[c][k]))));
    }
  }
  return M.map(row => row.slice(n));
}
const matmul = (X, Y) => X.map(row => Y[0].map((_, j) => row.reduce((s, x, k) => add(s, mul(x, Y[k][j])), fr(0))));
const transpose = X => X[0].map((_, j) => X.map(row => row[j]));

// --- the problem -----------------------------------------------------------
const dims = ['m', 's', 'c'];
// [symbol, meaning, exponents of m, s, c]; dependent variable first (Szirtes Ch. 14)
const B = [
  ['σv', 'speed spread (dependent)', 1, -1, 0],
  ['N', 'cars on ring', 0, 0, 1],
  ['NA', 'absorbers', 0, 0, 1],
  ['L', 'ring length', 1, 0, 0],
  ['ℓ', 'car length', 1, 0, -1],
  ['s0', 'jam gap', 1, 0, -1],
  ['TA', 'absorber headway', 0, 1, -1],
  ['τ', 'reaction delay', 0, 1, 0],
  ['a', 'max acceleration', 1, -2, 0],
  ['b', 'comfortable braking', 1, -2, 0],
  ['σ', 'noise intensity', 1, [-5, 2], 0],
  ['θ', 'noise correlation time', 0, 1, 0],
  ['W', 'absorber window', 0, 1, 0],
];
const A = [
  ['v0', 'desired speed', 1, -1, 0],
  ['T', 'time headway', 0, 1, -1],
  ['n1', 'one car (lattice constant)', 0, 0, 1],
];
const toFr = e => (Array.isArray(e) ? fr(e[0], e[1]) : fr(e));
const col = v => v.slice(2).map(toFr);
const Bm = transpose(B.map(col));   // rows = dimensions
const Am = transpose(A.map(col));
const C = transpose(matmul(inverse(Am), Bm)).map(row => row.map(neg));
const D = B.map((_, i) => B.map((_, j) => fr(i === j ? 1 : 0)));

// check M * U^T = 0 (Szirtes 8-14 with q = 0)
const M = Bm.map((row, r) => [...row, ...Am[r]]);
const U = D.map((row, i) => [...row, ...C[i]]);
const check = matmul(M, transpose(U));
const ok = check.every(row => row.every(isZero));

// --- print -----------------------------------------------------------------
const names = [...B, ...A].map(v => v[0]);
const w = 6;
const pad = s => String(s).padStart(w);
console.log('Dimensional Set  (B matrix | A matrix on top; D | C below)\n');
console.log(pad('') + names.map(pad).join(''));
dims.forEach((d, r) => console.log(pad(d) + M[r].map(x => pad(show(x))).join('')));
console.log(pad('') + '-'.repeat(w * names.length));
U.forEach((row, i) => console.log(pad(`π${i + 1}`) + row.map(x => pad(show(x))).join('')));
console.log(`\nM·Uᵀ = 0 ? ${ok}`);

console.log('\nProducts read off the rows:');
U.forEach((row, i) => {
  const up = [], dn = [];
  row.forEach((x, j) => {
    if (isZero(x)) return;
    const e = x.n < 0n ? neg(x) : x;
    const term = names[j] + (show(e) === '1' ? '' : `^${show(e)}`);
    (x.n > 0n ? up : dn).push(term);
  });
  console.log(`  π${i + 1} = ${up.join('·') || '1'} / ${dn.join('·') || '1'}`);
});

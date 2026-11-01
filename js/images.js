'use strict';
// Traitement des photos : réduction, miniature, détourage du fond, couleur dominante

const WEBP = (() => {
  try { const c = document.createElement('canvas'); c.width = c.height = 1; return c.toDataURL('image/webp').startsWith('data:image/webp'); }
  catch { return false; }
})();

function chargerImage(src) {
  return new Promise((ok, ko) => {
    const url = src instanceof Blob ? URL.createObjectURL(src) : src;
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => { if (src instanceof Blob) URL.revokeObjectURL(url); ok(img); };
    img.onerror = () => { if (src instanceof Blob) URL.revokeObjectURL(url); ko(new Error('image')); };
    img.src = url;
  });
}
function versCanvas(img, max) {
  const k = Math.min(1, max / Math.max(img.naturalWidth || img.width, img.naturalHeight || img.height));
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round((img.naturalWidth || img.width) * k));
  c.height = Math.max(1, Math.round((img.naturalHeight || img.height) * k));
  c.getContext('2d', { willReadFrequently: true }).drawImage(img, 0, 0, c.width, c.height);
  return c;
}
// toDataURL (synchrone) : toBlob est parfois retardé d'une seconde par certains navigateurs
async function enBlob(c, type, q) {
  const url = c.toDataURL(type, q);
  const bin = atob(url.slice(url.indexOf(',') + 1));
  const octets = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) octets[i] = bin.charCodeAt(i);
  return new Blob([octets], { type: url.slice(5, url.indexOf(';')) });
}
const dist3 = (r1, g1, b1, r2, g2, b2) => Math.sqrt((r1 - r2) ** 2 + (g1 - g2) ** 2 + (b1 - b2) ** 2);

// photo (fichier ou blob) -> { photo, mini, detoure, couleur }
async function traiterPhoto(source) {
  const img = await chargerImage(source);
  const grand = versCanvas(img, 900);
  const [photo, mini] = await Promise.all([
    enBlob(grand, 'image/jpeg', 0.82),
    enBlob(versCanvas(grand, 320), 'image/jpeg', 0.78),
  ]);
  const { detoure, couleur } = await detourer(versCanvas(grand, 460));
  return { photo, mini, detoure, couleur };
}

// Retire un fond uni (lit, drap, mur) par remplissage depuis les bords.
async function detourer(c) {
  const w = c.width, h = c.height, ctx = c.getContext('2d', { willReadFrequently: true });
  const im = ctx.getImageData(0, 0, w, h), d = im.data;
  // couleurs du fond : les couleurs fréquentes sur les bords (ex. un mur et un lit sur la même photo)
  const bord = [];
  for (let x = 0; x < w; x += 2) bord.push(x, w + x, (h - 1) * w + x, (h - 2) * w + x);
  for (let y = 0; y < h; y += 2) bord.push(y * w, y * w + 1, y * w + w - 1, y * w + w - 2);
  const caseDe = i => (d[i * 4] >> 5) * 64 + (d[i * 4 + 1] >> 5) * 8 + (d[i * 4 + 2] >> 5);
  const cases = new Map();
  for (const i of bord) cases.set(caseDe(i), (cases.get(caseDe(i)) || 0) + 1);
  const fonds = [...cases].sort((a, b) => b[1] - a[1]).filter(([, n], k) => k === 0 || n > bord.length * 0.15).slice(0, 3)
    .map(([cle]) => {
      const dans = bord.filter(i => caseDe(i) === cle);
      const med = k => { const v = dans.map(i => d[i * 4 + k]).sort((a, b) => a - b); return v[v.length >> 1]; };
      return [med(0), med(1), med(2)];
    });
  const aFond = (r, g, b) => Math.min(...fonds.map(f => dist3(r, g, b, f[0], f[1], f[2])));
  const proches = bord.filter(i => aFond(d[i * 4], d[i * 4 + 1], d[i * 4 + 2]) < 50);
  const fondUni = proches.length > bord.length * 0.6;

  const fond = new Uint8Array(w * h);
  if (fondUni) {
    const T = 38, pile = [];
    for (const i of proches) { fond[i] = 1; pile.push(i); }
    while (pile.length) {
      const i = pile.pop(), x = i % w;
      const voisins = [x > 0 ? i - 1 : -1, x < w - 1 ? i + 1 : -1, i - w, i + w];
      for (const j of voisins) {
        if (j < 0 || j >= w * h || fond[j]) continue;
        const r = d[j * 4], g = d[j * 4 + 1], b = d[j * 4 + 2];
        const ecart = aFond(r, g, b);
        const aVoisin = dist3(r, g, b, d[i * 4], d[i * 4 + 1], d[i * 4 + 2]);
        if (ecart < T || (aVoisin < 7 && ecart < T * 2.2)) { fond[j] = 1; pile.push(j); }
      }
    }
  }
  // on ne garde que le plus grand morceau ; si le vêtement est en miettes, le détourage est raté
  const comp = new Int32Array(w * h).fill(-1), tailles = [];
  for (let s = 0; s < w * h; s++) {
    if (fond[s] || comp[s] >= 0) continue;
    const id = tailles.length, pile = [s];
    let t = 0;
    comp[s] = id;
    while (pile.length) {
      const i = pile.pop(), x = i % w;
      t++;
      for (const j of [x > 0 ? i - 1 : -1, x < w - 1 ? i + 1 : -1, i - w, i + w])
        if (j >= 0 && j < w * h && !fond[j] && comp[j] < 0) { comp[j] = id; pile.push(j); }
    }
    tailles.push(t);
  }
  const total = tailles.reduce((a, b) => a + b, 0);
  const grand = tailles.indexOf(Math.max(0, ...tailles));
  for (let i = 0; i < w * h; i++) if (!fond[i] && comp[i] !== grand) fond[i] = 1;
  const entier = total > 0 && tailles[grand] > total * 0.85;

  let n = 0, x0 = w, y0 = h, x1 = 0, y1 = 0;
  const px = [];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = y * w + x;
    if (fond[i]) continue;
    n++;
    if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
    if ((x + y) % 3 === 0) px.push(i);
  }
  const ratio = n / (w * h);
  // un vêtement bien détouré touche au plus deux bords de la photo
  const bords = (x0 === 0) + (y0 === 0) + (x1 === w - 1) + (y1 === h - 1);
  const surBord = bord.filter(i => !fond[i]).length / bord.length;
  const reussi = fondUni && entier && bords <= 2 && surBord < 0.2 && ratio > 0.06 && ratio < 0.93;
  const couleur = couleurDominante(d, reussi ? px : centre(w, h));
  if (!reussi) return { detoure: null, couleur };

  // transparence + bord adouci
  for (let i = 0; i < w * h; i++) {
    if (fond[i]) { d[i * 4 + 3] = 0; continue; }
    const x = i % w;
    if ((x > 0 && fond[i - 1]) || (x < w - 1 && fond[i + 1]) || (i >= w && fond[i - w]) || (i + w < w * h && fond[i + w])) d[i * 4 + 3] = 140;
  }
  ctx.putImageData(im, 0, 0);
  const out = document.createElement('canvas');
  out.width = x1 - x0 + 1; out.height = y1 - y0 + 1;
  out.getContext('2d').drawImage(c, x0, y0, out.width, out.height, 0, 0, out.width, out.height);
  const detoure = await enBlob(out, WEBP ? 'image/webp' : 'image/png', 0.85);
  return { detoure, couleur };
}
function centre(w, h) {
  const r = [];
  for (let y = Math.floor(h * 0.25); y < h * 0.75; y += 3)
    for (let x = Math.floor(w * 0.25); x < w * 0.75; x += 3) r.push(y * w + x);
  return r;
}
function couleurDominante(d, indices) {
  if (!indices.length) return null;
  const med = k => { const v = indices.map(i => d[i * 4 + k]).sort((a, b) => a - b); return v[v.length >> 1]; };
  const r = med(0), g = med(1), b = med(2);
  let best = null, bd = Infinity;
  for (const c of COULEURS) {
    if (!c.hex.startsWith('#')) continue;
    const [cr, cg, cb] = [1, 3, 5].map(k => parseInt(c.hex.slice(k, k + 2), 16));
    const dd = dist3(r, g, b, cr, cg, cb);
    if (dd < bd) { bd = dd; best = c.id; }
  }
  return best;
}

// ---------- Teint ----------
// moyenne d'une zone de peau autour du point touché (coordonnées 0..1)
function echantillonPeau(img, fx, fy) {
  const c = versCanvas(img, 600), w = c.width, h = c.height;
  const ctx = c.getContext('2d', { willReadFrequently: true });
  const r = Math.max(4, Math.round(Math.min(w, h) * 0.03));
  const x = Math.min(w - r - 1, Math.max(r, Math.round(fx * w))), y = Math.min(h - r - 1, Math.max(r, Math.round(fy * h)));
  const d = ctx.getImageData(x - r, y - r, 2 * r, 2 * r).data;
  const v = [[], [], []];
  for (let i = 0; i < d.length; i += 4) for (let k = 0; k < 3; k++) v[k].push(d[i + k]);
  return v.map(a => { a.sort((p, q) => p - q); return a[a.length >> 1]; }); // médiane : ignore reflets et ombres
}
function rgbVersLab([r, g, b]) {
  const lin = u => { u /= 255; return u > 0.04045 ? ((u + 0.055) / 1.055) ** 2.4 : u / 12.92; };
  const [R, G, B] = [lin(r), lin(g), lin(b)];
  const f = t => t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116;
  const X = f((R * 0.4124 + G * 0.3576 + B * 0.1805) / 0.95047);
  const Y = f(R * 0.2126 + G * 0.7152 + B * 0.0722);
  const Z = f((R * 0.0193 + G * 0.1192 + B * 0.9505) / 1.08883);
  return [116 * Y - 16, 500 * (X - Y), 200 * (Y - Z)];
}
// visage rond pour la silhouette
async function recadrerVisage(img, fx, fy) {
  const c = versCanvas(img, 700), w = c.width, h = c.height;
  const t = Math.round(Math.min(w, h) * 0.5);
  const x = Math.min(w - t, Math.max(0, Math.round(fx * w - t / 2))), y = Math.min(h - t, Math.max(0, Math.round(fy * h - t * 0.55)));
  const o = document.createElement('canvas');
  o.width = o.height = 220;
  o.getContext('2d').drawImage(c, x, y, t, t, 0, 0, 220, 220);
  return enBlob(o, 'image/jpeg', 0.85);
}

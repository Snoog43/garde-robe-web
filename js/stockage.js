'use strict';
// Stockage local au téléphone (IndexedDB) : vêtements, favoris, profil (teint, visage)

let db;
function ouvrirBase() {
  return new Promise((ok, ko) => {
    const r = indexedDB.open('garde-robe', 3);
    r.onupgradeneeded = () => {
      const noms = r.result.objectStoreNames;
      for (const s of ['vetements', 'favoris', 'profil', 'essais'])
        if (!noms.contains(s)) r.result.createObjectStore(s, { keyPath: 'id' });
    };
    r.onsuccess = () => { db = r.result; ok(); };
    r.onerror = () => ko(r.error);
  });
}
function tx(store, mode, fn) {
  return new Promise((ok, ko) => {
    const t = db.transaction(store, mode);
    const res = fn(t.objectStore(store));
    t.oncomplete = () => ok(res && 'result' in res ? res.result : undefined);
    t.onerror = () => ko(t.error);
  });
}
const lireTout = s => tx(s, 'readonly', st => st.getAll());
const ecrire = (s, obj) => tx(s, 'readwrite', st => st.put(obj));
const ecrireTout = (s, objs) => tx(s, 'readwrite', st => { objs.forEach(o => st.put(o)); });
const effacer = (s, id) => tx(s, 'readwrite', st => st.delete(id));
const lire = (s, id) => tx(s, 'readonly', st => st.get(id));
const nouvelId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

const etat = { vetements: [], favoris: [], profil: {} };

async function recharger() {
  const [v, f, p] = await Promise.all([lireTout('vetements'), lireTout('favoris'), lireTout('profil')]);
  etat.vetements = v.sort((a, b) => b.cree - a.cree);
  etat.favoris = f.sort((a, b) => b.cree - a.cree);
  etat.profil = Object.fromEntries(p.map(x => [x.id, x.val]));
}
const sauverProfil = (id, val) => ecrire('profil', { id, val }).then(() => { etat.profil[id] = val; });

// détourage fait sur le PC (outils/preparer.py, plus fiable que celui du navigateur) ; sa longueur sert de version
async function detourePc(v) {
  if (!imageIntegree(v.detourePc)) return {};
  return { detoure: await (await fetch(v.detourePc)).blob(), detourePc: v.detourePc.length };
}
// anciennes données (photo en texte data:) ou import : on recalcule miniature et détourage
async function completerImages(v) {
  if (v.photo instanceof Blob && v.mini instanceof Blob && 'detoure' in v) return v;
  const src = typeof v.photo === 'string' ? await (await fetch(v.photo)).blob() : v.photo;
  const t = await traiterPhoto(src);
  const pc = await detourePc(v);
  return { ...v, photo: t.photo, mini: t.mini, detoure: t.detoure, couleur: v.couleur || t.couleur, maj: Date.now(), ...pc };
}
async function migrer(progres) {
  const aFaire = etat.vetements.filter(v => !(v.photo instanceof Blob && v.mini instanceof Blob && 'detoure' in v));
  for (const [i, v] of aFaire.entries()) {
    progres && progres(i + 1, aFaire.length);
    try { await ecrire('vetements', await completerImages(v)); } catch { /* photo illisible : laissée telle quelle */ }
  }
  if (aFaire.length) await recharger();
}

// ---------- Adresses d'images (créées à la demande, gardées en cache) ----------
const cacheUrl = new Map();
function urlImage(v, type) {
  const blob = v[type] || (type === 'detoure' ? null : v.photo);
  if (!blob) return null;
  if (typeof blob === 'string') return blob;
  const cle = `${v.id}:${type}:${v.maj || v.cree}`;
  if (!cacheUrl.has(cle)) cacheUrl.set(cle, URL.createObjectURL(blob));
  return cacheUrl.get(cle);
}

// ---------- Sauvegarde / restauration (fichier JSON) ----------
const blobVersTexte = b => new Promise(ok => { const r = new FileReader(); r.onload = () => ok(r.result); r.readAsDataURL(b); });
async function exporter() {
  const vetements = [];
  for (const v of etat.vetements)
    vetements.push({ ...v, photo: v.photo instanceof Blob ? await blobVersTexte(v.photo) : v.photo, mini: undefined, detoure: undefined });
  const profil = { ...etat.profil };
  for (const k of ['visage', 'corps', 'selfie']) if (profil[k] instanceof Blob) profil[k] = await blobVersTexte(profil[k]);
  return new Blob([JSON.stringify({ version: 2, vetements, favoris: etat.favoris, profil })], { type: 'application/json' });
}
// un fichier importé n'est pas sûr : on ne garde que des images intégrées et des valeurs connues
const imageIntegree = s => typeof s === 'string' && /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(s);
const parmi = (liste, id) => liste.some(x => x.id === id);
const texteCourt = s => typeof s === 'string' ? s.slice(0, 60) : '';
function vetementValide(v) {
  if (!v || !imageIntegree(v.photo)) return null;
  return {
    id: String(v.id || nouvelId()).slice(0, 40), cree: +v.cree || Date.now(), porte: +v.porte || 0, photo: v.photo,
    cat: parmi(CATS, v.cat) ? v.cat : null,
    couleur: parmi(COULEURS, v.couleur) ? v.couleur : null,
    saisons: (Array.isArray(v.saisons) ? v.saisons : []).filter(s => parmi(SAISONS, s)),
    occasions: (Array.isArray(v.occasions) ? v.occasions : []).filter(s => parmi(OCCASIONS, s)),
    encolure: parmi(ENCOLURES, v.encolure) ? v.encolure : null,
    nom: texteCourt(v.nom),
    ...(imageIntegree(v.detoure) ? { detourePc: v.detoure } : {}),
  };
}
function teintValide(t) {
  if (!t || !(t.saison in PALETTES)) return null;
  return { ...t, peau: /^rgb\(\d{1,3},\d{1,3},\d{1,3}\)$/.test(t.peau) ? t.peau : 'rgb(222,184,160)' };
}
// ajout : n'ajoute que les vêtements jamais reçus et ne remplace pas le profil déjà rempli
async function importer(fichier, progres, ajout = false) {
  const d = JSON.parse(await fichier.text());
  if (!Array.isArray(d.vetements)) throw new Error('format');
  const recus = new Set(reglage('recus') || []);
  const vetements = d.vetements.map(vetementValide).filter(v => v && !(ajout && recus.has(v.id)));
  for (const [i, v] of vetements.entries()) {
    progres && progres(i + 1, vetements.length);
    if (!v.saisons.length) v.saisons = ['hiver', 'mi', 'ete'];
    if (!v.occasions.length) v.occasions = ['quotidien'];
    await ecrire('vetements', await completerImages(v));
    recus.add(v.id);
    reglage('recus', [...recus]);
  }
  if (Array.isArray(d.favoris)) await ecrireTout('favoris', d.favoris
    .filter(f => f && Array.isArray(f.ids) && typeof f.cle === 'string')
    .map(f => ({ id: String(f.id || nouvelId()).slice(0, 40), cree: +f.cree || Date.now(), cle: f.cle.slice(0, 2000), ids: f.ids.map(String), titre: texteCourt(f.titre) })));
  const p = d.profil || {};
  if (teintValide(p.teint) && !(ajout && etat.profil.teint)) await sauverProfil('teint', teintValide(p.teint));
  for (const k of ['visage', 'corps', 'selfie']) if (imageIntegree(p[k]) && !(ajout && etat.profil[k])) {
    await sauverProfil(k, await (await fetch(p[k])).blob());
    await sauverProfil(k + 'Maj', Date.now());
  }
  // vêtements déjà reçus : on récupère le nouveau détourage s'il a changé
  let majs = 0;
  if (ajout) for (const v of d.vetements.map(vetementValide)) {
    const local = v?.detourePc && etat.vetements.find(x => x.id === v.id);
    if (!local || local.detourePc === v.detourePc.length) continue;
    await ecrire('vetements', { ...local, ...await detourePc(v), maj: Date.now() });
    majs++;
  }
  d.vetements = vetements;
  if (vetements.length || majs || !ajout) await recharger();
  if (ajout && majs) etat.detouresMaj = majs;
  return d.vetements.length;
}

// ---------- Petits réglages (localStorage, peut être bloqué) ----------
function reglage(cle, val) {
  try {
    if (val === undefined) return JSON.parse(localStorage.getItem('gr-' + cle));
    localStorage.setItem('gr-' + cle, JSON.stringify(val));
  } catch { return null; }
}

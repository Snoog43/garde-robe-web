'use strict';
// Essayage réaliste : une IA d'image (Gemini, via Puter) habille la photo de la personne avec ses vêtements.
// Puter fonctionne sans clé : la personne se connecte à son compte Puter, qui paie l'image (crédit gratuit mensuel).

const MODELE_ESSAI = 'gemini-3.1-flash-image';
let chargementPuter;
function chargerPuter() {
  if (window.puter) return Promise.resolve();
  chargementPuter ||= new Promise((ok, ko) => {
    const s = document.createElement('script');
    s.src = 'https://js.puter.com/v2/';
    s.onload = () => ok();
    s.onerror = () => { chargementPuter = null; ko(new Error('reseau')); };
    document.head.append(s);
  });
  return chargementPuter;
}

const NOMS_EN = {
  haut: 'top', bas: 'trousers or skirt', robe: 'dress', veste: 'jacket or coat (worn open over the rest)',
  chaussures: 'shoes', accessoire: 'bag or accessory',
};
// Comme un « changeur de vêtements » : on retouche SA photo, seuls les vêtements changent.
function consigne(pieces, enPied) {
  const liste = pieces.map((p, i) => `Image ${i + 2}: ${NOMS_EN[p.cat]}${p.nom ? ` ("${p.nom}")` : ''}.`).join('\n');
  const garder = 'Keep her face, expression, hairstyle, skin tone, age and body shape exactly as in image 1; do not make her younger or thinner.';
  const fidele = 'Reproduce each garment faithfully: same color, pattern, material and cut, fitted naturally to her body with realistic folds and shadows.';
  if (!enPied) return `Image 1 shows a woman's face. The next images are garments from her own wardrobe, each photographed alone:
${liste}
Create one realistic full-length photograph of this SAME woman wearing exactly these garments together, as one outfit.
${garder}
${fidele} Do not add any other clothing item or jewelry.
Natural standing pose, head to toe visible, soft daylight, plain warm beige background, photorealistic, no text.`;
  const seule = pieces.length === 1
    ? `Change only her ${NOMS_EN[pieces[0].cat]}; keep all her other clothes exactly as they are.`
    : 'Replace her outfit with these garments, and nothing else.';
  return `Edit image 1, a photo of a woman, as a virtual try-on. The next images are garments from her own wardrobe, each photographed alone:
${liste}
Dress her in these garments. ${seule}
${garder}
Keep the same pose, the same camera framing, the same background and the same lighting as image 1.
${fidele} Do not add jewelry or accessories.
The result must look like the original photo, as if she had really been wearing these clothes when it was taken. Photorealistic, no text.`;
}
// formats d'image acceptés par le modèle : on prend le plus proche de sa photo
const FORMATS = [[1, 1], [2, 3], [3, 2], [3, 4], [4, 3], [4, 5], [5, 4], [9, 16], [16, 9]];
async function formatDe(blob) {
  try {
    const b = await createImageBitmap(blob), r = b.width / b.height;
    b.close();
    const [w, h] = FORMATS.reduce((m, f) => Math.abs(Math.log(f[0] / f[1] / r)) < Math.abs(Math.log(m[0] / m[1] / r)) ? f : m);
    return { w, h };
  } catch { return { w: 3, h: 4 }; }
}

const blobEnTexte = b => new Promise(ok => { const r = new FileReader(); r.onload = () => ok(r.result); r.readAsDataURL(b); });
function photoPersonne() {
  const p = etat.profil;
  if (p.corps instanceof Blob) return { blob: p.corps, enPied: true, version: p.corpsMaj || 1 };
  if (p.visage instanceof Blob) return { blob: p.visage, enPied: false, version: p.visageMaj || 1 };
  return null;
}
const cleEssai = (t, pers) => `${t.cle}#${pers.version}`;
const urlPersonne = pers => urlImage({ id: 'personne', personne: pers.blob, maj: pers.version }, 'personne');
// un seul vêtement, comme le bouton « Essayer » d'une boutique en ligne
const essayerPiece = v => ouvrirEssai({ cle: 'piece:' + v.id, pieces: [v], titre: nomVetement(v) });

// ---------- Feuille d'essayage ----------
// Comme sur les boutiques (Genlook) : sa photo une seule fois, puis le résultat de chaque vêtement en un clic.
const feuilleEssai = $('#feuille-essai');
let essaiCourant = null;

async function ouvrirEssai(t) {
  essaiCourant = t;
  $('#essai-titre').textContent = 'Essayer';
  if (!feuilleEssai.open) feuilleEssai.showModal();
  const pers = photoPersonne();
  if (!pers) return afficherEssai(etapes(1), etapePhoto(t));
  const deja = await lire('essais', cleEssai(t, pers)) || await lire('essais', cleEssai(t, pers) + GRATUIT);
  if (deja) return afficherEssai(etapes(2), etapeResultat(deja.image, t));
  if (toutGratuit(t)) {
    const debut = Date.now();
    afficherEssai(etapes(2), etapeAttente(t, 'Services gratuits partagés : de 30 secondes à 2 minutes.'));
    try {
      const blob = await fabriquerGratuit(t);
      if (essaiCourant === t) afficherEssai(etapes(2), etapeResultat(blob, t, Date.now() - debut));
      return;
    } catch { if (essaiCourant !== t) return; }
  }
  afficherEssai(etapes(2), etapeAttente(t, 'Préparation…'));
  try { await chargerPuter(); }
  catch { return afficherEssai(etapes(2), etapeErreur('Pas de connexion internet. Réessayez plus tard.')); }
  if (!puter.auth.isSignedIn()) return afficherEssai(etapes(2), etapeConnexion());
  generer();
}
function afficherEssai(...contenu) { remplacer($('#essai-corps'), contenu); }

// 1 Votre photo — 2 Le résultat
function etapes(n) {
  return el('div', { class: 'etapes' }, ['Votre photo', 'Le résultat'].map((txt, i) =>
    el('div', { class: 'etape' + (i < n ? ' faite' : '') }, el('b', {}, String(i + 1)), txt)));
}
const miniPieces = t => el('div', { class: 'essai-mini' },
  t.pieces.map(p => el('img', { src: urlImage(p, 'mini'), alt: nomVetement(p), title: nomVetement(p) })));
function etapePhoto(t) {
  const pers = photoPersonne(), enPied = pers?.enPied;
  return [
    el('h3', { class: 'centre' }, enPied ? 'Votre photo' : 'Prête à l\'essayer ?'),
    el('p', { class: 'discret centre' }, 'Ajoutez une photo de vous une seule fois, puis essayez n\'importe quel vêtement. Idéal : debout, de face, de la tête aux pieds, devant un mur clair.'),
    enPied ? el('img', { class: 'photo-pied', src: urlPersonne(pers), alt: 'Votre photo' }) : miniPieces(t),
    champPhotoPied(() => ouvrirEssai(t), { texte: enPied ? 'Changer ma photo' : '＋ Choisir ma photo', principal: !enPied }),
    champPhotoPied(() => ouvrirEssai(t), { texte: '📷 Prendre une photo dans un miroir', capture: 'environment' }),
    pers ? el('button', { class: 'btn plein', onclick: () => ouvrirEssai(t) }, 'Continuer avec cette photo') : null,
  ];
}
function etapeConnexion() {
  return [
    el('p', {}, 'Ce vêtement passe par une intelligence artificielle d\'images (Gemini de Google), via le service Puter.'),
    el('ul', { class: 'discret' },
      el('li', {}, 'Une seule fois : créez un compte Puter gratuit (ou connectez-vous).'),
      el('li', {}, 'Puter offre un petit crédit gratuit chaque mois. Au-delà, comptez quelques centimes par image, payés sur votre compte Puter.'),
      el('li', {}, 'Votre photo et celles des vêtements sont envoyées à Puter et Google pour créer l\'image.')),
    el('button', {
      class: 'btn plein', onclick: async () => {
        try { await puter.auth.signIn(); } catch { return toast('Connexion annulée'); }
        if (puter.auth.isSignedIn()) generer();
      },
    }, 'Se connecter à Puter'),
  ];
}
// sa photo + le vêtement → le résultat, avec un chrono qui tourne
function etapeAttente(t, txt) {
  const pers = photoPersonne(), debut = Date.now();
  const chrono = el('b', {}, '0 s');
  const tic = setInterval(() => {
    if (!chrono.isConnected) return clearInterval(tic);
    chrono.textContent = Math.round((Date.now() - debut) / 1000) + ' s';
  }, 500);
  return [el('div', { class: 'attente' },
    t && pers ? el('div', { class: 'essai-formule' },
      el('img', { class: 'moi', src: urlPersonne(pers), alt: '' }), el('span', {}, '+'), miniPieces(t), el('span', {}, '→'), el('div', { class: 'roue' }))
      : el('div', { class: 'roue' }),
    el('div', {}, 'Je vous habille… ', chrono),
    el('div', { class: 'discret' }, txt))];
}
function etapeErreur(txt) {
  return [el('p', { class: 'erreur' }, txt), el('button', { class: 'btn doux plein', onclick: () => generer() }, 'Réessayer')];
}
function etapeResultat(blob, t, duree) {
  return [
    avantApres(blob, t),
    el('p', { class: 'discret centre' }, (duree ? `Créée en ${(duree / 1000).toFixed(1).replace('.', ',')} s · ` : '')
      + (t.pieces.length === 1 && t.pieces[0].cat === 'bas' ? 'Seul le bas compte : le haut est inventé. ' : '')
      + 'Glissez le trait pour comparer. Image créée par IA : les détails peuvent un peu différer.'),
    el('div', { class: 'duo' },
      el('button', { class: 'btn doux', onclick: () => refaire(t) }, '↻ Refaire'),
      el('button', { class: 'btn', onclick: () => partager(blob) }, 'Enregistrer')),
    el('button', { class: 'btn doux plein', onclick: () => afficherEssai(etapes(1), etapePhoto(t)) }, 'Changer ma photo'),
  ];
}
async function refaire(t) {
  const cle = cleEssai(t, photoPersonne());
  await effacer('essais', cle);
  await effacer('essais', cle + GRATUIT);
  ouvrirEssai(t);
}

// ---------- Mes essais : tous les essais déjà faits, gardés sur le téléphone ----------
const urlEssai = e => urlImage({ id: 'essai:' + e.id, image: e.image, maj: e.cree }, 'image');
const dateEssai = e => new Date(e.cree).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' });
async function ouvrirHistorique() {
  essaiCourant = null;
  $('#essai-titre').textContent = 'Mes essais';
  if (!feuilleEssai.open) feuilleEssai.showModal();
  const liste = (await lireTout('essais')).filter(e => e.image instanceof Blob).sort((a, b) => b.cree - a.cree);
  if (!liste.length) return afficherEssai(el('p', { class: 'discret centre' }, 'Aucun essai pour l\'instant. Touchez « ✨ Essayer » sur un vêtement de votre garde-robe.'));
  afficherEssai(el('div', { class: 'grille' }, liste.map(e => el('button', { type: 'button', class: 'vet', onclick: () => voirEssai(e) },
    el('img', { src: urlEssai(e), alt: e.titre || 'Essai', loading: 'lazy' }),
    el('div', { class: 'nom' }, e.titre || dateEssai(e))))));
}
function voirEssai(e) {
  afficherEssai(
    el('img', { class: 'essai-img', src: urlEssai(e), alt: e.titre || 'Essai' }),
    el('p', { class: 'discret centre' }, (e.titre ? e.titre + ' · ' : '') + dateEssai(e)),
    el('div', { class: 'duo' },
      el('button', { class: 'btn doux', onclick: ouvrirHistorique }, '‹ Mes essais'),
      el('button', { class: 'btn', onclick: () => partager(e.image) }, 'Enregistrer')),
    el('button', {
      class: 'btn danger plein', onclick: async () => { await effacer('essais', e.id); toast('Essai supprimé'); ouvrirHistorique(); },
    }, 'Supprimer cet essai'));
}
$('#btn-historique').onclick = ouvrirHistorique;
$('#btn-mes-essais').onclick = ouvrirHistorique;

// avant / après : on fait glisser le curseur pour comparer avec sa photo d'origine
function avantApres(blob, t) {
  const apres = el('img', { class: 'essai-img', src: URL.createObjectURL(blob), alt: `Vous avec « ${t.titre} »` });
  const pers = photoPersonne();
  if (!pers?.enPied) return apres;
  const avant = el('img', { class: 'aa-avant', src: URL.createObjectURL(pers.blob), alt: 'Votre photo d\'origine' });
  const curseur = el('input', { type: 'range', min: 0, max: 100, value: 50, class: 'aa-curseur', 'aria-label': 'Comparer avant et après' });
  const boite = el('div', { class: 'avant-apres' }, apres, avant, el('div', { class: 'aa-trait' }), curseur,
    el('span', { class: 'aa-tag g' }, 'Avant'), el('span', { class: 'aa-tag d' }, 'Après'));
  const placer = () => boite.style.setProperty('--x', curseur.value + '%');
  curseur.oninput = placer;
  placer();
  return boite;
}

// Une image coûte environ 220 crédits Puter (mesuré : 860 pour 4 images) et le compte gratuit en a 1000 par mois.
// On vérifie avant d'appeler : sinon Puter ouvre sa propre fenêtre « Low Balance ».
const COUT_IMAGE = 230;
async function creditSuffisant() {
  try {
    const reste = (await puter.auth.getMonthlyUsage()).allowanceInfo?.remaining;
    return typeof reste !== 'number' || reste >= COUT_IMAGE;
  } catch { return true; }
}

// une seule fabrication à la fois par tenue (la carte et la feuille peuvent la demander ensemble)
const enFabrication = new Map();
function fabriquerEssai(t) {
  const pers = photoPersonne(), cle = cleEssai(t, pers);
  if (!enFabrication.has(cle)) enFabrication.set(cle, (async () => {
    if (!(await creditSuffisant())) throw { code: 'insufficient_funds' };
    const images = [await blobEnTexte(pers.blob)];
    for (const p of t.pieces) images.push(await blobEnTexte((etat.vetements.find(x => x.id === p.id) || p).photo));
    const img = await puter.ai.txt2img(consigne(t.pieces, pers.enPied), {
      model: MODELE_ESSAI, input_images: images, ratio: pers.enPied ? await formatDe(pers.blob) : { w: 3, h: 4 }, quality: '1K',
    });
    const blob = await (await fetch(img.src)).blob();
    await ecrire('essais', { id: cle, image: blob, cree: Date.now(), titre: t.titre });
    return blob;
  })().finally(() => enFabrication.delete(cle)));
  return enFabrication.get(cle);
}
function messageErreur(e) {
  const code = e?.code || e?.errorCode || e?.error?.code || '';
  return /insufficient_funds/.test(code + (e?.message || ''))
    ? 'Le crédit Puter de ce mois est épuisé (environ 4 tenues complètes offertes par mois). Le haut reste gratuit ; pour la tenue complète, ajoutez du crédit sur puter.com ou attendez le mois prochain.'
    : 'L\'image n\'a pas pu être créée. Vérifiez la connexion internet et réessayez.';
}

async function generer() {
  const t = essaiCourant;
  if (!t || !photoPersonne()) return;
  const debut = Date.now();
  afficherEssai(etapes(2), etapeAttente(t, 'Habituellement de 15 à 40 secondes.'));
  try {
    const blob = await fabriquerEssai(t);
    if (essaiCourant === t) afficherEssai(etapes(2), etapeResultat(blob, t, Date.now() - debut));
  } catch (e) {
    if (essaiCourant === t) afficherEssai(etapes(2), etapeErreur(messageErreur(e)));
  }
}

// ---------- Version gratuite : Texelmoda (bas, robe) puis Kolors (haut), sur Hugging Face ----------
// Gratuits et sans compte, avec une file d'attente partagée. Il leur faut des vêtements bien détourés
// (outils/preparer.py, sur le PC). Texelmoda pose le bas ou la robe (résultat variable : « Refaire ») ;
// Kolors repose ensuite le vrai haut par-dessus, qu'il rend fidèlement, puis la veste (qui peut cacher le haut).
const KOLORS = 'https://kwai-kolors-kolors-virtual-try-on.hf.space';
const TEXEL = 'https://texelmoda-virtual-try-on-diffusion-vton-d.hf.space';
const GRATUIT = '#gratuit3';  // version 3 (avec la veste) : les essais des versions précédentes ne sont plus repris
const CATS_GRATUITES = ['haut', 'bas', 'robe', 'veste'];
const complet = p => etat.vetements.find(x => x.id === p.id) || p;
const piecesGratuites = t => {
  const d = t.pieces.map(complet).filter(p => CATS_GRATUITES.includes(p.cat) && p.detoure);
  const robe = d.find(p => p.cat === 'robe'), veste = d.find(p => p.cat === 'veste');
  return [...(robe ? [robe] : [d.find(p => p.cat === 'haut'), d.find(p => p.cat === 'bas')]), veste].filter(Boolean);
};
const gratuitPossible = t => !!photoPersonne()?.enPied && piecesGratuites(t).length > 0;
const toutGratuit = t => gratuitPossible(t) && piecesGratuites(t).length === t.pieces.length;
// ce que la version gratuite ne montre pas (ex. « la veste »)
const NOMS_CAT = { haut: 'le haut', bas: 'le bas', robe: 'la robe', veste: 'la veste', chaussures: 'les chaussures', accessoire: 'l\'accessoire' };
const manquesGratuit = t => {
  const ids = new Set(piecesGratuites(t).map(p => p.id));
  return [...new Set(t.pieces.filter(p => !ids.has(p.id)).map(p => NOMS_CAT[p.cat] || 'une pièce'))].join(', ');
};

async function enJpeg(blob, fond) {
  const img = await chargerImage(blob);
  if (!fond) return enBlob(versCanvas(img, 1024), 'image/jpeg', 0.9);
  // vêtement centré sur fond blanc : le modèle ne doit voir que lui
  const c = document.createElement('canvas');
  c.width = 768; c.height = 1024;
  const g = c.getContext('2d'), k = Math.min(700 / img.width, 950 / img.height);
  g.fillStyle = '#fff';
  g.fillRect(0, 0, c.width, c.height);
  g.drawImage(img, (c.width - img.width * k) / 2, (c.height - img.height * k) / 2, img.width * k, img.height * k);
  return enBlob(c, 'image/jpeg', 0.9);
}
// appel d'un Space Gradio par sa file d'attente (comme sa propre page web) ; une 2e tentative si la file sature
const gradio = (...args) => gradioUneFois(...args).catch(() => gradioUneFois(...args));
async function gradioUneFois(base, fichiers, donnees, fn_index) {
  const f = new FormData();
  fichiers.forEach((b, i) => f.append('files', b, `image${i}.jpg`));
  const r = await fetch(base + '/upload', { method: 'POST', body: f });
  if (!r.ok) throw new Error('gratuit');
  const chemins = (await r.json()).map(path => ({ path, meta: { _type: 'gradio.FileData' } }));
  const h = Math.random().toString(36).slice(2);
  const j = await fetch(base + '/queue/join', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ data: donnees(chemins), fn_index, session_hash: h }),
  });
  if (!j.ok) throw new Error('gratuit');
  const url = await new Promise((ok, ko) => {
    const es = new EventSource(`${base}/queue/data?session_hash=${h}`);
    const fin = m => { clearTimeout(delai); es.close(); m ? ko(m) : null; };
    const delai = setTimeout(() => fin(new Error('gratuit')), 300000);
    es.onmessage = e => {
      const m = JSON.parse(e.data);
      if (m.msg !== 'process_completed') return;
      fin();
      const u = m.success && m.output?.data?.[0]?.url;
      typeof u === 'string' && u.startsWith(new URL(base).origin + '/') ? ok(u) : ko(new Error('gratuit'));
    };
    es.onerror = () => fin(new Error('gratuit'));
  });
  return (await fetch(url)).blob();
}
const kolors = (personne, vetement) => gradio(KOLORS, [personne, vetement], ([p, v]) => [p, v, 0, true], 2);
// Texelmoda : vêtements, description (anglais), personne, consigne pour la personne, sexe, fond, description du fond, graine
const texel = (personne, aPlat, description) => gradio(TEXEL + '/gradio_api', [aPlat, personne],
  ([v, p]) => [v, description, p, 'full body, same body shape', 'female', null, '', -1], 6);

// vêtement posé à plat sur fond blanc, placé comme sur un corps : la robe en haut, le bas en dessous
async function tenueAPlat(pieces) {
  const c = document.createElement('canvas');
  c.width = 768; c.height = 1024;
  const g = c.getContext('2d');
  g.fillStyle = '#fff';
  g.fillRect(0, 0, c.width, c.height);
  const poser = (img, l, h, y) => {
    const k = Math.min(l / img.width, h / img.height), w = img.width * k;
    g.drawImage(img, (c.width - w) / 2, y, w, img.height * k);
    return img.height * k;
  };
  const [haut, bas, robe] = ['haut', 'bas', 'robe'].map(cat => pieces.find(p => p.cat === cat));
  // la robe en haut de l'image : Texelmoda cadre alors en pied, comme sa photo
  if (robe) poser(await chargerImage(robe.detoure), 700, 700, 10);
  else {
    const y = haut ? 20 + poser(await chargerImage(haut.detoure), 520, 380, 20) - 10 : 300;
    if (bas) poser(await chargerImage(bas.detoure), 420, 1024 - y - 10, y);
  }
  return enBlob(c, 'image/jpeg', 0.9);
}
const COULEURS_EN = {
  noir: 'black', blanc: 'white', gris: 'grey', beige: 'beige', camel: 'camel', marron: 'brown', marine: 'navy blue',
  jean: 'plain denim', kaki: 'khaki', bleu: 'blue', ciel: 'light blue', vert: 'green', jaune: 'mustard yellow',
  orange: 'coral orange', rouge: 'red', bordeaux: 'burgundy', rose: 'pink', violet: 'purple', motif: 'printed',
};
const MOTS_EN = { haut: 'top', bas: 'full-length trousers', robe: 'dress' };
const decrire = pieces => pieces.map(p => [COULEURS_EN[p.couleur], MOTS_EN[p.cat]].filter(Boolean).join(' ')).join(' and ');

function fabriquerGratuit(t) {
  const pers = photoPersonne(), cle = cleEssai(t, pers) + GRATUIT;
  if (!enFabrication.has(cle)) enFabrication.set(cle, (async () => {
    const pieces = piecesGratuites(t), [haut, veste] = ['haut', 'veste'].map(cat => pieces.find(p => p.cat === cat));
    let image = await enJpeg(pers.blob);
    // bas ou robe : Texelmoda, avec ce vêtement seul (le haut, mis à plat avec lui, l'égare : sac, veste inventés)
    const dessous = pieces.find(p => p.cat === 'bas' || p.cat === 'robe');
    if (dessous) {
      const description = (dessous.cat === 'robe' ? '' : 'plain black long-sleeve top and ') + decrire([dessous])
        + ', no bag, no jacket, no accessories';
      image = await enJpeg(await texel(image, await tenueAPlat([dessous]), description));
    }
    // le haut, repris par Kolors qui le rend plus fidèlement
    if (haut) image = await enJpeg(await kolors(image, await enJpeg(haut.detoure, true)));
    // la veste en dernier, par-dessus (Kolors la dessine parfois fermée)
    if (veste) image = await enJpeg(await kolors(image, await enJpeg(veste.detoure, true)));
    await ecrire('essais', { id: cle, image, cree: Date.now(), titre: t.titre });
    return image;
  })().finally(() => enFabrication.delete(cle)));
  return enFabrication.get(cle);
}

// ---------- Visuel d'une tenue dans les cartes : la tenue portée sur elle ----------
// La version gratuite se fabrique toute seule quand elle regarde la tenue ; Puter (payant) attend toujours un clic.
const observateurVisuels = 'IntersectionObserver' in window ? new IntersectionObserver(entrees => {
  for (const e of entrees) if (e.isIntersecting) { observateurVisuels.unobserve(e.target); e.target.lancerAuto?.(); }
}, { threshold: 0.6 }) : null;

function visuelTenue(t) {
  const boite = el('div', { class: 'visuel' });
  const pers = photoPersonne();
  const moi = pers ? urlImage({ id: 'personne', personne: pers.blob, maj: pers.version }, 'personne') : null;
  const attente = (...bas) => remplacer(boite,
    el('div', { class: 'v-attente' + (moi ? '' : ' sans-moi') },
      moi ? el('img', { class: 'v-moi', src: moi, alt: '' }) : null,
      el('div', { class: 'v-pieces' }, t.pieces.map(p => el('img', { src: urlImage(p, 'mini'), alt: nomVetement(p), title: nomVetement(p), loading: 'lazy' })))),
    el('div', { class: 'v-bas' }, ...bas));
  const btnComplet = (txt = '✨ Tenue complète') => el('button', { class: 'btn', onclick: () => lancer() }, txt);
  // Barre sous l'image (et non par-dessus) pour ne rien cacher de la tenue.
  const montrerImage = (blob, partiel) => {
    boite.classList.add('montre');
    remplacer(boite, avantApres(blob, t),
      el('div', { class: 'v-haut' },
        el('button', { class: 'btn doux', onclick: () => montrerPieces(blob, partiel) }, '👗 Les pièces'),
        el('span', {}, partiel ? `Sans ${manquesGratuit(t)}` : ''),
        partiel ? el('button', { class: 'btn', onclick: () => lancer() }, '✨ Avec Puter') : null,
        el('button', { class: 'rond v-agrandir', 'aria-label': 'Agrandir', onclick: () => ouvrirEssai(t) }, '⤢')));
  };
  // retour aux photos de départ (elle et les pièces), puis de nouveau la tenue portée
  const montrerPieces = (blob, partiel) => {
    boite.classList.remove('montre');
    attente(el('button', { class: 'btn', onclick: () => montrerImage(blob, partiel) }, '✨ Me revoir dedans'));
  };
  const proposer = () => attente(gratuitPossible(t) && !toutGratuit(t)
    ? [el('button', { class: 'btn', onclick: () => lancerGratuit() }, '✨ Me voir dedans (gratuit)'), el('button', { class: 'btn doux', onclick: () => lancer() }, 'Tenue complète (Puter)')]
    : gratuitPossible(t) ? el('button', { class: 'btn', onclick: () => lancerGratuit() }, '✨ Me voir dans cette tenue (gratuit)')
      : btnComplet('✨ Me voir dans cette tenue'));

  async function lancerGratuit() {
    boite.classList.remove('montre');
    attente(el('div', { class: 'info' }, el('div', { class: 'roue' }), 'Je vous habille… (30 secondes à 2 minutes, services gratuits partagés)'));
    try { montrerImage(await fabriquerGratuit(t), !toutGratuit(t)); }
    catch { attente(el('div', { class: 'info erreur' }, 'Le service gratuit est saturé pour le moment.'), el('button', { class: 'btn', onclick: () => lancerGratuit() }, 'Réessayer'), btnComplet('Tenue complète (Puter)')); }
  }
  async function lancer() {
    boite.classList.remove('montre');
    attente(el('div', { class: 'info' }, el('div', { class: 'roue' }), 'Je vous habille… (15 à 40 secondes)'));
    try { await chargerPuter(); }
    catch { return attente(el('div', { class: 'info erreur' }, 'Pas de connexion internet.'), btnComplet('Réessayer')); }
    if (!puter.auth.isSignedIn()) {
      return attente(el('div', { class: 'info' }, 'Une seule fois : connectez-vous à Puter, le service qui crée l\'image.'),
        el('button', { class: 'btn', onclick: async () => {
          try { await puter.auth.signIn(); } catch { return toast('Connexion annulée'); }
          if (puter.auth.isSignedIn()) lancer();
        } }, 'Se connecter à Puter'));
    }
    try { montrerImage(await fabriquerEssai(t)); }
    catch (e) { attente(el('div', { class: 'info erreur' }, messageErreur(e)), btnComplet('Réessayer')); }
  }

  if (!pers) {
    attente(el('button', { class: 'btn', onclick: () => ouvrirEssai(t) }, '📷 Ajouter ma photo pour me voir dedans'));
    return boite;
  }
  proposer();
  Promise.all([lire('essais', cleEssai(t, pers)), lire('essais', cleEssai(t, pers) + GRATUIT)]).then(([complet, gratuit]) => {
    if (complet) return montrerImage(complet.image);
    if (gratuit) return montrerImage(gratuit.image, !toutGratuit(t));
    // seul l'essai gratuit part tout seul ; Puter (payant) attend toujours un clic
    if (observateurVisuels && gratuitPossible(t)) { boite.lancerAuto = () => lancerGratuit(); observateurVisuels.observe(boite); }
  });
  return boite;
}
async function partager(blob) {
  const f = new File([blob], 'ma-tenue.png', { type: blob.type || 'image/png' });
  if (navigator.canShare?.({ files: [f] })) {
    try { await navigator.share({ files: [f] }); } catch { /* annulé */ }
    return;
  }
  const a = el('a', { href: URL.createObjectURL(f), download: f.name });
  document.body.append(a); a.click(); a.remove();
}

// ---------- Photo en pied (onglet Mon teint et feuille d'essayage) ----------
function champPhotoPied(apres, { texte, capture, principal } = {}) {
  return el('label', { class: 'btn plein' + (principal ? '' : ' doux') }, texte || (etat.profil.corps ? 'Changer ma photo en pied' : '📷 Ajouter ma photo en pied'),
    el('input', {
      type: 'file', accept: 'image/*', capture, hidden: true, onchange: async e => {
        const f = e.target.files[0];
        if (!f) return;
        try {
          const c = versCanvas(await chargerImage(f), 1100);
          await sauverProfil('corps', await enBlob(c, 'image/jpeg', 0.85));
          await sauverProfil('corpsMaj', Date.now());
          toast('Photo enregistrée');
          apres && apres();
        } catch { toast('Photo illisible, réessayez'); }
      },
    }));
}
function cartePhotoPied() {
  const url = etat.profil.corps instanceof Blob ? urlImage({ id: 'corps', corps: etat.profil.corps, maj: etat.profil.corpsMaj }, 'corps') : null;
  return el('div', { class: 'carte' },
    el('div', { class: 'etiquette' }, 'Ma photo en pied'),
    el('p', { class: 'discret' }, 'Pour le bouton « Essayer » : debout, de face, de la tête aux pieds, devant un mur clair, en tenue près du corps.'),
    url ? el('img', { class: 'photo-pied', src: url, alt: 'Votre photo en pied' }) : null,
    champPhotoPied(afficherTeint));
}

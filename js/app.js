'use strict';
// Interface : onglets, rendu des tenues, garde-robe, composer, conseils, teint, réglages

const $ = s => document.querySelector(s);
function el(tag, attrs = {}, ...enfants) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k === 'class') e.className = v;
    else if (k === 'style') e.style.cssText = v;
    else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
    else e.setAttribute(k, v === true ? '' : v);
  }
  for (const c of enfants.flat(9)) if (c != null && c !== false) e.append(c);
  return e;
}
// Comme replaceChildren, mais ignore null/false (sinon le DOM affiche « null »).
const remplacer = (z, ...enfants) => z.replaceChildren(...enfants.flat(9).filter(c => c != null && c !== false));
function pastille(id) {
  const c = couleur(id);
  return el('span', { class: 'pastille', style: `background:${c ? c.hex : '#ccc'}` });
}
// groupe de puces ; selection est un Set modifié sur place
function puces(conteneur, liste, selection, { multiple = false, avecPastille = false, onChange } = {}) {
  conteneur.replaceChildren(...liste.map(it => el('button', {
    type: 'button', class: 'puce' + (selection.has(it.id) ? ' on' : ''),
    onclick: () => {
      if (multiple) selection.has(it.id) ? selection.delete(it.id) : selection.add(it.id);
      else { selection.clear(); selection.add(it.id); }
      puces(conteneur, liste, selection, { multiple, avecPastille, onChange });
      onChange && onChange();
    },
  }, avecPastille ? pastille(it.id) : null, it.nom)));
}
function segment(conteneur, onChange) {
  conteneur.querySelectorAll('button').forEach(b => b.onclick = () => {
    conteneur.querySelectorAll('button').forEach(x => x.classList.toggle('on', x === b));
    onChange(b);
  });
}
let minuteurToast;
function toast(txt) {
  const t = $('#toast');
  t.textContent = txt;
  t.classList.add('vu');
  clearTimeout(minuteurToast);
  minuteurToast = setTimeout(() => t.classList.remove('vu'), 2600);
}
const nomVetement = v => !v.cat ? 'À compléter'
  : v.nom || `${nomDe(CATS, v.cat).split(' /')[0]} ${nomDe(COULEURS, v.couleur).split(' /')[0].toLowerCase()}`;
function vignette(v, { onclick, classe = '' } = {}) {
  return el('button', { type: 'button', class: `vet ${classe} ${!v.cat ? 'alerte' : ''}`, onclick },
    el('img', { src: urlImage(v, 'mini'), alt: '', loading: 'lazy', decoding: 'async' }),
    el('div', { class: 'nom' }, (!v.cat ? '⚠ ' : '') + nomVetement(v)));
}
document.querySelectorAll('dialog [data-fermer]').forEach(b => b.onclick = () => b.closest('dialog').close());
// fermeture d'une feuille en touchant le fond
document.querySelectorAll('dialog').forEach(d => d.addEventListener('click', e => { if (e.target === d) d.close(); }));

// ---------- Navigation ----------
const TITRES = { jour: "Aujourd'hui", composer: 'Composer', armoire: 'Ma garde-robe', conseils: 'Conseils', teint: 'Mon teint' };
let vueCourante = 'jour';
document.querySelectorAll('.onglets button').forEach(b => b.onclick = () => montrer(b.dataset.v));
function montrer(v) {
  vueCourante = v;
  document.querySelectorAll('.onglets button').forEach(b => b.classList.toggle('on', b.dataset.v === v));
  document.querySelectorAll('.vue').forEach(s => s.classList.toggle('active', s.id === 'v-' + v));
  $('#titre-vue').textContent = TITRES[v];
  ({ jour: () => !tenuesJour.length && afficherJour(), composer: afficherComposer, armoire: afficherArmoire,
    conseils: afficherConseils, teint: afficherTeint })[v]();
  $('#comp-barre').hidden = v !== 'composer' || !selection.size;
  scrollTo({ top: 0 });
}
$('#date-courte').textContent = new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });

// ---------- Contexte du jour : date, travail, météo ----------
const JOURS = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
const joursTravail = new Set(reglage('joursTravail') || ['1', '2', '3', '4', '5']);
let jour = 0;
const occasion = new Set();
let meteo = reglage('meteo'); // { recu, daily, lieu }

function dateCible() { const d = new Date(); d.setDate(d.getDate() + jour); return d; }
function contexte() {
  const date = dateCible();
  const iso = date.toLocaleDateString('sv-SE'); // AAAA-MM-JJ local
  const i = meteo?.daily?.time?.indexOf(iso) ?? -1;
  const ctx = { date, occasion: [...occasion][0], pluie: 0, code: null, meteo: i >= 0 };
  if (i >= 0) {
    ctx.temp = meteo.daily.temperature_2m_max[i];
    ctx.tmin = meteo.daily.temperature_2m_min[i];
    ctx.pluie = meteo.daily.precipitation_probability_max[i] || 0;
    ctx.code = meteo.daily.weather_code[i];
  } else ctx.temp = temperatureParDefaut(date);
  ctx.saison = saisonPour(ctx.temp);
  return ctx;
}
function occasionParDefaut() {
  occasion.clear();
  occasion.add(joursTravail.has(String(dateCible().getDay())) ? 'travail' : 'quotidien');
  puces($('#occ-choix'), OCCASIONS, occasion, { onChange: () => afficherJour() });
}
const iconeMeteo = c => c == null ? '🗓️' : c === 0 ? '☀️' : c <= 2 ? '🌤️' : c === 3 ? '☁️' : c <= 48 ? '🌫️'
  : c <= 67 ? '🌧️' : c <= 77 ? '❄️' : c <= 82 ? '🌦️' : '⛈️';
function afficherContexte(ctx) {
  const d = ctx.date;
  const travail = joursTravail.has(String(d.getDay()));
  $('#meteo-icone').textContent = iconeMeteo(ctx.code);
  if (ctx.meteo) {
    $('#meteo-temp').textContent = `${Math.round(ctx.tmin)}° – ${Math.round(ctx.temp)}°`;
    $('#meteo-detail').textContent = `${JOURS[d.getDay()]}${ctx.pluie >= 30 ? ` · pluie ${ctx.pluie} %` : ''} · ${meteo.lieu || 'ici'} · ${travail ? 'jour de travail' : 'repos'}`;
  } else {
    $('#meteo-temp').textContent = `${JOURS[d.getDay()]} ${d.getDate()}`;
    $('#meteo-detail').textContent = `${travail ? 'Jour de travail' : 'Jour de repos'} · météo de ${VILLE.nom} en attente`;
  }
}
// la météo est toujours celle de chez elle (à changer ici si elle déménage)
const VILLE = { nom: 'Valbonne', lat: 43.633, lon: 6.999 };
async function chargerMeteo() {
  const ville = VILLE;
  const aJour = meteo && meteo.lieu === ville.nom && Date.now() - meteo.recu < 3 * 3600000;
  if (aJour) return;
  try {
    const r = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${ville.lat}&longitude=${ville.lon}` +
      '&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max&timezone=auto&forecast_days=3');
    if (!r.ok) throw new Error();
    meteo = { recu: Date.now(), daily: (await r.json()).daily, lieu: ville.nom };
    reglage('meteo', meteo);
    afficherJour();
  } catch { /* hors ligne : on garde la saison du mois */ }
}
segment($('#seg-jour'), b => { jour = +b.dataset.j; occasionParDefaut(); afficherJour(); });

// ---------- Onglet Aujourd'hui : 3 tenues ----------
let tenuesJour = [];
const dejaVuesJour = new Set();
function afficherJour() {
  const ctx = contexte();
  afficherContexte(ctx);
  const z = $('#jour-res');
  if (!etat.vetements.some(v => v.cat)) {
    tenuesJour = [];
    $('#btn-autres').hidden = true;
    z.replaceChildren(el('div', { class: 'carte vide' },
      el('p', {}, 'Bienvenue ! Photographiez vos vêtements dans l\'onglet Garde-robe : je vous proposerai ici chaque matin trois tenues selon la météo et votre journée.'),
      el('button', { class: 'btn', onclick: () => montrer('armoire') }, 'Commencer ma garde-robe')));
    return;
  }
  tenuesJour = genererTenues(ctx, 3, { dejaVues: dejaVuesJour });
  $('#btn-autres').hidden = !tenuesJour.length;
  z.replaceChildren(carrousel(tenuesJour, ctx, manque()));
}
$('#btn-autres').onclick = () => { afficherJour(); $('#jour-res').scrollIntoView({ behavior: 'smooth', block: 'start' }); };
function manque() {
  const n = c => etat.vetements.filter(v => v.cat === c).length;
  return n('robe') || (n('haut') && n('bas')) ? null
    : `Il me faut au moins un haut et un bas, ou une robe. Vous avez ${n('haut')} haut(s), ${n('bas')} bas, ${n('robe')} robe(s).`;
}
function carrousel(tenues, ctx, message) {
  if (!tenues.length) return el('div', { class: 'carte vide' }, message || 'Pas de tenue possible avec ces pièces.');
  const piste = el('div', { class: 'carrousel' }, tenues.map(t => carteTenue(t, ctx)));
  const points = el('div', { class: 'points' }, tenues.map((_, i) => el('span', { class: i ? '' : 'on' })));
  const pas = () => piste.firstChild.offsetWidth + 12;
  const aller = sens => piste.scrollBy({ left: sens * pas(), behavior: 'smooth' });
  const g = el('button', { class: 'fleche g', 'aria-label': 'Tenue précédente', onclick: () => aller(-1) }, '‹');
  const d = el('button', { class: 'fleche d', 'aria-label': 'Tenue suivante', onclick: () => aller(1) }, '›');
  const maj = () => {
    const i = Math.round(piste.scrollLeft / pas());
    [...points.children].forEach((p, k) => p.classList.toggle('on', k === i));
    g.disabled = i <= 0;
    d.disabled = i >= tenues.length - 1;
  };
  piste.addEventListener('scroll', maj, { passive: true });
  requestAnimationFrame(maj);
  return el('div', { class: 'carrousel-boite' }, piste, tenues.length > 1 ? [g, d, points] : null);
}

function carteTenue(t, ctx, { favori } = {}) {
  const estFav = () => etat.favoris.some(f => f.cle === t.cle);
  const coeur = el('button', { class: 'btn doux coeur', 'aria-label': 'Garder en favori' }, estFav() ? '♥' : '♡');
  coeur.onclick = async () => {
    const f = etat.favoris.find(x => x.cle === t.cle);
    if (f) await effacer('favoris', f.id);
    else await ecrire('favoris', { id: nouvelId(), cree: Date.now(), cle: t.cle, ids: t.pieces.map(p => p.id), titre: t.titre });
    await recharger();
    coeur.textContent = estFav() ? '♥' : '♡';
    toast(estFav() ? 'Tenue ajoutée aux favorites' : 'Tenue retirée des favorites');
    if (favori) afficherFavoris();
  };
  const porter = el('button', { class: 'btn' }, 'Je la porte');
  porter.onclick = async () => {
    const maintenant = Date.now();
    await ecrireTout('vetements', t.pieces.map(p => ({ ...etat.vetements.find(v => v.id === p.id), porte: maintenant })));
    await recharger();
    porter.textContent = '✓ Bonne journée';
    porter.disabled = true;
    toast('Noté : ces pièces ne seront pas reproposées ces prochains jours');
  };
  return el('div', { class: 'carte tenue' },
    el('div', { class: 'tenue-tete' }, el('h3', {}, t.titre), el('span', { class: 'discret' }, `${t.pieces.length} pièces`)),
    visuelTenue(t),
    el('details', { class: 'conseils' }, el('summary', {}, 'Comment l\'accessoiriser ›'),
      conseilsTenue(t, ctx).map(([ic, titre, txt]) => el('div', { class: 'conseil' }, el('span', { class: 'ic' }, ic), el('div', {}, el('b', {}, titre), txt)))),
    el('div', { class: 'tenue-actions' }, coeur, porter));
}

// ---------- Onglet Garde-robe ----------
const filtre = new Set(['tous']);
segment($('#seg-armoire'), b => {
  $('#armoire-vet').hidden = b.dataset.a !== 'vet';
  $('#armoire-fav').hidden = b.dataset.a !== 'fav';
  b.dataset.a === 'fav' ? afficherFavoris() : afficherArmoire();
});
function afficherArmoire() {
  const aCompleter = etat.vetements.filter(v => !v.cat).length;
  if (!aCompleter && filtre.has('acompleter')) { filtre.clear(); filtre.add('tous'); }
  const n = c => etat.vetements.filter(v => v.cat === c).length;
  const choix = [{ id: 'tous', nom: `Tout (${etat.vetements.length})` }, ...CATS.map(c => ({ id: c.id, nom: `${c.nom.split(' /')[0]} (${n(c.id)})` }))];
  if (aCompleter) choix.unshift({ id: 'acompleter', nom: `⚠ À compléter (${aCompleter})` });
  puces($('#filtres'), choix, filtre, { onChange: dessinerGrille });
  dessinerGrille();
}
function dessinerGrille() {
  const f = [...filtre][0];
  const liste = etat.vetements.filter(v => f === 'tous' || v.cat === f || (f === 'acompleter' && !v.cat));
  const g = $('#grille');
  if (!etat.vetements.length) {
    g.replaceChildren(el('div', { class: 'vide', style: 'grid-column:1/-1' },
      'Votre garde-robe est vide. Ajoutez vos vêtements un par un, ou toutes vos photos d\'un coup.'));
    return;
  }
  // bouton « Essayer » sur chaque vêtement, comme sur une boutique en ligne
  g.replaceChildren(...liste.map(v => !v.cat ? vignette(v, { onclick: () => ouvrirFiche(v) })
    : el('div', { class: 'vet-boite' }, vignette(v, { onclick: () => ouvrirFiche(v) }),
      el('button', { type: 'button', class: 'vet-essayer', onclick: () => essayerPiece(v) }, '✨ Essayer'))));
}
function afficherFavoris() {
  const z = $('#armoire-fav');
  const parId = new Map(etat.vetements.map(v => [v.id, v]));
  const ctx = contexte();
  const cartes = etat.favoris.map(f => {
    const pieces = f.ids.map(id => parId.get(id)).filter(Boolean);
    return pieces.length ? carteTenue({ pieces, cle: f.cle, titre: f.titre || titreTenue(pieces) }, ctx, { favori: true }) : null;
  }).filter(Boolean);
  z.replaceChildren(...(cartes.length ? cartes
    : [el('div', { class: 'carte vide' }, 'Aucune tenue favorite pour l\'instant. Touchez ♡ sur une tenue qui vous plaît.')]));
}

// ---------- Fiche vêtement ----------
const fiche = $('#fiche');
const sel = { cat: new Set(), col: new Set(), sai: new Set(), occ: new Set(), enc: new Set() };
let enCours = null, imagesCourantes = null;

function ouvrirFiche(v) {
  enCours = v || null;
  imagesCourantes = null;
  sel.cat = new Set(v?.cat ? [v.cat] : []);
  sel.col = new Set(v?.couleur ? [v.couleur] : []);
  sel.sai = new Set(v ? v.saisons : ['hiver', 'mi', 'ete']);
  sel.occ = new Set(v ? v.occasions : ['quotidien', 'travail']);
  sel.enc = new Set(v?.encolure ? [v.encolure] : []);
  const reste = etat.vetements.filter(x => !x.cat).length;
  $('#fiche-titre').textContent = !v ? 'Nouveau vêtement' : !v.cat ? `Quel est ce vêtement ? (${reste} à compléter)` : 'Modifier';
  $('#f-nom').value = v?.nom || '';
  $('#btn-suppr').hidden = !v;
  $('#btn-essai-piece').hidden = !v?.cat;
  $('#fiche-err').textContent = '';
  afficherPhotoFiche(v ? urlImage(v, 'photo') : null);
  dessinerFiche();
  fiche.showModal();
  fiche.scrollTop = 0;
  if (!v) $('#in-photo').click();
}
function dessinerFiche() {
  puces($('#f-cat'), CATS, sel.cat, { onChange: dessinerFiche });
  $('#f-col-bloc').hidden = !(sel.cat.has('haut') || sel.cat.has('robe'));
  puces($('#f-enc'), ENCOLURES, sel.enc);
  puces($('#f-col'), COULEURS, sel.col, { avecPastille: true });
  puces($('#f-sai'), SAISONS, sel.sai, { multiple: true });
  puces($('#f-occ'), OCCASIONS, sel.occ, { multiple: true });
}
function afficherPhotoFiche(src) {
  $('#fiche-img').hidden = !src;
  if (src) $('#fiche-img').src = src;
  $('#photo-aide').hidden = !!src;
}
$('#btn-annuler').onclick = () => fiche.close();
$('#in-photo').onchange = async e => {
  const f = e.target.files[0];
  e.target.value = '';
  if (!f) return;
  $('#photo-aide').textContent = 'Préparation de la photo…';
  try {
    imagesCourantes = await traiterPhoto(f);
    afficherPhotoFiche(URL.createObjectURL(imagesCourantes.photo));
    if (imagesCourantes.couleur && !enCours) { sel.col = new Set([imagesCourantes.couleur]); dessinerFiche(); }
  } catch {
    $('#fiche-err').textContent = 'Impossible de lire cette photo. Essayez-en une autre.';
  }
};
$('#btn-enreg').onclick = async () => {
  const err = !(imagesCourantes || enCours) ? 'Ajoutez une photo.' : !sel.cat.size ? 'Choisissez le type.'
    : !sel.col.size ? 'Choisissez la couleur.' : !sel.sai.size ? 'Choisissez au moins une saison.'
    : !sel.occ.size ? 'Choisissez au moins une occasion.' : '';
  if (err) { $('#fiche-err').textContent = err; return; }
  const cat = [...sel.cat][0];
  const v = {
    ...(enCours || { id: nouvelId(), cree: Date.now(), porte: 0 }),
    ...(imagesCourantes ? { photo: imagesCourantes.photo, mini: imagesCourantes.mini, detoure: imagesCourantes.detoure, maj: Date.now() } : {}),
    cat, couleur: [...sel.col][0], saisons: [...sel.sai], occasions: [...sel.occ],
    encolure: cat === 'haut' || cat === 'robe' ? [...sel.enc][0] || null : null,
    nom: $('#f-nom').value.trim(),
  };
  delete v.couleurDevinee;
  try { await ecrire('vetements', v); }
  catch { $('#fiche-err').textContent = 'Enregistrement impossible (mémoire du téléphone pleine ?).'; return; }
  await recharger();
  fiche.close();
  tenuesJour = [];
  afficherArmoire();
  const suivant = enCours && !enCours.cat && etat.vetements.find(x => !x.cat);
  if (suivant) ouvrirFiche(suivant);
  else toast('Vêtement enregistré');
};
// essayer une seule pièce sur sa photo (le reste de sa tenue ne change pas)
$('#btn-essai-piece').onclick = () => {
  fiche.close();
  essayerPiece(enCours);
};
$('#btn-suppr').onclick = async () => {
  if (!enCours || !confirm('Supprimer ce vêtement de la garde-robe ?')) return;
  await effacer('vetements', enCours.id);
  await recharger();
  fiche.close();
  tenuesJour = [];
  afficherArmoire();
};
$('#btn-ajout').onclick = () => ouvrirFiche(null);
$('#in-lot').onchange = async e => {
  const fichiers = [...e.target.files];
  e.target.value = '';
  if (!fichiers.length) return;
  let ok = 0, ko = 0;
  const debut = Date.now(); // ordre d'affichage = ordre des photos
  for (const [i, f] of fichiers.entries()) {
    $('#lot-msg').textContent = `Préparation des photos : ${i + 1} / ${fichiers.length}…`;
    try {
      const t = await traiterPhoto(f);
      await ecrire('vetements', {
        id: nouvelId(), cree: debut - i, porte: 0, photo: t.photo, mini: t.mini, detoure: t.detoure,
        cat: null, couleur: t.couleur, saisons: ['hiver', 'mi', 'ete'], occasions: ['quotidien', 'travail'], encolure: null, nom: '',
      });
      ok++;
    } catch { ko++; }
  }
  await recharger();
  filtre.clear(); filtre.add('acompleter');
  afficherArmoire();
  $('#lot-msg').textContent = `${ok} photo${ok > 1 ? 's' : ''} ajoutée${ok > 1 ? 's' : ''}${ko ? `, ${ko} illisible${ko > 1 ? 's' : ''}` : ''}. Touchez chacune pour dire ce que c'est.`;
};

// ---------- Onglet Composer ----------
const selection = new Set();
const filtreComp = new Set(['tous']);
let dejaVuesComp = new Set();
function afficherComposer() {
  const choix = [{ id: 'tous', nom: 'Tout' }, ...CATS.filter(c => etat.vetements.some(v => v.cat === c.id)).map(c => ({ id: c.id, nom: c.nom.split(' /')[0] }))];
  puces($('#comp-filtres'), choix, filtreComp, { onChange: dessinerComposer });
  dessinerComposer();
}
function dessinerComposer() {
  const f = [...filtreComp][0];
  const liste = etat.vetements.filter(v => v.cat && (f === 'tous' || v.cat === f));
  const g = $('#comp-grille');
  if (!liste.length) {
    g.replaceChildren(el('div', { class: 'vide', style: 'grid-column:1/-1' }, 'Ajoutez d\'abord des vêtements dans votre garde-robe.'));
    return;
  }
  g.replaceChildren(...liste.map(v => {
    const b = vignette(v, { classe: selection.has(v.id) ? 'choisi' : '' });
    b.append(el('span', { class: 'coche' }, '✓'));
    b.onclick = () => {
      selection.has(v.id) ? selection.delete(v.id) : selection.add(v.id);
      b.classList.toggle('choisi', selection.has(v.id));
      majBarreComposer();
    };
    return b;
  }));
  majBarreComposer();
}
function majBarreComposer() {
  $('#comp-barre').hidden = vueCourante !== 'composer' || !selection.size;
  $('#btn-composer').textContent = `Proposer (${selection.size})`;
}
function composerTenues() {
  const choisis = etat.vetements.filter(v => selection.has(v.id));
  const ctx = contexte();
  const tenues = genererTenues(ctx, 4, { choisis, completer: $('#comp-completer').checked, dejaVues: dejaVuesComp });
  $('#comp-res').replaceChildren(carrousel(tenues, ctx,
    'Ces pièces ne suffisent pas pour une tenue complète. Ajoutez un haut et un bas (ou une robe), ou activez « Compléter avec le reste ».'));
  $('#btn-comp-autres').hidden = !tenues.length;
}
$('#btn-composer').onclick = () => { dejaVuesComp = new Set(); composerTenues(); $('#feuille-comp').showModal(); };
$('#btn-comp-autres').onclick = composerTenues;

// ---------- Onglet Conseils ----------
const couleurConseil = new Set(['marine']);
function afficherConseils() {
  const p = PALETTES[etat.profil.teint?.saison];
  $('#conseils-teint').replaceChildren(p
    ? el('div', { class: 'carte' }, el('div', { class: 'etiquette' }, `Votre palette : ${p.nom}`),
      el('div', {}, `Métal : ${p.metal}. Neutres : ${p.neutres}. Rouge à lèvres : ${p.levres}.`),
      el('div', { class: 'nuancier' }, p.nuancier.slice(0, 4).map(([n, hex]) => el('div', {}, el('i', { style: `background:${hex}` }), n))))
    : el('div', { class: 'carte' }, el('div', { class: 'etiquette' }, 'Connaître les couleurs qui vous vont'),
      el('p', { class: 'discret' }, 'Un selfie et 4 questions : je trouve votre palette et j\'en tiens compte dans les tenues.'),
      el('button', { class: 'btn', onclick: () => montrer('teint') }, 'Faire le test')));
  $('#regles').replaceChildren(...REGLES.map(([t, d]) => el('div', { class: 'regle' }, el('b', {}, t), el('span', {}, d))));
  $('#cols').replaceChildren(...ENCOLURES.map(e => el('div', { class: 'regle' }, el('b', {}, e.nom),
    el('span', {}, COLLIER_ENCOLURE[e.id].charAt(0).toUpperCase() + COLLIER_ENCOLURE[e.id].slice(1) + '.'))));
  puces($('#cons-couleurs'), COULEURS, couleurConseil, { avecPastille: true, onChange: dessinerConseilCouleur });
  dessinerConseilCouleur();
}
function dessinerConseilCouleur() {
  const id = [...couleurConseil][0], c = CONSEIL_COULEUR[id];
  const p = PALETTES[etat.profil.teint?.saison];
  const avis = !p ? null : p.reco.includes(id) ? '✓ Une de vos couleurs : portez-la près du visage.'
    : p.eviter.includes(id) ? 'Pour votre teint, portez-la plutôt en bas ou en accessoire, loin du visage.' : 'Couleur neutre pour votre teint.';
  remplacer($('#cons-couleur'),
    el('div', { class: 'resultat-tete' }, el('span', { class: 'peau', style: `background:${couleur(id).hex}` }), el('h3', {}, nomDe(COULEURS, id))),
    el('div', { class: 'conseil' }, el('span', { class: 'ic' }, '🤝'), el('div', {}, el('b', {}, 'À associer avec'), c.avec)),
    el('div', { class: 'conseil' }, el('span', { class: 'ic' }, '💍'), el('div', {}, el('b', {}, 'Bijoux'), c.bijoux)),
    el('div', { class: 'conseil' }, el('span', { class: 'ic' }, '✨'), el('div', {}, el('b', {}, 'L\'astuce'), c.astuce)),
    avis ? el('div', { class: 'conseil' }, el('span', { class: 'ic' }, '🎨'), el('div', {}, el('b', {}, 'Pour vous'), avis)) : null);
}

// ---------- Onglet Mon teint ----------
const test = { img: null, point: null, reponses: {}, refaire: false };
function afficherTeint() {
  const z = $('#teint');
  const r = etat.profil.teint;
  if (r && !test.refaire) { z.replaceChildren(...resultatTeint(r), cartePhotoPied()); return; }
  // selfie déjà fourni (envoyé avec sa garde-robe) : prêt à l'emploi
  if (!test.img && etat.profil.selfie instanceof Blob) {
    chargerImage(urlImage({ id: 'selfie', selfie: etat.profil.selfie, maj: etat.profil.selfieMaj }, 'selfie'))
      .then(img => { test.img ||= img; afficherTeint(); }, () => {});
  }

  const selfie = el('div', { class: 'selfie' });
  if (test.img) {
    selfie.append(el('img', { src: test.img.src, alt: 'Votre selfie' }));
    if (test.point) selfie.append(el('div', { class: 'cible', style: `left:${test.point[0] * 100}%;top:${test.point[1] * 100}%` }));
    selfie.onclick = e => {
      const b = selfie.getBoundingClientRect();
      test.point = [(e.clientX - b.left) / b.width, (e.clientY - b.top) / b.height];
      afficherTeint();
    };
  }
  const pret = QUIZ.every(q => test.reponses[q.id]) && (!test.img || test.point);
  remplacer(z,
    el('div', { class: 'carte' },
      el('div', { class: 'etiquette' }, '1. Un selfie'),
      el('p', { class: 'discret' }, 'Face à une fenêtre, à la lumière du jour, sans maquillage si possible. Photo facultative mais plus précise.'),
      selfie,
      test.img ? el('p', { class: 'discret', style: 'margin-top:8px' }, test.point ? 'Point de peau choisi. Touchez ailleurs pour le déplacer.' : '👆 Touchez votre joue sur la photo.') : null,
      el('label', { class: 'btn doux plein' }, test.img ? 'Reprendre la photo' : '📷 Prendre un selfie',
        el('input', { type: 'file', accept: 'image/*', capture: 'user', hidden: true, onchange: chargerSelfie }))),
    el('div', { class: 'carte' }, el('div', { class: 'etiquette' }, '2. Quatre questions'),
      QUIZ.map(q => {
        const s = new Set(test.reponses[q.id] ? [test.reponses[q.id]] : []);
        const c = el('div', { class: 'puces' });
        puces(c, q.r.map(([id, nom]) => ({ id, nom })), s, { onChange: () => { test.reponses[q.id] = [...s][0]; afficherTeint(); } });
        return el('div', { class: 'question' }, el('div', { class: 'q' }, q.q), c);
      })),
    el('button', { class: 'btn plein', disabled: !pret, onclick: calculerTeint }, 'Découvrir mes couleurs'),
    r ? el('button', { class: 'btn doux plein', onclick: () => { test.refaire = false; afficherTeint(); } }, 'Annuler') : null,
    cartePhotoPied());
}
async function chargerSelfie(e) {
  const f = e.target.files[0];
  if (!f) return;
  try {
    test.img = await chargerImage(f);
    test.point = null;
  } catch { toast('Photo illisible, réessayez'); }
  afficherTeint();
}
async function calculerTeint() {
  let lab = [66, 13, 18]; // peau moyenne, sans avis si pas de photo
  if (test.img && test.point) {
    lab = rgbVersLab(echantillonPeau(test.img, ...test.point));
    await sauverProfil('visage', await recadrerVisage(test.img, ...test.point));
    await sauverProfil('visageMaj', Date.now());
  }
  const r = { ...analyserTeint(lab, test.reponses), photo: !!test.img, date: Date.now() };
  await sauverProfil('teint', r);
  test.refaire = false;
  tenuesJour = [];
  afficherTeint();
  scrollTo({ top: 0, behavior: 'smooth' });
}
function resultatTeint(r) {
  const p = PALETTES[r.saison];
  const visage = etat.profil.visage instanceof Blob ? urlImage({ id: 'visage', visage: etat.profil.visage, maj: etat.profil.visageMaj }, 'visage') : null;
  const prets = etat.vetements.filter(v => PRES_VISAGE.has(v.cat));
  const flatteurs = prets.filter(v => p.reco.includes(v.couleur));
  const loin = prets.filter(v => p.eviter.includes(v.couleur));
  const rang = l => el('div', { class: 'mini-rang' }, l.map(v => el('img', { src: urlImage(v, 'mini'), alt: nomVetement(v), loading: 'lazy' })));
  return [
    el('div', { class: 'carte' },
      el('div', { class: 'resultat-tete' },
        visage ? el('img', { class: 'visage', src: visage, alt: '' }) : el('span', { class: 'peau', style: `background:${r.peau}` }),
        el('div', {}, el('div', { class: 'surtitre' }, 'Votre palette'), el('h3', {}, p.nom), el('div', { class: 'discret' }, p.resume))),
      el('p', { style: 'margin-top:12px' }, p.texte),
      el('div', { class: 'nuancier' }, p.nuancier.map(([n, hex]) => el('div', {}, el('i', { style: `background:${hex}` }), n)))),
    el('div', { class: 'carte liste-regles' },
      el('div', { class: 'regle' }, el('b', {}, 'Vos neutres'), el('span', {}, p.neutres)),
      el('div', { class: 'regle' }, el('b', {}, 'Vos bijoux'), el('span', {}, p.metal)),
      el('div', { class: 'regle' }, el('b', {}, 'Rouge à lèvres'), el('span', {}, p.levres)),
      el('div', { class: 'regle' }, el('b', {}, 'À éloigner du visage'), el('div', { class: 'puces', style: 'margin-top:6px' },
        p.eviter.map(id => el('span', { class: 'puce' }, pastille(id), nomDe(COULEURS, id).split(' /')[0]))))),
    prets.length ? el('div', { class: 'carte' },
      el('div', { class: 'etiquette' }, `Dans votre garde-robe, ce qui vous illumine (${flatteurs.length})`),
      flatteurs.length ? rang(flatteurs) : el('div', { class: 'discret' }, 'Rien encore : pensez-y lors de vos prochains achats.'),
      loin.length ? [el('div', { class: 'etiquette' }, `À porter avec un foulard ou loin du visage (${loin.length})`), rang(loin)] : null) : null,
    el('p', { class: 'discret centre' }, 'Ces couleurs sont désormais prises en compte dans les tenues proposées.'),
    el('button', { class: 'btn doux plein', onclick: () => { test.refaire = true; test.reponses = {}; test.img = null; test.point = null; afficherTeint(); } }, 'Refaire le test'),
  ];
}

// ---------- Réglages ----------
function ouvrirReglages() {
  puces($('#jours-travail'), [1, 2, 3, 4, 5, 6, 0].map(n => ({ id: String(n), nom: JOURS[n].slice(0, 3) + '.' })), joursTravail, {
    multiple: true, onChange: () => { reglage('joursTravail', [...joursTravail]); occasionParDefaut(); tenuesJour = []; },
  });
  $('#reglages').showModal();
}
$('#btn-reglages').onclick = ouvrirReglages;
$('#reglages').addEventListener('close', () => { if (vueCourante === 'jour' && !tenuesJour.length) afficherJour(); });
$('#btn-export').onclick = async () => {
  $('#sauv-msg').textContent = 'Préparation…';
  const blob = await exporter();
  const a = el('a', { href: URL.createObjectURL(blob), download: `garde-robe-${new Date().toLocaleDateString('sv-SE')}.json` });
  document.body.append(a); a.click(); a.remove();
  $('#sauv-msg').textContent = 'Fichier téléchargé. Gardez-le précieusement (mail, Drive, iCloud…).';
};
$('#in-import').onchange = async e => {
  const f = e.target.files[0];
  e.target.value = '';
  if (!f) return;
  try {
    const n = await importer(f, (i, t) => { $('#sauv-msg').textContent = `Restauration : ${i} / ${t}…`; });
    $('#sauv-msg').textContent = `✓ ${n} vêtements restaurés.`;
    tenuesJour = [];
  } catch { $('#sauv-msg').textContent = 'Ce fichier n\'est pas une sauvegarde valide.'; }
};

// garde-robe déposée sur le site : les nouveaux vêtements arrivent tout seuls sur le téléphone
async function chargerEnLigne() {
  let r;
  try { r = await fetch('garde-robe.json', { cache: 'no-cache' }); } catch { return; }
  if (!r.ok) return;
  try {
    const n = await importer(r, (i, t) => toast(`Arrivée de vos vêtements : ${i} / ${t}`), true);
    if (n) { tenuesJour = []; afficherJour(); toast(`${n} vêtements ajoutés`); }
    else if (etat.detouresMaj) { delete etat.detouresMaj; afficherJour(); }
  } catch { /* fichier absent ou abîmé : on garde ce qu'on a */ }
}

// ---------- Souris : faire glisser les zones horizontales en cliquant-tirant ----------
function glisserALaSouris() {
  let zone = null, x0 = 0, depart = 0, bouge = false;
  document.addEventListener('pointerdown', e => {
    if (e.pointerType !== 'mouse' || e.button !== 0) return;
    zone = e.target.closest('.carrousel, .defile, .mini-rang');
    if (!zone || zone.scrollWidth <= zone.clientWidth || e.target.closest('input, .aa-curseur')) { zone = null; return; }
    x0 = e.clientX; depart = zone.scrollLeft; bouge = false;
  });
  document.addEventListener('pointermove', e => {
    if (!zone) return;
    const dx = e.clientX - x0;
    if (!bouge && Math.abs(dx) < 6) return;
    if (!bouge) { bouge = true; zone.classList.add('glisse'); }
    zone.scrollLeft = depart - dx;
  });
  // sinon le navigateur prend le geste pour un glisser-déposer d'image et l'annule
  document.addEventListener('dragstart', e => { if (e.target.closest?.('.carrousel, .defile, .mini-rang')) e.preventDefault(); });
  document.addEventListener('pointerup', e => {
    if (!zone) return;
    const z = zone, dx = e.clientX - x0;
    zone = null;
    if (!bouge) return;
    if (z.classList.contains('carrousel')) {
      // carrousel : une tenue de plus ou de moins selon le sens du geste
      const pas = z.firstElementChild.offsetWidth + 12, i = Math.round(depart / pas) + (dx < -40 ? 1 : dx > 40 ? -1 : 0);
      z.scrollTo({ left: Math.max(0, i) * pas, behavior: 'smooth' });
      setTimeout(() => z.classList.remove('glisse'), 450);
    } else z.classList.remove('glisse');
    // le relâchement après un glissement n'est pas un clic
    const bloquer = ev => { ev.stopPropagation(); ev.preventDefault(); };
    addEventListener('click', bloquer, { capture: true, once: true });
    setTimeout(() => removeEventListener('click', bloquer, { capture: true }));
  });
}
glisserALaSouris();

// ---------- Démarrage ----------
occasionParDefaut();
ouvrirBase()
  .then(recharger)
  .then(async () => {
    afficherJour();
    chargerMeteo();
    if (navigator.storage?.persist) navigator.storage.persist();
    const avant = etat.vetements.length && etat.vetements.some(v => !(v.mini instanceof Blob));
    await migrer((i, n) => toast(`Mise à jour des photos : ${i} / ${n}`));
    if (avant) afficherJour();
    await chargerEnLigne();
  })
  .catch(e => {
    console.error(e);
    $('main').prepend(el('div', { class: 'carte erreur' },
      'Ce navigateur bloque l\'enregistrement (navigation privée ?). Ouvrez le site dans Safari ou Chrome, en mode normal.'));
  });

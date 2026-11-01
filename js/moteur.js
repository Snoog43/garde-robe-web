'use strict';
// Composition des tenues, conseils et analyse du teint

const couleur = id => COULEURS.find(c => c.id === id);
const nomDe = (liste, id) => (liste.find(x => x.id === id) || {}).nom || '';
const estNeutre = id => !!couleur(id)?.neutre;
const auHasard = l => l[Math.floor(Math.random() * l.length)];
const PRES_VISAGE = new Set(['haut', 'robe', 'veste']);
const CHAUDS = new Set(['beige', 'camel', 'marron', 'kaki', 'orange', 'jaune', 'rouge', 'bordeaux']);

function temperatureParDefaut(date) {
  return [8, 9, 13, 16, 20, 25, 28, 28, 24, 19, 13, 9][date.getMonth()];
}
function saisonPour(temp) { return temp < 13 ? 'hiver' : temp < 21 ? 'mi' : 'ete'; }

// réserves de pièces par catégorie : d'abord les mieux adaptées, sinon le reste
function reserve(cat, liste, ctx) {
  const l = liste.filter(v => v.cat === cat);
  const adaptees = l.filter(v => v.saisons.includes(ctx.saison) && v.occasions.includes(ctx.occasion));
  if (adaptees.length) return adaptees;
  const saison = l.filter(v => v.saisons.includes(ctx.saison));
  return saison.length ? saison : l;
}

function noteCouleurs(pieces) {
  const ids = pieces.filter(p => p.cat !== 'chaussures').map(p => p.couleur);
  const vives = [...new Set(ids.filter(c => !estNeutre(c)))];
  let n = 0;
  if (vives.length === 0) n += 2;
  else if (vives.length === 1) n += 3;
  else if (vives.length === 2) n += vives.includes('motif') ? 0.5
    : DUOS.has(vives.join('-')) || DUOS.has([...vives].reverse().join('-')) ? 2.5 : -3;
  else n -= 5;
  if (ids.filter(c => c === 'motif').length > 1) n -= 4;
  if (ids.includes('noir') && ids.includes('marine')) n -= 1;
  if (ids.includes('noir') && ids.includes('marron')) n -= 0.7;
  return n;
}
function noteTeint(pieces) {
  const p = PALETTES[etat.profil.teint?.saison];
  if (!p) return 0;
  return pieces.filter(x => PRES_VISAGE.has(x.cat))
    .reduce((s, x) => s + (p.reco.includes(x.couleur) ? 0.8 : p.eviter.includes(x.couleur) ? -1.2 : 0), 0);
}
function noteFraicheur(pieces) {
  const now = Date.now(), jour = 86400000;
  return pieces.reduce((s, p) => s - (p.porte && now - p.porte < 4 * jour ? 2 : 0), 0);
}

// Propose n tenues variées.
// options.choisis : pièces sélectionnées (onglet Composer), toujours au moins une par tenue
function genererTenues(ctx, n = 3, options = {}) {
  const tout = etat.vetements.filter(v => v.cat);
  const choisis = options.choisis || null;
  const source = cat => {
    if (choisis) {
      const c = reserve(cat, choisis, ctx);
      if (c.length || !options.completer) return c;
    }
    return reserve(cat, tout, ctx);
  };
  const R = Object.fromEntries(CATS.map(c => [c.id, source(c.id)]));
  const avecDeux = R.haut.length && R.bas.length;
  if (!R.robe.length && !avecDeux) return [];
  const pRobe = !avecDeux ? 1 : !R.robe.length ? 0 : ctx.occasion === 'sortie' ? 0.5 : ctx.occasion === 'sport' ? 0.1 : 0.3;
  const idsChoisis = new Set((choisis || []).map(v => v.id));
  const deja = options.dejaVues || new Set();

  const vus = new Map();
  for (let i = 0; i < 600; i++) {
    const pieces = Math.random() < pRobe ? [auHasard(R.robe)] : [auHasard(R.haut), auHasard(R.bas)];
    if (ctx.temp < 19 && R.veste.length) pieces.push(auHasard(R.veste));
    if (R.chaussures.length) pieces.push(auHasard(R.chaussures));
    if (R.accessoire.length && Math.random() < 0.6) pieces.push(auHasard(R.accessoire));
    const cle = pieces.map(p => p.id).sort().join('|');
    if (vus.has(cle)) continue;
    const nbChoisis = pieces.filter(p => idsChoisis.has(p.id)).length;
    if (choisis && !nbChoisis) continue;
    const note = noteCouleurs(pieces) + noteTeint(pieces) + noteFraicheur(pieces)
      + nbChoisis * 1.5 + Math.random() * 1.2 - (deja.has(cle) ? 8 : 0);
    vus.set(cle, { pieces, cle, note });
  }
  // les meilleures, en évitant de reprendre les mêmes pièces d'une tenue à l'autre
  const classees = [...vus.values()].sort((a, b) => b.note - a.note);
  const retenues = [];
  for (const maxCommun of [0, 1, 2, 9]) {
    for (const t of classees) {
      if (retenues.length >= n) break;
      if (retenues.includes(t)) continue;
      const ids = t.pieces.filter(p => p.cat !== 'chaussures' && p.cat !== 'accessoire').map(p => p.id);
      if (retenues.every(r => ids.filter(id => r.cle.includes(id)).length <= maxCommun)) retenues.push(t);
    }
  }
  retenues.forEach(t => deja.add(t.cle));
  const ordre = ['veste', 'haut', 'robe', 'bas', 'chaussures', 'accessoire'];
  return retenues.map(t => ({
    ...t,
    pieces: [...t.pieces].sort((a, b) => ordre.indexOf(a.cat) - ordre.indexOf(b.cat)),
    titre: titreTenue(t.pieces),
  }));
}

function titreTenue(pieces) {
  const ids = pieces.filter(p => p.cat !== 'chaussures').map(p => p.couleur);
  const vives = [...new Set(ids.filter(c => !estNeutre(c)))];
  const nom = id => nomDe(COULEURS, id).split(' /')[0].toLowerCase();
  if (vives.includes('motif')) return 'Imprimé à l\'honneur';
  if (vives.length === 1) return `Touche de ${nom(vives[0])}`;
  if (vives.length === 2) return `Duo ${nom(vives[0])} et ${nom(vives[1])}`;
  const s = new Set(ids);
  if ([...s].every(c => ['beige', 'camel', 'marron', 'blanc'].includes(c))) return 'Camaïeu chaud';
  if (s.has('marine') && (s.has('blanc') || s.has('camel'))) return 'Chic marine';
  if (s.has('noir') && s.has('blanc')) return 'Noir et blanc graphique';
  if (s.has('jean')) return 'Décontracté chic';
  return 'Neutres élégants';
}

// ---------- Conseils pour une tenue ----------
function metalConseille(pieces) {
  const p = PALETTES[etat.profil.teint?.saison];
  if (p) return p.metal;
  const chauds = pieces.filter(x => CHAUDS.has(x.couleur)).length;
  return chauds >= pieces.length / 2 ? 'or' : 'argent ou or';
}
function conseilsTenue(t, ctx) {
  const c = [];
  const pieces = t.pieces;
  const haut = pieces.find(p => p.cat === 'robe') || pieces.find(p => p.cat === 'haut');
  const metal = metalConseille(pieces);
  c.push(['💍', 'Bijoux', `En ${metal}. ` + (haut?.encolure ? `Avec ce ${nomDe(ENCOLURES, haut.encolure).toLowerCase()} : ${COLLIER_ENCOLURE[haut.encolure]}.`
    : 'Une seule pièce forte : collier OU boucles d\'oreilles marquées.')]);
  const sac = {
    travail: 'Sac cabas structuré, mocassins ou escarpins à petit talon.',
    sortie: 'Pochette, bijoux un peu plus marqués, petit talon ou bottines fines.',
    quotidien: 'Baskets blanches en cuir ou bottines, sac porté croisé.',
    sport: 'Baskets confortables, petit sac croisé ou banane.',
  }[ctx.occasion];
  c.push(['👜', 'Sac et chaussures', sac]);
  if (pieces.some(p => p.cat === 'bas') && ctx.occasion !== 'sport') {
    const cognac = pieces.some(p => CHAUDS.has(p.couleur) || p.couleur === 'jean');
    c.push(['✨', 'Silhouette', `Rentrez le haut devant et marquez la taille avec une ceinture ${cognac ? 'cognac' : 'noire fine'}.`]);
  }
  const vive = pieces.map(p => p.couleur).find(x => !estNeutre(x));
  const ref = CONSEIL_COULEUR[vive || haut?.couleur];
  if (ref) c.push(['🎨', 'Couleurs', ref.astuce]);
  const pal = PALETTES[etat.profil.teint?.saison];
  if (pal && haut && pal.eviter.includes(haut.couleur))
    c.push(['🧣', 'Près du visage', `Ce ${nomDe(COULEURS, haut.couleur).toLowerCase()} n'est pas le plus flatteur pour votre teint : un foulard ${pal.nuancier[0][0].toLowerCase()} ou ${pal.nuancier[1][0].toLowerCase()} près du visage arrange tout.`]);
  if (ctx.pluie >= 50) c.push(['☔', 'Météo', 'Pluie prévue : trench ou imperméable, et un parapluie.']);
  else if (ctx.temp < 8) c.push(['🧥', 'Météo', 'Il fait froid : écharpe et manteau chaud.']);
  else if (ctx.temp > 27) c.push(['☀️', 'Météo', 'Forte chaleur : matières légères (lin, coton) et sandales.']);
  if (ctx.temp < 19 && !pieces.some(p => p.cat === 'veste'))
    c.push(['🧥', 'À ajouter', 'Prévoyez une veste : photographiez vos vestes pour qu\'elles soient proposées.']);
  return c;
}

// ---------- Teint ----------
function analyserTeint(lab, reponses) {
  const [L, a, b] = lab;
  const angle = Math.atan2(b, a) * 180 / Math.PI;
  const photo = angle > 61 ? 1 : angle < 52 ? -1 : 0;
  const pts = id => (QUIZ.find(q => q.id === id).r.find(r => r[0] === reponses[id]) || [0, 0, 0])[2];
  let score = photo + pts('veines') + pts('metal') + pts('cheveux');
  if (score === 0) score = angle >= 57 ? 1 : -1;
  const chaud = score > 0;
  const fonce = reponses.cheveux === 'brun' || reponses.yeux === 'fonces' || L < 52;
  const clair = reponses.cheveux === 'blond' || (reponses.yeux === 'clairs' && reponses.cheveux !== 'brun');
  let saison;
  if (chaud) saison = fonce || reponses.cheveux === 'roux' && !clair ? 'automne' : 'printemps';
  else saison = fonce && !clair ? 'hiver' : 'ete';
  return {
    saison, sousTon: chaud ? 'chaud' : 'froid',
    peau: `rgb(${labVersRgbApprox(lab)})`, angle: Math.round(angle), clarte: Math.round(L),
  };
}
function labVersRgbApprox([L, a, b]) {
  const fy = (L + 16) / 116, fx = fy + a / 500, fz = fy - b / 200;
  const inv = t => t ** 3 > 0.008856 ? t ** 3 : (t - 16 / 116) / 7.787;
  const X = inv(fx) * 0.95047, Y = inv(fy), Z = inv(fz) * 1.08883;
  const g = u => { u = u > 0.0031308 ? 1.055 * u ** (1 / 2.4) - 0.055 : 12.92 * u; return Math.round(Math.min(1, Math.max(0, u)) * 255); };
  return [g(X * 3.2406 - Y * 1.5372 - Z * 0.4986), g(-X * 0.9689 + Y * 1.8758 + Z * 0.0415), g(X * 0.0557 - Y * 0.204 + Z * 1.057)].join(',');
}

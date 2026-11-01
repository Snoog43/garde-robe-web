'use strict';
// Référentiels et contenus de style (aucune logique ici)

const CATS = [
  { id: 'haut', nom: 'Haut' },
  { id: 'bas', nom: 'Bas' },
  { id: 'robe', nom: 'Robe' },
  { id: 'veste', nom: 'Veste / manteau' },
  { id: 'chaussures', nom: 'Chaussures' },
  { id: 'accessoire', nom: 'Sac / accessoire' },
];

// neutre : se marie avec tout
const COULEURS = [
  { id: 'noir', nom: 'Noir', hex: '#1b1b1b', neutre: true },
  { id: 'blanc', nom: 'Blanc / écru', hex: '#f6f3ec', neutre: true },
  { id: 'gris', nom: 'Gris', hex: '#8d8d8d', neutre: true },
  { id: 'beige', nom: 'Beige', hex: '#d8c3a5', neutre: true },
  { id: 'camel', nom: 'Camel', hex: '#b5835a', neutre: true },
  { id: 'marron', nom: 'Marron', hex: '#5e3d29', neutre: true },
  { id: 'marine', nom: 'Bleu marine', hex: '#1f2d4d', neutre: true },
  { id: 'jean', nom: 'Jean', hex: '#4a6a93', neutre: true },
  { id: 'kaki', nom: 'Kaki', hex: '#6b6b3f', neutre: true },
  { id: 'bleu', nom: 'Bleu', hex: '#2f6fd1' },
  { id: 'ciel', nom: 'Bleu ciel', hex: '#9cc7ec' },
  { id: 'vert', nom: 'Vert', hex: '#2e8b57' },
  { id: 'jaune', nom: 'Jaune / moutarde', hex: '#d9ad3c' },
  { id: 'orange', nom: 'Orange / corail', hex: '#e67e50' },
  { id: 'rouge', nom: 'Rouge', hex: '#c62828' },
  { id: 'bordeaux', nom: 'Bordeaux', hex: '#6d1a2c' },
  { id: 'rose', nom: 'Rose', hex: '#e48aa9' },
  { id: 'violet', nom: 'Violet / prune', hex: '#6f4a8e' },
  { id: 'motif', nom: 'Imprimé', hex: 'conic-gradient(#c62828 0 25%,#d9ad3c 0 50%,#2f6fd1 0 75%,#2e8b57 0)' },
];

const SAISONS = [
  { id: 'hiver', nom: 'Hiver' },
  { id: 'mi', nom: 'Printemps / automne' },
  { id: 'ete', nom: 'Été' },
];

const OCCASIONS = [
  { id: 'quotidien', nom: 'Quotidien' },
  { id: 'travail', nom: 'Travail' },
  { id: 'sortie', nom: 'Sortie / soirée' },
  { id: 'sport', nom: 'Balade / sport' },
];

const ENCOLURES = [
  { id: 'v', nom: 'Col V' },
  { id: 'rond', nom: 'Col rond' },
  { id: 'chemise', nom: 'Chemise' },
  { id: 'roule', nom: 'Col roulé' },
  { id: 'bateau', nom: 'Col bateau' },
];

// deux couleurs vives qui fonctionnent ensemble
const DUOS = new Set([
  'bleu-ciel', 'bleu-jaune', 'bleu-orange', 'bleu-rose', 'bleu-rouge', 'ciel-rose', 'ciel-jaune',
  'vert-rose', 'vert-jaune', 'bordeaux-rose', 'rose-rouge', 'rose-violet', 'orange-ciel',
  'violet-jaune', 'vert-ciel', 'bordeaux-jaune', 'vert-bordeaux', 'orange-violet',
]);

// ---------- Bijoux selon l'encolure ----------
const COLLIER_ENCOLURE = {
  v: 'un pendentif qui suit la ligne du V, arrêté juste au-dessus de la pointe',
  rond: 'un collier court ou un plastron posé sur le col',
  chemise: 'une fine chaîne ras-du-cou col ouvert, ou un foulard noué',
  roule: 'un sautoir long par-dessus la maille, ou de belles boucles d\'oreilles seules',
  bateau: 'des boucles d\'oreilles marquées et un bracelet, le cou reste nu',
};

// ---------- Conseils par couleur ----------
const CONSEIL_COULEUR = {
  noir: { avec: 'Blanc, camel, rouge, rose poudré. Pour l\'adoucir près du visage, ajoutez un foulard clair.', bijoux: 'Or pour réchauffer, argent pour un look graphique. Une grosse manchette ou des perles.', astuce: 'Le total noir s\'éclaire avec une texture (cuir, satin, maille) et un rouge à lèvres.' },
  blanc: { avec: 'Marine, camel, jean, bordeaux. L\'écru est plus flatteur que le blanc pur.', bijoux: 'Or ou perles, très lumineux sur le blanc.', astuce: 'Un total look blanc ou écru en été fait tout de suite chic.' },
  gris: { avec: 'Rose, bordeaux, bleu ciel, blanc. Évitez le gris sur gris sans relief.', bijoux: 'Argent ou or rose, perles grises.', astuce: 'Un gris chiné avec une touche de rose fait doux et moderne.' },
  beige: { avec: 'Blanc, camel, marine, bordeaux, kaki. Le camaïeu de beiges est très élégant.', bijoux: 'Or, écaille, bois, cuir naturel.', astuce: 'Jouez ton sur ton (beige, camel, écru) et marquez la taille avec une ceinture cognac.' },
  camel: { avec: 'Marine, blanc, noir, bordeaux, jean.', bijoux: 'Or, écaille.', astuce: 'Le manteau camel est la pièce chic par excellence : il va avec tout.' },
  marron: { avec: 'Beige, écru, bleu ciel, rose poudré, kaki.', bijoux: 'Or, bronze, ambre.', astuce: 'Le chocolat remplace le noir de façon plus douce et plus moderne.' },
  marine: { avec: 'Blanc, camel, rouge, rose, beige.', bijoux: 'Or ou argent, les deux vont.', astuce: 'Marine et camel : l\'association la plus chic et la plus sûre.' },
  jean: { avec: 'Blanc, marine, camel, toutes les couleurs vives.', bijoux: 'Or, argent, gros bijoux fantaisie.', astuce: 'Un jean brut bien coupé + blazer + mocassins = élégant tous les jours.' },
  kaki: { avec: 'Beige, blanc, camel, rouille, rose.', bijoux: 'Or, bronze, bois.', astuce: 'Le kaki se porte comme un neutre, en veste ou en pantalon.' },
  bleu: { avec: 'Blanc, beige, rose, jaune, jean.', bijoux: 'Argent ou or blanc.', astuce: 'Un bleu franc près du visage illumine le teint.' },
  ciel: { avec: 'Blanc, marine, gris, camel, rose pâle.', bijoux: 'Argent, perles.', astuce: 'Doux et frais, idéal pour le travail au printemps.' },
  vert: { avec: 'Blanc, beige, marine, rose, camel.', bijoux: 'Or.', astuce: 'Un vert émeraude en pièce forte, le reste en neutres.' },
  jaune: { avec: 'Marine, gris, blanc, jean, violet.', bijoux: 'Or.', astuce: 'Le moutarde se marie très bien avec le marine ou le bordeaux.' },
  orange: { avec: 'Marine, blanc, jean, beige.', bijoux: 'Or.', astuce: 'Le corail réveille le teint, parfait en haut ou en foulard.' },
  rouge: { avec: 'Marine, blanc, noir, camel, jean.', bijoux: 'Or, discrets : le rouge fait déjà tout.', astuce: 'Un seul rouge dans la tenue, repris éventuellement sur les lèvres.' },
  bordeaux: { avec: 'Camel, beige, rose, gris, marine.', bijoux: 'Or, rose gold.', astuce: 'Bordeaux et camel : le duo chic de l\'automne.' },
  rose: { avec: 'Marine, gris, bordeaux, blanc, camel.', bijoux: 'Or rose, perles, argent.', astuce: 'Un rose franc avec du marine fait moderne et lumineux.' },
  violet: { avec: 'Gris, blanc, jaune moutarde, beige.', bijoux: 'Argent, améthyste.', astuce: 'Le prune est une alternative douce et chic au noir.' },
  motif: { avec: 'Reprenez une couleur de l\'imprimé pour le reste de la tenue, en uni.', bijoux: 'Sobres : l\'imprimé suffit.', astuce: 'Un seul imprimé par tenue, le reste en uni.' },
};

// ---------- Règles d'or (style moderne et chic, 50 ans et plus) ----------
const REGLES = [
  ['Trois couleurs maximum', 'Deux neutres et une couleur forte : la tenue est lisible et élégante.'],
  ['La lumière près du visage', 'Mettez la plus belle couleur de votre palette en haut : elle illumine le teint.'],
  ['Marquer la taille', 'Une ceinture, un haut rentré devant ou une veste cintrée structurent la silhouette.'],
  ['Une pièce forte', 'Un bijou imposant OU un imprimé OU une couleur vive. Pas les trois à la fois.'],
  ['Des matières nobles', 'Maille fine, soie, laine, cuir : elles font plus chic que n\'importe quelle tendance.'],
  ['Le bon basique moderne', 'Jean droit brut, blazer, chemise blanche, trench, mocassins : la base qui ne se démode pas.'],
  ['Les bijoux qui rajeunissent', 'Préférez une belle pièce dorée ou des créoles à une parure complète assortie.'],
  ['Les chaussures finissent la tenue', 'Une couleur neutre, ou le rappel d\'une couleur de la tenue.'],
];

// ---------- Colorimétrie ----------
// reco / eviter : identifiants de COULEURS ; nuancier : teintes idéales à chercher en boutique
const PALETTES = {
  printemps: {
    nom: 'Printemps', resume: 'Teint chaud et lumineux',
    texte: 'Les couleurs claires, chaudes et vives vous vont : corail, turquoise, vert pomme, camel clair. Elles donnent bonne mine.',
    metal: 'or jaune', neutres: 'beige, camel clair, écru, marine clair',
    reco: ['beige', 'camel', 'blanc', 'orange', 'jaune', 'vert', 'ciel', 'rose', 'jean', 'marine'],
    eviter: ['noir', 'gris', 'bordeaux', 'violet'],
    nuancier: [['Corail', '#f27b5b'], ['Pêche', '#f6b28a'], ['Turquoise', '#2ab3b0'], ['Vert pomme', '#8cc152'], ['Jaune doré', '#f2c14e'], ['Camel clair', '#d1a06a'], ['Ivoire', '#fbf3e1'], ['Bleu bleuet', '#5d8ad6']],
    levres: 'corail, pêche, rose saumon',
  },
  ete: {
    nom: 'Été', resume: 'Teint froid et doux',
    texte: 'Les couleurs douces et froides vous subliment : gris, bleu lavande, rose poudré, framboise. Évitez les tons trop chauds ou trop criards.',
    metal: 'argent, or blanc, or rose', neutres: 'gris, marine doux, taupe, blanc cassé',
    reco: ['gris', 'marine', 'ciel', 'bleu', 'rose', 'violet', 'bordeaux', 'blanc', 'jean'],
    eviter: ['orange', 'jaune', 'kaki', 'camel', 'marron'],
    nuancier: [['Rose poudré', '#e3a7b8'], ['Lavande', '#a99bd1'], ['Bleu gris', '#7d97b5'], ['Framboise', '#b8406b'], ['Gris perle', '#c3c4c7'], ['Taupe', '#8b7d77'], ['Bleu ciel', '#a8c8e8'], ['Vert d\'eau', '#9fd1c3']],
    levres: 'rose framboise, vieux rose',
  },
  automne: {
    nom: 'Automne', resume: 'Teint chaud et profond',
    texte: 'Les couleurs chaudes et profondes vous vont : camel, rouille, kaki, moutarde, bordeaux, chocolat. Le chocolat remplace avantageusement le noir.',
    metal: 'or jaune, bronze', neutres: 'camel, chocolat, kaki, écru',
    reco: ['camel', 'marron', 'beige', 'kaki', 'vert', 'orange', 'jaune', 'bordeaux', 'rouge', 'jean', 'blanc'],
    eviter: ['noir', 'ciel', 'rose', 'gris', 'violet'],
    nuancier: [['Rouille', '#b5532c'], ['Moutarde', '#cf9a2c'], ['Olive', '#6f7440'], ['Bordeaux', '#6d1a2c'], ['Camel', '#b5835a'], ['Chocolat', '#5e3d29'], ['Vert sapin', '#2f5a45'], ['Terracotta', '#c66b4a']],
    levres: 'brique, terracotta, nude chaud',
  },
  hiver: {
    nom: 'Hiver', resume: 'Teint froid et contrasté',
    texte: 'Les couleurs franches et contrastées vous vont : noir, blanc pur, rouge, fuchsia, bleu roi, émeraude. Évitez les beiges et les tons fanés.',
    metal: 'argent, or blanc', neutres: 'noir, blanc pur, marine, gris anthracite',
    reco: ['noir', 'blanc', 'marine', 'gris', 'rouge', 'bordeaux', 'bleu', 'violet', 'rose', 'vert'],
    eviter: ['beige', 'camel', 'orange', 'kaki', 'jaune', 'marron'],
    nuancier: [['Rouge vif', '#c8102e'], ['Fuchsia', '#c2185b'], ['Bleu roi', '#1f4fbf'], ['Émeraude', '#00875a'], ['Blanc pur', '#ffffff'], ['Noir', '#111111'], ['Prune', '#5b2a5e'], ['Gris anthracite', '#3c3f45']],
    levres: 'rouge franc, fuchsia, prune',
  },
};

const QUIZ = [
  { id: 'veines', q: 'Les veines de votre poignet, à la lumière du jour :',
    r: [['bleues', 'Plutôt bleues ou violettes', -1], ['vertes', 'Plutôt vertes', 1], ['deux', 'Difficile à dire', 0]] },
  { id: 'metal', q: 'Quels bijoux vous mettent le plus en valeur ?',
    r: [['argent', 'L\'argent', -1], ['or', 'L\'or', 1], ['deux', 'Les deux', 0]] },
  { id: 'cheveux', q: 'Vos cheveux (couleur actuelle) :',
    r: [['blond', 'Blonds', 0], ['roux', 'Roux / cuivrés', 1], ['chatain', 'Châtains', 0], ['brun', 'Bruns / noirs', 0], ['gris', 'Gris / blancs', -1]] },
  { id: 'yeux', q: 'Vos yeux :',
    r: [['clairs', 'Clairs (bleus, verts, gris)', 0], ['noisette', 'Noisette / marron clair', 0], ['fonces', 'Marron foncé / noirs', 0]] },
];

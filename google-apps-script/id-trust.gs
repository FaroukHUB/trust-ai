/**
 * TRUST AI — Colonne « ID TRUST » du récapitulatif
 * ---------------------------------------------------------------------------
 * Ce script vit DANS le Google Sheets. Il attribue à chaque ligne un
 * identifiant unique et stable, pour que TRUST AI reconnaisse une ligne même
 * si elle est déplacée, triée ou modifiée.
 *
 * Ce qu'il fait :
 *   * remplit automatiquement les cellules « ID TRUST » vides ;
 *   * détecte les identifiants DUPLIQUÉS (copier-coller d'une ligne) et
 *     régénère uniquement les doublons — jamais l'original ;
 *   * n'écrit QUE dans la colonne « ID TRUST » : aucune autre cellule n'est
 *     touchée.
 *
 * Ce qu'il ne fait pas :
 *   * aucun export, aucun envoi de données, aucune connexion sortante ;
 *   * aucune action quotidienne demandée aux vendeuses.
 *
 * TRUST AI, de son côté, lit le fichier en LECTURE SEULE : il ne peut pas
 * écrire dans le Sheet, même en cas d'erreur.
 *
 * Installation : voir docs/RECAP_GOOGLE_SHEETS.md (tout se fait dans le
 * navigateur, sans terminal).
 */

/** Nom de l'onglet à surveiller. */
var TRUST_SHEET_NAME = 'RECAP';

/** Titre exact de la colonne d'identifiants. */
var TRUST_ID_HEADER = 'ID TRUST';

/** Numéro de la ligne contenant les titres de colonnes. */
var TRUST_HEADER_ROW = 1;

/** Préfixe des identifiants générés. */
var TRUST_ID_PREFIX = 'TR-';

/**
 * Point d'entrée : à relier à un déclencheur installable « onChange ».
 * Se déclenche sur les ajouts de lignes, collages, tris et modifications.
 */
function onChangeTrustIds(e) {
  remplirIdentifiantsTrust();
}

/** Remplissage manuel, depuis le menu TRUST AI. */
function remplirIdentifiantsTrust() {
  var sheet = SpreadsheetApp.getActive().getSheetByName(TRUST_SHEET_NAME);
  if (!sheet) {
    throw new Error('Onglet « ' + TRUST_SHEET_NAME + ' » introuvable.');
  }

  var lastRow = sheet.getLastRow();
  var lastCol = sheet.getLastColumn();
  if (lastRow <= TRUST_HEADER_ROW || lastCol < 1) return;

  // 1. Retrouver la colonne par son TITRE (jamais par sa position).
  var headers = sheet.getRange(TRUST_HEADER_ROW, 1, 1, lastCol).getValues()[0];
  var idCol = -1;
  for (var i = 0; i < headers.length; i++) {
    if (String(headers[i]).trim().toLowerCase() === TRUST_ID_HEADER.toLowerCase()) {
      idCol = i + 1;
      break;
    }
  }
  if (idCol === -1) {
    throw new Error(
      'Colonne « ' + TRUST_ID_HEADER + ' » introuvable dans la ligne ' + TRUST_HEADER_ROW + '.'
    );
  }

  // 2. Lire la colonne entière en une fois (rapide, même sur gros fichier).
  var firstDataRow = TRUST_HEADER_ROW + 1;
  var count = lastRow - TRUST_HEADER_ROW;
  var range = sheet.getRange(firstDataRow, idCol, count, 1);
  var ids = range.getValues();

  // Contenu des lignes : une ligne entièrement vide ne reçoit pas d'ID.
  var allValues = sheet.getRange(firstDataRow, 1, count, lastCol).getValues();

  var seen = {};
  var modified = false;

  for (var r = 0; r < ids.length; r++) {
    var ligneVide = true;
    for (var c = 0; c < allValues[r].length; c++) {
      if (c === idCol - 1) continue; // la colonne ID ne compte pas
      if (String(allValues[r][c]).trim() !== '') {
        ligneVide = false;
        break;
      }
    }
    if (ligneVide) {
      // Ligne vide : on retire un identifiant résiduel éventuel.
      if (String(ids[r][0]).trim() !== '') {
        ids[r][0] = '';
        modified = true;
      }
      continue;
    }

    var current = String(ids[r][0]).trim();

    if (current === '') {
      ids[r][0] = genererIdentifiantTrust();
      modified = true;
    } else if (seen[current]) {
      // DOUBLON (copier-coller) : seul le second exemplaire est régénéré,
      // l'original conserve son identifiant et son historique.
      ids[r][0] = genererIdentifiantTrust();
      modified = true;
    }
    seen[String(ids[r][0]).trim()] = true;
  }

  // 3. Une seule écriture, uniquement dans la colonne ID.
  if (modified) {
    range.setValues(ids);
  }
}

/** Identifiant unique, court et lisible : TR- + horodatage + aléa. */
function genererIdentifiantTrust() {
  var time = new Date().getTime().toString(36).toUpperCase();
  var rand = Math.floor(Math.random() * 1679616).toString(36).toUpperCase();
  while (rand.length < 4) rand = '0' + rand;
  return TRUST_ID_PREFIX + time + '-' + rand;
}

/** Menu « TRUST AI » dans la barre du Sheet (confort, non obligatoire). */
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('TRUST AI')
    .addItem('Compléter les ID TRUST maintenant', 'remplirIdentifiantsTrust')
    .addItem('Vérifier les doublons d\'ID', 'verifierDoublonsTrust')
    .addToUi();
}

/** Contrôle sans écriture : signale les identifiants en double. */
function verifierDoublonsTrust() {
  var sheet = SpreadsheetApp.getActive().getSheetByName(TRUST_SHEET_NAME);
  if (!sheet) return;
  var lastRow = sheet.getLastRow();
  var lastCol = sheet.getLastColumn();
  var headers = sheet.getRange(TRUST_HEADER_ROW, 1, 1, lastCol).getValues()[0];
  var idCol = -1;
  for (var i = 0; i < headers.length; i++) {
    if (String(headers[i]).trim().toLowerCase() === TRUST_ID_HEADER.toLowerCase()) {
      idCol = i + 1;
    }
  }
  if (idCol === -1 || lastRow <= TRUST_HEADER_ROW) return;

  var ids = sheet
    .getRange(TRUST_HEADER_ROW + 1, idCol, lastRow - TRUST_HEADER_ROW, 1)
    .getValues();
  var seen = {};
  var doublons = [];
  for (var r = 0; r < ids.length; r++) {
    var v = String(ids[r][0]).trim();
    if (v === '') continue;
    if (seen[v]) doublons.push('ligne ' + (TRUST_HEADER_ROW + 1 + r) + ' : ' + v);
    seen[v] = true;
  }
  SpreadsheetApp.getUi().alert(
    doublons.length === 0
      ? 'Aucun identifiant en double.'
      : 'Identifiants en double :\n' + doublons.join('\n')
  );
}

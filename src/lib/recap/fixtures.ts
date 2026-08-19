import type { ColumnMapping, WarehouseRef } from "./parser";

/**
 * Fixtures représentatives du fichier récapitulatif réel.
 *
 * Trois familles de lignes cohabitent dans le même fichier :
 *   * « Internet »          — commandes web, souvent avec un numéro de
 *                             commande FOURNISSEUR (colonne ORDER) ;
 *   * « Herblay/Argenteuil »— magasin d'Herblay, marchandise reçue au DÉPÔT
 *                             d'Argenteuil (deux entités distinctes) ;
 *   * « Marseille/Aubagne » — ancien libellé « Marseille » pour Aubagne,
 *                             souvent après transfert depuis Argenteuil.
 *
 * Les en-têtes sont volontairement dans un ordre quelconque et comportent
 * des accents, des majuscules et des espaces : le mapping ne doit dépendre
 * d'aucun ordre figé.
 */

export const FIXTURE_WAREHOUSES: WarehouseRef[] = [
  { id: "wh-argenteuil", name: "Dépôt d'Argenteuil", city: "Argenteuil" },
  { id: "wh-aubagne", name: "Dépôt d'Aubagne", city: "Aubagne" },
];

export const FIXTURE_HEADERS = [
  "ID TRUST",
  "DATE",
  "FOURNISSEUR",
  "STATUT",
  "RÉFÉRENCE",
  "DÉSIGNATION",
  "QTÉ",
  "CLIENT",
  "ORDER",
  "ARRIVÉE PRÉVUE",
  "COMMENTAIRES",
  "RÉCEPTION ARGENTEUIL",
  "DATE RÉCEPTION",
  "AFFRÈTEMENT",
  "MODE DE SORTIE",
  "RÉCEPTION AUBAGNE",
  "DATE AUBAGNE",
  "LIVRAISON / RETRAIT",
  "DATE FINALE",
];

export const FIXTURE_MAPPING: ColumnMapping = {
  recap_row_id: "ID TRUST",
  recap_date: "DATE",
  supplier_label: "FOURNISSEUR",
  status_label: "STATUT",
  supplier_reference: "RÉFÉRENCE",
  designation: "DÉSIGNATION",
  quantity: "QTÉ",
  customer_label: "CLIENT",
  supplier_order_ref: "ORDER",
  expected_at: "ARRIVÉE PRÉVUE",
  comments: "COMMENTAIRES",
  received_argenteuil: "RÉCEPTION ARGENTEUIL",
  received_argenteuil_at: "DATE RÉCEPTION",
  freight_label: "AFFRÈTEMENT",
  exit_mode_label: "MODE DE SORTIE",
  received_aubagne: "RÉCEPTION AUBAGNE",
  received_aubagne_at: "DATE AUBAGNE",
  final_release_label: "LIVRAISON / RETRAIT",
  final_release_at: "DATE FINALE",
};

/** Construit une ligne à partir d'un objet partiel (colonnes nommées). */
export function fixtureRow(values: Record<string, string>): string[] {
  return FIXTURE_HEADERS.map((h) => values[h] ?? "");
}

// --- Jeu de lignes représentatif -------------------------------------------

/** Internet : numéro de commande FOURNISSEUR, attendue, rien de reçu. */
export const ROW_INTERNET = fixtureRow({
  "ID TRUST": "TR-000001",
  DATE: "05/08/2026",
  FOURNISSEUR: "By Boo",
  STATUT: "Commandé",
  "RÉFÉRENCE": "BB-EVA-CAR",
  "DÉSIGNATION": "Canapé EVA XL caramel",
  "QTÉ": "1",
  CLIENT: "Dupont Marie",
  ORDER: "WEB-88421",
  "ARRIVÉE PRÉVUE": "20/09/2026",
  COMMENTAIRES: "Commande passée sur le site fournisseur",
});

/** Herblay (MAGASIN) livré depuis Argenteuil (DÉPÔT) : reçu, disponible. */
export const ROW_HERBLAY_ARGENTEUIL = fixtureRow({
  "ID TRUST": "TR-000002",
  DATE: "12/07/2026",
  FOURNISSEUR: "GDM",
  STATUT: "Reçu",
  "RÉFÉRENCE": "GDM-RUST-220",
  "DÉSIGNATION": "Table Rustica 220 cm",
  "QTÉ": "1",
  CLIENT: "Martin Paul",
  "ARRIVÉE PRÉVUE": "10/07/2026",
  "RÉCEPTION ARGENTEUIL": "X",
  "DATE RÉCEPTION": "11/07/2026",
  "MODE DE SORTIE": "Livraison Argenteuil",
  "LIVRAISON / RETRAIT": "Livraison Argenteuil",
});

/** Marseille = alias d'Aubagne ; parcours Argenteuil → Aubagne (transfert). */
export const ROW_MARSEILLE_AUBAGNE = fixtureRow({
  "ID TRUST": "TR-000003",
  DATE: "03/06/2026",
  FOURNISSEUR: "Eleonora",
  "RÉFÉRENCE": "ELE-VERA-TP",
  "DÉSIGNATION": "Chaise Vera velours taupe",
  "QTÉ": "4",
  CLIENT: "Bernard Sophie",
  "ARRIVÉE PRÉVUE": "20/06/2026",
  "RÉCEPTION ARGENTEUIL": "OUI",
  "DATE RÉCEPTION": "18/06/2026",
  "AFFRÈTEMENT": "Groupage Sud",
  "MODE DE SORTIE": "Marseille",
  "RÉCEPTION AUBAGNE": "X",
  "DATE AUBAGNE": "25/06/2026",
});

/** Reçue à Argenteuil mais attendue à Aubagne : transfert à faire. */
export const ROW_TRANSFERT_EN_COURS = fixtureRow({
  "ID TRUST": "TR-000004",
  DATE: "01/08/2026",
  FOURNISSEUR: "Dreams Fly",
  "DÉSIGNATION": "Matelas Cloud 160x200",
  "QTÉ": "2",
  CLIENT: "Nguyen Linh",
  "RÉCEPTION ARGENTEUIL": "X",
  "DATE RÉCEPTION": "02/08/2026",
  "MODE DE SORTIE": "Aubagne",
});

/** Réception partielle : 2 sur 4 — la ligne ne devient pas disponible. */
export const ROW_PARTIELLE = fixtureRow({
  "ID TRUST": "TR-000005",
  DATE: "15/07/2026",
  FOURNISSEUR: "SM",
  "DÉSIGNATION": "Chaise Oslo",
  "QTÉ": "4",
  CLIENT: "Petit Julie",
  "RÉCEPTION ARGENTEUIL": "X",
  "DATE RÉCEPTION": "20/07/2026",
  COMMENTAIRES: "Réception partielle 2/4, reliquat annoncé en septembre",
  "MODE DE SORTIE": "Argenteuil",
});

/** Destination inconnue : anomalie, aucune supposition. */
export const ROW_DESTINATION_AMBIGUE = fixtureRow({
  DATE: "46239",
  FOURNISSEUR: "Polez",
  "DÉSIGNATION": "Fauteuil Lisbonne",
  "QTÉ": "1",
  CLIENT: "Roux Camille",
  "MODE DE SORTIE": "Entrepôt Nord",
});

/** Ligne de total : doit être ignorée. */
export const ROW_TOTAL = fixtureRow({ "DÉSIGNATION": "TOTAL", "QTÉ": "13" });

/** Ligne vide : ignorée. */
export const ROW_VIDE = fixtureRow({});

export const FIXTURE_ROWS = [
  ROW_INTERNET,
  ROW_HERBLAY_ARGENTEUIL,
  ROW_MARSEILLE_AUBAGNE,
  ROW_TRANSFERT_EN_COURS,
  ROW_PARTIELLE,
  ROW_DESTINATION_AMBIGUE,
  ROW_TOTAL,
  ROW_VIDE,
];

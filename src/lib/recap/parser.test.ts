import { describe, expect, it } from "vitest";
import {
  findColumnIndex,
  isTotalRow,
  parseBoolean,
  parseDate,
  parseQuantity,
  parseRecapRows,
  resolveWarehouse,
} from "./parser";
import {
  FIXTURE_HEADERS,
  FIXTURE_MAPPING,
  FIXTURE_ROWS,
  FIXTURE_WAREHOUSES,
  ROW_DESTINATION_AMBIGUE,
  ROW_HERBLAY_ARGENTEUIL,
  ROW_INTERNET,
  ROW_MARSEILLE_AUBAGNE,
  ROW_PARTIELLE,
  ROW_TRANSFERT_EN_COURS,
  fixtureRow,
} from "./fixtures";

const options = {
  headers: FIXTURE_HEADERS,
  mapping: FIXTURE_MAPPING,
  warehouses: FIXTURE_WAREHOUSES,
};

const parseOne = (row: string[]) => parseRecapRows([row], options)[0];

describe("Lecture des cellules", () => {
  it("reconnaît les dates françaises, ISO et Google Sheets", () => {
    expect(parseDate("05/08/2026")).toBe("2026-08-05");
    expect(parseDate("5/8/26")).toBe("2026-08-05");
    expect(parseDate("2026-08-05")).toBe("2026-08-05");
    expect(parseDate("05-08-2026")).toBe("2026-08-05");
    // Numéro de série Sheets (jours depuis le 30/12/1899).
    expect(parseDate("46239")).toBe("2026-08-05");
    // Cellules vides ou illisibles : aucune date inventée.
    expect(parseDate("")).toBeUndefined();
    expect(parseDate("   ")).toBeUndefined();
    expect(parseDate("dès que possible")).toBeUndefined();
    expect(parseDate("32/13/2026")).toBeUndefined();
  });

  it("interprète les marques de réception les plus courantes", () => {
    for (const value of ["X", "x", "OUI", "oui", "Reçu", "reçue", "1", "OK"]) {
      expect(parseBoolean(value), value).toBe(true);
    }
    for (const value of ["NON", "non", "0", "-", "/"]) {
      expect(parseBoolean(value), value).toBe(false);
    }
    // Une cellule VIDE ne signifie pas « non » : elle signifie « on ne sait
    // pas ». La distinction évite de déclarer non reçue une marchandise dont
    // la case n'a simplement pas encore été remplie.
    expect(parseBoolean("")).toBeUndefined();
    expect(parseBoolean("   ")).toBeUndefined();
    expect(parseBoolean("peut-être")).toBeUndefined();
  });

  it("lit les quantités même mal saisies", () => {
    expect(parseQuantity("2")).toBe(2);
    expect(parseQuantity(" 3 pcs")).toBe(3);
    expect(parseQuantity("x4")).toBe(4);
    expect(parseQuantity("2,0")).toBe(2);
    expect(parseQuantity("")).toBeUndefined();
    expect(parseQuantity("plusieurs")).toBeUndefined();
  });

  it("ne dépend pas de l'ordre des colonnes ni des accents", () => {
    expect(findColumnIndex(FIXTURE_HEADERS, "QTÉ")).toBe(
      FIXTURE_HEADERS.indexOf("QTÉ"),
    );
    expect(findColumnIndex(["qte", "client"], "QTÉ")).toBe(0);
    expect(findColumnIndex(["  Désignation  "], "designation")).toBe(0);
    expect(findColumnIndex(FIXTURE_HEADERS, "colonne inexistante")).toBe(-1);
  });

  it("écarte les lignes de totaux", () => {
    expect(isTotalRow(["TOTAL", "13"])).toBe(true);
    expect(isTotalRow(["Sous-total", "4"])).toBe(true);
    expect(isTotalRow(["Canapé", "1", "Client", "Fournisseur"])).toBe(false);
  });

  it("traite « Marseille » comme un alias d'Aubagne et jamais Herblay comme un dépôt", () => {
    expect(resolveWarehouse(FIXTURE_WAREHOUSES, "Marseille")?.id).toBe("wh-aubagne");
    expect(resolveWarehouse(FIXTURE_WAREHOUSES, "AUBAGNE")?.id).toBe("wh-aubagne");
    expect(resolveWarehouse(FIXTURE_WAREHOUSES, "Argenteuil")?.id).toBe("wh-argenteuil");
    // Herblay est un MAGASIN : il ne doit correspondre à aucun dépôt.
    expect(resolveWarehouse(FIXTURE_WAREHOUSES, "Herblay")).toBeUndefined();
    expect(resolveWarehouse(FIXTURE_WAREHOUSES, "Lisses")).toBeUndefined();
  });
});

describe("Analyse du récapitulatif", () => {
  it("ignore les lignes vides et de total, garde les autres", () => {
    const parsed = parseRecapRows(FIXTURE_ROWS, options);
    const ignored = parsed.filter((r) => r.ignored);
    expect(ignored).toHaveLength(2);
    expect(ignored.map((r) => r.ignoredReason)).toEqual(
      expect.arrayContaining(["Ligne de total", "Ligne vide"]),
    );
    expect(parsed.filter((r) => !r.ignored)).toHaveLength(6);
  });

  it("« ORDER » est le numéro de commande FOURNISSEUR, pas la commande client", () => {
    const row = parseOne(ROW_INTERNET);
    expect(row.supplier_order_ref).toBe("WEB-88421");
    // Le client reste dans son propre champ : aucune confusion possible.
    expect(row.customer_label).toBe("Dupont Marie");
    expect(row.supplier_reference).toBe("BB-EVA-CAR");
    expect(row.stage).toBe("commandee");
  });

  it("conserve la ligne source brute pour audit", () => {
    const row = parseOne(ROW_INTERNET);
    expect(row.raw_row["FOURNISSEUR"]).toBe("By Boo");
    expect(row.raw_row["ORDER"]).toBe("WEB-88421");
    // Les cellules vides ne sont pas conservées inutilement.
    expect(row.raw_row["DATE AUBAGNE"]).toBeUndefined();
  });

  it("Herblay (magasin) reçu à Argenteuil (dépôt) : disponible à Argenteuil", () => {
    const row = parseOne(ROW_HERBLAY_ARGENTEUIL);
    expect(row.stage).toBe("disponible");
    expect(row.destination_warehouse_id).toBe("wh-argenteuil");
    expect(row.destination_confidence).toBe("sure");
    expect(row.events.map((e) => e.event_type)).toContain("reception_argenteuil");
  });

  it("Argenteuil puis Aubagne = un transfert, pas deux disponibilités", () => {
    const row = parseOne(ROW_MARSEILLE_AUBAGNE);
    // Deux réceptions successives sont enregistrées comme deux ÉVÉNEMENTS…
    const types = row.events.map((e) => e.event_type);
    expect(types).toContain("reception_argenteuil");
    expect(types).toContain("reception_aubagne");
    // …mais la marchandise n'est disponible qu'à UN seul endroit : Aubagne.
    expect(row.stage).toBe("disponible");
    expect(row.current_warehouse_id).toBe("wh-aubagne");
    expect(row.destination_warehouse_id).toBe("wh-aubagne");
    expect(row.quantity).toBe(4);
  });

  it("reçue à Argenteuil mais attendue à Aubagne : en transfert", () => {
    const row = parseOne(ROW_TRANSFERT_EN_COURS);
    expect(row.stage).toBe("en_transfert");
    expect(row.current_warehouse_id).toBe("wh-argenteuil");
    expect(row.destination_warehouse_id).toBe("wh-aubagne");
    expect(row.events.map((e) => e.event_type)).toContain("depart_transfert");
  });

  it("une réception partielle ne rend jamais la ligne disponible", () => {
    const row = parseOne(ROW_PARTIELLE);
    expect(row.stage).not.toBe("disponible");
    expect(row.stage).toBe("recue_argenteuil");
    expect(row.anomalies.map((a) => a.type)).toContain("reception_partielle");
    expect(row.events.map((e) => e.event_type)).not.toContain("mise_a_disposition");
  });

  it("une destination inconnue crée une anomalie sans rien deviner", () => {
    const row = parseOne(ROW_DESTINATION_AMBIGUE);
    expect(row.destination_warehouse_id).toBeUndefined();
    expect(row.destination_confidence).toBe("ambigue");
    expect(row.anomalies.map((a) => a.type)).toContain("destination_ambigue");
    // La date au format Google Sheets a bien été comprise.
    expect(row.recap_date).toBe("2026-08-05");
  });

  it("signale une réception à Aubagne antérieure à Argenteuil", () => {
    const row = parseOne(
      fixtureRow({
        "DÉSIGNATION": "Buffet",
        CLIENT: "Test",
        "RÉCEPTION ARGENTEUIL": "X",
        "DATE RÉCEPTION": "20/07/2026",
        "RÉCEPTION AUBAGNE": "X",
        "DATE AUBAGNE": "10/07/2026",
      }),
    );
    expect(row.anomalies.map((a) => a.type)).toContain("incoherence_dates");
  });

  it("signale les données manquantes sans bloquer la ligne", () => {
    const row = parseOne(
      fixtureRow({ FOURNISSEUR: "By Boo", "QTÉ": "beaucoup" }),
    );
    expect(row.ignored).toBe(false);
    expect(row.quantity).toBe(1);
    const types = row.anomalies.map((a) => a.type);
    expect(types).toContain("quantite_illisible");
    expect(types).toContain("designation_manquante");
    expect(types).toContain("client_manquant");
  });

  it("l'empreinte de secours est stable et distingue les lignes", () => {
    const a = parseOne(ROW_INTERNET);
    const b = parseOne(ROW_INTERNET);
    const c = parseOne(ROW_HERBLAY_ARGENTEUIL);
    expect(a.fingerprint).toBe(b.fingerprint);
    expect(a.fingerprint).not.toBe(c.fingerprint);
    expect(a.fingerprint).toHaveLength(32);
  });

  it("l'ID TRUST est repris tel quel quand il existe", () => {
    expect(parseOne(ROW_INTERNET).recap_row_id).toBe("TR-000001");
    // Sans ID TRUST, seule l'empreinte identifie la ligne.
    const sansId = parseOne(ROW_DESTINATION_AMBIGUE);
    expect(sansId.recap_row_id).toBeUndefined();
    expect(sansId.fingerprint).not.toBe("");
  });

  it("numérote les lignes pour des messages compréhensibles", () => {
    const parsed = parseRecapRows(FIXTURE_ROWS, { ...options, firstDataRow: 3 });
    expect(parsed[0].rowNumber).toBe(3);
    expect(parsed[1].rowNumber).toBe(4);
  });
});

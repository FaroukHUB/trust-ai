import { createHash } from "node:crypto";

/**
 * Analyse du fichier récapitulatif (une ligne = un article attendu).
 *
 * Ce module est PUR : il ne connaît ni Google, ni Supabase, ni le réseau.
 * Il reçoit un tableau de cellules brutes et produit des lignes normalisées,
 * ce qui le rend entièrement testable avec des fixtures réelles.
 *
 * Règles métier non négociables appliquées ici :
 *  * « ORDER » est le numéro de commande du FOURNISSEUR (site marchand du
 *    fournisseur), jamais la référence de commande client ;
 *  * Herblay est un MAGASIN, Argenteuil un DÉPÔT : jamais confondus ;
 *  * Aubagne possède un magasin ET un dépôt distincts ; « Marseille » n'est
 *    qu'un alias historique d'Aubagne ;
 *  * une arrivée à Argenteuil PUIS à Aubagne est un TRANSFERT, pas deux
 *    disponibilités ;
 *  * une réception partielle ne rend jamais la ligne entièrement disponible ;
 *  * une destination ambiguë produit une ANOMALIE : rien n'est deviné.
 */

/** Champs métier reconnus, alimentés par le mapping de colonnes. */
export type RecapField =
  | "recap_row_id"
  | "recap_date"
  | "supplier_label"
  | "status_label"
  | "supplier_reference"
  | "designation"
  | "quantity"
  | "customer_label"
  | "supplier_order_ref"
  | "expected_at"
  | "comments"
  | "received_argenteuil"
  | "received_argenteuil_at"
  | "freight_label"
  | "exit_mode_label"
  | "received_aubagne"
  | "received_aubagne_at"
  | "final_release_label"
  | "final_release_at";

/** Mapping « champ métier → en-tête de colonne du fichier ». */
export type ColumnMapping = Partial<Record<RecapField, string>>;

export interface WarehouseRef {
  id: string;
  name: string;
  city: string;
}

export interface ParseOptions {
  /** En-têtes du fichier, dans l'ordre des colonnes. */
  headers: string[];
  mapping: ColumnMapping;
  /** Dépôts connus (Argenteuil, Aubagne) pour résoudre les destinations. */
  warehouses: WarehouseRef[];
  /** Numéro de la première ligne de données (pour les messages). */
  firstDataRow?: number;
}

export interface ParsedEvent {
  event_type:
    | "commande_fournisseur"
    | "arrivee_prevue"
    | "reception_argenteuil"
    | "depart_transfert"
    | "reception_aubagne"
    | "mise_a_disposition"
    | "sortie";
  occurred_on: string;
  warehouse_id?: string;
  quantity?: number;
  notes?: string;
}

export interface ParsedAnomaly {
  type: string;
  severity: "info" | "avertissement" | "bloquant";
  message: string;
}

export interface ParsedRow {
  /** true = ligne écartée (vide, total, en-tête répété). */
  ignored: boolean;
  ignoredReason?: string;
  rowNumber: number;
  recap_row_id?: string;
  fingerprint: string;
  recap_date?: string;
  supplier_label?: string;
  supplier_reference?: string;
  /** Numéro de commande FOURNISSEUR (colonne « ORDER »). */
  supplier_order_ref?: string;
  designation?: string;
  quantity: number;
  customer_label?: string;
  expected_at?: string;
  comments?: string;
  stage: string;
  current_warehouse_id?: string;
  destination_warehouse_id?: string;
  destination_confidence: "sure" | "deduite" | "ambigue";
  events: ParsedEvent[];
  anomalies: ParsedAnomaly[];
  raw_row: Record<string, string>;
}

// ---------------------------------------------------------------------------
// Normalisation
// ---------------------------------------------------------------------------

/** Minuscules sans accents ni ponctuation : comparaison robuste d'en-têtes. */
export function normalizeHeader(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** Index d'une colonne d'après son en-tête, quel que soit l'ordre du fichier. */
export function findColumnIndex(headers: string[], name?: string): number {
  if (!name) return -1;
  const target = normalizeHeader(name);
  if (!target) return -1;
  return headers.findIndex((h) => normalizeHeader(h) === target);
}

const TRUE_WORDS = new Set([
  "x", "oui", "o", "yes", "true", "vrai", "1", "ok", "fait", "recu", "recue",
  "receptionne", "receptionnee", "arrive", "arrivee",
]);
const FALSE_WORDS = new Set(["", "non", "n", "no", "false", "faux", "0", "-", "/"]);

export function parseBoolean(raw: string | undefined): boolean | undefined {
  const trimmed = (raw ?? "").trim();
  if (trimmed === "") return undefined;          // cellule vide : on ne sait pas
  const value = normalizeHeader(trimmed).replace(/\s+/g, "");
  // Une cellule ne contenant que de la ponctuation (« - », « / ») est un
  // marquage explicite de « rien » : c'est un NON, pas une inconnue.
  if (value === "") return false;
  if (TRUE_WORDS.has(value)) return true;
  if (FALSE_WORDS.has(value)) return false;
  return undefined;
}

/**
 * Dates : format français (jj/mm/aaaa ou jj-mm-aa), ISO, ou numéro de série
 * Google Sheets (jours depuis le 30/12/1899). Retourne « aaaa-mm-jj ».
 */
export function parseDate(raw: string | undefined): string | undefined {
  const value = (raw ?? "").trim();
  if (!value) return undefined;

  const iso = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;

  const fr = value.match(/^(\d{1,2})[/.\-](\d{1,2})[/.\-](\d{2,4})$/);
  if (fr) {
    const day = Number(fr[1]);
    const month = Number(fr[2]);
    let year = Number(fr[3]);
    if (year < 100) year += year < 70 ? 2000 : 1900;
    if (month < 1 || month > 12 || day < 1 || day > 31) return undefined;
    return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  }

  // Numéro de série Google Sheets / Excel.
  if (/^\d{4,6}(\.\d+)?$/.test(value)) {
    const serial = Math.floor(Number(value));
    if (serial > 20000 && serial < 80000) {
      const epoch = Date.UTC(1899, 11, 30);
      const date = new Date(epoch + serial * 86400000);
      return date.toISOString().slice(0, 10);
    }
  }
  return undefined;
}

/** Quantité : accepte « 2 », « 2,0 », « x3 », « 3 pcs ». Défaut : 1. */
export function parseQuantity(raw: string | undefined): number | undefined {
  const value = (raw ?? "").trim();
  if (!value) return undefined;
  const match = value.replace(",", ".").match(/(\d+(?:\.\d+)?)/);
  if (!match) return undefined;
  const parsed = Math.floor(Number(match[1]));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

const TOTAL_WORDS = ["total", "totaux", "sous total", "recapitulatif", "somme"];

/** Ligne de total / séparateur : à écarter sans bruit. */
export function isTotalRow(cells: string[]): boolean {
  const filled = cells.filter((c) => (c ?? "").trim() !== "");
  if (filled.length === 0) return false;
  const joined = normalizeHeader(filled.join(" "));
  return (
    filled.length <= 3 &&
    TOTAL_WORDS.some((w) => joined.startsWith(w) || joined === w)
  );
}

// ---------------------------------------------------------------------------
// Dépôts : Argenteuil / Aubagne (Marseille = alias d'Aubagne)
// ---------------------------------------------------------------------------

function warehouseByCity(warehouses: WarehouseRef[], city: string) {
  const target = normalizeHeader(city);
  return warehouses.find(
    (w) => normalizeHeader(w.city) === target || normalizeHeader(w.name).includes(target),
  );
}

/** Reconnaît un libellé de lieu : « Marseille » renvoie toujours Aubagne. */
export function resolveWarehouse(
  warehouses: WarehouseRef[],
  label: string | undefined,
): WarehouseRef | undefined {
  const value = normalizeHeader(label ?? "");
  if (!value) return undefined;
  if (value.includes("argenteuil")) return warehouseByCity(warehouses, "Argenteuil");
  // « Marseille » est un ALIAS historique d'Aubagne, jamais un lieu distinct.
  if (value.includes("aubagne") || value.includes("marseille")) {
    return warehouseByCity(warehouses, "Aubagne");
  }
  return undefined;
}

// ---------------------------------------------------------------------------
// Analyse d'une ligne
// ---------------------------------------------------------------------------

function fingerprintOf(parts: (string | undefined)[]): string {
  return createHash("sha256")
    .update(parts.map((p) => (p ?? "").trim().toLowerCase()).join("|"))
    .digest("hex")
    .slice(0, 32);
}

export function parseRecapRows(
  rows: string[][],
  options: ParseOptions,
): ParsedRow[] {
  const { headers, mapping, warehouses } = options;
  const firstDataRow = options.firstDataRow ?? 2;
  const index: Partial<Record<RecapField, number>> = {};
  for (const [field, header] of Object.entries(mapping) as [RecapField, string][]) {
    index[field] = findColumnIndex(headers, header);
  }

  const cellOf = (cells: string[], field: RecapField): string | undefined => {
    const i = index[field];
    if (i === undefined || i < 0) return undefined;
    const value = (cells[i] ?? "").trim();
    return value === "" ? undefined : value;
  };

  return rows.map((cells, position) => {
    const rowNumber = firstDataRow + position;
    const raw_row: Record<string, string> = {};
    headers.forEach((header, i) => {
      const value = (cells[i] ?? "").trim();
      if (value !== "") raw_row[header] = value;
    });

    const anomalies: ParsedAnomaly[] = [];
    const events: ParsedEvent[] = [];

    // --- Lignes à écarter -------------------------------------------------
    if (cells.every((c) => (c ?? "").trim() === "")) {
      return emptyIgnored(rowNumber, "Ligne vide", raw_row);
    }
    if (isTotalRow(cells)) {
      return emptyIgnored(rowNumber, "Ligne de total", raw_row);
    }
    const designation = cellOf(cells, "designation");
    const customer = cellOf(cells, "customer_label");
    const supplier = cellOf(cells, "supplier_label");
    if (!designation && !customer && !supplier) {
      return emptyIgnored(rowNumber, "Ligne sans donnée exploitable", raw_row);
    }

    // --- Champs simples ---------------------------------------------------
    const recapDate = parseDate(cellOf(cells, "recap_date"));
    const expectedAt = parseDate(cellOf(cells, "expected_at"));
    const quantityRaw = cellOf(cells, "quantity");
    const quantity = parseQuantity(quantityRaw) ?? 1;
    if (quantityRaw && parseQuantity(quantityRaw) === undefined) {
      anomalies.push({
        type: "quantite_illisible",
        severity: "avertissement",
        message: `Quantité illisible (« ${quantityRaw} ») : 1 retenu par défaut, à vérifier.`,
      });
    }
    if (!designation) {
      anomalies.push({
        type: "designation_manquante",
        severity: "avertissement",
        message: "Aucune désignation d'article sur cette ligne.",
      });
    }
    if (!customer) {
      anomalies.push({
        type: "client_manquant",
        severity: "info",
        message: "Aucun nom de client : rapprochement impossible en l'état.",
      });
    }

    // --- Réceptions : Argenteuil PUIS Aubagne = un transfert --------------
    const argenteuil = warehouseByCity(warehouses, "Argenteuil");
    const aubagne = warehouseByCity(warehouses, "Aubagne");
    const recArgFlag = parseBoolean(cellOf(cells, "received_argenteuil"));
    const recArgDate = parseDate(cellOf(cells, "received_argenteuil_at"));
    const recAubFlag = parseBoolean(cellOf(cells, "received_aubagne"));
    const recAubDate = parseDate(cellOf(cells, "received_aubagne_at"));
    const receivedArgenteuil = recArgFlag === true || Boolean(recArgDate);
    const receivedAubagne = recAubFlag === true || Boolean(recAubDate);

    if (receivedArgenteuil && argenteuil) {
      events.push({
        event_type: "reception_argenteuil",
        occurred_on: recArgDate ?? recapDate ?? expectedAt ?? todayIso(),
        warehouse_id: argenteuil.id,
      });
    }
    if (receivedAubagne && aubagne) {
      events.push({
        event_type: "reception_aubagne",
        occurred_on: recAubDate ?? recapDate ?? expectedAt ?? todayIso(),
        warehouse_id: aubagne.id,
      });
    }
    if (receivedArgenteuil && receivedAubagne && recArgDate && recAubDate && recAubDate < recArgDate) {
      anomalies.push({
        type: "incoherence_dates",
        severity: "avertissement",
        message: `Réception à Aubagne (${recAubDate}) antérieure à Argenteuil (${recArgDate}) : parcours à vérifier.`,
      });
    }

    // --- Destination : jamais devinée en silence --------------------------
    const releaseLabel = cellOf(cells, "final_release_label");
    const exitLabel = cellOf(cells, "exit_mode_label");
    const releaseWarehouse = resolveWarehouse(warehouses, releaseLabel);
    const exitWarehouse = resolveWarehouse(warehouses, exitLabel);

    let destination: WarehouseRef | undefined;
    let confidence: ParsedRow["destination_confidence"] = "deduite";
    if (releaseWarehouse) {
      destination = releaseWarehouse;
      confidence = "sure";
    } else if (exitWarehouse) {
      destination = exitWarehouse;
      confidence = "sure";
    } else if (receivedAubagne && aubagne) {
      destination = aubagne;
      confidence = "deduite";
    } else if (receivedArgenteuil && argenteuil) {
      destination = argenteuil;
      confidence = "deduite";
    } else if (releaseLabel || exitLabel) {
      // Un libellé est présent mais ne correspond à aucun dépôt connu.
      confidence = "ambigue";
      anomalies.push({
        type: "destination_ambigue",
        severity: "avertissement",
        message: `Destination non reconnue (« ${releaseLabel ?? exitLabel} ») : à confirmer manuellement.`,
      });
    } else {
      confidence = "ambigue";
      anomalies.push({
        type: "destination_absente",
        severity: "info",
        message: "Aucune destination indiquée : à confirmer manuellement.",
      });
    }

    // --- Réception partielle : jamais disponible en totalité --------------
    const partial = detectPartial(cellOf(cells, "comments"), cellOf(cells, "status_label"), quantity);
    if (partial) {
      anomalies.push({
        type: "reception_partielle",
        severity: "avertissement",
        message: `Réception partielle signalée (${partial} sur ${quantity}) : la ligne reste incomplète.`,
      });
    }

    // --- Étape courante ---------------------------------------------------
    const statusLabel = cellOf(cells, "status_label");
    const released = Boolean(parseDate(cellOf(cells, "final_release_at")));
    let stage: string;
    let currentWarehouse: WarehouseRef | undefined;

    if (released) {
      stage = "sortie";
      currentWarehouse = destination;
    } else if (partial) {
      // Une partie seulement est arrivée : on reste au stade réception.
      stage = receivedAubagne ? "recue_aubagne" : receivedArgenteuil ? "recue_argenteuil" : "attendue";
      currentWarehouse = receivedAubagne ? aubagne : receivedArgenteuil ? argenteuil : undefined;
    } else if (receivedAubagne) {
      stage = "disponible";
      currentWarehouse = aubagne;
    } else if (receivedArgenteuil) {
      // Reçue à Argenteuil mais attendue à Aubagne → transfert à faire.
      const needsTransfer = destination && aubagne && destination.id === aubagne.id;
      stage = needsTransfer ? "en_transfert" : "disponible";
      currentWarehouse = argenteuil;
      if (needsTransfer) {
        events.push({
          event_type: "depart_transfert",
          occurred_on: recArgDate ?? recapDate ?? todayIso(),
          warehouse_id: argenteuil?.id,
          notes: "Transfert Argenteuil → Aubagne déduit du récapitulatif.",
        });
      }
    } else if (statusLabel && /command/i.test(statusLabel)) {
      stage = "commandee";
    } else if (expectedAt) {
      stage = "attendue";
    } else {
      stage = "a_commander";
    }

    if (stage === "disponible" && !partial) {
      events.push({
        event_type: "mise_a_disposition",
        occurred_on: recAubDate ?? recArgDate ?? todayIso(),
        warehouse_id: currentWarehouse?.id,
      });
    }
    if (expectedAt) {
      events.push({ event_type: "arrivee_prevue", occurred_on: expectedAt });
    }

    const recapRowId = cellOf(cells, "recap_row_id");
    // Empreinte de secours : stable tant que les colonnes structurantes ne
    // changent pas. Utilisée uniquement quand « ID TRUST » est absent.
    const fingerprint = fingerprintOf([
      recapDate,
      supplier,
      cellOf(cells, "supplier_reference"),
      designation,
      String(quantity),
      customer,
    ]);

    return {
      ignored: false,
      rowNumber,
      recap_row_id: recapRowId,
      fingerprint,
      recap_date: recapDate,
      supplier_label: supplier,
      supplier_reference: cellOf(cells, "supplier_reference"),
      // « ORDER » : numéro de commande du FOURNISSEUR, jamais du client.
      supplier_order_ref: cellOf(cells, "supplier_order_ref"),
      designation,
      quantity,
      customer_label: customer,
      expected_at: expectedAt,
      comments: cellOf(cells, "comments"),
      stage,
      current_warehouse_id: currentWarehouse?.id,
      destination_warehouse_id: destination?.id,
      destination_confidence: confidence,
      events,
      anomalies,
      raw_row,
    };
  });
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function emptyIgnored(
  rowNumber: number,
  reason: string,
  raw_row: Record<string, string>,
): ParsedRow {
  return {
    ignored: true,
    ignoredReason: reason,
    rowNumber,
    fingerprint: "",
    quantity: 0,
    stage: "a_commander",
    destination_confidence: "ambigue",
    events: [],
    anomalies: [],
    raw_row,
  };
}

/** Quantité partielle mentionnée dans les commentaires ou le statut. */
function detectPartial(
  comments: string | undefined,
  status: string | undefined,
  quantity: number,
): number | undefined {
  const haystack = `${comments ?? ""} ${status ?? ""}`;
  if (!/partiel/i.test(haystack)) {
    // « 2/4 reçus » signale aussi une réception partielle.
    const ratio = haystack.match(/(\d+)\s*\/\s*(\d+)/);
    if (ratio && Number(ratio[1]) < Number(ratio[2])) return Number(ratio[1]);
    return undefined;
  }
  const ratio = haystack.match(/(\d+)\s*(?:\/|sur)\s*(\d+)/i);
  if (ratio && Number(ratio[1]) < Number(ratio[2])) return Number(ratio[1]);
  const single = haystack.match(/(\d+)/);
  if (single && Number(single[1]) < quantity) return Number(single[1]);
  return quantity > 1 ? quantity - 1 : undefined;
}

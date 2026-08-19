import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requirePermission } from "@/lib/auth/serverGuard";
import {
  GoogleSheetsAccessError,
  GoogleSheetsConfigError,
  isGoogleSheetsConfigured,
  readSheet,
} from "@/lib/recap/google-sheets";
import { parseRecapRows, type ColumnMapping, type WarehouseRef } from "@/lib/recap/parser";

/**
 * Lecture du récapitulatif Google Sheets → lignes logistiques.
 *
 * Chaîne de responsabilité :
 *   1. permission « importer_recap » vérifiée côté serveur ;
 *   2. configuration lue par RPC (l'organisation vient de la session) ;
 *   3. lecture du Sheet en LECTURE SEULE avec le compte de service ;
 *   4. analyse locale (module pur, testé unitairement) ;
 *   5. écriture atomique par RPC `sync_recap_rows`.
 *
 * Les appels Supabase utilisent la session de l'utilisateur : `auth.uid()`
 * est disponible côté base, les permissions et l'isolation par organisation
 * sont donc rejouées par PostgreSQL. La clé serveur n'est PAS utilisée ici.
 *
 * `preview=1` analyse sans rien écrire (prévisualisation avant la première
 * synchronisation).
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

interface RecapSourceRow {
  id: string;
  spreadsheet_id: string | null;
  sheet_name: string | null;
  header_row: number | null;
  id_column: string | null;
  column_mapping: ColumnMapping | null;
}

export async function POST(request: Request) {
  const guard = await requirePermission("importer_recap");
  if (!guard.ok) {
    return NextResponse.json({ error: guard.error }, { status: guard.status });
  }
  if (!isGoogleSheetsConfigured()) {
    return NextResponse.json(
      {
        error:
          "Connexion Google Sheets non configurée : renseignez GOOGLE_SERVICE_ACCOUNT_EMAIL et GOOGLE_PRIVATE_KEY dans les variables serveur (voir docs/RECAP_GOOGLE_SHEETS.md).",
      },
      { status: 503 },
    );
  }

  const preview = new URL(request.url).searchParams.get("preview") === "1";
  let supabase;
  try {
    supabase = createSupabaseServerClient();
  } catch {
    return NextResponse.json(
      { error: "Mode connecté requis (Supabase non configuré)." },
      { status: 503 },
    );
  }

  // 1. Configuration de la source (RPC : permission + organisation vérifiées).
  const { data: sourceData, error: sourceError } = await supabase.rpc("get_recap_source");
  if (sourceError) {
    return NextResponse.json({ error: sourceError.message }, { status: 400 });
  }
  const source = sourceData as RecapSourceRow | null;
  if (!source?.spreadsheet_id || !source.sheet_name) {
    return NextResponse.json(
      {
        error:
          "Aucune source configurée : renseignez l'identifiant du Google Sheet et le nom de l'onglet avant de synchroniser.",
      },
      { status: 400 },
    );
  }

  // 2. Dépôts de l'organisation : nécessaires pour résoudre les destinations.
  const { data: warehouses, error: warehousesError } = await supabase
    .from("warehouses")
    .select("id, name, city");
  if (warehousesError) {
    return NextResponse.json({ error: warehousesError.message }, { status: 400 });
  }

  // 3. Lecture du Sheet + 4. analyse.
  let parsed;
  let headers: string[];
  try {
    const sheet = await readSheet(
      source.spreadsheet_id,
      source.sheet_name,
      source.header_row ?? 1,
    );
    headers = sheet.headers;
    parsed = parseRecapRows(sheet.rows, {
      headers: sheet.headers,
      mapping: (source.column_mapping ?? {}) as ColumnMapping,
      warehouses: (warehouses ?? []) as WarehouseRef[],
      firstDataRow: sheet.firstDataRow,
    });
  } catch (error) {
    const known =
      error instanceof GoogleSheetsConfigError || error instanceof GoogleSheetsAccessError;
    return NextResponse.json(
      {
        error: known
          ? error.message
          : "Lecture du récapitulatif impossible. Vérifiez le partage du fichier et le nom de l'onglet.",
      },
      { status: known ? 400 : 502 },
    );
  }

  const kept = parsed.filter((r) => !r.ignored);
  const summary = {
    headers,
    rowsRead: parsed.length,
    kept: kept.length,
    ignored: parsed.length - kept.length,
    anomalies: kept.reduce((n, r) => n + r.anomalies.length, 0),
    withId: kept.filter((r) => r.recap_row_id).length,
  };

  // Prévisualisation : rien n'est écrit en base.
  if (preview) {
    return NextResponse.json({
      ok: true,
      preview: true,
      summary,
      rows: parsed.slice(0, 25),
    });
  }

  // 5. Écriture atomique.
  const { data: report, error: syncError } = await supabase.rpc("sync_recap_rows", {
    p_source_id: source.id,
    p_rows: parsed,
    p_trigger: "manuel",
  });
  if (syncError) {
    return NextResponse.json({ error: syncError.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true, preview: false, summary, report });
}

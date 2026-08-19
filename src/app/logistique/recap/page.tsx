"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Eye, FileSpreadsheet, RefreshCw } from "lucide-react";
import { useData, BusinessError } from "@/lib/store/DataProvider";
import { useSession } from "@/lib/auth/SessionProvider";
import { hasPermission } from "@/lib/permissions";
import { useToast } from "@/components/ui/Toast";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Badge } from "@/components/ui/Badge";
import { formatDateTime } from "@/lib/format";
import type { RecapSource } from "@/lib/types";

/**
 * Configuration et synchronisation du récapitulatif Google Sheets.
 *
 * TRUST AI lit le fichier en LECTURE SEULE : il n'y écrit jamais. Seul
 * l'Apps Script installé dans le Sheet alimente la colonne « ID TRUST »
 * (voir docs/RECAP_GOOGLE_SHEETS.md).
 */

/** Champs métier configurables et leur intitulé pour l'utilisateur. */
const FIELDS: { key: string; label: string; hint?: string }[] = [
  { key: "recap_row_id", label: "ID TRUST", hint: "Colonne masquée alimentée par le script" },
  { key: "recap_date", label: "Date" },
  { key: "supplier_label", label: "Fournisseur" },
  { key: "status_label", label: "Statut" },
  { key: "supplier_reference", label: "Référence fournisseur" },
  { key: "designation", label: "Désignation" },
  { key: "quantity", label: "Quantité" },
  { key: "customer_label", label: "Client" },
  {
    key: "supplier_order_ref",
    label: "ORDER",
    hint: "Numéro de commande du FOURNISSEUR, pas la commande client",
  },
  { key: "expected_at", label: "Arrivée prévue" },
  { key: "comments", label: "Commentaires" },
  { key: "received_argenteuil", label: "Réception Argenteuil" },
  { key: "received_argenteuil_at", label: "Date réception Argenteuil" },
  { key: "freight_label", label: "Affrètement" },
  { key: "exit_mode_label", label: "Mode de sortie / transporteur" },
  { key: "received_aubagne", label: "Réception Aubagne" },
  { key: "received_aubagne_at", label: "Date réception Aubagne" },
  { key: "final_release_label", label: "Livraison ou retrait final" },
  { key: "final_release_at", label: "Date finale" },
];

interface PreviewRow {
  ignored: boolean;
  ignoredReason?: string;
  rowNumber: number;
  recap_row_id?: string;
  designation?: string;
  quantity: number;
  customer_label?: string;
  supplier_label?: string;
  supplier_order_ref?: string;
  stage: string;
  destination_confidence: string;
  anomalies: { type: string; message: string }[];
}

export default function RecapPage() {
  const { mode, getRecapSource, saveRecapSource } = useData();
  const { profile } = useSession();
  const { notify } = useToast();

  const [source, setSource] = useState<RecapSource | null>(null);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({
    label: "Récapitulatif",
    spreadsheetId: "",
    sheetName: "",
    headerRow: "1",
    idColumn: "ID TRUST",
  });
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<{
    summary: Record<string, number | string[]>;
    rows: PreviewRow[];
  } | null>(null);
  const [confirmSync, setConfirmSync] = useState(false);
  const [lastReport, setLastReport] = useState<Record<string, number> | null>(null);

  const canImport =
    mode === "connected" && profile !== null && hasPermission(profile.role, "importer_recap");

  const load = useCallback(async () => {
    if (mode !== "connected") {
      setLoading(false);
      return;
    }
    try {
      const value = await getRecapSource();
      setSource(value);
      if (value) {
        setForm({
          label: value.label || "Récapitulatif",
          spreadsheetId: value.spreadsheetId,
          sheetName: value.sheetName,
          headerRow: String(value.headerRow || 1),
          idColumn: value.idColumn ?? "ID TRUST",
        });
        setMapping(value.columnMapping ?? {});
      }
    } catch (error) {
      notify(error instanceof Error ? error.message : "Lecture impossible.", "error");
    }
    setLoading(false);
  }, [mode, getRecapSource, notify]);

  useEffect(() => {
    void load();
  }, [load]);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await saveRecapSource({
        label: form.label.trim() || "Récapitulatif",
        spreadsheetId: form.spreadsheetId.trim(),
        sheetName: form.sheetName.trim(),
        headerRow: Number(form.headerRow) || 1,
        idColumn: form.idColumn.trim() || undefined,
        columnMapping: Object.fromEntries(
          Object.entries(mapping).filter(([, v]) => v.trim() !== ""),
        ),
      });
      notify("Configuration enregistrée.");
      await load();
    } catch (error) {
      notify(
        error instanceof BusinessError || error instanceof Error
          ? error.message
          : "Enregistrement impossible.",
        "error",
      );
    }
    setBusy(false);
  };

  const run = async (isPreview: boolean) => {
    setBusy(true);
    try {
      const response = await fetch(`/api/recap/sync${isPreview ? "?preview=1" : ""}`, {
        method: "POST",
      });
      const body = await response.json();
      if (!response.ok) {
        notify(body.error ?? "Synchronisation impossible.", "error");
      } else if (isPreview) {
        setPreview({ summary: body.summary, rows: body.rows ?? [] });
        notify(
          `Prévisualisation : ${body.summary.kept} ligne(s) exploitable(s), ${body.summary.ignored} ignorée(s).`,
        );
      } else {
        setLastReport(body.report);
        setPreview(null);
        notify(
          `Synchronisation terminée : ${body.report.created} créée(s), ${body.report.updated} modifiée(s), ${body.report.unchanged} inchangée(s).`,
        );
        await load();
      }
    } catch {
      notify("Erreur réseau.", "error");
    }
    setBusy(false);
  };

  if (mode === "demo") {
    return (
      <div className="flex flex-col gap-4">
        <BackLink />
        <h1 className="text-xl font-bold">Récapitulatif</h1>
        <div className="card p-6 text-sm">
          <p>
            La connexion au fichier récapitulatif s&apos;appuie sur la base
            partagée et n&apos;est active qu&apos;en <strong>mode connecté</strong>.
          </p>
        </div>
      </div>
    );
  }

  if (!canImport) {
    return (
      <div className="flex flex-col gap-4">
        <BackLink />
        <h1 className="text-xl font-bold">Récapitulatif</h1>
        <div className="card p-6 text-sm">
          <p>Votre rôle ne permet pas de configurer ni de synchroniser le récapitulatif.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <BackLink />
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-bold">
            <FileSpreadsheet size={20} aria-hidden style={{ color: "var(--primary)" }} />
            Récapitulatif Google Sheets
          </h1>
          <p className="mt-1 text-sm" style={{ color: "var(--muted)" }}>
            Source de la disponibilité des marchandises. TRUST AI lit le
            fichier, ne le modifie jamais.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="btn-secondary"
            disabled={busy || !source}
            onClick={() => run(true)}
          >
            <Eye size={15} aria-hidden />
            Prévisualiser
          </button>
          <button
            type="button"
            className="btn-primary"
            disabled={busy || !source}
            onClick={() => setConfirmSync(true)}
          >
            <RefreshCw size={15} aria-hidden className={busy ? "animate-spin" : undefined} />
            Synchroniser maintenant
          </button>
        </div>
      </div>

      {/* État de la dernière lecture */}
      <div className="card p-4">
        <h2 className="text-sm font-semibold">Dernière synchronisation</h2>
        {loading ? (
          <p className="mt-2 text-sm" style={{ color: "var(--muted)" }}>Chargement…</p>
        ) : !source ? (
          <p className="mt-2 text-sm" style={{ color: "var(--muted)" }}>
            Aucune source configurée pour l&apos;instant.
          </p>
        ) : (
          <div className="mt-2 flex flex-wrap items-center gap-3 text-sm">
            <Badge tone={source.lastReadStatus === "succes" ? "success" : "neutral"}>
              {source.lastReadAt ? formatDateTime(source.lastReadAt) : "Jamais lue"}
            </Badge>
            {source.lastRead ? (
              <span style={{ color: "var(--muted)" }}>
                {source.lastRead.rowsRead} ligne(s) lue(s) ·{" "}
                {source.lastRead.rowsCreated} créée(s) ·{" "}
                {source.lastRead.rowsUpdated} modifiée(s) ·{" "}
                {source.lastRead.report?.unchanged ?? 0} inchangée(s) ·{" "}
                {source.lastRead.rowsIgnored} ignorée(s) ·{" "}
                {source.lastRead.errorsCount} anomalie(s) ·{" "}
                {source.lastRead.report?.missing ?? 0} absente(s)
              </span>
            ) : null}
          </div>
        )}
        {lastReport ? (
          <p className="mt-2 text-sm">
            Résultat : {lastReport.created} créée(s), {lastReport.updated} modifiée(s),{" "}
            {lastReport.unchanged} inchangée(s), {lastReport.ignored} ignorée(s),{" "}
            {lastReport.anomalies} anomalie(s), {lastReport.missing} absente(s).
          </p>
        ) : null}
      </div>

      {/* Configuration */}
      <form onSubmit={save} className="card flex flex-col gap-4 p-4">
        <h2 className="text-sm font-semibold">Configuration de la source</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label>
            <span className="field-label">Identifiant du Google Sheet</span>
            <input
              className="field-input"
              value={form.spreadsheetId}
              onChange={(e) => setForm({ ...form, spreadsheetId: e.target.value })}
              placeholder="1AbCdEf…"
              required
            />
            <span className="field-hint">
              Dans l&apos;URL du fichier, entre <code>/d/</code> et <code>/edit</code>.
            </span>
          </label>
          <label>
            <span className="field-label">Nom de l&apos;onglet</span>
            <input
              className="field-input"
              value={form.sheetName}
              onChange={(e) => setForm({ ...form, sheetName: e.target.value })}
              placeholder="RECAP"
              required
            />
          </label>
          <label>
            <span className="field-label">Ligne des en-têtes</span>
            <input
              type="number"
              min={1}
              className="field-input"
              value={form.headerRow}
              onChange={(e) => setForm({ ...form, headerRow: e.target.value })}
            />
          </label>
          <label>
            <span className="field-label">Colonne « ID TRUST »</span>
            <input
              className="field-input"
              value={form.idColumn}
              onChange={(e) => setForm({ ...form, idColumn: e.target.value })}
            />
            <span className="field-hint">
              Colonne masquée, remplie automatiquement par le script installé
              dans le Sheet.
            </span>
          </label>
        </div>

        <div>
          <h3 className="text-sm font-semibold">Correspondance des colonnes</h3>
          <p className="mt-1 text-xs" style={{ color: "var(--muted)" }}>
            Saisissez le titre exact de la colonne du fichier. L&apos;ordre des
            colonnes n&apos;a aucune importance ; laissez vide si la colonne
            n&apos;existe pas.
          </p>
          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {FIELDS.map((field) => (
              <label key={field.key}>
                <span className="field-label">{field.label}</span>
                <input
                  className="field-input"
                  value={mapping[field.key] ?? ""}
                  onChange={(e) => setMapping({ ...mapping, [field.key]: e.target.value })}
                />
                {field.hint ? <span className="field-hint">{field.hint}</span> : null}
              </label>
            ))}
          </div>
        </div>

        <div>
          <button type="submit" className="btn-primary" disabled={busy}>
            Enregistrer la configuration
          </button>
        </div>
      </form>

      {/* Prévisualisation */}
      {preview ? (
        <div className="card p-4">
          <h2 className="text-sm font-semibold">
            Prévisualisation — aucune donnée enregistrée
          </h2>
          <p className="mt-1 text-sm" style={{ color: "var(--muted)" }}>
            {String(preview.summary.kept)} ligne(s) exploitable(s) ·{" "}
            {String(preview.summary.ignored)} ignorée(s) ·{" "}
            {String(preview.summary.anomalies)} anomalie(s) ·{" "}
            {String(preview.summary.withId)} avec ID TRUST
          </p>
          <div className="mt-3 overflow-x-auto">
            <table className="table-base">
              <thead>
                <tr>
                  <th scope="col">Ligne</th>
                  <th scope="col">Article</th>
                  <th scope="col">Client</th>
                  <th scope="col">Fournisseur</th>
                  <th scope="col">Étape</th>
                  <th scope="col">Anomalies</th>
                </tr>
              </thead>
              <tbody>
                {preview.rows.map((row) => (
                  <tr key={row.rowNumber}>
                    <td>{row.rowNumber}</td>
                    <td>
                      {row.ignored ? (
                        <em style={{ color: "var(--muted)" }}>{row.ignoredReason}</em>
                      ) : (
                        <>
                          {row.designation ?? "—"}
                          <span style={{ color: "var(--muted)" }}> × {row.quantity}</span>
                        </>
                      )}
                    </td>
                    <td>{row.customer_label ?? "—"}</td>
                    <td>
                      {row.supplier_label ?? "—"}
                      {row.supplier_order_ref ? (
                        <p className="text-xs" style={{ color: "var(--muted)" }}>
                          Commande fournisseur : {row.supplier_order_ref}
                        </p>
                      ) : null}
                    </td>
                    <td>{row.ignored ? "—" : row.stage}</td>
                    <td>
                      {row.anomalies?.length ? (
                        <Badge tone="warning">{row.anomalies.length}</Badge>
                      ) : (
                        "—"
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      <ConfirmDialog
        open={confirmSync}
        title="Synchroniser le récapitulatif ?"
        description="Les lignes du fichier seront créées ou mises à jour dans TRUST AI. Le Google Sheet n'est jamais modifié, et aucune ligne existante n'est supprimée."
        confirmLabel="Synchroniser"
        onCancel={() => setConfirmSync(false)}
        onConfirm={() => {
          setConfirmSync(false);
          void run(false);
        }}
      />
    </div>
  );
}

function BackLink() {
  return (
    <Link
      href="/logistique"
      className="inline-flex items-center gap-1 text-sm font-medium"
      style={{ color: "var(--muted)" }}
    >
      <ArrowLeft size={14} aria-hidden />
      Logistique
    </Link>
  );
}

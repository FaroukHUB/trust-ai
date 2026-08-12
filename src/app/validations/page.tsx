"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { CheckSquare, X } from "lucide-react";
import { useData, BusinessError } from "@/lib/store/DataProvider";
import { useToast } from "@/components/ui/Toast";
import { Badge } from "@/components/ui/Badge";
import { LoadingState } from "@/components/ui/LoadingState";
import { EmptyState } from "@/components/ui/EmptyState";
import { ViewTabs } from "@/components/ui/ViewTabs";
import { PaginationBar, usePagination } from "@/components/ui/Pagination";
import { formatDateTime, formatEuro } from "@/lib/format";
import { approvalStatusLabels, approvalTypeLabels } from "@/lib/labels";
import type { ApprovalRequest } from "@/lib/types";

type ViewKey = "en_attente" | "traitees" | "toutes";

interface Decision {
  request: ApprovalRequest;
  approved: boolean;
}

export default function ApprovalsPage() {
  const { db, decideApproval } = useData();
  const { notify } = useToast();
  const [view, setView] = useState<ViewKey>("en_attente");
  const [decision, setDecision] = useState<Decision | null>(null);
  const [reason, setReason] = useState("");

  const requests = useMemo(() => {
    if (!db) return [];
    return db.approvalRequests
      .filter((r) =>
        view === "toutes"
          ? true
          : view === "en_attente"
            ? r.status === "en_attente"
            : r.status !== "en_attente",
      )
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }, [db, view]);

  const pagination = usePagination(requests);

  if (!db) return <LoadingState />;

  const pendingCount = db.approvalRequests.filter(
    (r) => r.status === "en_attente",
  ).length;
  const treatedCount = db.approvalRequests.length - pendingCount;

  const confirmDecision = () => {
    if (!decision) return;
    try {
      decideApproval(
        decision.request.id,
        decision.approved,
        "Responsable magasin",
        reason.trim() || undefined,
      );
      notify(decision.approved ? "Demande validée." : "Demande refusée.");
    } catch (e) {
      notify(
        e instanceof BusinessError ? e.message : "Impossible de traiter la demande.",
        "error",
      );
    }
    setDecision(null);
    setReason("");
  };

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-xl font-bold">Validations</h1>
        <p className="text-sm" style={{ color: "var(--muted)" }}>
          Toutes les décisions importantes attendent ici une validation
          humaine. Aucune action extérieure réelle n&apos;est exécutée dans cette
          version.
        </p>
      </div>

      <ViewTabs<ViewKey>
        ariaLabel="Filtrer les demandes"
        value={view}
        onChange={setView}
        tabs={[
          { key: "en_attente", label: "En attente de validation", count: pendingCount },
          { key: "traitees", label: "Traitées", count: treatedCount },
          { key: "toutes", label: "Toutes" },
        ]}
      />

      {requests.length === 0 ? (
        <EmptyState
          title={
            view === "en_attente"
              ? "Aucune demande en attente de validation"
              : "Aucune demande"
          }
          description="Les demandes créées depuis les commandes, les achats ou les relances apparaîtront ici."
          icon={CheckSquare}
        />
      ) : (
        <div className="flex flex-col gap-4">
          {pagination.paged.map((request) => {
            const status = approvalStatusLabels[request.status];
            const order = db.orders.find((o) => o.id === request.relatedOrderId);
            const store = order
              ? db.stores.find((s) => s.id === order.storeId)
              : undefined;
            const customer = order
              ? db.customers.find((c) => c.id === order.customerId)
              : undefined;
            const supplierOrder = db.supplierOrders.find(
              (o) => o.id === request.relatedSupplierOrderId,
            );
            return (
              <div key={request.id} className="card p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge tone="neutral">{approvalTypeLabels[request.type]}</Badge>
                      <Badge tone={status.tone}>{status.label}</Badge>
                      {request.financialImpact && request.financialImpact > 0 ? (
                        <Badge tone="warning">
                          Impact : {formatEuro(request.financialImpact)} encaissés
                        </Badge>
                      ) : null}
                    </div>
                    <p className="mt-2 font-semibold">{request.title}</p>
                    <p className="mt-1 text-sm" style={{ color: "var(--muted)" }}>
                      {request.description}
                    </p>
                    <dl className="mt-2 grid grid-cols-1 gap-x-8 gap-y-1 text-sm sm:grid-cols-2 lg:grid-cols-3">
                      {order ? (
                        <div className="flex gap-1.5">
                          <dt style={{ color: "var(--muted)" }}>Commande :</dt>
                          <dd>
                            <Link
                              href={`/commandes/${order.id}`}
                              className="font-medium"
                              style={{ color: "var(--primary)" }}
                            >
                              {order.reference}
                            </Link>
                          </dd>
                        </div>
                      ) : null}
                      {store ? (
                        <div className="flex gap-1.5">
                          <dt style={{ color: "var(--muted)" }}>Magasin :</dt>
                          <dd>{store.name}</dd>
                        </div>
                      ) : null}
                      {customer ? (
                        <div className="flex gap-1.5">
                          <dt style={{ color: "var(--muted)" }}>Client :</dt>
                          <dd>{customer.name}</dd>
                        </div>
                      ) : null}
                      <div className="flex gap-1.5">
                        <dt style={{ color: "var(--muted)" }}>Demandé par :</dt>
                        <dd>{request.requestedBy ?? "—"}</dd>
                      </div>
                      <div className="flex gap-1.5">
                        <dt style={{ color: "var(--muted)" }}>Le :</dt>
                        <dd>{formatDateTime(request.createdAt)}</dd>
                      </div>
                      {request.status !== "en_attente" ? (
                        <div className="flex gap-1.5">
                          <dt style={{ color: "var(--muted)" }}>Traitée par :</dt>
                          <dd>
                            {request.decidedBy ?? "—"} · {formatDateTime(request.decidedAt)}
                          </dd>
                        </div>
                      ) : null}
                    </dl>
                    {supplierOrder ? (
                      <ul className="mt-2 text-sm" style={{ color: "var(--muted)" }}>
                        {supplierOrder.lines.map((l) => (
                          <li key={l.id}>
                            {l.quantity} × {l.productName}
                            {l.variant ? ` (${l.variant})` : ""}
                            {l.supplierReference ? ` — réf. ${l.supplierReference}` : ""}
                          </li>
                        ))}
                      </ul>
                    ) : null}
                    {request.decisionReason ? (
                      <p className="mt-2 text-sm italic" style={{ color: "var(--muted)" }}>
                        Motif : {request.decisionReason}
                      </p>
                    ) : null}
                  </div>
                  {request.status === "en_attente" ? (
                    <div className="flex shrink-0 gap-2">
                      <button
                        type="button"
                        className="btn-primary"
                        onClick={() => setDecision({ request, approved: true })}
                      >
                        Valider
                      </button>
                      <button
                        type="button"
                        className="btn-secondary"
                        onClick={() => setDecision({ request, approved: false })}
                      >
                        Refuser
                      </button>
                    </div>
                  ) : null}
                </div>
              </div>
            );
          })}
          <div className="card">
            <PaginationBar
              page={pagination.page}
              pageCount={pagination.pageCount}
              pageSize={pagination.pageSize}
              total={pagination.total}
              onPageChange={pagination.setPage}
              onPageSizeChange={pagination.setPageSize}
            />
          </div>
        </div>
      )}

      {/* Dialogue de décision avec motif */}
      {decision ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="decision-title"
        >
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setDecision(null)}
            aria-hidden
          />
          <div className="card relative w-full max-w-md p-5 shadow-xl">
            <div className="flex items-start justify-between gap-3">
              <h2 id="decision-title" className="text-base font-semibold">
                {decision.approved ? "Valider cette demande ?" : "Refuser cette demande ?"}
              </h2>
              <button
                type="button"
                onClick={() => setDecision(null)}
                className="rounded p-1 transition hover:bg-black/5"
                aria-label="Fermer"
              >
                <X size={18} />
              </button>
            </div>
            <p className="mt-2 text-sm" style={{ color: "var(--muted)" }}>
              {decision.request.title} — aucune action extérieure réelle ne sera
              exécutée : seul le suivi interne sera mis à jour.
            </p>
            <label className="mt-4 block">
              <span className="field-label">
                Motif {decision.approved ? "(facultatif)" : "(recommandé)"}
              </span>
              <textarea
                className="field-input"
                rows={2}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder={
                  decision.approved
                    ? "Commentaire éventuel…"
                    : "Pourquoi cette demande est-elle refusée ?"
                }
              />
            </label>
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" className="btn-secondary" onClick={() => setDecision(null)}>
                Annuler
              </button>
              <button
                type="button"
                className={decision.approved ? "btn-primary" : "btn-danger"}
                onClick={confirmDecision}
              >
                {decision.approved ? "Valider" : "Refuser"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

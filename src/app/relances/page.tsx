"use client";

import Link from "next/link";
import { PhoneOutgoing } from "lucide-react";
import { useData } from "@/lib/store/DataProvider";
import { useToast } from "@/components/ui/Toast";
import { Badge } from "@/components/ui/Badge";
import { LoadingState } from "@/components/ui/LoadingState";
import { EmptyState } from "@/components/ui/EmptyState";
import { computeReminders } from "@/lib/derive";
import { formatDate, formatDateLong, nextMonday } from "@/lib/format";
import { procurementStatusLabels } from "@/lib/labels";

export default function RemindersPage() {
  const { db, markReminderDone } = useData();
  const { notify } = useToast();

  if (!db) return <LoadingState />;

  const reminders = computeReminders(db);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-bold">Relances du lundi</h1>
        <p className="text-sm" style={{ color: "var(--muted)" }}>
          Le lundi est le jour des commandes et relances fournisseurs. Prochain
          lundi : {formatDateLong(nextMonday())}. Aucun message WhatsApp réel
          n&apos;est envoyé dans cette version.
        </p>
      </div>

      {reminders.length === 0 ? (
        <EmptyState
          title="Aucune relance en attente"
          description="Les articles à commander ou indisponibles apparaîtront automatiquement ici."
          icon={PhoneOutgoing}
        />
      ) : (
        <div className="flex flex-col gap-4">
          {reminders.map(({ line, order, overdueDays }) => {
            const supplier = db.suppliers.find((s) => s.id === line.supplierId);
            const customer = db.customers.find((c) => c.id === order.customerId);
            const status = procurementStatusLabels[line.procurementStatus];
            const message = `Bonjour${supplier ? ` ${supplier.name}` : ""}, avez-vous du stock sur « ${line.productName}${line.variant ? ` — ${line.variant}` : ""} »${line.reference ? ` (réf. ${line.reference})` : ""} ? Il nous en faudrait ${line.quantity} pour une commande client. Merci !`;
            return (
              <div key={line.id} className="card p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold">
                        {line.quantity} × {line.productName}
                        {line.variant ? ` — ${line.variant}` : ""}
                      </p>
                      <Badge tone={status.tone}>{status.label}</Badge>
                      {overdueDays > 0 ? (
                        <Badge tone="danger">Retard de {overdueDays} j</Badge>
                      ) : null}
                    </div>
                    <dl className="mt-2 grid grid-cols-1 gap-x-8 gap-y-1 text-sm sm:grid-cols-2 lg:grid-cols-3">
                      <div className="flex gap-1.5">
                        <dt style={{ color: "var(--muted)" }}>Fournisseur :</dt>
                        <dd className="font-medium">
                          {supplier?.name ?? "À déterminer"}
                        </dd>
                      </div>
                      <div className="flex gap-1.5">
                        <dt style={{ color: "var(--muted)" }}>Client :</dt>
                        <dd>
                          {customer?.name ?? "—"}{" "}
                          <Link
                            href={`/commandes/${order.id}`}
                            className="font-medium"
                            style={{ color: "var(--primary)" }}
                          >
                            ({order.reference})
                          </Link>
                        </dd>
                      </div>
                      <div className="flex gap-1.5">
                        <dt style={{ color: "var(--muted)" }}>Dernière relance :</dt>
                        <dd>{formatDate(line.lastReminderAt)}</dd>
                      </div>
                      <div className="flex gap-1.5">
                        <dt style={{ color: "var(--muted)" }}>Prochain lundi :</dt>
                        <dd>{formatDate(line.nextReminderAt ?? nextMonday())}</dd>
                      </div>
                    </dl>
                    <div
                      className="mt-3 rounded-md border p-3 text-sm"
                      style={{
                        borderColor: "var(--border)",
                        background: "var(--surface-muted)",
                      }}
                    >
                      <p className="mb-1 text-xs font-semibold" style={{ color: "var(--muted)" }}>
                        Proposition de message (à envoyer manuellement)
                      </p>
                      {message}
                    </div>
                  </div>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    type="button"
                    className="btn-primary"
                    onClick={() => {
                      markReminderDone(line.id, "indisponible");
                      notify(
                        "Relance enregistrée — prochaine relance programmée lundi prochain.",
                      );
                    }}
                  >
                    Relance faite — toujours indisponible
                  </button>
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => {
                      markReminderDone(line.id, "disponible");
                      notify("Relance enregistrée — article de nouveau disponible.");
                    }}
                  >
                    Relance faite — article disponible
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

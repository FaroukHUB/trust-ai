"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Banknote, CreditCard, Landmark, Receipt, Wallet } from "lucide-react";
import { useData } from "@/lib/store/DataProvider";
import { StatCard } from "@/components/ui/StatCard";
import { LoadingState } from "@/components/ui/LoadingState";
import { EmptyState } from "@/components/ui/EmptyState";
import { linesOfOrder, orderTotal } from "@/lib/derive";
import { formatDate, formatEuro } from "@/lib/format";
import { paymentMethodLabels } from "@/lib/labels";
import type { PaymentMethod } from "@/lib/types";

const FINANCING_METHODS: PaymentMethod[] = [
  "cofidis",
  "pnf",
  "alma",
  "floa",
  "paiement_express",
];

export default function CashPage() {
  const { db, storeFilter } = useData();
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [store, setStore] = useState("all");
  const [salesperson, setSalesperson] = useState("all");
  const [method, setMethod] = useState<"all" | PaymentMethod>("all");

  const data = useMemo(() => {
    if (!db) return null;

    const inPeriod = (iso: string) => {
      const day = iso.slice(0, 10);
      if (from && day < from) return false;
      if (to && day > to) return false;
      return true;
    };

    const effectiveStore = store !== "all" ? store : storeFilter;

    const payments = db.payments
      .filter((p) => inPeriod(p.date))
      .filter(
        (p) =>
          effectiveStore === "all" ||
          p.storeId === effectiveStore ||
          // Les paiements Shopify n'ont pas de magasin : visibles seulement en "tous".
          (effectiveStore === "all" && !p.storeId),
      )
      .filter((p) => salesperson === "all" || p.salespersonId === salesperson)
      .filter((p) => method === "all" || p.method === method)
      .sort((a, b) => b.date.localeCompare(a.date));

    // Montant facturé : total des commandes passées sur la période/le périmètre.
    const orders = db.orders
      .filter((o) => o.status !== "annulee")
      .filter((o) => inPeriod(o.orderedAt))
      .filter((o) => effectiveStore === "all" || o.storeId === effectiveStore)
      .filter((o) => salesperson === "all" || o.salespersonId === salesperson);

    const invoiced = orders.reduce(
      (sum, o) => sum + orderTotal(o, linesOfOrder(db, o.id)),
      0,
    );
    const collected = payments.reduce((sum, p) => sum + p.amount, 0);
    const sumBy = (pred: (m: PaymentMethod) => boolean) =>
      payments.filter((p) => p.amount > 0 && pred(p.method)).reduce((s, p) => s + p.amount, 0);

    const cash = sumBy((m) => m === "especes");
    const transfers = sumBy((m) => m === "virement");
    const cards = sumBy((m) => m === "carte_bancaire");
    const financing = sumBy((m) => FINANCING_METHODS.includes(m));
    const credits = sumBy((m) => m === "avoir");
    const refunds = payments
      .filter((p) => p.amount < 0)
      .reduce((s, p) => s + p.amount, 0);

    // RAP du périmètre : facturé − encaissé sur ces commandes (tous règlements confondus).
    const orderIds = new Set(orders.map((o) => o.id));
    const collectedForOrders = db.payments
      .filter((p) => orderIds.has(p.orderId))
      .reduce((s, p) => s + p.amount, 0);
    const rap = Math.max(0, Math.round((invoiced - collectedForOrders) * 100) / 100);

    return {
      payments,
      invoiced,
      collected,
      cash,
      transfers,
      cards,
      financing,
      credits,
      refunds,
      rap,
    };
  }, [db, from, to, store, salesperson, method, storeFilter]);

  if (!db || !data) return <LoadingState />;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-bold">Encaissements</h1>
        <p className="text-sm" style={{ color: "var(--muted)" }}>
          Récapitulatif calculé automatiquement depuis les commandes et les
          règlements — aucune double saisie.
        </p>
      </div>

      <div className="card grid grid-cols-1 gap-3 p-4 sm:grid-cols-2 lg:grid-cols-5">
        <label>
          <span className="field-label">Du</span>
          <input
            type="date"
            className="field-input"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
          />
        </label>
        <label>
          <span className="field-label">Au</span>
          <input
            type="date"
            className="field-input"
            value={to}
            onChange={(e) => setTo(e.target.value)}
          />
        </label>
        <label>
          <span className="field-label">Magasin</span>
          <select
            className="field-input"
            value={store}
            onChange={(e) => setStore(e.target.value)}
          >
            <option value="all">Tous</option>
            {db.stores.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span className="field-label">Vendeuse / vendeur</span>
          <select
            className="field-input"
            value={salesperson}
            onChange={(e) => setSalesperson(e.target.value)}
          >
            <option value="all">Toutes / tous</option>
            {db.salespeople.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span className="field-label">Moyen de paiement</span>
          <select
            className="field-input"
            value={method}
            onChange={(e) => setMethod(e.target.value as "all" | PaymentMethod)}
          >
            <option value="all">Tous</option>
            {Object.entries(paymentMethodLabels).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard label="Montant facturé" value={formatEuro(data.invoiced)} icon={Receipt} />
        <StatCard
          label="Encaissé"
          value={formatEuro(data.collected)}
          icon={Wallet}
          tone="success"
        />
        <StatCard label="Espèces" value={formatEuro(data.cash)} icon={Banknote} />
        <StatCard label="Virements" value={formatEuro(data.transfers)} icon={Landmark} />
        <StatCard label="Cartes bancaires" value={formatEuro(data.cards)} icon={CreditCard} />
        <StatCard label="Financements" value={formatEuro(data.financing)} hint="Cofidis, PNF, Alma, Floa, paiement express" />
        <StatCard label="Avoirs" value={formatEuro(data.credits)} />
        <StatCard
          label="Remboursements / dépenses"
          value={formatEuro(data.refunds)}
          tone={data.refunds < 0 ? "danger" : "default"}
        />
        <StatCard
          label="RAP du périmètre"
          value={formatEuro(data.rap)}
          tone={data.rap > 0 ? "warning" : "success"}
        />
        <StatCard
          label="Total général encaissé"
          value={formatEuro(data.collected)}
          tone="success"
        />
      </div>

      {data.payments.length === 0 ? (
        <EmptyState
          title="Aucun règlement sur cette période"
          description="Modifiez les dates ou les filtres pour élargir la recherche."
        />
      ) : (
        <div className="card overflow-x-auto">
          <table className="table-base">
            <thead>
              <tr>
                <th scope="col">Date</th>
                <th scope="col">Commande</th>
                <th scope="col">Magasin</th>
                <th scope="col">Vendeuse / vendeur</th>
                <th scope="col">Moyen de paiement</th>
                <th scope="col">Montant</th>
                <th scope="col">Commentaire</th>
              </tr>
            </thead>
            <tbody>
              {data.payments.map((payment) => {
                const order = db.orders.find((o) => o.id === payment.orderId);
                const storeName = db.stores.find((s) => s.id === payment.storeId)?.name;
                const cashier = db.salespeople.find(
                  (s) => s.id === payment.salespersonId,
                )?.name;
                return (
                  <tr key={payment.id}>
                    <td className="whitespace-nowrap">{formatDate(payment.date)}</td>
                    <td>
                      {order ? (
                        <Link
                          href={`/commandes/${order.id}`}
                          className="font-medium"
                          style={{ color: "var(--primary)" }}
                        >
                          {order.reference}
                        </Link>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td>{storeName ?? "En ligne"}</td>
                    <td>{cashier ?? "—"}</td>
                    <td>{paymentMethodLabels[payment.method]}</td>
                    <td
                      className="whitespace-nowrap font-medium"
                      style={{ color: payment.amount < 0 ? "var(--danger)" : undefined }}
                    >
                      {formatEuro(payment.amount)}
                    </td>
                    <td style={{ color: "var(--muted)" }}>{payment.comment ?? "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

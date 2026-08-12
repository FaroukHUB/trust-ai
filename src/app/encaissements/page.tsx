"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Banknote, Receipt, Search, Wallet } from "lucide-react";
import { useData } from "@/lib/store/DataProvider";
import { StatCard } from "@/components/ui/StatCard";
import { LoadingState } from "@/components/ui/LoadingState";
import { EmptyState } from "@/components/ui/EmptyState";
import { ViewTabs } from "@/components/ui/ViewTabs";
import { PaginationBar, usePagination } from "@/components/ui/Pagination";
import { linesOfOrder, orderRapCents, orderTotalCents } from "@/lib/derive";
import { fromCents, toCents } from "@/lib/money";
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

type ViewKey = "synthese" | "details";

function currentMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

interface DayRow {
  day: string;
  invoicedCents: number;
  collectedCents: number;
  cashCents: number;
  cardCents: number;
  transferCents: number;
  financingCents: number;
  creditCents: number;
  refundCents: number;
  rapCents: number;
}

export default function CashPage() {
  const { db, storeFilter } = useData();
  const [view, setView] = useState<ViewKey>("synthese");
  const [month, setMonth] = useState(currentMonth());
  const [store, setStore] = useState("all");
  const [salesperson, setSalesperson] = useState("all");
  const [method, setMethod] = useState<"all" | PaymentMethod>("all");
  const [dayFilter, setDayFilter] = useState<string | "">("");
  const [search, setSearch] = useState("");

  const effectiveStore = store !== "all" ? store : storeFilter;

  // Périmètre commun : magasin + vendeuse/vendeur.
  const scope = useMemo(() => {
    if (!db) return null;
    const matchStore = (id?: string) =>
      effectiveStore === "all" || id === effectiveStore;
    const orders = db.orders.filter(
      (o) =>
        o.status !== "annulee" &&
        matchStore(o.storeId) &&
        (salesperson === "all" || o.salespersonId === salesperson),
    );
    const payments = db.payments.filter(
      (p) =>
        (effectiveStore === "all" ? true : p.storeId === effectiveStore) &&
        (salesperson === "all" || p.salespersonId === salesperson),
    );
    return { orders, payments };
  }, [db, effectiveStore, salesperson]);

  // Synthèse mensuelle : une ligne par journée du mois sélectionné.
  const dayRows = useMemo<DayRow[]>(() => {
    if (!db || !scope) return [];
    const rows = new Map<string, DayRow>();
    const rowFor = (day: string): DayRow => {
      let row = rows.get(day);
      if (!row) {
        row = {
          day,
          invoicedCents: 0,
          collectedCents: 0,
          cashCents: 0,
          cardCents: 0,
          transferCents: 0,
          financingCents: 0,
          creditCents: 0,
          refundCents: 0,
          rapCents: 0,
        };
        rows.set(day, row);
      }
      return row;
    };

    for (const order of scope.orders) {
      const day = order.orderedAt.slice(0, 10);
      if (!day.startsWith(month)) continue;
      const row = rowFor(day);
      row.invoicedCents += orderTotalCents(order, linesOfOrder(db, order.id));
      // RAP des commandes créées ce jour-là, calculé commande par commande.
      row.rapCents += Math.max(
        0,
        orderRapCents(order, db.orderLines, db.payments),
      );
    }
    for (const payment of scope.payments) {
      const day = payment.date.slice(0, 10);
      if (!day.startsWith(month)) continue;
      const row = rowFor(day);
      const cents = toCents(payment.amount);
      row.collectedCents += cents;
      if (cents < 0) {
        row.refundCents += cents;
      } else if (payment.method === "especes") {
        row.cashCents += cents;
      } else if (payment.method === "carte_bancaire") {
        row.cardCents += cents;
      } else if (payment.method === "virement") {
        row.transferCents += cents;
      } else if (FINANCING_METHODS.includes(payment.method)) {
        row.financingCents += cents;
      } else if (payment.method === "avoir") {
        row.creditCents += cents;
      }
    }
    return Array.from(rows.values()).sort((a, b) => b.day.localeCompare(a.day));
  }, [db, scope, month]);

  const monthTotals = useMemo(() => {
    return dayRows.reduce(
      (acc, r) => ({
        invoicedCents: acc.invoicedCents + r.invoicedCents,
        collectedCents: acc.collectedCents + r.collectedCents,
        rapCents: acc.rapCents + r.rapCents,
        refundCents: acc.refundCents + r.refundCents,
      }),
      { invoicedCents: 0, collectedCents: 0, rapCents: 0, refundCents: 0 },
    );
  }, [dayRows]);

  // Détail des règlements (paginé).
  const detailPayments = useMemo(() => {
    if (!db || !scope) return [];
    const q = search.trim().toLowerCase();
    return scope.payments
      .filter((p) => {
        const day = p.date.slice(0, 10);
        if (dayFilter) return day === dayFilter;
        return day.startsWith(month);
      })
      .filter((p) => method === "all" || p.method === method)
      .filter((p) => {
        if (!q) return true;
        const order = db.orders.find((o) => o.id === p.orderId);
        const customer = order
          ? db.customers.find((c) => c.id === order.customerId)
          : undefined;
        return (
          (order?.reference.toLowerCase().includes(q) ?? false) ||
          (customer?.name.toLowerCase().includes(q) ?? false) ||
          (p.comment?.toLowerCase().includes(q) ?? false)
        );
      })
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [db, scope, month, dayFilter, method, search]);

  const pagination = usePagination(detailPayments);

  if (!db || !scope) return <LoadingState />;

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-xl font-bold">Encaissements</h1>
        <p className="text-sm" style={{ color: "var(--muted)" }}>
          Récapitulatif calculé automatiquement depuis les commandes et les
          règlements — aucune double saisie. « Facturé » : commandes créées
          dans la période. « Encaissé » : règlements datés de la période.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <ViewTabs<ViewKey>
          ariaLabel="Choisir la vue"
          value={view}
          onChange={(v) => {
            setView(v);
            if (v === "synthese") setDayFilter("");
          }}
          tabs={[
            { key: "synthese", label: "Synthèse mensuelle" },
            { key: "details", label: "Détail des règlements" },
          ]}
        />
        <label>
          <span className="sr-only">Mois</span>
          <input
            type="month"
            className="field-input w-auto"
            value={month}
            onChange={(e) => {
              setMonth(e.target.value);
              setDayFilter("");
            }}
          />
        </label>
        <label>
          <span className="sr-only">Magasin</span>
          <select
            className="field-input w-auto"
            value={store}
            onChange={(e) => setStore(e.target.value)}
          >
            <option value="all">Tous les magasins</option>
            {db.stores.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span className="sr-only">Vendeuse / vendeur</span>
          <select
            className="field-input w-auto"
            value={salesperson}
            onChange={(e) => setSalesperson(e.target.value)}
          >
            <option value="all">Toute l&apos;équipe</option>
            {db.salespeople.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>
        {view === "details" ? (
          <label>
            <span className="sr-only">Moyen de paiement</span>
            <select
              className="field-input w-auto"
              value={method}
              onChange={(e) => setMethod(e.target.value as "all" | PaymentMethod)}
            >
              <option value="all">Tous les moyens</option>
              {Object.entries(paymentMethodLabels).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
          </label>
        ) : null}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Montant facturé (mois)"
          value={formatEuro(fromCents(monthTotals.invoicedCents))}
          icon={Receipt}
        />
        <StatCard
          label="Encaissé (mois)"
          value={formatEuro(fromCents(monthTotals.collectedCents))}
          icon={Wallet}
          tone="success"
        />
        <StatCard
          label="RAP des commandes du mois"
          value={formatEuro(fromCents(monthTotals.rapCents))}
          icon={Banknote}
          tone={monthTotals.rapCents > 0 ? "warning" : "success"}
          hint="Calculé commande par commande"
        />
        <StatCard
          label="Remboursements / dépenses"
          value={formatEuro(fromCents(monthTotals.refundCents))}
          tone={monthTotals.refundCents < 0 ? "danger" : "default"}
        />
      </div>

      {view === "synthese" ? (
        dayRows.length === 0 ? (
          <EmptyState
            title="Aucune activité sur ce mois"
            description="Changez de mois ou de filtres pour voir les journées."
          />
        ) : (
          <div className="card overflow-x-auto">
            <table className="table-base">
              <thead>
                <tr>
                  <th scope="col">Date</th>
                  <th scope="col">Facturé</th>
                  <th scope="col">Encaissé</th>
                  <th scope="col">Espèces</th>
                  <th scope="col">Carte</th>
                  <th scope="col">Virement</th>
                  <th scope="col">Financements</th>
                  <th scope="col">Avoirs</th>
                  <th scope="col">Remb. / dépenses</th>
                  <th scope="col">RAP du jour</th>
                  <th scope="col">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {dayRows.map((row) => (
                  <tr key={row.day}>
                    <td className="whitespace-nowrap font-medium">
                      {formatDate(`${row.day}T12:00:00`)}
                    </td>
                    <td className="whitespace-nowrap">
                      {formatEuro(fromCents(row.invoicedCents))}
                    </td>
                    <td className="whitespace-nowrap font-medium">
                      {formatEuro(fromCents(row.collectedCents))}
                    </td>
                    <td className="whitespace-nowrap">{formatEuro(fromCents(row.cashCents))}</td>
                    <td className="whitespace-nowrap">{formatEuro(fromCents(row.cardCents))}</td>
                    <td className="whitespace-nowrap">
                      {formatEuro(fromCents(row.transferCents))}
                    </td>
                    <td className="whitespace-nowrap">
                      {formatEuro(fromCents(row.financingCents))}
                    </td>
                    <td className="whitespace-nowrap">
                      {formatEuro(fromCents(row.creditCents))}
                    </td>
                    <td
                      className="whitespace-nowrap"
                      style={{
                        color: row.refundCents < 0 ? "var(--danger)" : undefined,
                      }}
                    >
                      {formatEuro(fromCents(row.refundCents))}
                    </td>
                    <td
                      className="whitespace-nowrap"
                      style={{ color: row.rapCents > 0 ? "var(--danger)" : undefined }}
                    >
                      {formatEuro(fromCents(row.rapCents))}
                    </td>
                    <td>
                      <button
                        type="button"
                        className="text-sm font-medium"
                        style={{ color: "var(--primary)" }}
                        onClick={() => {
                          setDayFilter(row.day);
                          setView("details");
                        }}
                      >
                        Voir le détail
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      ) : (
        <>
          <div className="card flex flex-wrap items-center gap-3 p-4">
            <label className="relative min-w-64 flex-1">
              <span className="sr-only">Rechercher</span>
              <Search
                size={16}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2"
                style={{ color: "var(--muted)" }}
                aria-hidden
              />
              <input
                type="search"
                className="field-input pl-9"
                placeholder="Rechercher une commande, un client, un commentaire…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </label>
            {dayFilter ? (
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setDayFilter("")}
              >
                Journée du {formatDate(`${dayFilter}T12:00:00`)} — afficher tout
                le mois
              </button>
            ) : null}
          </div>

          {detailPayments.length === 0 ? (
            <EmptyState
              title="Aucun règlement sur cette période"
              description="Modifiez le mois, la journée ou les filtres."
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
                  {pagination.paged.map((payment) => {
                    const order = db.orders.find((o) => o.id === payment.orderId);
                    const storeName = db.stores.find(
                      (s) => s.id === payment.storeId,
                    )?.name;
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
                          style={{
                            color: payment.amount < 0 ? "var(--danger)" : undefined,
                          }}
                        >
                          {formatEuro(payment.amount)}
                        </td>
                        <td style={{ color: "var(--muted)" }}>
                          {payment.comment ?? "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <PaginationBar
                page={pagination.page}
                pageCount={pagination.pageCount}
                pageSize={pagination.pageSize}
                total={pagination.total}
                onPageChange={pagination.setPage}
                onPageSizeChange={pagination.setPageSize}
              />
            </div>
          )}
        </>
      )}
    </div>
  );
}

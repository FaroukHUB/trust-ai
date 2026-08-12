"use client";

import Link from "next/link";
import { Megaphone } from "lucide-react";
import { useData } from "@/lib/store/DataProvider";
import { LoadingState } from "@/components/ui/LoadingState";
import { formatDate } from "@/lib/format";
import { acquisitionSourceLabels, originLabels } from "@/lib/labels";
import type { AcquisitionSource } from "@/lib/types";

const ALL_SOURCES = Object.keys(acquisitionSourceLabels) as AcquisitionSource[];

export default function AcquisitionPage() {
  const { db, storeFilter } = useData();

  if (!db) return <LoadingState />;

  const orders = db.orders
    .filter((o) => o.status !== "annulee")
    .filter((o) => storeFilter === "all" || o.storeId === storeFilter);

  const counts = new Map<AcquisitionSource, number>();
  for (const source of ALL_SOURCES) counts.set(source, 0);
  let unknown = 0;
  for (const order of orders) {
    if (order.acquisitionSource) {
      counts.set(order.acquisitionSource, (counts.get(order.acquisitionSource) ?? 0) + 1);
    } else {
      unknown += 1;
    }
  }
  const max = Math.max(1, ...Array.from(counts.values()));

  const shopifyOrders = orders.filter((o) => o.origin === "SHOPIFY");

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-bold">Acquisition marketing</h1>
        <p className="text-sm" style={{ color: "var(--muted)" }}>
          Provenance des commandes : sources déclarées en magasin et données
          de visite pour les commandes Shopify simulées.
        </p>
      </div>

      <section className="card p-4">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          <Megaphone size={16} aria-hidden style={{ color: "var(--primary)" }} />
          Commandes par source
        </h2>
        <ul className="mt-4 flex flex-col gap-3">
          {ALL_SOURCES.map((source) => {
            const count = counts.get(source) ?? 0;
            return (
              <li key={source} className="flex items-center gap-3">
                <span className="w-48 shrink-0 text-sm">
                  {acquisitionSourceLabels[source]}
                </span>
                <div
                  className="h-4 flex-1 overflow-hidden rounded"
                  style={{ background: "var(--surface-muted)" }}
                  role="img"
                  aria-label={`${acquisitionSourceLabels[source]} : ${count} commande(s)`}
                >
                  <div
                    className="h-full rounded"
                    style={{
                      width: `${(count / max) * 100}%`,
                      background: "var(--primary)",
                    }}
                  />
                </div>
                <span className="w-8 text-right text-sm font-semibold">{count}</span>
              </li>
            );
          })}
          {unknown > 0 ? (
            <li className="text-sm" style={{ color: "var(--muted)" }}>
              {unknown} commande(s) sans source renseignée.
            </li>
          ) : null}
        </ul>
      </section>

      <section className="card">
        <h2 className="p-4 pb-0 text-sm font-semibold">
          Détail des commandes Shopify (simulées)
        </h2>
        <p className="px-4 pt-1 text-xs" style={{ color: "var(--muted)" }}>
          Dans la version connectée, ces données arriveront automatiquement via
          les webhooks Shopify.
        </p>
        <div className="mt-3 overflow-x-auto">
          <table className="table-base">
            <thead>
              <tr>
                <th scope="col">Commande</th>
                <th scope="col">Source</th>
                <th scope="col">Première page visitée</th>
                <th scope="col">UTM (source / medium / campagne)</th>
                <th scope="col">Première visite</th>
                <th scope="col">Conversion</th>
                <th scope="col">Client</th>
              </tr>
            </thead>
            <tbody>
              {shopifyOrders.map((order) => {
                const journey = db.acquisitionJourneys.find(
                  (j) => j.orderId === order.id,
                );
                return (
                  <tr key={order.id}>
                    <td>
                      <Link
                        href={`/commandes/${order.id}`}
                        className="font-medium"
                        style={{ color: "var(--primary)" }}
                      >
                        {order.reference}
                      </Link>
                      <p className="text-xs" style={{ color: "var(--muted)" }}>
                        {originLabels[order.origin]}
                      </p>
                    </td>
                    <td>
                      {order.acquisitionSource
                        ? acquisitionSourceLabels[order.acquisitionSource]
                        : "—"}
                    </td>
                    <td className="break-all">{journey?.landingPage ?? "—"}</td>
                    <td>
                      {journey?.utmSource
                        ? `${journey.utmSource} / ${journey.utmMedium ?? "—"} / ${journey.utmCampaign ?? "—"}`
                        : "—"}
                    </td>
                    <td className="whitespace-nowrap">
                      {formatDate(journey?.firstVisitAt)}
                    </td>
                    <td>
                      {journey?.daysToConversion !== undefined
                        ? `${journey.daysToConversion} j`
                        : "—"}
                    </td>
                    <td>
                      {journey?.newCustomer === undefined
                        ? "—"
                        : journey.newCustomer
                          ? "Nouveau client"
                          : "Client récurrent"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

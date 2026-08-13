"use client";

import { useMemo, useState } from "react";
import { BookOpen, RefreshCw, Search } from "lucide-react";
import { useData } from "@/lib/store/DataProvider";
import { useSession } from "@/lib/auth/SessionProvider";
import { hasPermission } from "@/lib/permissions";
import { useToast } from "@/components/ui/Toast";
import { Badge } from "@/components/ui/Badge";
import { LoadingState } from "@/components/ui/LoadingState";
import { EmptyState } from "@/components/ui/EmptyState";
import { PaginationBar, usePagination } from "@/components/ui/Pagination";
import { formatDate, formatEuro } from "@/lib/format";
import { productCategoryLabels, productSourceLabels } from "@/lib/labels";
import type { ProductCategory } from "@/lib/types";

export default function CataloguePage() {
  const { db, mode, refresh } = useData();
  const { profile } = useSession();
  const { notify } = useToast();
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<"all" | ProductCategory>("all");
  const [activeFilter, setActiveFilter] = useState<"all" | "actifs" | "inactifs">("actifs");
  const [syncing, setSyncing] = useState(false);

  const canSync =
    mode === "connected" && profile !== null && hasPermission(profile.role, "gerer_catalogue");

  const syncFromShopify = async () => {
    setSyncing(true);
    try {
      const response = await fetch("/api/shopify/sync-products", { method: "POST" });
      const body = await response.json();
      if (!response.ok) {
        notify(body.error ?? "Synchronisation impossible.", "error");
      } else {
        notify(
          `Catalogue synchronisé : ${body.products} produit(s), ${body.variants} variante(s).`,
        );
        await refresh();
      }
    } catch {
      notify("Erreur réseau pendant la synchronisation.", "error");
    }
    setSyncing(false);
  };

  const rows = useMemo(() => {
    if (!db) return [];
    const q = search.trim().toLowerCase();
    return db.products
      .filter((p) => category === "all" || p.category === category)
      .filter((p) =>
        activeFilter === "all" ? true : activeFilter === "actifs" ? p.active : !p.active,
      )
      .map((product) => {
        const variants = db.productVariants.filter((v) => v.productId === product.id);
        return { product, variants };
      })
      .filter(({ product, variants }) => {
        if (!q) return true;
        const links = db.productSuppliers.filter((ps) => ps.productId === product.id);
        const haystack = [
          product.title,
          ...variants.map((v) => `${v.name} ${v.sku}`),
          ...links.map((l) => l.supplierReference ?? ""),
        ]
          .join(" ")
          .toLowerCase();
        return haystack.includes(q);
      })
      .sort((a, b) => a.product.title.localeCompare(b.product.title));
  }, [db, search, category, activeFilter]);

  const pagination = usePagination(rows);

  if (!db) return <LoadingState />;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold">Catalogue</h1>
          <p className="text-sm" style={{ color: "var(--muted)" }}>
            {mode === "connected"
              ? "Catalogue centralisé. Les produits Shopify arrivent automatiquement par webhook ; la synchronisation manuelle importe tout le catalogue."
              : "Catalogue centralisé des produits et variantes. La synchronisation Shopify est simulée en mode démonstration."}
          </p>
        </div>
        {canSync ? (
          <button
            type="button"
            className="btn-primary"
            onClick={syncFromShopify}
            disabled={syncing}
          >
            <RefreshCw size={16} aria-hidden className={syncing ? "animate-spin" : undefined} />
            {syncing ? "Synchronisation…" : "Synchroniser depuis Shopify"}
          </button>
        ) : null}
      </div>

      <div className="card grid grid-cols-1 gap-3 p-4 sm:grid-cols-2 lg:grid-cols-4">
        <label className="relative sm:col-span-2">
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
            placeholder="Rechercher par nom, SKU, référence fournisseur…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </label>
        <label>
          <span className="sr-only">Catégorie</span>
          <select
            className="field-input"
            value={category}
            onChange={(e) => setCategory(e.target.value as "all" | ProductCategory)}
          >
            <option value="all">Toutes catégories</option>
            {Object.entries(productCategoryLabels).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span className="sr-only">Actif / inactif</span>
          <select
            className="field-input"
            value={activeFilter}
            onChange={(e) =>
              setActiveFilter(e.target.value as "all" | "actifs" | "inactifs")
            }
          >
            <option value="actifs">Produits actifs</option>
            <option value="inactifs">Produits inactifs</option>
            <option value="all">Tous</option>
          </select>
        </label>
      </div>

      {rows.length === 0 ? (
        <EmptyState
          title="Aucun produit trouvé"
          description="Modifiez la recherche ou les filtres."
          icon={BookOpen}
        />
      ) : (
        <div className="card">
          <div className="overflow-x-auto">
            <table className="table-base">
              <thead>
                <tr>
                  <th scope="col">Produit</th>
                  <th scope="col">Catégorie</th>
                  <th scope="col">Variantes</th>
                  <th scope="col">Fournisseur principal</th>
                  <th scope="col">Origine</th>
                  <th scope="col">Synchronisation</th>
                </tr>
              </thead>
              <tbody>
                {pagination.paged.map(({ product, variants }) => {
                  const source = productSourceLabels[product.source];
                  const links = db.productSuppliers
                    .filter((ps) => ps.productId === product.id)
                    .sort((a, b) => a.priority - b.priority);
                  const primary = links.find((l) => l.isPrimary) ?? links[0];
                  const primaryName = primary
                    ? db.suppliers.find((s) => s.id === primary.supplierId)?.name
                    : undefined;
                  const altNames = links
                    .filter((l) => l !== primary)
                    .map((l) => db.suppliers.find((s) => s.id === l.supplierId)?.name)
                    .filter(Boolean);
                  return (
                    <tr key={product.id}>
                      <td>
                        <div className="flex items-center gap-2">
                          <p className="font-medium">{product.title}</p>
                          {!product.active ? <Badge tone="neutral">Inactif</Badge> : null}
                        </div>
                        {product.shortDescription ? (
                          <p className="text-xs" style={{ color: "var(--muted)" }}>
                            {product.shortDescription}
                          </p>
                        ) : null}
                      </td>
                      <td>{productCategoryLabels[product.category]}</td>
                      <td>
                        <ul className="flex flex-col gap-1">
                          {variants.map((v) => (
                            <li key={v.id} className="text-sm">
                              <span className="font-medium">{v.name}</span>{" "}
                              <span style={{ color: "var(--muted)" }}>
                                · {v.sku} · {formatEuro(v.price)}
                                {v.dimensions ? ` · ${v.dimensions}` : ""}
                              </span>
                            </li>
                          ))}
                          {variants.length === 0 ? (
                            <li className="text-sm" style={{ color: "var(--muted)" }}>
                              Aucune variante
                            </li>
                          ) : null}
                        </ul>
                      </td>
                      <td>
                        {primaryName ?? "—"}
                        {altNames.length > 0 ? (
                          <p className="text-xs" style={{ color: "var(--muted)" }}>
                            Alt. : {altNames.join(", ")}
                          </p>
                        ) : null}
                      </td>
                      <td>
                        <Badge tone={source.tone}>{source.label}</Badge>
                      </td>
                      <td>
                        {product.source === "shopify" ? (
                          <span
                            className="inline-flex items-center gap-1.5 text-sm"
                            style={{ color: "var(--muted)" }}
                          >
                            <RefreshCw size={13} aria-hidden />
                            {product.lastSyncedAt
                              ? `Synchronisé le ${formatDate(product.lastSyncedAt)} (simulation)`
                              : "Jamais synchronisé"}
                          </span>
                        ) : (
                          <span className="text-sm" style={{ color: "var(--muted)" }}>
                            Saisie manuelle
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
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
    </div>
  );
}

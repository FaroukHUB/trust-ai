"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { ChevronsUpDown, Search } from "lucide-react";
import { productCategoryLabels } from "@/lib/labels";
import { formatEuro } from "@/lib/format";
import type {
  Database,
  Product,
  ProductCategory,
  ProductVariant,
} from "@/lib/types";

export interface ProductSelection {
  product: Product;
  variant: ProductVariant;
  primarySupplierId?: string;
  altSupplierId?: string;
}

interface Option {
  product: Product;
  variant: ProductVariant;
  supplierName?: string;
  altNames: string[];
  primarySupplierId?: string;
  altSupplierId?: string;
}

/**
 * Combobox accessible de sélection produit + variante depuis le catalogue.
 * Recherche par nom, SKU ou référence fournisseur, filtre par catégorie,
 * navigation clavier (flèches, Entrée, Échap).
 */
export function ProductCombobox({
  db,
  onSelect,
  placeholder = "Rechercher un produit, un SKU…",
}: {
  db: Database;
  onSelect: (selection: ProductSelection) => void;
  placeholder?: string;
}) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<"all" | ProductCategory>("all");
  const [open, setOpen] = useState(false);
  const [highlighted, setHighlighted] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listboxId = useId();

  const options = useMemo<Option[]>(() => {
    const q = query.trim().toLowerCase();
    const result: Option[] = [];
    for (const variant of db.productVariants) {
      const product = db.products.find((p) => p.id === variant.productId);
      if (!product || !product.active) continue;
      if (category !== "all" && product.category !== category) continue;
      const links = db.productSuppliers
        .filter((ps) => ps.variantId === variant.id)
        .sort((a, b) => a.priority - b.priority);
      const primary = links.find((l) => l.isPrimary) ?? links[0];
      const alts = links.filter((l) => l !== primary);
      if (q) {
        const haystack = [
          product.title,
          variant.name,
          variant.sku,
          ...links.map((l) => l.supplierReference ?? ""),
        ]
          .join(" ")
          .toLowerCase();
        if (!haystack.includes(q)) continue;
      }
      result.push({
        product,
        variant,
        supplierName: primary
          ? db.suppliers.find((s) => s.id === primary.supplierId)?.name
          : undefined,
        altNames: alts
          .map((l) => db.suppliers.find((s) => s.id === l.supplierId)?.name)
          .filter((n): n is string => Boolean(n)),
        primarySupplierId: primary?.supplierId,
        altSupplierId: alts[0]?.supplierId,
      });
    }
    return result.slice(0, 30);
  }, [db, query, category]);

  useEffect(() => {
    setHighlighted(0);
  }, [query, category, open]);

  // Fermeture au clic extérieur
  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  const select = (option: Option) => {
    onSelect({
      product: option.product,
      variant: option.variant,
      primarySupplierId: option.primarySupplierId,
      altSupplierId: option.altSupplierId,
    });
    setQuery("");
    setOpen(false);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (!open && (e.key === "ArrowDown" || e.key === "Enter")) {
      setOpen(true);
      return;
    }
    if (!open) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlighted((h) => Math.min(h + 1, options.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlighted((h) => Math.max(h - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (options[highlighted]) select(options[highlighted]);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  };

  return (
    <div ref={rootRef} className="relative">
      <div className="flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <Search
            size={16}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2"
            style={{ color: "var(--muted)" }}
            aria-hidden
          />
          <input
            ref={inputRef}
            type="text"
            role="combobox"
            aria-expanded={open}
            aria-controls={listboxId}
            aria-autocomplete="list"
            aria-label="Rechercher un produit du catalogue"
            className="field-input pl-9 pr-9"
            placeholder={placeholder}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            onKeyDown={onKeyDown}
          />
          <ChevronsUpDown
            size={16}
            className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2"
            style={{ color: "var(--muted)" }}
            aria-hidden
          />
        </div>
        <label>
          <span className="sr-only">Catégorie</span>
          <select
            className="field-input w-full sm:w-44"
            value={category}
            onChange={(e) => {
              setCategory(e.target.value as "all" | ProductCategory);
              setOpen(true);
              inputRef.current?.focus();
            }}
          >
            <option value="all">Toutes catégories</option>
            {Object.entries(productCategoryLabels).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        </label>
      </div>

      {open ? (
        <ul
          id={listboxId}
          role="listbox"
          aria-label="Produits du catalogue"
          className="absolute z-30 mt-1 max-h-80 w-full overflow-y-auto rounded-md border shadow-lg"
          style={{ borderColor: "var(--border)", background: "var(--surface)" }}
        >
          {options.length === 0 ? (
            <li className="px-3 py-3 text-sm" style={{ color: "var(--muted)" }} role="presentation">
              Aucun produit trouvé. Utilisez « Produit hors catalogue » pour une
              saisie libre.
            </li>
          ) : (
            options.map((option, index) => (
              <li
                key={option.variant.id}
                role="option"
                aria-selected={index === highlighted}
                className="cursor-pointer border-b px-3 py-2.5 last:border-b-0"
                style={{
                  borderColor: "var(--border)",
                  background: index === highlighted ? "var(--primary-soft)" : undefined,
                }}
                onMouseEnter={() => setHighlighted(index)}
                onMouseDown={(e) => {
                  e.preventDefault();
                  select(option);
                }}
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-medium">
                    {option.product.title}
                    <span style={{ color: "var(--muted)" }}> — {option.variant.name}</span>
                  </p>
                  <p className="whitespace-nowrap text-sm font-semibold">
                    {formatEuro(option.variant.price)}
                  </p>
                </div>
                <p className="mt-0.5 text-xs" style={{ color: "var(--muted)" }}>
                  {productCategoryLabels[option.product.category]} · SKU {option.variant.sku}
                  {option.supplierName ? ` · Fournisseur : ${option.supplierName}` : ""}
                  {option.altNames.length > 0 ? ` (alt. ${option.altNames.join(", ")})` : ""}
                </p>
              </li>
            ))
          )}
        </ul>
      ) : null}
    </div>
  );
}

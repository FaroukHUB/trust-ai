"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  BarChart3,
  Building2,
  ClipboardList,
  CreditCard,
  LayoutDashboard,
  Megaphone,
  Menu,
  PhoneOutgoing,
  RotateCcw,
  ShoppingCart,
  Store,
  Truck,
  X,
} from "lucide-react";
import { useData } from "@/lib/store/DataProvider";
import { useToast } from "@/components/ui/Toast";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";

const navigation = [
  { href: "/dashboard", label: "Tableau de bord", icon: LayoutDashboard },
  { href: "/commandes", label: "Commandes", icon: ClipboardList },
  { href: "/achats", label: "Achats fournisseurs", icon: ShoppingCart },
  { href: "/relances", label: "Relances du lundi", icon: PhoneOutgoing },
  { href: "/arrivages", label: "Arrivages", icon: Truck },
  { href: "/fournisseurs", label: "Fournisseurs", icon: Building2 },
  { href: "/encaissements", label: "Encaissements", icon: CreditCard },
  { href: "/acquisition", label: "Acquisition", icon: Megaphone },
];

function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <nav className="flex flex-col gap-1" aria-label="Navigation principale">
      {navigation.map((item) => {
        const active =
          pathname === item.href || pathname.startsWith(`${item.href}/`);
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            className="flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition"
            style={
              active
                ? { background: "var(--primary-soft)", color: "var(--primary-strong)" }
                : { color: "var(--muted)" }
            }
            aria-current={active ? "page" : undefined}
          >
            <item.icon size={18} aria-hidden />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const { db, storeFilter, setStoreFilter, resetDemo } = useData();
  const { notify } = useToast();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);

  const stores = db?.stores ?? [];
  const currentStoreName =
    storeFilter === "all"
      ? "Tous les magasins"
      : stores.find((s) => s.id === storeFilter)?.name ?? "Tous les magasins";

  const sidebarContent = (
    <div className="flex h-full flex-col gap-6 p-4">
      <div className="flex items-center gap-2 px-2">
        <div
          className="flex h-9 w-9 items-center justify-center rounded-md text-sm font-bold text-white"
          style={{ background: "var(--primary)" }}
          aria-hidden
        >
          TA
        </div>
        <div>
          <p className="text-sm font-bold leading-tight">TRUST AI</p>
          <p className="text-xs leading-tight" style={{ color: "var(--muted)" }}>
            Trust Industrie
          </p>
        </div>
      </div>
      <NavLinks onNavigate={() => setMobileOpen(false)} />
      <div className="mt-auto flex flex-col gap-2">
        <span
          className="inline-flex w-fit items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold"
          style={{ background: "var(--warning-soft)", color: "var(--warning)" }}
        >
          <BarChart3 size={13} aria-hidden />
          Mode démonstration
        </span>
        <button
          type="button"
          onClick={() => setConfirmReset(true)}
          className="flex items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-xs font-medium transition hover:bg-black/5"
          style={{ color: "var(--muted)" }}
        >
          <RotateCcw size={14} aria-hidden />
          Réinitialiser les données de démo
        </button>
      </div>
    </div>
  );

  return (
    <div className="flex min-h-screen">
      {/* Barre latérale (ordinateur) */}
      <aside
        className="sticky top-0 hidden h-screen w-64 shrink-0 border-r lg:block"
        style={{ borderColor: "var(--border)", background: "var(--surface)" }}
      >
        {sidebarContent}
      </aside>

      {/* Menu mobile */}
      {mobileOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setMobileOpen(false)}
            aria-hidden
          />
          <div
            className="absolute inset-y-0 left-0 w-72 shadow-xl"
            style={{ background: "var(--surface)" }}
          >
            <button
              type="button"
              className="absolute right-3 top-3 rounded p-1 hover:bg-black/5"
              onClick={() => setMobileOpen(false)}
              aria-label="Fermer le menu"
            >
              <X size={20} />
            </button>
            {sidebarContent}
          </div>
        </div>
      ) : null}

      <div className="flex min-w-0 flex-1 flex-col">
        {/* En-tête */}
        <header
          className="sticky top-0 z-40 flex items-center gap-3 border-b px-4 py-3"
          style={{ borderColor: "var(--border)", background: "var(--surface)" }}
        >
          <button
            type="button"
            className="rounded-md border p-2 lg:hidden"
            style={{ borderColor: "var(--border)" }}
            onClick={() => setMobileOpen(true)}
            aria-label="Ouvrir le menu"
          >
            <Menu size={18} />
          </button>
          <div className="flex items-center gap-2 lg:hidden">
            <p className="text-sm font-bold">TRUST AI</p>
          </div>
          <div className="ml-auto flex items-center gap-3">
            <span
              className="hidden items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold sm:inline-flex lg:hidden"
              style={{ background: "var(--warning-soft)", color: "var(--warning)" }}
            >
              Mode démonstration
            </span>
            <label className="flex items-center gap-2 text-sm">
              <Store size={16} style={{ color: "var(--muted)" }} aria-hidden />
              <span className="sr-only">Filtrer par magasin</span>
              <select
                className="field-input w-auto py-1.5"
                value={storeFilter}
                onChange={(e) => setStoreFilter(e.target.value)}
                aria-label="Filtrer par magasin"
              >
                <option value="all">Tous les magasins</option>
                {stores.map((store) => (
                  <option key={store.id} value={store.id}>
                    {store.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </header>

        <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6">
          <p className="mb-4 text-xs lg:hidden" style={{ color: "var(--muted)" }}>
            Magasin affiché : {currentStoreName}
          </p>
          {children}
        </main>
      </div>

      <ConfirmDialog
        open={confirmReset}
        title="Réinitialiser les données de démonstration ?"
        description="Toutes les commandes, règlements et relances saisis pendant la démo seront remplacés par le jeu de données initial."
        confirmLabel="Réinitialiser"
        danger
        onConfirm={() => {
          resetDemo();
          setConfirmReset(false);
          notify("Données de démonstration réinitialisées.");
        }}
        onCancel={() => setConfirmReset(false)}
      />
    </div>
  );
}

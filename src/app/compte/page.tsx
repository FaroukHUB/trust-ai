"use client";

import { UserCircle2 } from "lucide-react";
import { useData } from "@/lib/store/DataProvider";
import { useSession } from "@/lib/auth/SessionProvider";
import { Badge } from "@/components/ui/Badge";
import { LoadingState } from "@/components/ui/LoadingState";
import { roleLabels } from "@/lib/labels";
import { roleDescriptions } from "@/lib/permissions";

/** Page « Mon compte » : informations du profil connecté. */
export default function AccountPage() {
  const { db, mode } = useData();
  const { profile, email, loading } = useSession();

  if (mode === "demo") {
    return (
      <div className="flex flex-col gap-4">
        <h1 className="text-xl font-bold">Mon compte</h1>
        <div className="card p-6 text-sm">
          <p>
            L&apos;application fonctionne en <strong>mode démonstration</strong> :
            il n&apos;y a pas de compte personnel. En mode connecté (Supabase),
            cette page affichera votre nom, votre rôle et vos magasins
            autorisés.
          </p>
        </div>
      </div>
    );
  }

  if (loading || !db) return <LoadingState />;
  if (!profile) return null; // géré par AppShell (session expirée)

  const primaryStore = db.stores.find((s) => s.id === profile.primaryStoreId);
  const allowedStores = db.stores.filter((s) =>
    profile.allowedStoreIds.includes(s.id),
  );

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-bold">Mon compte</h1>
      <div className="card max-w-xl p-6">
        <div className="flex items-center gap-3">
          <UserCircle2 size={40} style={{ color: "var(--primary)" }} aria-hidden />
          <div>
            <p className="text-lg font-semibold">{profile.displayName}</p>
            <p className="text-sm" style={{ color: "var(--muted)" }}>
              {email ?? "—"}
            </p>
          </div>
        </div>
        <dl className="mt-5 flex flex-col gap-3 text-sm">
          <div className="flex items-center justify-between gap-3">
            <dt style={{ color: "var(--muted)" }}>Rôle</dt>
            <dd className="font-medium">{roleLabels[profile.role]}</dd>
          </div>
          <div className="flex items-center justify-between gap-3">
            <dt style={{ color: "var(--muted)" }}>Magasin principal</dt>
            <dd className="font-medium">{primaryStore?.name ?? "—"}</dd>
          </div>
          <div className="flex items-center justify-between gap-3">
            <dt style={{ color: "var(--muted)" }}>Magasins autorisés</dt>
            <dd className="text-right font-medium">
              {allowedStores.length > 0
                ? allowedStores.map((s) => s.name).join(", ")
                : "Tous (rôle transverse)"}
            </dd>
          </div>
          <div className="flex items-center justify-between gap-3">
            <dt style={{ color: "var(--muted)" }}>État du compte</dt>
            <dd>
              <Badge tone={profile.active ? "success" : "danger"}>
                {profile.active ? "Actif" : "Désactivé"}
              </Badge>
            </dd>
          </div>
        </dl>
        <p
          className="mt-5 rounded-md border p-3 text-xs"
          style={{ borderColor: "var(--border)", color: "var(--muted)" }}
        >
          {roleDescriptions[profile.role]}
        </p>
      </div>
    </div>
  );
}

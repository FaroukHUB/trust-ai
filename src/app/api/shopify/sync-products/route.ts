import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { requirePermission } from "@/lib/auth/serverGuard";
import { isShopifyAdminConfigured } from "@/lib/shopify/config";
import { ShopifyConfigError } from "@/lib/shopify/auth";
import { getOrganizationId, syncAllProducts } from "@/lib/shopify/sync";

/**
 * Synchronisation manuelle et COMPLÈTE du catalogue depuis l'API Admin
 * GraphQL Shopify (toutes les pages, toutes les variantes — les endpoints
 * REST produits sont dépréciés).
 *
 * Autorisation vérifiée côté serveur : session authentifiée + permission
 * « gerer_catalogue ». Les identifiants Shopify (Client ID/Secret ou token
 * legacy) restent côté serveur et ne quittent jamais cette route.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST() {
  const guard = await requirePermission("gerer_catalogue");
  if (!guard.ok) {
    return NextResponse.json({ error: guard.error }, { status: guard.status });
  }

  if (!isShopifyAdminConfigured()) {
    return NextResponse.json(
      {
        error:
          "Shopify non configuré : renseignez SHOPIFY_STORE_DOMAIN + SHOPIFY_CLIENT_ID + SHOPIFY_CLIENT_SECRET (voir docs/SHOPIFY_SETUP.md).",
      },
      { status: 503 },
    );
  }

  const admin = createSupabaseAdminClient();
  if (!admin) {
    return NextResponse.json(
      { error: "Clé serveur Supabase absente (SUPABASE_SECRET_KEY)." },
      { status: 503 },
    );
  }
  const organizationId = await getOrganizationId(admin);
  if (!organizationId) {
    return NextResponse.json(
      { error: "Aucune organisation en base : appliquez le seed Supabase." },
      { status: 500 },
    );
  }

  try {
    const result = await syncAllProducts(admin, organizationId);
    await admin.from("activity_logs").insert({
      organization_id: organizationId,
      actor_profile_id: guard.userId,
      actor_label: guard.displayName,
      action: "Catalogue synchronisé",
      details: `${result.products} produit(s), ${result.variants} variante(s) importés ou mis à jour depuis Shopify${result.deactivated > 0 ? ` ; ${result.deactivated} produit(s) désactivé(s) (absents de la boutique)` : ""}.`,
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    const message =
      error instanceof ShopifyConfigError
        ? error.message
        : error instanceof Error
          ? error.message
          : "Erreur de synchronisation.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}

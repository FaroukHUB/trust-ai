import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { isSupabaseConfigured } from "@/lib/config";
import { hasPermission } from "@/lib/permissions";
import { mapProductPayload } from "@/lib/shopify/mapping";
import { getOrganizationId, upsertProduct } from "@/lib/shopify/sync";
import type { Role } from "@/lib/types";

/**
 * Synchronisation manuelle du catalogue depuis l'API Admin Shopify.
 *
 * Déclenchée depuis la page Catalogue par un profil disposant de la
 * permission « gerer_catalogue » (vérifiée côté serveur via la session
 * authentifiée — jamais via un paramètre client). Le token Admin Shopify
 * (SHOPIFY_ADMIN_ACCESS_TOKEN) reste côté serveur.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const API_VERSION = "2024-07";
const PAGE_LIMIT = 250;
const MAX_PAGES = 40; // garde-fou : 10 000 produits max par synchronisation

/* eslint-disable @typescript-eslint/no-explicit-any */

function nextPageInfo(linkHeader: string | null): string | null {
  if (!linkHeader) return null;
  // Format : <https://...products.json?page_info=XXX&limit=250>; rel="next"
  const match = linkHeader
    .split(",")
    .find((part) => part.includes('rel="next"'))
    ?.match(/page_info=([^&>]+)/);
  return match ? match[1] : null;
}

export async function POST() {
  if (!isSupabaseConfigured()) {
    return NextResponse.json(
      { error: "Mode démonstration : la synchronisation Shopify nécessite le mode connecté." },
      { status: 503 },
    );
  }
  const domain = process.env.SHOPIFY_STORE_DOMAIN;
  const token = process.env.SHOPIFY_ADMIN_ACCESS_TOKEN;
  if (!domain || !token) {
    return NextResponse.json(
      {
        error:
          "Shopify non configuré : ajoutez SHOPIFY_STORE_DOMAIN et SHOPIFY_ADMIN_ACCESS_TOKEN (variables serveur, voir docs/SHOPIFY_SETUP.md).",
      },
      { status: 503 },
    );
  }

  // Contrôle d'accès : session authentifiée + permission gerer_catalogue.
  const supabaseUser = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabaseUser.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Authentification requise." }, { status: 401 });
  }
  const { data: profile } = await supabaseUser
    .rpc("current_profile")
    .single<{ role: Role; active: boolean }>();
  if (!profile?.active || !hasPermission(profile.role, "gerer_catalogue")) {
    return NextResponse.json(
      { error: "Votre rôle ne permet pas de synchroniser le catalogue." },
      { status: 403 },
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

  let pageInfo: string | null = null;
  let products = 0;
  let variants = 0;
  try {
    for (let page = 0; page < MAX_PAGES; page++) {
      const url = new URL(`https://${domain}/admin/api/${API_VERSION}/products.json`);
      url.searchParams.set("limit", String(PAGE_LIMIT));
      if (pageInfo) url.searchParams.set("page_info", pageInfo);
      const response = await fetch(url, {
        headers: { "X-Shopify-Access-Token": token },
        cache: "no-store",
      });
      if (!response.ok) {
        const body = await response.text();
        throw new Error(
          `API Shopify ${response.status} : ${body.slice(0, 200) || response.statusText}`,
        );
      }
      const data = (await response.json()) as { products: any[] };
      for (const productPayload of data.products ?? []) {
        const mapped = mapProductPayload(productPayload);
        await upsertProduct(admin, organizationId, mapped);
        products += 1;
        variants += mapped.variants.length;
      }
      pageInfo = nextPageInfo(response.headers.get("link"));
      if (!pageInfo) break;
    }

    await admin.from("activity_logs").insert({
      organization_id: organizationId,
      actor_profile_id: user.id,
      actor_label: "Synchronisation Shopify",
      action: "Catalogue synchronisé",
      details: `${products} produit(s) et ${variants} variante(s) importés ou mis à jour depuis Shopify.`,
    });

    return NextResponse.json({ ok: true, products, variants });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur de synchronisation." },
      { status: 502 },
    );
  }
}

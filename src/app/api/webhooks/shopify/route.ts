import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  mapOrderPayload,
  mapProductPayload,
  verifyShopifyHmac,
} from "@/lib/shopify/mapping";
import {
  getOrganizationId,
  upsertOrder,
  upsertProduct,
} from "@/lib/shopify/sync";

/**
 * Réception des webhooks Shopify.
 *
 * Sécurité :
 *  1. la signature HMAC-SHA256 du corps brut est vérifiée avec
 *     SHOPIFY_WEBHOOK_SECRET — toute requête non signée est rejetée ;
 *  2. les écritures utilisent la clé serveur Supabase (jamais exposée au
 *     navigateur) ;
 *  3. chaque événement est journalisé dans shopify_webhook_events
 *     (traçabilité + débogage), et les upserts sont idempotents
 *     (shopify_order_id / shopify_line_id / shopify_product_id uniques) :
 *     rejouer un webhook ne crée jamais de doublon.
 *
 * Règle métier : un orders/updated met à jour les montants/quantités mais
 * ne touche JAMAIS au suivi d'approvisionnement saisi par l'équipe
 * (statut, fournisseur, dépôt de destination restent intacts).
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SUPPORTED_TOPICS = new Set([
  "orders/create",
  "orders/updated",
  "products/create",
  "products/update",
]);

export async function POST(request: Request) {
  const secret = process.env.SHOPIFY_WEBHOOK_SECRET;
  if (!secret) {
    // Intégration non configurée : on répond clairement, sans rien traiter.
    return NextResponse.json(
      { error: "Webhook Shopify non configuré (SHOPIFY_WEBHOOK_SECRET absent)." },
      { status: 503 },
    );
  }

  const rawBody = await request.text();
  const hmacHeader = request.headers.get("x-shopify-hmac-sha256");
  if (!verifyShopifyHmac(rawBody, hmacHeader, secret)) {
    return NextResponse.json({ error: "Signature HMAC invalide." }, { status: 401 });
  }

  const topic = request.headers.get("x-shopify-topic") ?? "inconnu";
  const supabase = createSupabaseAdminClient();
  if (!supabase) {
    return NextResponse.json(
      { error: "Clé serveur Supabase absente (SUPABASE_SECRET_KEY)." },
      { status: 503 },
    );
  }

  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Corps JSON invalide." }, { status: 400 });
  }

  // Journalisation de l'événement (traçabilité/débogage).
  const { data: eventRow } = await supabase
    .from("shopify_webhook_events")
    .insert({
      topic,
      shopify_id: payload.id !== undefined ? String(payload.id) : null,
      payload,
      status: SUPPORTED_TOPICS.has(topic) ? "recu" : "ignore",
    })
    .select("id")
    .single();
  const eventId = (eventRow as { id: string } | null)?.id;

  if (!SUPPORTED_TOPICS.has(topic)) {
    // Sujet non géré : accusé de réception pour éviter les re-livraisons.
    return NextResponse.json({ ok: true, ignored: topic });
  }

  try {
    const organizationId = await getOrganizationId(supabase);
    if (!organizationId) {
      throw new Error("Aucune organisation en base : appliquez le seed Supabase.");
    }
    if (topic === "orders/create" || topic === "orders/updated") {
      await upsertOrder(supabase, organizationId, mapOrderPayload(payload));
    } else {
      await upsertProduct(supabase, organizationId, mapProductPayload(payload));
    }
    if (eventId) {
      await supabase
        .from("shopify_webhook_events")
        .update({ status: "traite", processed_at: new Date().toISOString() })
        .eq("id", eventId);
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (eventId) {
      await supabase
        .from("shopify_webhook_events")
        .update({
          status: "erreur",
          error: error instanceof Error ? error.message : String(error),
          processed_at: new Date().toISOString(),
        })
        .eq("id", eventId);
    }
    // 500 → Shopify retentera la livraison automatiquement.
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur de traitement." },
      { status: 500 },
    );
  }
}

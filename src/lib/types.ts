/**
 * Modèle de données TRUST AI.
 *
 * Toutes les entités utilisent des identifiants stables (string) et des
 * relations explicites par id, afin de pouvoir remplacer plus tard le
 * stockage localStorage par Supabase sans réécrire l'interface.
 */

// ---------------------------------------------------------------------------
// Référentiels
// ---------------------------------------------------------------------------

export interface Store {
  id: string;
  /** Code court utilisé dans les références de commande (LIS, HER, AUB). */
  code: string;
  name: string;
  city: string;
  /** Anciens noms rencontrés dans les documents (ex. Aubagne = "Marseille"). */
  aliases: string[];
  active: boolean;
}

export interface Warehouse {
  id: string;
  name: string;
  city: string;
  /**
   * Magasins habituellement desservis par ce dépôt. Association souple :
   * Herblay est aujourd'hui lié au dépôt d'Argenteuil mais les deux entités
   * restent séparées dans le modèle.
   */
  linkedStoreIds: string[];
  active: boolean;
  notes?: string;
}

export interface Salesperson {
  id: string;
  name: string;
  storeId: string;
  active: boolean;
}

export interface Customer {
  id: string;
  name: string;
  phone?: string;
  email?: string;
  address?: string;
  postalCode?: string;
  city?: string;
}

// ---------------------------------------------------------------------------
// Commandes clients
// ---------------------------------------------------------------------------

export type OrderOrigin = "SHOPIFY" | "MAGASIN";

export type FulfillmentMode = "livraison" | "retrait_magasin" | "retrait_depot";

export type DeliveryStatus =
  | "a_planifier"
  | "planifiee"
  | "en_cours"
  | "livree"
  | "prete_retrait"
  | "retiree"
  | "reportee"
  | "annulee";

export type OrderStatus = "ouverte" | "terminee" | "annulee";

/** Statut d'approvisionnement suivi article par article. */
export type ProcurementStatus =
  | "a_verifier"
  | "stock_local"
  | "a_commander"
  | "en_attente_validation"
  | "commande"
  | "indisponible"
  | "relance_due"
  | "pret_fournisseur"
  | "en_transport"
  | "recu_depot"
  | "annule";

export type AcquisitionSource =
  | "google_naturel"
  | "google_ads"
  | "instagram"
  | "facebook"
  | "tiktok"
  | "bouche_a_oreille"
  | "passage_magasin"
  | "ancien_client"
  | "autre";

/**
 * Détails propres aux commandes Shopify.
 *
 * NOTE INTÉGRATION FUTURE : dans la version connectée, ces commandes seront
 * reçues automatiquement via les webhooks Shopify (orders/create,
 * orders/updated) et stockées dans Supabase. Les champs ci-dessous sont
 * alignés sur la payload Shopify pour faciliter ce branchement.
 */
export interface ShopifyDetails {
  shopifyId: string;
  orderNumber: string;
  paymentStatusShopify?: string;
  fulfillmentStatusShopify?: string;
  landingPage?: string;
  firstVisitAt?: string;
  lastVisitAt?: string;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  utmContent?: string;
  utmTerm?: string;
  daysToConversion?: number;
  returningCustomer?: boolean;
}

export interface Order {
  id: string;
  /** Référence lisible : MAG-LIS-2026-0001 ou numéro Shopify (#TR1058). */
  reference: string;
  origin: OrderOrigin;
  /** Magasin de rattachement (obligatoire pour l'origine MAGASIN). */
  storeId?: string;
  /** Vendeuse / vendeur (obligatoire pour une commande magasin). */
  salespersonId?: string;
  customerId: string;
  orderedAt: string;
  desiredAt?: string;
  fulfillmentMode: FulfillmentMode;
  deliveryStatus: DeliveryStatus;
  /** Dépôt ou magasin de retrait / point de départ de la livraison. */
  fulfillmentLocationLabel?: string;
  deliveryFee: number;
  /** Remise globale sur la commande, en euros. */
  discount: number;
  acquisitionSource?: AcquisitionSource;
  shopify?: ShopifyDetails;
  status: OrderStatus;
  notes?: string;
  createdAt: string;
}

/**
 * Ligne de commande : chaque article a son propre suivi d'approvisionnement.
 * Une commande n'est jamais modélisée comme une seule ligne produit.
 */
export interface OrderLine {
  id: string;
  orderId: string;
  productName: string;
  variant?: string;
  reference?: string;
  quantity: number;
  /** Prix unitaire TTC en euros. */
  unitPrice: number;
  /** Remise sur la ligne, en euros (montant total pour la ligne). */
  discount: number;
  /** Fournisseur principal pressenti pour cet article. */
  supplierId?: string;
  /** Fournisseur alternatif éventuel. */
  altSupplierId?: string;
  procurementStatus: ProcurementStatus;
  expectedArrival?: string;
  destinationWarehouseId?: string;
  /** Commande fournisseur à laquelle la ligne est rattachée, le cas échéant. */
  supplierOrderId?: string;
  /** Suivi des relances du lundi. */
  lastReminderAt?: string;
  nextReminderAt?: string;
  comments?: string;
}

// ---------------------------------------------------------------------------
// Fournisseurs
// ---------------------------------------------------------------------------

export type SupplierChannel = "whatsapp" | "site" | "application" | "email";

export type SupplierLogistics =
  | "retrait_trust"
  | "livraison_fournisseur"
  | "les_deux";

export interface Supplier {
  id: string;
  name: string;
  phone?: string;
  country?: string;
  specialties: string[];
  website?: string;
  orderChannel: SupplierChannel;
  /** Lien de consultation du stock (catalogue B2B). Aucun identifiant stocké. */
  stockUrl?: string;
  usualOrderDay?: string;
  pickupDays: string[];
  leadTimeDays?: number;
  active: boolean;
  logistics: SupplierLogistics;
  comments?: string;
}

/**
 * Association produit ↔ fournisseur. Un produit peut avoir un fournisseur
 * principal et plusieurs alternatifs, avec référence, délai et priorité
 * propres à chaque fournisseur. Servira à l'agent IA pour proposer un
 * fournisseur de repli en cas de rupture.
 */
export interface ProductSupplier {
  id: string;
  productName: string;
  variant?: string;
  supplierId: string;
  supplierReference?: string;
  leadTimeDays?: number;
  /** 1 = fournisseur principal, 2+ = alternatifs par ordre de priorité. */
  priority: number;
  isPrimary: boolean;
}

// ---------------------------------------------------------------------------
// Commandes fournisseurs
// ---------------------------------------------------------------------------

export type SupplierOrderStatus =
  | "proposition"
  | "en_attente_validation"
  | "validee"
  | "confirmee"
  | "annulee";

export interface SupplierOrderLine {
  id: string;
  /** Ligne de commande client à l'origine du besoin (traçabilité). */
  orderLineId?: string;
  productName: string;
  variant?: string;
  supplierReference?: string;
  quantity: number;
}

/**
 * Commande fournisseur : regroupe plusieurs lignes destinées au même
 * fournisseur. Doit TOUJOURS être validée par un humain avant d'être
 * considérée comme envoyée — le système prépare une proposition mais ne
 * simule jamais un envoi réel.
 */
export interface SupplierOrder {
  id: string;
  reference: string;
  supplierId: string;
  status: SupplierOrderStatus;
  lines: SupplierOrderLine[];
  createdAt: string;
  validatedAt?: string;
  validatedBy?: string;
  expectedAt?: string;
  notes?: string;
}

// ---------------------------------------------------------------------------
// Logistique : arrivages, transports, mouvements entre dépôts
// ---------------------------------------------------------------------------

export type ShipmentStatus =
  | "a_organiser"
  | "programme"
  | "pret_fournisseur"
  | "recupere"
  | "en_transit"
  | "recu_partiellement"
  | "recu"
  | "retarde"
  | "annule";

export type TransportMode =
  | "retrait_trust"
  | "livraison_fournisseur"
  | "affretement";

export type ShipmentEndpointType =
  | "fournisseur"
  | "depot"
  | "magasin"
  | "client";

export interface ShipmentItem {
  id: string;
  orderLineId?: string;
  productName: string;
  variant?: string;
  quantity: number;
  /** Permet les réceptions partielles. */
  quantityReceived: number;
}

/**
 * Étape d'un parcours logistique. Un transport peut être composé de
 * plusieurs étapes, par exemple :
 * Fournisseur → dépôt d'Argenteuil → affrètement → dépôt d'Aubagne → client.
 */
export interface ShipmentLeg {
  id: string;
  shipmentId: string;
  sequence: number;
  originType: ShipmentEndpointType;
  originLabel: string;
  destinationType: ShipmentEndpointType;
  destinationLabel: string;
  mode: TransportMode;
  carrier?: string;
  charterReference?: string;
  plannedAt?: string;
  actualAt?: string;
  status: ShipmentStatus;
}

/**
 * Arrivage / mouvement logistique. Peut contenir plusieurs commandes ou
 * articles, et être découpé en étapes (legs).
 */
export interface Shipment {
  id: string;
  reference: string;
  supplierId?: string;
  /** Dépôt principal concerné (destination courante). */
  warehouseId?: string;
  originLabel: string;
  destinationLabel: string;
  mode: TransportMode;
  carrier?: string;
  charterReference?: string;
  plannedAt?: string;
  actualAt?: string;
  status: ShipmentStatus;
  items: ShipmentItem[];
  legs: ShipmentLeg[];
  comments?: string;
}

// ---------------------------------------------------------------------------
// Règlements
// ---------------------------------------------------------------------------

export type PaymentMethod =
  | "especes"
  | "virement"
  | "carte_bancaire"
  | "paiement_express"
  | "cofidis"
  | "pnf"
  | "alma"
  | "floa"
  | "avoir"
  | "autre";

export type PaymentStatus =
  | "a_payer"
  | "partiellement_paye"
  | "paye"
  | "rembourse";

/**
 * Ligne de règlement. Une commande peut avoir plusieurs règlements ;
 * le reste à payer (RAP) est toujours calculé, jamais saisi.
 * Un montant négatif représente un remboursement.
 */
export interface Payment {
  id: string;
  orderId: string;
  amount: number;
  date: string;
  method: PaymentMethod;
  storeId?: string;
  salespersonId?: string;
  comment?: string;
}

// ---------------------------------------------------------------------------
// Acquisition marketing
// ---------------------------------------------------------------------------

export interface AcquisitionJourney {
  id: string;
  orderId: string;
  source: AcquisitionSource;
  landingPage?: string;
  firstVisitAt?: string;
  lastVisitAt?: string;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  utmContent?: string;
  utmTerm?: string;
  daysToConversion?: number;
  newCustomer?: boolean;
}

// ---------------------------------------------------------------------------
// Validations humaines & journal d'activité
// ---------------------------------------------------------------------------

export type ApprovalType =
  | "commande_fournisseur"
  | "changement_fournisseur"
  | "annulation_commande"
  | "reaffectation_produit"
  | "reservation_affretement"
  | "message_externe"
  | "modification_commande";

export type ApprovalStatus = "en_attente" | "approuvee" | "refusee";

/**
 * Demande de validation humaine. Aucune action extérieure réelle n'est
 * exécutée dans cette version : approuver une demande met simplement à jour
 * les statuts internes et le journal d'activité.
 */
export interface ApprovalRequest {
  id: string;
  type: ApprovalType;
  title: string;
  description: string;
  relatedOrderId?: string;
  relatedSupplierOrderId?: string;
  relatedShipmentId?: string;
  status: ApprovalStatus;
  createdAt: string;
  decidedAt?: string;
  decidedBy?: string;
}

export interface ActivityLog {
  id: string;
  at: string;
  actor: string;
  action: string;
  details?: string;
  orderId?: string;
}

// ---------------------------------------------------------------------------
// Base de données de démonstration
// ---------------------------------------------------------------------------

export interface Database {
  /** Version du schéma local : un changement force le rechargement du seed. */
  version: number;
  stores: Store[];
  warehouses: Warehouse[];
  salespeople: Salesperson[];
  customers: Customer[];
  orders: Order[];
  orderLines: OrderLine[];
  suppliers: Supplier[];
  productSuppliers: ProductSupplier[];
  supplierOrders: SupplierOrder[];
  shipments: Shipment[];
  payments: Payment[];
  acquisitionJourneys: AcquisitionJourney[];
  approvalRequests: ApprovalRequest[];
  activityLog: ActivityLog[];
}

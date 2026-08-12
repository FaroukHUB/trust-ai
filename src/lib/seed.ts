import { nextMonday } from "./format";
import type { Database } from "./types";

/**
 * Données de démonstration TRUST AI.
 *
 * Toutes les personnes (clients, vendeuses, vendeurs) sont entièrement
 * fictives : aucun nom, téléphone, adresse ou e-mail réel n'est utilisé.
 * Les dates sont calculées par rapport à aujourd'hui pour que la démo
 * reste vivante (commandes du jour, retards, relances...).
 */

export const SEED_VERSION = 1;

function iso(d: Date): string {
  return d.toISOString();
}

function daysAgo(n: number, hour = 10): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(hour, 15, 0, 0);
  return iso(d);
}

function daysFromNow(n: number, hour = 10): string {
  const d = new Date();
  d.setDate(d.getDate() + n);
  d.setHours(hour, 0, 0, 0);
  return iso(d);
}

/** Lundi précédent (ou aujourd'hui si lundi). */
function lastMonday(): string {
  const d = new Date();
  const day = d.getDay();
  const diff = (day + 6) % 7; // jours depuis lundi
  d.setDate(d.getDate() - diff);
  d.setHours(9, 0, 0, 0);
  return iso(d);
}

export function createSeed(): Database {
  const monday = lastMonday();
  const nextMon = nextMonday();

  return {
    version: SEED_VERSION,

    // -----------------------------------------------------------------
    // Magasins (Aubagne était parfois appelé "Marseille" dans les
    // anciens documents — conservé en alias).
    // -----------------------------------------------------------------
    stores: [
      {
        id: "store-lis",
        code: "LIS",
        name: "Trust Lisses",
        city: "Lisses",
        aliases: [],
        active: true,
      },
      {
        id: "store-her",
        code: "HER",
        name: "Trust Herblay",
        city: "Herblay",
        aliases: [],
        active: true,
      },
      {
        id: "store-aub",
        code: "AUB",
        name: "Trust Aubagne",
        city: "Aubagne",
        aliases: ["Marseille"],
        active: true,
      },
    ],

    // -----------------------------------------------------------------
    // Dépôts — séparés des magasins. Herblay est aujourd'hui desservi
    // par le dépôt d'Argenteuil, sans fusion des deux entités.
    // -----------------------------------------------------------------
    warehouses: [
      {
        id: "wh-arg",
        name: "Dépôt d'Argenteuil",
        city: "Argenteuil",
        linkedStoreIds: ["store-her", "store-lis"],
        active: true,
        notes:
          "Dépôt principal Île-de-France. Dessert notamment le magasin d'Herblay.",
      },
      {
        id: "wh-aub",
        name: "Dépôt d'Aubagne",
        city: "Aubagne",
        linkedStoreIds: ["store-aub"],
        active: true,
        notes: "Dépôt Sud, alimenté par affrètement depuis Argenteuil.",
      },
    ],

    // -----------------------------------------------------------------
    // Équipe de vente (personnes fictives)
    // -----------------------------------------------------------------
    salespeople: [
      { id: "sp-sarah", name: "Sarah Delcourt", storeId: "store-her", active: true },
      { id: "sp-julie", name: "Julie Mancini", storeId: "store-her", active: true },
      { id: "sp-nadia", name: "Nadia Berrada", storeId: "store-lis", active: true },
      { id: "sp-karim", name: "Karim Fabre", storeId: "store-aub", active: true },
      { id: "sp-lea", name: "Léa Sorel", storeId: "store-aub", active: true },
    ],

    // -----------------------------------------------------------------
    // Clients (entièrement fictifs)
    // -----------------------------------------------------------------
    customers: [
      {
        id: "cus-1",
        name: "Camille Estève",
        phone: "06 00 00 00 01",
        email: "camille.exemple@demo.fr",
        address: "12 rue des Lilas",
        postalCode: "95220",
        city: "Herblay-sur-Seine",
      },
      {
        id: "cus-2",
        name: "Thomas Vernet",
        phone: "06 00 00 00 02",
        email: "thomas.exemple@demo.fr",
        address: "8 avenue du Parc",
        postalCode: "13400",
        city: "Aubagne",
      },
      {
        id: "cus-3",
        name: "Inès Roussel",
        phone: "06 00 00 00 03",
        address: "3 allée des Cèdres",
        postalCode: "91090",
        city: "Lisses",
      },
      {
        id: "cus-4",
        name: "Marc Aubertin",
        phone: "06 00 00 00 04",
        email: "marc.exemple@demo.fr",
        address: "27 boulevard de la Mer",
        postalCode: "13008",
        city: "Marseille",
      },
      {
        id: "cus-5",
        name: "Sofia Lamarre",
        phone: "06 00 00 00 05",
        email: "sofia.exemple@demo.fr",
        address: "5 rue du Moulin",
        postalCode: "95100",
        city: "Argenteuil",
      },
      {
        id: "cus-6",
        name: "Hugo Perrin",
        phone: "06 00 00 00 06",
        address: "14 chemin des Vignes",
        postalCode: "13390",
        city: "Auriol",
      },
    ],

    // -----------------------------------------------------------------
    // Fournisseurs (exemples réalistes, coordonnées fictives,
    // aucun identifiant ni mot de passe stocké)
    // -----------------------------------------------------------------
    suppliers: [
      {
        id: "sup-gdm",
        name: "GDM",
        phone: "+33 1 00 00 00 10",
        country: "France",
        specialties: ["Tables", "Meubles massifs"],
        website: "https://exemple-gdm.fr",
        orderChannel: "whatsapp",
        stockUrl: "https://exemple-gdm.fr/stock",
        usualOrderDay: "lundi",
        pickupDays: ["mardi", "jeudi"],
        leadTimeDays: 7,
        active: true,
        logistics: "retrait_trust",
        comments: "Relance de préférence le lundi matin.",
      },
      {
        id: "sup-sm",
        name: "SM",
        phone: "+33 1 00 00 00 11",
        country: "France",
        specialties: ["Salons", "Canapés"],
        orderChannel: "whatsapp",
        usualOrderDay: "lundi",
        pickupDays: ["mercredi"],
        leadTimeDays: 10,
        active: true,
        logistics: "retrait_trust",
      },
      {
        id: "sup-greathome",
        name: "Great Home",
        phone: "+31 0 00 00 00 12",
        country: "Pays-Bas",
        specialties: ["Décoration", "Petits meubles"],
        website: "https://exemple-greathome.nl",
        orderChannel: "site",
        stockUrl: "https://exemple-greathome.nl/b2b",
        usualOrderDay: "lundi",
        pickupDays: ["lundi", "mardi", "mercredi", "jeudi", "vendredi"],
        leadTimeDays: 14,
        active: true,
        logistics: "livraison_fournisseur",
      },
      {
        id: "sup-polez",
        name: "Polez",
        country: "Pologne",
        specialties: ["Chambres", "Literie"],
        orderChannel: "email",
        leadTimeDays: 21,
        pickupDays: [],
        active: true,
        logistics: "livraison_fournisseur",
      },
      {
        id: "sup-signal",
        name: "Signal",
        country: "Pologne",
        specialties: ["Meubles TV", "Rangements"],
        orderChannel: "site",
        leadTimeDays: 18,
        pickupDays: [],
        active: true,
        logistics: "livraison_fournisseur",
      },
      {
        id: "sup-poletopole",
        name: "Pole to Pole",
        country: "Pays-Bas",
        specialties: ["Décoration exotique"],
        orderChannel: "site",
        leadTimeDays: 15,
        pickupDays: ["jeudi"],
        active: true,
        logistics: "les_deux",
      },
      {
        id: "sup-eleonora",
        name: "Eleonora",
        country: "Pays-Bas",
        specialties: ["Chaises", "Fauteuils"],
        website: "https://exemple-eleonora.nl",
        orderChannel: "site",
        stockUrl: "https://exemple-eleonora.nl/stock",
        usualOrderDay: "lundi",
        pickupDays: ["mardi", "vendredi"],
        leadTimeDays: 12,
        active: true,
        logistics: "les_deux",
      },
      {
        id: "sup-byboo",
        name: "By Boo",
        country: "Pays-Bas",
        specialties: ["Canapés", "Tables basses", "Luminaires"],
        website: "https://exemple-byboo.nl",
        orderChannel: "application",
        usualOrderDay: "lundi",
        pickupDays: ["lundi", "jeudi"],
        leadTimeDays: 10,
        active: true,
        logistics: "les_deux",
      },
      {
        id: "sup-dreamsfly",
        name: "Dreams Fly",
        country: "France",
        specialties: ["Matelas", "Sommiers"],
        orderChannel: "whatsapp",
        pickupDays: ["vendredi"],
        leadTimeDays: 5,
        active: true,
        logistics: "retrait_trust",
      },
      {
        id: "sup-eurodesign",
        name: "Eurodesign",
        country: "Italie",
        specialties: ["Salles à manger design"],
        orderChannel: "email",
        leadTimeDays: 28,
        pickupDays: [],
        active: true,
        logistics: "livraison_fournisseur",
      },
      {
        id: "sup-meubelco",
        name: "Meubel Co",
        country: "Belgique",
        specialties: ["Meubles en chêne"],
        orderChannel: "site",
        leadTimeDays: 20,
        pickupDays: ["mercredi"],
        active: true,
        logistics: "les_deux",
      },
      {
        id: "sup-jja",
        name: "JJA",
        country: "France",
        specialties: ["Décoration", "Jardin"],
        website: "https://exemple-jja.fr",
        orderChannel: "site",
        usualOrderDay: "lundi",
        pickupDays: [],
        leadTimeDays: 8,
        active: true,
        logistics: "livraison_fournisseur",
        comments: "Livre directement chez Trust.",
      },
      {
        id: "sup-luxuryliving",
        name: "Luxury Living",
        country: "France",
        specialties: ["Canapés haut de gamme"],
        orderChannel: "whatsapp",
        pickupDays: ["mardi"],
        leadTimeDays: 15,
        active: true,
        logistics: "retrait_trust",
      },
      {
        id: "sup-globehome",
        name: "Globe Home Trade",
        country: "France",
        specialties: ["Import", "Mobilier varié"],
        orderChannel: "whatsapp",
        pickupDays: ["lundi", "mercredi"],
        leadTimeDays: 9,
        active: false,
        logistics: "retrait_trust",
        comments: "Fournisseur en pause, stock irrégulier.",
      },
    ],

    // -----------------------------------------------------------------
    // Associations produits ↔ fournisseurs (principal + alternatifs)
    // -----------------------------------------------------------------
    productSuppliers: [
      {
        id: "ps-1",
        productName: "Table à manger Rustica 220 cm",
        supplierId: "sup-gdm",
        supplierReference: "GDM-RUST-220",
        leadTimeDays: 7,
        priority: 1,
        isPrimary: true,
      },
      {
        id: "ps-2",
        productName: "Table à manger Rustica 220 cm",
        supplierId: "sup-meubelco",
        supplierReference: "MC-TBL-0220",
        leadTimeDays: 20,
        priority: 2,
        isPrimary: false,
      },
      {
        id: "ps-3",
        productName: "Canapé d'angle Milano",
        variant: "Velours vert, angle gauche",
        supplierId: "sup-byboo",
        supplierReference: "BB-MIL-VG-G",
        leadTimeDays: 10,
        priority: 1,
        isPrimary: true,
      },
      {
        id: "ps-4",
        productName: "Canapé d'angle Milano",
        variant: "Velours vert, angle gauche",
        supplierId: "sup-sm",
        supplierReference: "SM-ANG-118",
        leadTimeDays: 12,
        priority: 2,
        isPrimary: false,
      },
      {
        id: "ps-5",
        productName: "Chaise Vera",
        variant: "Velours taupe",
        supplierId: "sup-eleonora",
        supplierReference: "ELE-VERA-TP",
        leadTimeDays: 12,
        priority: 1,
        isPrimary: true,
      },
      {
        id: "ps-6",
        productName: "Chaise Vera",
        variant: "Velours taupe",
        supplierId: "sup-poletopole",
        supplierReference: "PTP-CH-VER",
        leadTimeDays: 15,
        priority: 2,
        isPrimary: false,
      },
      {
        id: "ps-7",
        productName: "Buffet Oslo 180 cm",
        supplierId: "sup-signal",
        supplierReference: "SIG-OSL-180",
        leadTimeDays: 18,
        priority: 1,
        isPrimary: true,
      },
      {
        id: "ps-8",
        productName: "Matelas Cloud 160×200",
        supplierId: "sup-dreamsfly",
        supplierReference: "DF-CLD-160",
        leadTimeDays: 5,
        priority: 1,
        isPrimary: true,
      },
    ],

    // -----------------------------------------------------------------
    // Commandes clients
    // -----------------------------------------------------------------
    orders: [
      // Scénario 1 : commande Shopify multi-articles, fournisseurs différents
      {
        id: "ord-sho-1",
        reference: "#TR1058",
        origin: "SHOPIFY",
        customerId: "cus-5",
        orderedAt: daysAgo(6),
        desiredAt: daysFromNow(9),
        fulfillmentMode: "livraison",
        deliveryStatus: "a_planifier",
        fulfillmentLocationLabel: "Dépôt d'Argenteuil",
        deliveryFee: 89,
        discount: 0,
        acquisitionSource: "google_ads",
        shopify: {
          shopifyId: "gid://shopify/Order/5901058",
          orderNumber: "#TR1058",
          paymentStatusShopify: "paid",
          fulfillmentStatusShopify: "unfulfilled",
          landingPage: "/collections/canapes-dangle",
          firstVisitAt: daysAgo(19),
          lastVisitAt: daysAgo(6),
          utmSource: "google",
          utmMedium: "cpc",
          utmCampaign: "canapes-hiver",
          daysToConversion: 13,
          returningCustomer: false,
        },
        status: "ouverte",
        notes: "Client joignable après 18 h.",
        createdAt: daysAgo(6),
      },
      // Scénarios 2, 5, 6 : commande magasin Herblay, vendeuse, acompte + RAP,
      // ligne en attente de validation fournisseur, ligne indisponible à relancer
      {
        id: "ord-mag-her-1",
        reference: "MAG-HER-2026-0007",
        origin: "MAGASIN",
        storeId: "store-her",
        salespersonId: "sp-sarah",
        customerId: "cus-1",
        orderedAt: daysAgo(9),
        desiredAt: daysFromNow(20),
        fulfillmentMode: "livraison",
        deliveryStatus: "a_planifier",
        fulfillmentLocationLabel: "Dépôt d'Argenteuil",
        deliveryFee: 60,
        discount: 100,
        acquisitionSource: "passage_magasin",
        status: "ouverte",
        notes: "Livraison au 2e étage sans ascenseur.",
        createdAt: daysAgo(9),
      },
      // Scénario 3 : commande Aubagne, marchandise via Argenteuil puis affrètement
      {
        id: "ord-mag-aub-1",
        reference: "MAG-AUB-2026-0004",
        origin: "MAGASIN",
        storeId: "store-aub",
        salespersonId: "sp-karim",
        customerId: "cus-2",
        orderedAt: daysAgo(14),
        desiredAt: daysFromNow(6),
        fulfillmentMode: "livraison",
        deliveryStatus: "planifiee",
        fulfillmentLocationLabel: "Dépôt d'Aubagne",
        deliveryFee: 70,
        discount: 0,
        acquisitionSource: "ancien_client",
        status: "ouverte",
        createdAt: daysAgo(14),
      },
      // Scénarios 4 et 7 : commande Lisses, article en stock local,
      // payée avec plusieurs moyens de paiement
      {
        id: "ord-mag-lis-1",
        reference: "MAG-LIS-2026-0012",
        origin: "MAGASIN",
        storeId: "store-lis",
        salespersonId: "sp-nadia",
        customerId: "cus-3",
        orderedAt: daysAgo(3),
        desiredAt: daysFromNow(2),
        fulfillmentMode: "retrait_magasin",
        deliveryStatus: "prete_retrait",
        fulfillmentLocationLabel: "Trust Lisses",
        deliveryFee: 0,
        discount: 50,
        acquisitionSource: "bouche_a_oreille",
        status: "ouverte",
        createdAt: daysAgo(3),
      },
      // Scénario 8 : commande Shopify avec retrait client au dépôt
      {
        id: "ord-sho-2",
        reference: "#TR1071",
        origin: "SHOPIFY",
        customerId: "cus-4",
        orderedAt: daysAgo(12),
        fulfillmentMode: "retrait_depot",
        deliveryStatus: "prete_retrait",
        fulfillmentLocationLabel: "Dépôt d'Aubagne",
        deliveryFee: 0,
        discount: 0,
        acquisitionSource: "instagram",
        shopify: {
          shopifyId: "gid://shopify/Order/5901071",
          orderNumber: "#TR1071",
          paymentStatusShopify: "paid",
          fulfillmentStatusShopify: "unfulfilled",
          landingPage: "/products/buffet-oslo-180",
          firstVisitAt: daysAgo(13),
          lastVisitAt: daysAgo(12),
          utmSource: "instagram",
          utmMedium: "social",
          utmCampaign: "reels-salon",
          daysToConversion: 1,
          returningCustomer: true,
        },
        status: "ouverte",
        createdAt: daysAgo(12),
      },
      // Commande du jour (dashboard) : Aubagne, acompte encaissé aujourd'hui,
      // scénario 9 rattaché (livraison fournisseur directement chez Trust)
      {
        id: "ord-mag-aub-2",
        reference: "MAG-AUB-2026-0009",
        origin: "MAGASIN",
        storeId: "store-aub",
        salespersonId: "sp-lea",
        customerId: "cus-6",
        orderedAt: daysAgo(0, 9),
        desiredAt: daysFromNow(15),
        fulfillmentMode: "retrait_depot",
        deliveryStatus: "a_planifier",
        fulfillmentLocationLabel: "Dépôt d'Aubagne",
        deliveryFee: 0,
        discount: 0,
        acquisitionSource: "google_naturel",
        status: "ouverte",
        createdAt: daysAgo(0, 9),
      },
    ],

    // -----------------------------------------------------------------
    // Lignes de commande — suivi fournisseur article par article
    // -----------------------------------------------------------------
    orderLines: [
      // Scénario 1 : deux articles, deux fournisseurs différents
      {
        id: "line-sho1-1",
        orderId: "ord-sho-1",
        productName: "Canapé d'angle Milano",
        variant: "Velours vert, angle gauche",
        reference: "BB-MIL-VG-G",
        quantity: 1,
        unitPrice: 1490,
        discount: 0,
        supplierId: "sup-byboo",
        altSupplierId: "sup-sm",
        procurementStatus: "commande",
        expectedArrival: daysFromNow(5),
        destinationWarehouseId: "wh-arg",
        supplierOrderId: "so-2",
        comments: "Confirmé par By Boo, retrait jeudi.",
      },
      {
        id: "line-sho1-2",
        orderId: "ord-sho-1",
        productName: "Table basse Louna",
        variant: "Travertin, Ø90",
        reference: "ELE-LOU-90",
        quantity: 1,
        unitPrice: 349,
        discount: 0,
        supplierId: "sup-eleonora",
        procurementStatus: "a_commander",
        destinationWarehouseId: "wh-arg",
        nextReminderAt: nextMon,
        comments: "À grouper avec la prochaine commande Eleonora.",
      },
      // Scénario 6 : ligne en attente de validation (commande fournisseur GDM)
      {
        id: "line-her1-1",
        orderId: "ord-mag-her-1",
        productName: "Table à manger Rustica 220 cm",
        variant: "Chêne massif",
        reference: "GDM-RUST-220",
        quantity: 1,
        unitPrice: 1190,
        discount: 100,
        supplierId: "sup-gdm",
        altSupplierId: "sup-meubelco",
        procurementStatus: "en_attente_validation",
        destinationWarehouseId: "wh-arg",
        supplierOrderId: "so-1",
      },
      // Scénario 5 : article indisponible, relance le lundi
      {
        id: "line-her1-2",
        orderId: "ord-mag-her-1",
        productName: "Chaise Vera",
        variant: "Velours taupe",
        reference: "ELE-VERA-TP",
        quantity: 6,
        unitPrice: 129,
        discount: 0,
        supplierId: "sup-eleonora",
        altSupplierId: "sup-poletopole",
        procurementStatus: "indisponible",
        destinationWarehouseId: "wh-arg",
        lastReminderAt: monday,
        nextReminderAt: nextMon,
        comments: "Rupture chez Eleonora, réappro annoncé sous 3 semaines.",
      },
      // Scénario 3 : deux articles en transit Argenteuil → Aubagne
      {
        id: "line-aub1-1",
        orderId: "ord-mag-aub-1",
        productName: "Canapé 3 places Ferrare",
        variant: "Tissu beige",
        reference: "SM-FER-3P",
        quantity: 1,
        unitPrice: 990,
        discount: 0,
        supplierId: "sup-sm",
        procurementStatus: "en_transport",
        expectedArrival: daysFromNow(2),
        destinationWarehouseId: "wh-aub",
        supplierOrderId: "so-3",
        comments: "Parti d'Argenteuil par affrètement.",
      },
      {
        id: "line-aub1-2",
        orderId: "ord-mag-aub-1",
        productName: "Fauteuil Ferrare",
        variant: "Tissu beige",
        reference: "SM-FER-FT",
        quantity: 2,
        unitPrice: 390,
        discount: 0,
        supplierId: "sup-sm",
        procurementStatus: "en_transport",
        expectedArrival: daysFromNow(2),
        destinationWarehouseId: "wh-aub",
        supplierOrderId: "so-3",
      },
      // Scénario 4 : article disponible en stock local
      {
        id: "line-lis1-1",
        orderId: "ord-mag-lis-1",
        productName: "Matelas Cloud 160×200",
        reference: "DF-CLD-160",
        quantity: 1,
        unitPrice: 649,
        discount: 0,
        supplierId: "sup-dreamsfly",
        procurementStatus: "stock_local",
        destinationWarehouseId: "wh-arg",
        comments: "En stock au magasin de Lisses.",
      },
      {
        id: "line-lis1-2",
        orderId: "ord-mag-lis-1",
        productName: "Cadre de lit Éden 160",
        variant: "Tissu gris clair",
        quantity: 1,
        unitPrice: 450,
        discount: 0,
        supplierId: "sup-polez",
        procurementStatus: "stock_local",
        comments: "Dernière pièce d'exposition.",
      },
      // Scénario 8 : article reçu au dépôt, retrait client
      {
        id: "line-sho2-1",
        orderId: "ord-sho-2",
        productName: "Buffet Oslo 180 cm",
        variant: "Chêne / noir",
        reference: "SIG-OSL-180",
        quantity: 1,
        unitPrice: 780,
        discount: 0,
        supplierId: "sup-signal",
        procurementStatus: "recu_depot",
        destinationWarehouseId: "wh-aub",
        comments: "Client prévenu, retrait possible dès maintenant.",
      },
      // Scénario 9 : livraison fournisseur directement chez Trust (JJA)
      {
        id: "line-aub2-1",
        orderId: "ord-mag-aub-2",
        productName: "Ensemble déco Riviera (miroir + vases)",
        quantity: 1,
        unitPrice: 320,
        discount: 0,
        supplierId: "sup-jja",
        procurementStatus: "commande",
        expectedArrival: daysFromNow(4),
        destinationWarehouseId: "wh-aub",
        supplierOrderId: "so-4",
        comments: "JJA livre directement au dépôt d'Aubagne.",
      },
      {
        id: "line-aub2-2",
        orderId: "ord-mag-aub-2",
        productName: "Lampadaire Arco",
        variant: "Laiton",
        quantity: 1,
        unitPrice: 189,
        discount: 0,
        supplierId: "sup-greathome",
        procurementStatus: "a_verifier",
        destinationWarehouseId: "wh-aub",
      },
    ],

    // -----------------------------------------------------------------
    // Commandes fournisseurs
    // -----------------------------------------------------------------
    supplierOrders: [
      // Scénario 6 : proposition en attente de validation humaine
      {
        id: "so-1",
        reference: "FOU-2026-0015",
        supplierId: "sup-gdm",
        status: "en_attente_validation",
        lines: [
          {
            id: "sol-1",
            orderLineId: "line-her1-1",
            productName: "Table à manger Rustica 220 cm",
            variant: "Chêne massif",
            supplierReference: "GDM-RUST-220",
            quantity: 1,
          },
        ],
        createdAt: daysAgo(2),
        expectedAt: daysFromNow(8),
        notes:
          "Proposition préparée automatiquement. Validation humaine obligatoire avant tout envoi.",
      },
      // Commande By Boo validée (scénario 1)
      {
        id: "so-2",
        reference: "FOU-2026-0013",
        supplierId: "sup-byboo",
        status: "validee",
        lines: [
          {
            id: "sol-2",
            orderLineId: "line-sho1-1",
            productName: "Canapé d'angle Milano",
            variant: "Velours vert, angle gauche",
            supplierReference: "BB-MIL-VG-G",
            quantity: 1,
          },
        ],
        createdAt: daysAgo(5),
        validatedAt: daysAgo(5),
        validatedBy: "Sarah Delcourt",
        expectedAt: daysFromNow(5),
      },
      // Commande SM confirmée (scénario 3)
      {
        id: "so-3",
        reference: "FOU-2026-0011",
        supplierId: "sup-sm",
        status: "confirmee",
        lines: [
          {
            id: "sol-3",
            orderLineId: "line-aub1-1",
            productName: "Canapé 3 places Ferrare",
            variant: "Tissu beige",
            supplierReference: "SM-FER-3P",
            quantity: 1,
          },
          {
            id: "sol-4",
            orderLineId: "line-aub1-2",
            productName: "Fauteuil Ferrare",
            variant: "Tissu beige",
            supplierReference: "SM-FER-FT",
            quantity: 2,
          },
        ],
        createdAt: daysAgo(12),
        validatedAt: daysAgo(12),
        validatedBy: "Karim Fabre",
        expectedAt: daysFromNow(2),
      },
      // Commande JJA (scénario 9, livraison directe chez Trust)
      {
        id: "so-4",
        reference: "FOU-2026-0016",
        supplierId: "sup-jja",
        status: "validee",
        lines: [
          {
            id: "sol-5",
            orderLineId: "line-aub2-1",
            productName: "Ensemble déco Riviera (miroir + vases)",
            quantity: 1,
          },
        ],
        createdAt: daysAgo(0, 11),
        validatedAt: daysAgo(0, 11),
        validatedBy: "Léa Sorel",
        expectedAt: daysFromNow(4),
      },
      // Commande Great Home reçue partiellement (scénario 10)
      {
        id: "so-5",
        reference: "FOU-2026-0009",
        supplierId: "sup-greathome",
        status: "confirmee",
        lines: [
          {
            id: "sol-6",
            productName: "Miroir organique Wave",
            quantity: 4,
          },
          {
            id: "sol-7",
            productName: "Suspension rotin Bali",
            quantity: 2,
          },
        ],
        createdAt: daysAgo(16),
        validatedAt: daysAgo(16),
        validatedBy: "Julie Mancini",
        expectedAt: daysAgo(1),
      },
    ],

    // -----------------------------------------------------------------
    // Arrivages / transports
    // -----------------------------------------------------------------
    shipments: [
      // Scénario 3 : Fournisseur SM → Argenteuil → affrètement → Aubagne
      {
        id: "shp-1",
        reference: "TRA-2026-0021",
        supplierId: "sup-sm",
        warehouseId: "wh-aub",
        originLabel: "Fournisseur SM",
        destinationLabel: "Dépôt d'Aubagne",
        mode: "affretement",
        carrier: "Transports Riviera",
        charterReference: "AFF-2026-088",
        plannedAt: daysFromNow(2),
        status: "en_transit",
        items: [
          {
            id: "shi-1",
            orderLineId: "line-aub1-1",
            productName: "Canapé 3 places Ferrare",
            variant: "Tissu beige",
            quantity: 1,
            quantityReceived: 0,
          },
          {
            id: "shi-2",
            orderLineId: "line-aub1-2",
            productName: "Fauteuil Ferrare",
            variant: "Tissu beige",
            quantity: 2,
            quantityReceived: 0,
          },
        ],
        legs: [
          {
            id: "leg-1a",
            shipmentId: "shp-1",
            sequence: 1,
            originType: "fournisseur",
            originLabel: "Fournisseur SM",
            destinationType: "depot",
            destinationLabel: "Dépôt d'Argenteuil",
            mode: "retrait_trust",
            carrier: "Livreurs Trust",
            plannedAt: daysAgo(4),
            actualAt: daysAgo(4),
            status: "recu",
          },
          {
            id: "leg-1b",
            shipmentId: "shp-1",
            sequence: 2,
            originType: "depot",
            originLabel: "Dépôt d'Argenteuil",
            destinationType: "depot",
            destinationLabel: "Dépôt d'Aubagne",
            mode: "affretement",
            carrier: "Transports Riviera",
            charterReference: "AFF-2026-088",
            plannedAt: daysFromNow(2),
            status: "en_transit",
          },
          {
            id: "leg-1c",
            shipmentId: "shp-1",
            sequence: 3,
            originType: "depot",
            originLabel: "Dépôt d'Aubagne",
            destinationType: "client",
            destinationLabel: "Client — Aubagne",
            mode: "retrait_trust",
            carrier: "Livreurs Trust",
            plannedAt: daysFromNow(6),
            status: "programme",
          },
        ],
        comments: "Affrètement hebdomadaire Argenteuil → Aubagne.",
      },
      // Scénario 10 : arrivage Great Home reçu partiellement à Argenteuil
      {
        id: "shp-2",
        reference: "TRA-2026-0019",
        supplierId: "sup-greathome",
        warehouseId: "wh-arg",
        originLabel: "Fournisseur Great Home",
        destinationLabel: "Dépôt d'Argenteuil",
        mode: "livraison_fournisseur",
        carrier: "Great Home Logistics",
        plannedAt: daysAgo(1),
        actualAt: daysAgo(1),
        status: "recu_partiellement",
        items: [
          {
            id: "shi-3",
            productName: "Miroir organique Wave",
            quantity: 4,
            quantityReceived: 2,
          },
          {
            id: "shi-4",
            productName: "Suspension rotin Bali",
            quantity: 2,
            quantityReceived: 2,
          },
        ],
        legs: [
          {
            id: "leg-2a",
            shipmentId: "shp-2",
            sequence: 1,
            originType: "fournisseur",
            originLabel: "Fournisseur Great Home",
            destinationType: "depot",
            destinationLabel: "Dépôt d'Argenteuil",
            mode: "livraison_fournisseur",
            carrier: "Great Home Logistics",
            plannedAt: daysAgo(1),
            actualAt: daysAgo(1),
            status: "recu_partiellement",
          },
        ],
        comments: "2 miroirs manquants, reliquat annoncé sous 10 jours.",
      },
      // Scénario 9 : livraison fournisseur JJA directement chez Trust
      {
        id: "shp-3",
        reference: "TRA-2026-0024",
        supplierId: "sup-jja",
        warehouseId: "wh-aub",
        originLabel: "Fournisseur JJA",
        destinationLabel: "Dépôt d'Aubagne",
        mode: "livraison_fournisseur",
        carrier: "JJA Distribution",
        plannedAt: daysFromNow(4),
        status: "programme",
        items: [
          {
            id: "shi-5",
            orderLineId: "line-aub2-1",
            productName: "Ensemble déco Riviera (miroir + vases)",
            quantity: 1,
            quantityReceived: 0,
          },
        ],
        legs: [
          {
            id: "leg-3a",
            shipmentId: "shp-3",
            sequence: 1,
            originType: "fournisseur",
            originLabel: "Fournisseur JJA",
            destinationType: "depot",
            destinationLabel: "Dépôt d'Aubagne",
            mode: "livraison_fournisseur",
            carrier: "JJA Distribution",
            plannedAt: daysFromNow(4),
            status: "programme",
          },
        ],
      },
      // Retrait By Boo en retard (alerte dashboard)
      {
        id: "shp-4",
        reference: "TRA-2026-0022",
        supplierId: "sup-byboo",
        warehouseId: "wh-arg",
        originLabel: "Fournisseur By Boo",
        destinationLabel: "Dépôt d'Argenteuil",
        mode: "retrait_trust",
        carrier: "Livreurs Trust",
        plannedAt: daysAgo(2),
        status: "retarde",
        items: [
          {
            id: "shi-6",
            orderLineId: "line-sho1-1",
            productName: "Canapé d'angle Milano",
            variant: "Velours vert, angle gauche",
            quantity: 1,
            quantityReceived: 0,
          },
        ],
        legs: [
          {
            id: "leg-4a",
            shipmentId: "shp-4",
            sequence: 1,
            originType: "fournisseur",
            originLabel: "Fournisseur By Boo",
            destinationType: "depot",
            destinationLabel: "Dépôt d'Argenteuil",
            mode: "retrait_trust",
            carrier: "Livreurs Trust",
            plannedAt: daysAgo(2),
            status: "retarde",
          },
        ],
        comments: "Camion complet lundi, retrait reporté à cette semaine.",
      },
    ],

    // -----------------------------------------------------------------
    // Règlements (le RAP est toujours calculé, jamais saisi)
    // -----------------------------------------------------------------
    payments: [
      // Scénario 1 : Shopify payé en ligne
      {
        id: "pay-1",
        orderId: "ord-sho-1",
        amount: 1928,
        date: daysAgo(6),
        method: "carte_bancaire",
        comment: "Paiement Shopify en ligne.",
      },
      // Scénario 2 : acompte à Herblay → RAP restant
      {
        id: "pay-2",
        orderId: "ord-mag-her-1",
        amount: 500,
        date: daysAgo(9),
        method: "carte_bancaire",
        storeId: "store-her",
        salespersonId: "sp-sarah",
        comment: "Acompte à la commande.",
      },
      // Scénario 3 : acompte par virement
      {
        id: "pay-3",
        orderId: "ord-mag-aub-1",
        amount: 800,
        date: daysAgo(14),
        method: "virement",
        storeId: "store-aub",
        salespersonId: "sp-karim",
      },
      // Scénarios 4/7 : commande payée avec plusieurs moyens de paiement
      {
        id: "pay-4",
        orderId: "ord-mag-lis-1",
        amount: 400,
        date: daysAgo(3),
        method: "especes",
        storeId: "store-lis",
        salespersonId: "sp-nadia",
        comment: "Première partie en espèces.",
      },
      {
        id: "pay-5",
        orderId: "ord-mag-lis-1",
        amount: 649,
        date: daysAgo(3),
        method: "carte_bancaire",
        storeId: "store-lis",
        salespersonId: "sp-nadia",
        comment: "Solde par carte bancaire.",
      },
      // Scénario 8 : Shopify payé, financement Alma
      {
        id: "pay-6",
        orderId: "ord-sho-2",
        amount: 780,
        date: daysAgo(12),
        method: "alma",
        comment: "Financement Alma en 3 fois.",
      },
      // Commande du jour : acompte encaissé aujourd'hui à Aubagne
      {
        id: "pay-7",
        orderId: "ord-mag-aub-2",
        amount: 250,
        date: daysAgo(0, 9),
        method: "especes",
        storeId: "store-aub",
        salespersonId: "sp-lea",
        comment: "Acompte du jour.",
      },
    ],

    // -----------------------------------------------------------------
    // Parcours d'acquisition marketing
    // -----------------------------------------------------------------
    acquisitionJourneys: [
      {
        id: "acq-1",
        orderId: "ord-sho-1",
        source: "google_ads",
        landingPage: "/collections/canapes-dangle",
        firstVisitAt: daysAgo(19),
        lastVisitAt: daysAgo(6),
        utmSource: "google",
        utmMedium: "cpc",
        utmCampaign: "canapes-hiver",
        daysToConversion: 13,
        newCustomer: true,
      },
      {
        id: "acq-2",
        orderId: "ord-sho-2",
        source: "instagram",
        landingPage: "/products/buffet-oslo-180",
        firstVisitAt: daysAgo(13),
        lastVisitAt: daysAgo(12),
        utmSource: "instagram",
        utmMedium: "social",
        utmCampaign: "reels-salon",
        daysToConversion: 1,
        newCustomer: false,
      },
      {
        id: "acq-3",
        orderId: "ord-mag-her-1",
        source: "passage_magasin",
        newCustomer: true,
      },
      {
        id: "acq-4",
        orderId: "ord-mag-aub-1",
        source: "ancien_client",
        newCustomer: false,
      },
      {
        id: "acq-5",
        orderId: "ord-mag-lis-1",
        source: "bouche_a_oreille",
        newCustomer: true,
      },
      {
        id: "acq-6",
        orderId: "ord-mag-aub-2",
        source: "google_naturel",
        newCustomer: true,
      },
    ],

    // -----------------------------------------------------------------
    // Demandes de validation humaine
    // -----------------------------------------------------------------
    approvalRequests: [
      {
        id: "apr-1",
        type: "commande_fournisseur",
        title: "Valider la commande GDM (FOU-2026-0015)",
        description:
          "Table à manger Rustica 220 cm pour la commande MAG-HER-2026-0007. À valider avant l'envoi WhatsApp du lundi.",
        relatedOrderId: "ord-mag-her-1",
        relatedSupplierOrderId: "so-1",
        status: "en_attente",
        createdAt: daysAgo(2),
      },
      {
        id: "apr-2",
        type: "changement_fournisseur",
        title: "Basculer les chaises Vera vers Pole to Pole",
        description:
          "Eleonora est en rupture sur la chaise Vera velours taupe (6 pièces, commande MAG-HER-2026-0007). Pole to Pole a un modèle équivalent avec 15 jours de délai. Confirmer le changement de fournisseur ?",
        relatedOrderId: "ord-mag-her-1",
        status: "en_attente",
        createdAt: daysAgo(1),
      },
      {
        id: "apr-3",
        type: "reservation_affretement",
        title: "Réserver l'affrètement Argenteuil → Aubagne du lundi",
        description:
          "Canapé et fauteuils Ferrare (MAG-AUB-2026-0004) via Transports Riviera, référence AFF-2026-088.",
        relatedOrderId: "ord-mag-aub-1",
        relatedShipmentId: "shp-1",
        status: "approuvee",
        createdAt: daysAgo(6),
        decidedAt: daysAgo(5),
        decidedBy: "Karim Fabre",
      },
    ],

    // -----------------------------------------------------------------
    // Journal d'activité
    // -----------------------------------------------------------------
    activityLog: [
      {
        id: "log-1",
        at: daysAgo(0, 9),
        actor: "Léa Sorel",
        action: "Commande créée",
        details: "MAG-AUB-2026-0009 — acompte de 250 € encaissé en espèces.",
        orderId: "ord-mag-aub-2",
      },
      {
        id: "log-2",
        at: daysAgo(1),
        actor: "TRUST AI",
        action: "Proposition de changement de fournisseur",
        details:
          "Chaise Vera indisponible chez Eleonora — alternative Pole to Pole proposée, en attente de validation.",
        orderId: "ord-mag-her-1",
      },
      {
        id: "log-3",
        at: daysAgo(1),
        actor: "Julie Mancini",
        action: "Réception partielle",
        details:
          "TRA-2026-0019 (Great Home) : 2 miroirs Wave manquants sur 4, reliquat annoncé sous 10 jours.",
      },
      {
        id: "log-4",
        at: daysAgo(2),
        actor: "TRUST AI",
        action: "Proposition de commande fournisseur",
        details:
          "FOU-2026-0015 (GDM) préparée pour la table Rustica — validation humaine requise.",
        orderId: "ord-mag-her-1",
      },
      {
        id: "log-5",
        at: monday,
        actor: "Sarah Delcourt",
        action: "Relance fournisseur effectuée",
        details:
          "Eleonora relancé pour les chaises Vera — toujours indisponible, prochaine relance lundi prochain.",
        orderId: "ord-mag-her-1",
      },
      {
        id: "log-6",
        at: daysAgo(5),
        actor: "Sarah Delcourt",
        action: "Commande fournisseur validée",
        details: "FOU-2026-0013 (By Boo) validée pour le canapé Milano.",
        orderId: "ord-sho-1",
      },
      {
        id: "log-7",
        at: daysAgo(6),
        actor: "Webhook Shopify (simulation)",
        action: "Commande Shopify reçue",
        details:
          "#TR1058 — 2 articles, 1 928 €. Sera automatisé via webhook orders/create.",
        orderId: "ord-sho-1",
      },
    ],
  };
}

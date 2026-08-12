import { beforeEach, describe, expect, it } from "vitest";
import { createSeed } from "./seed";
import {
  BusinessError,
  addPaymentM,
  createStoreOrderM,
  decideApprovalM,
  markReminderDoneM,
  receiveShipmentM,
  requestOrderCancellationM,
} from "./mutations";
import {
  computeReminders,
  globalRap,
  orderRap,
  refundAlerts,
} from "./derive";
import { addAmounts } from "./money";
import type { Database } from "./types";

let db: Database;

beforeEach(() => {
  db = createSeed();
});

const paymentBase = {
  date: new Date().toISOString(),
  method: "carte_bancaire" as const,
};

describe("Règlements", () => {
  // ord-mag-her-1 : total 1 824 € (1 090 + 774 − 100 + 60), acompte 500 € → RAP 1 324 €
  it("refuse un règlement supérieur au RAP", () => {
    expect(() =>
      addPaymentM(db, "ord-mag-her-1", { ...paymentBase, amount: 1324.01 }),
    ).toThrow(BusinessError);
    // Rien n'a été enregistré (pas de plafonnement silencieux).
    expect(db.payments.filter((p) => p.orderId === "ord-mag-her-1")).toHaveLength(1);
  });

  it("refuse un règlement lorsque le RAP est nul", () => {
    // ord-mag-lis-1 est déjà soldée (400 + 649 = 1 049 = total).
    const order = db.orders.find((o) => o.id === "ord-mag-lis-1")!;
    expect(orderRap(order, db.orderLines, db.payments)).toBe(0);
    expect(() =>
      addPaymentM(db, "ord-mag-lis-1", { ...paymentBase, amount: 10 }),
    ).toThrow(/soldée/);
  });

  it("refuse un règlement nul ou négatif", () => {
    expect(() =>
      addPaymentM(db, "ord-mag-her-1", { ...paymentBase, amount: 0 }),
    ).toThrow(BusinessError);
    expect(() =>
      addPaymentM(db, "ord-mag-her-1", { ...paymentBase, amount: -50 }),
    ).toThrow(BusinessError);
  });

  it("accepte un règlement égal au RAP et solde la commande", () => {
    addPaymentM(db, "ord-mag-her-1", { ...paymentBase, amount: 1324 });
    const order = db.orders.find((o) => o.id === "ord-mag-her-1")!;
    expect(orderRap(order, db.orderLines, db.payments)).toBe(0);
  });

  it("calcule en centimes sans erreur de flottants", () => {
    expect(addAmounts(0.1, 0.2)).toBe(0.3);
  });

  it("calcule le RAP global commande par commande (jamais net d'un trop-perçu)", () => {
    // Trop-perçu artificiel de 10 000 € sur une commande soldée.
    db.payments.push({
      id: "pay-test-overpaid",
      orderId: "ord-mag-lis-1",
      amount: 10000,
      date: new Date().toISOString(),
      method: "virement",
    });
    const before = globalRap(db.orders, db);
    // Le trop-perçu ne doit PAS réduire le RAP des autres commandes :
    // le RAP global reste la somme des RAP positifs.
    const naive =
      before -
      db.orders
        .filter((o) => o.status !== "annulee")
        .reduce((s, o) => s + orderRap(o, db.orderLines, db.payments), 0);
    expect(naive).toBeGreaterThan(0); // le calcul naïf serait bien inférieur
    expect(before).toBeGreaterThan(0);
    const her = db.orders.find((o) => o.id === "ord-mag-her-1")!;
    expect(before).toBeGreaterThanOrEqual(
      orderRap(her, db.orderLines, db.payments),
    );
  });
});

describe("Annulation avec validation humaine", () => {
  it("crée une demande d'annulation sans annuler la commande", () => {
    requestOrderCancellationM(db, "ord-mag-her-1", "Sarah Delcourt");
    const order = db.orders.find((o) => o.id === "ord-mag-her-1")!;
    expect(order.status).toBe("ouverte");
    const request = db.approvalRequests.find(
      (r) => r.type === "annulation_commande" && r.relatedOrderId === "ord-mag-her-1",
    );
    expect(request).toBeDefined();
    expect(request!.status).toBe("en_attente");
    expect(request!.requestedBy).toBe("Sarah Delcourt");
    expect(request!.financialImpact).toBe(500);
  });

  it("empêche deux demandes actives pour la même commande", () => {
    requestOrderCancellationM(db, "ord-mag-her-1");
    expect(() => requestOrderCancellationM(db, "ord-mag-her-1")).toThrow(
      /déjà en attente/,
    );
  });

  it("valide une annulation : commande annulée, règlements conservés, alerte financière", () => {
    requestOrderCancellationM(db, "ord-mag-her-1");
    const request = db.approvalRequests.find(
      (r) => r.type === "annulation_commande" && r.relatedOrderId === "ord-mag-her-1",
    )!;
    const paymentsBefore = db.payments.filter(
      (p) => p.orderId === "ord-mag-her-1",
    ).length;

    decideApprovalM(db, request.id, true, "Julie Mancini");

    const order = db.orders.find((o) => o.id === "ord-mag-her-1")!;
    expect(order.status).toBe("annulee");
    // Les règlements existants ne sont jamais effacés.
    expect(db.payments.filter((p) => p.orderId === "ord-mag-her-1")).toHaveLength(
      paymentsBefore,
    );
    // Alerte financière dérivée : remboursement ou avoir à traiter (500 €).
    const alerts = refundAlerts(db);
    expect(alerts.some((a) => a.order.id === "ord-mag-her-1" && a.amount === 500)).toBe(
      true,
    );
    expect(
      db.activityLog.some(
        (l) =>
          l.action === "Alerte financière" &&
          l.details?.includes("Remboursement ou avoir à traiter"),
      ),
    ).toBe(true);
  });

  it("refuse une annulation : commande intacte, refus et motif dans l'historique", () => {
    requestOrderCancellationM(db, "ord-mag-her-1");
    const request = db.approvalRequests.find(
      (r) => r.type === "annulation_commande" && r.relatedOrderId === "ord-mag-her-1",
    )!;
    decideApprovalM(db, request.id, false, "Julie Mancini", "Client a changé d'avis");

    const order = db.orders.find((o) => o.id === "ord-mag-her-1")!;
    expect(order.status).toBe("ouverte");
    expect(request.status).toBe("refusee");
    expect(request.decisionReason).toBe("Client a changé d'avis");
    expect(
      db.activityLog.some(
        (l) =>
          l.action === "Demande refusée" &&
          l.details?.includes("Client a changé d'avis"),
      ),
    ).toBe(true);
  });

  it("une demande déjà traitée ne peut pas être re-décidée", () => {
    requestOrderCancellationM(db, "ord-mag-her-1");
    const request = db.approvalRequests.find(
      (r) => r.type === "annulation_commande" && r.relatedOrderId === "ord-mag-her-1",
    )!;
    decideApprovalM(db, request.id, false, "Julie Mancini");
    expect(() => decideApprovalM(db, request.id, true, "X")).toThrow(/déjà été traitée/);
  });
});

describe("Relances fournisseurs", () => {
  // line-her1-2 : chaises Vera indisponibles, dans la file des relances.
  it("toujours indisponible : reste dans la file, prochain lundi programmé", () => {
    markReminderDoneM(db, "line-her1-2", "indisponible", "Myriam Costa");
    const line = db.orderLines.find((l) => l.id === "line-her1-2")!;
    expect(line.procurementStatus).toBe("indisponible");
    expect(line.nextReminderAt).toBeDefined();
    expect(new Date(line.nextReminderAt!).getDay()).toBe(1); // lundi
    expect(
      computeReminders(db).some((r) => r.line.id === "line-her1-2"),
    ).toBe(true);
    expect(
      db.activityLog.some((l) => l.action === "Relance fournisseur effectuée"),
    ).toBe(true);
  });

  it("article disponible : sort des relances, passe en attente de validation", () => {
    markReminderDoneM(db, "line-her1-2", "disponible", "Myriam Costa");
    const line = db.orderLines.find((l) => l.id === "line-her1-2")!;
    expect(line.procurementStatus).toBe("en_attente_validation");
    expect(line.nextReminderAt).toBeUndefined();
    // Retiré de la file des relances.
    expect(
      computeReminders(db).some((r) => r.line.id === "line-her1-2"),
    ).toBe(false);
  });

  it("article disponible : crée automatiquement une proposition d'achat à valider", () => {
    const soCountBefore = db.supplierOrders.length;
    markReminderDoneM(db, "line-her1-2", "disponible", "Myriam Costa");
    const line = db.orderLines.find((l) => l.id === "line-her1-2")!;
    expect(db.supplierOrders).toHaveLength(soCountBefore + 1);
    const so = db.supplierOrders.find((o) => o.id === line.supplierOrderId)!;
    expect(so.status).toBe("en_attente_validation");
    expect(so.supplierId).toBe("sup-eleonora"); // fournisseur concerné
    expect(so.lines.some((l) => l.orderLineId === "line-her1-2")).toBe(true);
    // Demande de validation humaine associée.
    expect(
      db.approvalRequests.some(
        (r) => r.relatedSupplierOrderId === so.id && r.status === "en_attente",
      ),
    ).toBe(true);
  });
});

describe("Arrivages et étapes logistiques", () => {
  // shp-1 : SM → Argenteuil (reçu) → affrètement → Aubagne (en transit) → client (programmé)
  it("réception partielle : statut global et étape « Reçue partiellement »", () => {
    receiveShipmentM(db, "shp-1", [
      { itemId: "shi-1", quantityReceived: 1 },
      { itemId: "shi-2", quantityReceived: 1 }, // 1 sur 2
    ]);
    const shipment = db.shipments.find((s) => s.id === "shp-1")!;
    expect(shipment.status).toBe("recu_partiellement");
    const receivingLeg = shipment.legs.find((l) => l.id === "leg-1b")!;
    expect(receivingLeg.status).toBe("recu_partiellement");
    // L'étape suivante (Aubagne → client) n'est pas modifiée.
    expect(shipment.legs.find((l) => l.id === "leg-1c")!.status).toBe("programme");
  });

  it("réception complète : transport reçu, étape reçue, étape suivante inchangée", () => {
    receiveShipmentM(db, "shp-1", [
      { itemId: "shi-1", quantityReceived: 1 },
      { itemId: "shi-2", quantityReceived: 2 },
    ]);
    const shipment = db.shipments.find((s) => s.id === "shp-1")!;
    expect(shipment.status).toBe("recu");
    expect(shipment.legs.find((l) => l.id === "leg-1b")!.status).toBe("recu");
    expect(shipment.legs.find((l) => l.id === "leg-1a")!.status).toBe("recu");
    expect(shipment.legs.find((l) => l.id === "leg-1c")!.status).toBe("programme");
    // Les lignes clients concernées passent en « Reçu au dépôt ».
    expect(
      db.orderLines.find((l) => l.id === "line-aub1-1")!.procurementStatus,
    ).toBe("recu_depot");
  });
});

describe("Commande magasin et catalogue", () => {
  const baseOrder = {
    storeId: "store-her",
    salespersonId: "sp-sarah",
    orderedAt: new Date().toISOString(),
    customer: { name: "Client Test", phone: "06 00 00 00 99" },
    fulfillmentMode: "retrait_magasin" as const,
    deliveryFee: 0,
    discount: 0,
    payments: [],
  };

  it("crée une ligne rattachée au catalogue (produit + variante)", () => {
    const order = createStoreOrderM(db, {
      ...baseOrder,
      lines: [
        {
          productId: "prod-vera",
          variantId: "var-vera-taupe",
          offCatalog: false,
          productName: "Chaise Vera",
          variant: "Velours taupe",
          reference: "ELE-VERA-TP",
          quantity: 4,
          unitPrice: 129,
          discount: 0,
          supplierId: "sup-eleonora",
        },
      ],
    });
    const line = db.orderLines.find((l) => l.orderId === order.id)!;
    expect(line.productId).toBe("prod-vera");
    expect(line.variantId).toBe("var-vera-taupe");
    expect(line.offCatalog).toBeUndefined();
    expect(order.reference).toMatch(/^MAG-HER-\d{4}-\d{4}$/);
  });

  it("crée une ligne hors catalogue clairement marquée", () => {
    const order = createStoreOrderM(db, {
      ...baseOrder,
      lines: [
        {
          offCatalog: true,
          productName: "Produit sur mesure",
          quantity: 1,
          unitPrice: 250,
          discount: 0,
        },
      ],
    });
    const line = db.orderLines.find((l) => l.orderId === order.id)!;
    expect(line.offCatalog).toBe(true);
    expect(line.productId).toBeUndefined();
  });

  it("refuse une vendeuse/un vendeur manquant", () => {
    expect(() =>
      createStoreOrderM(db, {
        ...baseOrder,
        salespersonId: "",
        lines: [
          { offCatalog: true, productName: "X", quantity: 1, unitPrice: 10, discount: 0 },
        ],
      }),
    ).toThrow(/obligatoire/);
  });

  it("refuse des règlements initiaux dépassant le total", () => {
    expect(() =>
      createStoreOrderM(db, {
        ...baseOrder,
        payments: [{ amount: 999, date: new Date().toISOString(), method: "especes" }],
        lines: [
          { offCatalog: true, productName: "X", quantity: 1, unitPrice: 10, discount: 0 },
        ],
      }),
    ).toThrow(/dépasse le total/);
  });
});

describe("Référentiel magasins / dépôts", () => {
  it("sépare strictement Herblay (magasin) et Argenteuil (dépôt)", () => {
    // Herblay est un magasin, jamais un dépôt.
    expect(db.stores.some((s) => s.city === "Herblay")).toBe(true);
    expect(db.warehouses.some((w) => w.city === "Herblay")).toBe(false);
    // Argenteuil est un dépôt, jamais un magasin.
    expect(db.warehouses.some((w) => w.city === "Argenteuil")).toBe(true);
    expect(db.stores.some((s) => s.city === "Argenteuil")).toBe(false);
    // Le rattachement logistique existe sans fusion des entités.
    const arg = db.warehouses.find((w) => w.id === "wh-arg")!;
    expect(arg.linkedStoreIds).toContain("store-her");
    expect(arg.id).not.toBe("store-her");
  });

  it("Aubagne garde son alias historique « Marseille » pour les futurs imports", () => {
    const aubagne = db.stores.find((s) => s.code === "AUB")!;
    expect(aubagne.name).toContain("Aubagne");
    expect(aubagne.aliases).toContain("Marseille");
  });
});

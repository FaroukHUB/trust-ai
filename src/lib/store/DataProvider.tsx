"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { repository } from "../repository";
import { nextMonday, todayIso } from "../format";
import type {
  ActivityLog,
  Customer,
  Database,
  Order,
  OrderLine,
  Payment,
  ProcurementStatus,
} from "../types";

/** Générateur d'identifiants stables pour la démo. */
function uid(prefix: string): string {
  const rand =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID().slice(0, 8)
      : Math.random().toString(36).slice(2, 10);
  return `${prefix}-${rand}`;
}

export interface NewOrderLineInput {
  productName: string;
  variant?: string;
  reference?: string;
  quantity: number;
  unitPrice: number;
  discount: number;
  supplierId?: string;
  altSupplierId?: string;
  destinationWarehouseId?: string;
  comments?: string;
}

export interface NewPaymentInput {
  amount: number;
  date: string;
  method: Payment["method"];
  salespersonId?: string;
  storeId?: string;
  comment?: string;
}

export interface NewStoreOrderInput {
  storeId: string;
  salespersonId: string;
  orderedAt: string;
  desiredAt?: string;
  customer: Omit<Customer, "id">;
  fulfillmentMode: Order["fulfillmentMode"];
  deliveryFee: number;
  discount: number;
  acquisitionSource?: Order["acquisitionSource"];
  notes?: string;
  lines: NewOrderLineInput[];
  payments: NewPaymentInput[];
}

interface DataContextValue {
  /** null tant que l'hydratation client n'est pas terminée. */
  db: Database | null;
  /** Filtre global par magasin ("all" = tous les magasins). */
  storeFilter: string;
  setStoreFilter: (storeId: string) => void;
  createStoreOrder: (input: NewStoreOrderInput) => Order;
  addPayment: (orderId: string, payment: NewPaymentInput) => void;
  markReminderDone: (
    lineId: string,
    outcome: "indisponible" | "disponible",
    actor?: string,
  ) => void;
  prepareSupplierOrder: (supplierId: string, lineIds: string[]) => void;
  decideApproval: (requestId: string, approved: boolean, actor: string) => void;
  requestOrderCancellation: (orderId: string) => void;
  updateLineStatus: (lineId: string, status: ProcurementStatus) => void;
  receiveShipment: (
    shipmentId: string,
    receipts: { itemId: string; quantityReceived: number }[],
  ) => void;
  resetDemo: () => void;
}

const DataContext = createContext<DataContextValue | null>(null);

export function DataProvider({ children }: { children: ReactNode }) {
  // db reste null pendant le rendu serveur et la première passe client :
  // cela évite tout écart d'hydratation entre le HTML serveur et le client.
  const [db, setDb] = useState<Database | null>(null);
  const [storeFilter, setStoreFilter] = useState<string>("all");
  const loaded = useRef(false);

  useEffect(() => {
    if (loaded.current) return;
    loaded.current = true;
    setDb(repository.load());
  }, []);

  // Toute mutation passe par ici : mise à jour de l'état puis persistance.
  const mutate = useCallback((fn: (draft: Database) => Database) => {
    setDb((current) => {
      if (!current) return current;
      const next = fn(structuredClone(current));
      repository.save(next);
      return next;
    });
  }, []);

  const log = useCallback(
    (
      draft: Database,
      entry: Omit<ActivityLog, "id" | "at"> & { at?: string },
    ) => {
      draft.activityLog.unshift({
        id: uid("log"),
        at: entry.at ?? new Date().toISOString(),
        actor: entry.actor,
        action: entry.action,
        details: entry.details,
        orderId: entry.orderId,
      });
    },
    [],
  );

  const createStoreOrder = useCallback(
    (input: NewStoreOrderInput): Order => {
      if (!db) {
        throw new Error("Données non chargées : impossible de créer la commande.");
      }
      const now = new Date().toISOString();
      const orderId = uid("ord");

      // La référence est calculée avant la mutation pour pouvoir être
      // retournée de manière fiable à l'appelant (redirection vers la fiche).
      const store = db.stores.find((s) => s.id === input.storeId);
      const code = store?.code ?? "MAG";
      const year = new Date().getFullYear();
      const prefix = `MAG-${code}-${year}-`;
      const seq =
        db.orders
          .filter((o) => o.reference.startsWith(prefix))
          .map((o) => parseInt(o.reference.slice(prefix.length), 10))
          .filter((n) => !Number.isNaN(n))
          .reduce((max, n) => Math.max(max, n), 0) + 1;
      const reference = `${prefix}${String(seq).padStart(4, "0")}`;

      const customer: Customer = { id: uid("cus"), ...input.customer };
      const order: Order = {
        id: orderId,
        reference,
        origin: "MAGASIN",
        storeId: input.storeId,
        salespersonId: input.salespersonId,
        customerId: customer.id,
        orderedAt: input.orderedAt,
        desiredAt: input.desiredAt,
        fulfillmentMode: input.fulfillmentMode,
        deliveryStatus: "a_planifier",
        deliveryFee: input.deliveryFee,
        discount: input.discount,
        acquisitionSource: input.acquisitionSource,
        status: "ouverte",
        notes: input.notes,
        createdAt: now,
      };

      mutate((draft) => {
        draft.customers.push(customer);
        draft.orders.push(order);

        for (const line of input.lines) {
          const newLine: OrderLine = {
            id: uid("line"),
            orderId,
            productName: line.productName,
            variant: line.variant || undefined,
            reference: line.reference || undefined,
            quantity: line.quantity,
            unitPrice: line.unitPrice,
            discount: line.discount,
            supplierId: line.supplierId || undefined,
            altSupplierId: line.altSupplierId || undefined,
            procurementStatus: "a_verifier",
            destinationWarehouseId: line.destinationWarehouseId || undefined,
            comments: line.comments || undefined,
          };
          draft.orderLines.push(newLine);
        }

        for (const payment of input.payments) {
          draft.payments.push({
            id: uid("pay"),
            orderId,
            amount: payment.amount,
            date: payment.date,
            method: payment.method,
            storeId: input.storeId,
            salespersonId: payment.salespersonId ?? input.salespersonId,
            comment: payment.comment,
          });
        }

        if (input.acquisitionSource) {
          draft.acquisitionJourneys.push({
            id: uid("acq"),
            orderId,
            source: input.acquisitionSource,
            newCustomer: true,
          });
        }

        const salesperson = draft.salespeople.find(
          (s) => s.id === input.salespersonId,
        );
        log(draft, {
          actor: salesperson?.name ?? "Équipe magasin",
          action: "Commande créée",
          details: `${reference} — ${input.lines.length} article(s), saisie magasin.`,
          orderId,
        });
        return draft;
      });

      return order;
    },
    [db, mutate, log],
  );

  const addPayment = useCallback(
    (orderId: string, payment: NewPaymentInput) => {
      mutate((draft) => {
        const order = draft.orders.find((o) => o.id === orderId);
        if (!order) return draft;
        draft.payments.push({
          id: uid("pay"),
          orderId,
          amount: payment.amount,
          date: payment.date,
          method: payment.method,
          storeId: payment.storeId ?? order.storeId,
          salespersonId: payment.salespersonId ?? order.salespersonId,
          comment: payment.comment,
        });
        log(draft, {
          actor: "Équipe magasin",
          action: "Règlement enregistré",
          details: `${order.reference} — règlement de ${payment.amount.toLocaleString("fr-FR")} €.`,
          orderId,
        });
        return draft;
      });
    },
    [mutate, log],
  );

  const markReminderDone = useCallback(
    (
      lineId: string,
      outcome: "indisponible" | "disponible",
      actor = "Équipe achats",
    ) => {
      mutate((draft) => {
        const line = draft.orderLines.find((l) => l.id === lineId);
        if (!line) return draft;
        const order = draft.orders.find((o) => o.id === line.orderId);
        line.lastReminderAt = new Date().toISOString();
        if (outcome === "indisponible") {
          line.procurementStatus = "indisponible";
          line.nextReminderAt = nextMonday();
          log(draft, {
            actor,
            action: "Relance fournisseur effectuée",
            details: `${line.productName} toujours indisponible — prochaine relance programmée lundi prochain.`,
            orderId: order?.id,
          });
        } else {
          line.procurementStatus = "a_commander";
          line.nextReminderAt = undefined;
          log(draft, {
            actor,
            action: "Relance fournisseur effectuée",
            details: `${line.productName} de nouveau disponible — à commander.`,
            orderId: order?.id,
          });
        }
        return draft;
      });
    },
    [mutate, log],
  );

  const prepareSupplierOrder = useCallback(
    (supplierId: string, lineIds: string[]) => {
      mutate((draft) => {
        const supplier = draft.suppliers.find((s) => s.id === supplierId);
        if (!supplier) return draft;
        const year = new Date().getFullYear();
        const prefix = `FOU-${year}-`;
        const seq =
          draft.supplierOrders
            .map((o) =>
              o.reference.startsWith(prefix)
                ? parseInt(o.reference.slice(prefix.length), 10)
                : 0,
            )
            .filter((n) => !Number.isNaN(n))
            .reduce((max, n) => Math.max(max, n), 0) + 1;
        const reference = `${prefix}${String(seq).padStart(4, "0")}`;
        const soId = uid("so");

        const lines = draft.orderLines.filter((l) => lineIds.includes(l.id));
        draft.supplierOrders.push({
          id: soId,
          reference,
          supplierId,
          status: "en_attente_validation",
          lines: lines.map((l) => ({
            id: uid("sol"),
            orderLineId: l.id,
            productName: l.productName,
            variant: l.variant,
            supplierReference: l.reference,
            quantity: l.quantity,
          })),
          createdAt: new Date().toISOString(),
          notes: "Proposition préparée depuis la page Achats.",
        });
        for (const l of lines) {
          l.procurementStatus = "en_attente_validation";
          l.supplierOrderId = soId;
        }
        draft.approvalRequests.unshift({
          id: uid("apr"),
          type: "commande_fournisseur",
          title: `Valider la commande ${supplier.name} (${reference})`,
          description: `${lines.length} article(s) à commander chez ${supplier.name}. Aucun envoi réel ne sera effectué : la validation met simplement à jour le suivi.`,
          relatedSupplierOrderId: soId,
          status: "en_attente",
          createdAt: new Date().toISOString(),
        });
        log(draft, {
          actor: "TRUST AI",
          action: "Proposition de commande fournisseur",
          details: `${reference} (${supplier.name}) — en attente de validation humaine.`,
        });
        return draft;
      });
    },
    [mutate, log],
  );

  const decideApproval = useCallback(
    (requestId: string, approved: boolean, actor: string) => {
      mutate((draft) => {
        const request = draft.approvalRequests.find((r) => r.id === requestId);
        if (!request || request.status !== "en_attente") return draft;
        request.status = approved ? "approuvee" : "refusee";
        request.decidedAt = new Date().toISOString();
        request.decidedBy = actor;

        // Effets internes selon le type de demande (aucune action externe réelle).
        if (request.relatedSupplierOrderId) {
          const so = draft.supplierOrders.find(
            (o) => o.id === request.relatedSupplierOrderId,
          );
          if (so) {
            so.status = approved ? "validee" : "annulee";
            if (approved) {
              so.validatedAt = new Date().toISOString();
              so.validatedBy = actor;
            }
            for (const sol of so.lines) {
              const line = draft.orderLines.find(
                (l) => l.id === sol.orderLineId,
              );
              if (line) {
                line.procurementStatus = approved ? "commande" : "a_commander";
                if (!approved) line.supplierOrderId = undefined;
              }
            }
          }
        }
        if (request.type === "annulation_commande" && request.relatedOrderId) {
          const order = draft.orders.find(
            (o) => o.id === request.relatedOrderId,
          );
          if (order && approved) {
            order.status = "annulee";
            order.deliveryStatus = "annulee";
            for (const line of draft.orderLines.filter(
              (l) => l.orderId === order.id,
            )) {
              line.procurementStatus = "annule";
            }
          }
        }

        log(draft, {
          actor,
          action: approved ? "Demande approuvée" : "Demande refusée",
          details: request.title,
          orderId: request.relatedOrderId,
        });
        return draft;
      });
    },
    [mutate, log],
  );

  const requestOrderCancellation = useCallback(
    (orderId: string) => {
      mutate((draft) => {
        const order = draft.orders.find((o) => o.id === orderId);
        if (!order) return draft;
        const already = draft.approvalRequests.some(
          (r) =>
            r.type === "annulation_commande" &&
            r.relatedOrderId === orderId &&
            r.status === "en_attente",
        );
        if (already) return draft;
        draft.approvalRequests.unshift({
          id: uid("apr"),
          type: "annulation_commande",
          title: `Annuler la commande ${order.reference}`,
          description:
            "L'annulation d'une commande client est une décision importante : elle nécessite une validation humaine.",
          relatedOrderId: orderId,
          status: "en_attente",
          createdAt: new Date().toISOString(),
        });
        log(draft, {
          actor: "Équipe magasin",
          action: "Demande d'annulation créée",
          details: `${order.reference} — en attente de validation.`,
          orderId,
        });
        return draft;
      });
    },
    [mutate, log],
  );

  const updateLineStatus = useCallback(
    (lineId: string, status: ProcurementStatus) => {
      mutate((draft) => {
        const line = draft.orderLines.find((l) => l.id === lineId);
        if (!line) return draft;
        line.procurementStatus = status;
        if (status === "relance_due" && !line.nextReminderAt) {
          line.nextReminderAt = nextMonday();
        }
        return draft;
      });
    },
    [mutate],
  );

  const receiveShipment = useCallback(
    (
      shipmentId: string,
      receipts: { itemId: string; quantityReceived: number }[],
    ) => {
      mutate((draft) => {
        const shipment = draft.shipments.find((s) => s.id === shipmentId);
        if (!shipment) return draft;
        for (const receipt of receipts) {
          const item = shipment.items.find((i) => i.id === receipt.itemId);
          if (!item) continue;
          item.quantityReceived = Math.min(
            Math.max(0, receipt.quantityReceived),
            item.quantity,
          );
        }
        const complete = shipment.items.every(
          (i) => i.quantityReceived >= i.quantity,
        );
        const started = shipment.items.some((i) => i.quantityReceived > 0);
        shipment.status = complete
          ? "recu"
          : started
            ? "recu_partiellement"
            : shipment.status;
        if (started) shipment.actualAt = new Date().toISOString();

        // Les lignes de commande entièrement reçues passent en "Reçu au dépôt".
        for (const item of shipment.items) {
          if (!item.orderLineId) continue;
          const line = draft.orderLines.find((l) => l.id === item.orderLineId);
          if (line && item.quantityReceived >= item.quantity) {
            line.procurementStatus = "recu_depot";
          }
        }
        log(draft, {
          actor: "Équipe dépôt",
          action: complete ? "Arrivage reçu" : "Réception partielle",
          details: `${shipment.reference} — ${shipment.destinationLabel}.`,
        });
        return draft;
      });
    },
    [mutate, log],
  );

  const resetDemo = useCallback(() => {
    const fresh = repository.reset();
    setDb(fresh);
  }, []);

  const value = useMemo<DataContextValue>(
    () => ({
      db,
      storeFilter,
      setStoreFilter,
      createStoreOrder,
      addPayment,
      markReminderDone,
      prepareSupplierOrder,
      decideApproval,
      requestOrderCancellation,
      updateLineStatus,
      receiveShipment,
      resetDemo,
    }),
    [
      db,
      storeFilter,
      createStoreOrder,
      addPayment,
      markReminderDone,
      prepareSupplierOrder,
      decideApproval,
      requestOrderCancellation,
      updateLineStatus,
      receiveShipment,
      resetDemo,
    ],
  );

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export function useData(): DataContextValue {
  const ctx = useContext(DataContext);
  if (!ctx) {
    throw new Error("useData doit être utilisé dans un <DataProvider>.");
  }
  return ctx;
}

/** Date du jour (yyyy-mm-dd) pour préremplir les formulaires. */
export { todayIso };

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
import { todayIso } from "../format";
import {
  addPaymentM,
  createStoreOrderM,
  decideApprovalM,
  markReminderDoneM,
  prepareSupplierOrderM,
  receiveShipmentM,
  requestOrderCancellationM,
  updateLineStatusM,
  type NewStoreOrderInput,
  type PaymentInput,
} from "../mutations";
import type { Database, Order, ProcurementStatus } from "../types";

export type { NewStoreOrderInput, NewOrderLineInput, PaymentInput } from "../mutations";
export { BusinessError } from "../mutations";

interface DataContextValue {
  /** null tant que l'hydratation client n'est pas terminée. */
  db: Database | null;
  /** Filtre global par magasin ("all" = tous les magasins). */
  storeFilter: string;
  setStoreFilter: (storeId: string) => void;
  createStoreOrder: (input: NewStoreOrderInput) => Order;
  addPayment: (orderId: string, payment: PaymentInput) => void;
  markReminderDone: (
    lineId: string,
    outcome: "indisponible" | "disponible",
    actor?: string,
  ) => void;
  prepareSupplierOrder: (supplierId: string, lineIds: string[]) => void;
  decideApproval: (
    requestId: string,
    approved: boolean,
    actor: string,
    reason?: string,
  ) => void;
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
  // Référence synchone vers l'état courant : permet aux mutations de
  // valider les règles métier sur des données à jour et de lever des
  // erreurs AVANT tout setState (les erreurs remontent à l'appelant).
  const dbRef = useRef<Database | null>(null);
  const loaded = useRef(false);

  useEffect(() => {
    if (loaded.current) return;
    loaded.current = true;
    const initial = repository.load();
    dbRef.current = initial;
    setDb(initial);
  }, []);

  /**
   * Applique une mutation métier pure sur un clone de la base, puis
   * persiste et met à jour l'état. Si la mutation lève une BusinessError,
   * rien n'est modifié et l'erreur remonte au composant appelant.
   */
  const apply = useCallback(<T,>(fn: (draft: Database) => T): T => {
    const current = dbRef.current;
    if (!current) {
      throw new Error("Données non chargées : réessayez dans un instant.");
    }
    const draft = structuredClone(current);
    const result = fn(draft); // peut lever une BusinessError → aucun effet
    dbRef.current = draft;
    repository.save(draft);
    setDb(draft);
    return result;
  }, []);

  const createStoreOrder = useCallback(
    (input: NewStoreOrderInput): Order => apply((d) => createStoreOrderM(d, input)),
    [apply],
  );

  const addPayment = useCallback(
    (orderId: string, payment: PaymentInput) => {
      apply((d) => addPaymentM(d, orderId, payment));
    },
    [apply],
  );

  const markReminderDone = useCallback(
    (
      lineId: string,
      outcome: "indisponible" | "disponible",
      actor = "Équipe achats",
    ) => {
      apply((d) => markReminderDoneM(d, lineId, outcome, actor));
    },
    [apply],
  );

  const prepareSupplierOrder = useCallback(
    (supplierId: string, lineIds: string[]) => {
      apply((d) => prepareSupplierOrderM(d, supplierId, lineIds, "Équipe achats"));
    },
    [apply],
  );

  const decideApproval = useCallback(
    (requestId: string, approved: boolean, actor: string, reason?: string) => {
      apply((d) => decideApprovalM(d, requestId, approved, actor, reason));
    },
    [apply],
  );

  const requestOrderCancellation = useCallback(
    (orderId: string) => {
      apply((d) => requestOrderCancellationM(d, orderId));
    },
    [apply],
  );

  const updateLineStatus = useCallback(
    (lineId: string, status: ProcurementStatus) => {
      apply((d) => updateLineStatusM(d, lineId, status));
    },
    [apply],
  );

  const receiveShipment = useCallback(
    (
      shipmentId: string,
      receipts: { itemId: string; quantityReceived: number }[],
    ) => {
      apply((d) => receiveShipmentM(d, shipmentId, receipts));
    },
    [apply],
  );

  const resetDemo = useCallback(() => {
    const fresh = repository.reset();
    dbRef.current = fresh;
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

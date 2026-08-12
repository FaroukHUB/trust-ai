import type {
  Database,
  Order,
  OrderLine,
  Payment,
  PaymentStatus,
  ProcurementStatus,
} from "./types";

/** Total d'une ligne : quantité × prix unitaire − remise de ligne. */
export function lineTotal(line: OrderLine): number {
  return line.quantity * line.unitPrice - (line.discount || 0);
}

/** Total d'une commande : somme des lignes − remise globale + frais de livraison. */
export function orderTotal(order: Order, lines: OrderLine[]): number {
  const items = lines
    .filter((l) => l.orderId === order.id && l.procurementStatus !== "annule")
    .reduce((sum, l) => sum + lineTotal(l), 0);
  return items - (order.discount || 0) + (order.deliveryFee || 0);
}

/** Total encaissé (les remboursements sont des montants négatifs). */
export function orderPaid(order: Order, payments: Payment[]): number {
  return payments
    .filter((p) => p.orderId === order.id)
    .reduce((sum, p) => sum + p.amount, 0);
}

/** RAP = reste à payer = total de la commande − total des règlements encaissés. */
export function orderRap(
  order: Order,
  lines: OrderLine[],
  payments: Payment[],
): number {
  return round2(orderTotal(order, lines) - orderPaid(order, payments));
}

/** Statut de paiement, toujours calculé à partir du total et des règlements. */
export function orderPaymentStatus(
  order: Order,
  lines: OrderLine[],
  payments: Payment[],
): PaymentStatus {
  const total = orderTotal(order, lines);
  const paid = orderPaid(order, payments);
  if (order.status === "annulee" && paid <= 0) return "rembourse";
  if (paid <= 0) return "a_payer";
  if (paid + 0.005 >= total) return "paye";
  return "partiellement_paye";
}

export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Statuts d'approvisionnement qui alimentent la file des relances du lundi. */
export const REMINDER_STATUSES: ProcurementStatus[] = [
  "a_commander",
  "indisponible",
  "relance_due",
];

export interface ReminderItem {
  line: OrderLine;
  order: Order;
  overdueDays: number;
}

/** File des relances du lundi, calculée depuis les lignes de commande. */
export function computeReminders(db: Database): ReminderItem[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const items: ReminderItem[] = [];
  for (const line of db.orderLines) {
    if (!REMINDER_STATUSES.includes(line.procurementStatus)) continue;
    const order = db.orders.find((o) => o.id === line.orderId);
    if (!order || order.status === "annulee") continue;
    let overdueDays = 0;
    if (line.nextReminderAt) {
      const next = new Date(line.nextReminderAt);
      next.setHours(0, 0, 0, 0);
      overdueDays = Math.floor(
        (today.getTime() - next.getTime()) / (1000 * 60 * 60 * 24),
      );
    }
    items.push({ line, order, overdueDays });
  }
  return items.sort((a, b) => b.overdueDays - a.overdueDays);
}

/** Avancement d'une commande : part des lignes reçues ou disponibles. */
export function orderProgress(order: Order, lines: OrderLine[]): number {
  const active = lines.filter(
    (l) => l.orderId === order.id && l.procurementStatus !== "annule",
  );
  if (active.length === 0) return 0;
  const done = active.filter((l) =>
    ["stock_local", "recu_depot"].includes(l.procurementStatus),
  ).length;
  return Math.round((done / active.length) * 100);
}

export function linesOfOrder(db: Database, orderId: string): OrderLine[] {
  return db.orderLines.filter((l) => l.orderId === orderId);
}

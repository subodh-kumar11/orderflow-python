export const statuses = [
  "PENDING",
  "PROCESSING",
  "SHIPPED",
  "DELIVERED",
  "CANCELLED",
] as const;
export type Status = (typeof statuses)[number];
export type Item = { product_id: string; quantity: number; unit_price: string };
export type Order = {
  id: string;
  customer_id: string;
  status: Status;
  total: string;
  currency: string;
  items: Item[];
  version: number;
  created_at: string;
  updated_at: string;
};
export type Page = {
  orders: Order[];
  total: number;
  offset: number;
  limit: number;
  parser?: "rules" | "ai";
  filters?: Record<string, unknown>;
};
export type Summary = {
  total_orders: number;
  active_value: string;
  counts: Record<Status, number>;
};
export const labels: Record<Status, string> = {
  PENDING: "Pending",
  PROCESSING: "Processing",
  SHIPPED: "Shipped",
  DELIVERED: "Delivered",
  CANCELLED: "Cancelled",
};
export const nextStatus: Partial<Record<Status, Status>> = {
  PENDING: "PROCESSING",
  PROCESSING: "SHIPPED",
  SHIPPED: "DELIVERED",
};
export const money = (value: string) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(
    Number(value),
  );
export const dateTime = (value: string) =>
  new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
export async function request<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const response = await fetch(path, {
    ...options,
    headers: { "Content-Type": "application/json", ...options.headers },
  });
  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as {
      detail?: string;
    };
    throw new Error(
      body.detail || `Request failed (${response.status}). Please retry.`,
    );
  }
  return response.json() as Promise<T>;
}

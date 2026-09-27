import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import { Plus, X, Trash2, ArrowUpRight } from "lucide-react";
import { request } from "./api";
import type { Item, Order } from "./api";

export default function CreateOrder({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (order: Order) => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [customer, setCustomer] = useState("");
  const [items, setItems] = useState<Item[]>([
    { product_id: "", quantity: 1, unit_price: "" },
  ]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    dialog.current?.showModal();
  }, []);
  function edit(index: number, field: keyof Item, value: string) {
    setItems(
      items.map((item, i) =>
        i === index
          ? { ...item, [field]: field === "quantity" ? Number(value) : value }
          : item,
      ),
    );
  }
  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    setBusy(true);
    try {
      onCreated(
        await request<Order>("/api/orders", {
          method: "POST",
          body: JSON.stringify({ customer_id: customer, items }),
        }),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not create order");
    } finally {
      setBusy(false);
    }
  }
  const total =
    items.reduce(
      (sum, item) =>
        sum + Math.round(Number(item.unit_price || 0) * 100) * item.quantity,
      0,
    ) / 100;
  return (
    <dialog
      ref={dialog}
      className="create-dialog"
      onCancel={(event) => {
        event.preventDefault();
        if (!busy) onClose();
      }}
      aria-labelledby="create-title"
    >
      <form onSubmit={(event) => void submit(event)}>
        <div className="dialog-header">
          <div>
            <span className="eyebrow">START SOMETHING GOOD</span>
            <h2 id="create-title">New order</h2>
          </div>
          <button
            type="button"
            className="icon-btn"
            aria-label="Close new order"
            disabled={busy}
            onClick={onClose}
          >
            <X size={22} />
          </button>
        </div>
        <p className="muted">
          Add a customer and their items. We'll take it from here.
        </p>
        <label className="field">
          Customer ID
          <input
            autoFocus
            required
            maxLength={100}
            value={customer}
            onChange={(e) => setCustomer(e.target.value)}
            placeholder="e.g. customer-alice"
          />
        </label>
        <div className="section-label">
          ORDER ITEMS <span>{items.length} / 100</span>
        </div>
        {items.map((item, index) => (
          <div className="item-row" key={index}>
            <label className="field">
              Product ID
              <input
                aria-label={`Product ${index + 1}`}
                required
                maxLength={100}
                value={item.product_id}
                placeholder="e.g. canvas-tote"
                onChange={(e) => edit(index, "product_id", e.target.value)}
              />
            </label>
            <label className="field quantity">
              Qty
              <input
                aria-label={`Quantity ${index + 1}`}
                type="number"
                required
                min={1}
                max={10000}
                step={1}
                value={item.quantity}
                onChange={(e) => edit(index, "quantity", e.target.value)}
              />
            </label>
            <label className="field price">
              Unit price ($)
              <input
                aria-label={`Price ${index + 1}`}
                type="number"
                required
                min="0.01"
                max="1000000"
                step="0.01"
                value={item.unit_price}
                onChange={(e) => edit(index, "unit_price", e.target.value)}
              />
            </label>
            <button
              className="icon-btn item-remove"
              type="button"
              disabled={items.length === 1 || busy}
              aria-label={`Remove item ${index + 1}`}
              onClick={() => setItems(items.filter((_, i) => i !== index))}
            >
              <Trash2 size={17} />
            </button>
          </div>
        ))}
        <button
          type="button"
          className="text-btn"
          disabled={items.length >= 100 || busy}
          onClick={() =>
            setItems([
              ...items,
              { product_id: "", quantity: 1, unit_price: "" },
            ])
          }
        >
          <Plus size={16} /> Add another item
        </button>
        <div className="order-total">
          <span>
            Order total <small>USD</small>
          </span>
          <strong>${total.toFixed(2)}</strong>
        </div>
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        <div className="dialog-footer">
          <button
            type="button"
            className="secondary"
            disabled={busy}
            onClick={onClose}
          >
            Discard
          </button>
          <button className="primary" disabled={busy}>
            {busy ? "Creating…" : "Create order"}
            <ArrowUpRight size={17} />
          </button>
        </div>
      </form>
    </dialog>
  );
}

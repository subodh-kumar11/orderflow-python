import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import CreateOrder from "./CreateOrder";

it("adds and removes order lines", () => {
  render(<CreateOrder onClose={() => {}} onCreated={() => {}} />);
  fireEvent.click(screen.getByText("Add another item"));
  expect(screen.getByLabelText("Product 2")).toBeInTheDocument();
  fireEvent.click(screen.getByLabelText("Remove item 2"));
  expect(screen.queryByLabelText("Product 2")).not.toBeInTheDocument();
});
it("previews a multi-item total", () => {
  render(<CreateOrder onClose={() => {}} onCreated={() => {}} />);
  fireEvent.change(screen.getByLabelText("Price 1"), {
    target: { value: "12.50" },
  });
  fireEvent.change(screen.getByLabelText("Quantity 1"), {
    target: { value: "2" },
  });
  expect(screen.getByText("$25.00")).toBeInTheDocument();
});
it("submits order values and calls onCreated", async () => {
  const result = { id: "abc" };
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({ ok: true, json: async () => result }),
  );
  const created = vi.fn();
  render(<CreateOrder onClose={() => {}} onCreated={created} />);
  fireEvent.change(screen.getByLabelText("Customer ID"), {
    target: { value: "alice" },
  });
  fireEvent.change(screen.getByLabelText("Product 1"), {
    target: { value: "book" },
  });
  fireEvent.change(screen.getByLabelText("Price 1"), {
    target: { value: "12.50" },
  });
  fireEvent.click(screen.getByText("Create order"));
  await waitFor(() => expect(created).toHaveBeenCalledWith(result));
  expect(fetch).toHaveBeenCalledWith(
    "/api/orders",
    expect.objectContaining({
      method: "POST",
      body: JSON.stringify({
        customer_id: "alice",
        items: [{ product_id: "book", quantity: 1, unit_price: "12.50" }],
      }),
    }),
  );
});
it("keeps form data after server validation failure", async () => {
  vi.stubGlobal(
    "fetch",
    vi
      .fn()
      .mockResolvedValue({
        ok: false,
        status: 422,
        json: async () => ({ detail: "Duplicate product" }),
      }),
  );
  render(<CreateOrder onClose={() => {}} onCreated={() => {}} />);
  fireEvent.change(screen.getByLabelText("Customer ID"), {
    target: { value: "alice" },
  });
  fireEvent.change(screen.getByLabelText("Product 1"), {
    target: { value: "book" },
  });
  fireEvent.change(screen.getByLabelText("Price 1"), {
    target: { value: "2" },
  });
  fireEvent.click(screen.getByText("Create order"));
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "Duplicate product",
  );
  expect(screen.getByLabelText("Customer ID")).toHaveValue("alice");
});

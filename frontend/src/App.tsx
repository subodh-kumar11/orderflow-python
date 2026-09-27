import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  Check,
  CheckCheck,
  ChevronLeft,
  ChevronRight,
  CircleHelp,
  Clock3,
  Layers3,
  LayoutDashboard,
  Package,
  Plus,
  RefreshCw,
  Search,
  Sparkles,
  Truck,
  X,
} from "lucide-react";
import CreateOrder from "./CreateOrder";
import { dateTime, labels, money, nextStatus, request, statuses } from "./api";
import type { Order, Page, Status, Summary } from "./api";

const emptySummary: Summary = {
  total_orders: 0,
  active_value: "0",
  counts: { PENDING: 0, PROCESSING: 0, SHIPPED: 0, DELIVERED: 0, CANCELLED: 0 },
};
export default function App() {
  const [page, setPage] = useState<Page>({
    orders: [],
    total: 0,
    offset: 0,
    limit: 10,
  });
  const [summary, setSummary] = useState(emptySummary);
  const [status, setStatus] = useState<Status | "">("");
  const [offset, setOffset] = useState(0);
  const [query, setQuery] = useState("");
  const [search, setSearch] = useState("");
  const [ai, setAi] = useState(false);
  const [aiEnabled, setAiEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [creating, setCreating] = useState(false);
  const [selected, setSelected] = useState<Order | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [refresh, setRefresh] = useState(0);
  const [interval, setIntervalSeconds] = useState(300);
  const generation = useRef(0);
  const reload = useCallback(() => setRefresh((value) => value + 1), []);
  useEffect(() => {
    let disposed = false;
    const current = ++generation.current;
    setLoading(true);
    setError("");
    const endpoint = `/api/orders?limit=10&offset=${offset}${status ? `&status=${status}` : ""}`;
    const data = search
      ? request<Page>("/api/orders/search", {
          method: "POST",
          body: JSON.stringify({
            query: search,
            use_ai: ai,
            offset,
            limit: 10,
          }),
        })
      : request<Page>(endpoint);
    void Promise.all([
      data,
      request<Summary>("/api/orders/summary"),
      request<{ ai_enabled: boolean; processing_interval_seconds: number }>(
        "/api/config",
      ),
    ])
      .then(([result, totals, config]) => {
        if (!disposed && current === generation.current) {
          setPage(result);
          setSummary(totals);
          setAiEnabled(config.ai_enabled);
          setIntervalSeconds(config.processing_interval_seconds);
        }
      })
      .catch((e) => {
        if (!disposed)
          setError(e instanceof Error ? e.message : "Could not load orders");
      })
      .finally(() => {
        if (!disposed) setLoading(false);
      });
    return () => {
      disposed = true;
    };
  }, [status, offset, search, ai, refresh]);
  useEffect(() => {
    const timer = window.setInterval(reload, 30000);
    return () => window.clearInterval(timer);
  }, [reload]);
  async function openOrder(id: string) {
    setError("");
    setConfirmCancel(false);
    try {
      setSelected(await request<Order>(`/api/orders/${id}`));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load order");
    }
  }
  async function transition(target: Status) {
    if (!selected) return;
    setBusy(true);
    setError("");
    try {
      const order = await request<Order>(
        `/api/orders/${selected.id}${target === "CANCELLED" ? "/cancel" : "/status"}`,
        {
          method: target === "CANCELLED" ? "POST" : "PATCH",
          ...(target === "CANCELLED"
            ? {}
            : {
                body: JSON.stringify({
                  status: target,
                  expected_version: selected.version,
                }),
              }),
        },
      );
      setSelected(order);
      setConfirmCancel(false);
      setNotice(`Order ${labels[target].toLowerCase()} successfully.`);
      reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Update failed");
      void request<Order>(`/api/orders/${selected.id}`)
        .then(setSelected)
        .catch(() => {});
    } finally {
      setBusy(false);
    }
  }
  function chooseStatus(value: Status | "") {
    setStatus(value);
    setOffset(0);
    setSearch("");
    setQuery("");
  }
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a className="brand" href="/">
          <div className="brand-icon">
            <Layers3 size={23} />
          </div>
          orderflow<span>®</span>
        </a>
        <div className="workspace">
          <span className="workspace-avatar">S</span>
          <div>
            Store workspace<small>Order operations</small>
          </div>
          <span className="workspace-dot" />
        </div>
        <p className="nav-label">WORKSPACE</p>
        <button className="nav-item active" onClick={() => chooseStatus("")}>
          <LayoutDashboard size={18} /> Overview <span className="nav-dot" />
        </button>
        <button className="nav-item" onClick={() => chooseStatus("PENDING")}>
          <Package size={18} /> Pending orders{" "}
          <span className="nav-count">{summary.counts.PENDING}</span>
        </button>
        <a className="nav-item" href="/docs" target="_blank" rel="noreferrer">
          <BookOpen size={18} /> API reference <ArrowUpRight size={14} />
        </a>
        <div className="sidebar-note">
          <span className="note-icon">
            <Sparkles size={19} />
          </span>
          <h3>A little less busywork.</h3>
          <p>
            Pending orders move to processing automatically every{" "}
            {interval % 60 === 0
              ? `${interval / 60} minutes`
              : `${interval} seconds`}
            .
          </p>
          <div>
            <span className="green-dot" /> Scheduled processing
          </div>
        </div>
        <div className="sidebar-bottom">
          <CircleHelp size={17} />
          <span>Built for a smoother day.</span>
        </div>
      </aside>
      <main>
        <header className="topbar">
          <div>
            Workspace <ChevronRight size={14} />
            <strong>Overview</strong>
          </div>
          <div className="topbar-right">
            <span className="live">
              <span className="green-dot" /> Live workspace
            </span>
            <span className="avatar">SK</span>
          </div>
        </header>
        <div className="main-content">
          <section className="page-heading">
            <div>
              <span className="eyebrow">EVERY ORDER, IN GOOD HANDS</span>
              <h1>
                Order overview<span>.</span>
              </h1>
              <p>A clear view of what's moving, and what's next.</p>
            </div>
            <button className="primary" onClick={() => setCreating(true)}>
              <Plus size={18} /> New order
            </button>
          </section>
          <section className="stats" aria-label="Order statistics">
            <div className="stat-card">
              <div className="stat-top">
                <span>Total orders</span>
                <span className="stat-icon">
                  <Layers3 size={19} />
                </span>
              </div>
              <strong>{summary.total_orders.toLocaleString()}</strong>
              <p>
                All orders in your workspace <ArrowUpRight size={14} />
              </p>
            </div>
            <div className="stat-card">
              <div className="stat-top">
                <span>In progress</span>
                <span className="stat-icon amber">
                  <Clock3 size={19} />
                </span>
              </div>
              <strong>
                {summary.counts.PENDING + summary.counts.PROCESSING}
              </strong>
              <p>
                <span className="tiny-dot amber-bg" />
                {summary.counts.PENDING} waiting to be processed
              </p>
            </div>
            <div className="stat-card">
              <div className="stat-top">
                <span>On the way</span>
                <span className="stat-icon blue">
                  <Truck size={19} />
                </span>
              </div>
              <strong>{summary.counts.SHIPPED}</strong>
              <p>Shipped and heading to customers</p>
            </div>
            <div className="stat-card highlight">
              <div className="stat-top">
                <span>Order value</span>
                <span className="stat-icon">
                  <ArrowDownRight size={19} />
                </span>
              </div>
              <strong>{money(summary.active_value)}</strong>
              <p>
                Excludes cancelled orders <span className="currency">USD</span>
              </p>
            </div>
          </section>
          <section className="search-card">
            <div className="search-intro">
              <span className="sparkle-box">
                <Sparkles size={20} />
              </span>
              <div>
                <strong>Find it in your own words</strong>
                <p>Try “pending orders for alice over 20”</p>
              </div>
              <span className="beta">SMART SEARCH</span>
            </div>
            <form
              className="search-form"
              onSubmit={(e) => {
                e.preventDefault();
                setOffset(0);
                setStatus("");
                setSearch(query.trim());
              }}
            >
              <Search size={18} />
              <input
                aria-label="Search orders"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Ask about your orders…"
                maxLength={500}
              />
              <button
                className="search-submit"
                disabled={!query.trim() || loading}
              >
                Search <ArrowRight size={16} />
              </button>
            </form>
            <div className="search-hint">
              <span>
                Works without an API key · Status, customer, amount & date
              </span>
              {aiEnabled && (
                <label>
                  <input
                    type="checkbox"
                    checked={ai}
                    onChange={(e) => setAi(e.target.checked)}
                  />{" "}
                  Allow AI fallback (sends search text to provider)
                </label>
              )}
            </div>
          </section>
          {error && (
            <div className="error" role="alert">
              {error}
              <button className="text-btn" onClick={reload}>
                Retry
              </button>
            </div>
          )}
          {notice && (
            <div className="notice" role="status">
              <Check size={17} />
              {notice}
              <button
                aria-label="Dismiss notification"
                className="icon-btn"
                onClick={() => setNotice("")}
              >
                <X size={16} />
              </button>
            </div>
          )}
          <section className="orders-panel">
            <div className="orders-heading">
              <div>
                <h2>
                  All orders <span>{page.total}</span>
                </h2>
                <p>The details that keep your day moving.</p>
              </div>
              <button
                className="secondary refresh"
                onClick={reload}
                disabled={loading}
              >
                <RefreshCw size={15} className={loading ? "spin" : ""} />{" "}
                Refresh
              </button>
            </div>
            <div className="tabs" aria-label="Filter orders by status">
              <button
                className={!status ? "selected" : ""}
                onClick={() => chooseStatus("")}
              >
                All orders
              </button>
              {statuses.map((value) => (
                <button
                  key={value}
                  className={status === value ? "selected" : ""}
                  onClick={() => chooseStatus(value)}
                >
                  {labels[value]}
                  <span>{summary.counts[value]}</span>
                </button>
              ))}
            </div>
            {search && (
              <div className="search-result">
                Results for <strong>“{search}”</strong>
                <span>
                  {page.parser === "ai" ? "AI interpreted" : "Rule-based"}
                </span>
                <button
                  className="text-btn"
                  onClick={() => {
                    setSearch("");
                    setQuery("");
                    setOffset(0);
                  }}
                >
                  Clear search <X size={13} />
                </button>
              </div>
            )}
            <div className="table-wrap" aria-busy={loading}>
              <table>
                <thead>
                  <tr>
                    <th>ORDER</th>
                    <th>CUSTOMER</th>
                    <th>PLACED</th>
                    <th>ITEMS</th>
                    <th>AMOUNT</th>
                    <th>STATUS</th>
                    <th aria-label="View order" />
                  </tr>
                </thead>
                <tbody>
                  {!loading &&
                    !error &&
                    page.orders.map((order) => (
                      <tr key={order.id}>
                        <td>
                          <button
                            className="order-link"
                            onClick={() => void openOrder(order.id)}
                          >
                            #{order.id.slice(0, 8).toUpperCase()}
                          </button>
                        </td>
                        <td>
                          <span className="customer-cell">
                            <span className="customer-icon">
                              {order.customer_id.slice(0, 1).toUpperCase()}
                            </span>
                            {order.customer_id}
                          </span>
                        </td>
                        <td className="date-cell">
                          {new Date(order.created_at).toLocaleDateString(
                            "en-US",
                            { month: "short", day: "numeric", year: "numeric" },
                          )}
                        </td>
                        <td>
                          {order.items.reduce((n, i) => n + i.quantity, 0)}
                        </td>
                        <td className="amount-cell">{money(order.total)}</td>
                        <td>
                          <span
                            className={`badge ${order.status.toLowerCase()}`}
                          >
                            <span />
                            {labels[order.status]}
                          </span>
                        </td>
                        <td>
                          <button
                            className="icon-btn"
                            aria-label={`View order ${order.id}`}
                            onClick={() => void openOrder(order.id)}
                          >
                            <ArrowUpRight size={17} />
                          </button>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
              {loading ? (
                <div className="empty">
                  <RefreshCw className="spin" size={24} />
                  <p>Loading your workspace…</p>
                </div>
              ) : error ? (
                <div className="empty">
                  <p>Orders could not be loaded. Retry above.</p>
                </div>
              ) : (
                page.orders.length === 0 && (
                  <div className="empty">
                    <span className="empty-icon">
                      <Package size={30} />
                    </span>
                    <h3>
                      {search || status
                        ? "No matching orders"
                        : "Your next chapter starts here"}
                    </h3>
                    <p>
                      {search || status
                        ? "Try another search or status filter."
                        : "Create your first order. We’ll keep everything organized."}
                    </p>
                    <button
                      className="text-btn"
                      onClick={() => setCreating(true)}
                    >
                      Create an order <ArrowRight size={15} />
                    </button>
                  </div>
                )
              )}
            </div>
            <div className="table-footer">
              <span>
                {page.total === 0
                  ? "No orders yet"
                  : `Showing ${offset + 1}–${Math.min(offset + 10, page.total)} of ${page.total} orders`}
              </span>
              <div>
                <button
                  className="icon-btn"
                  aria-label="Previous page"
                  disabled={offset === 0 || loading}
                  onClick={() => setOffset(Math.max(0, offset - 10))}
                >
                  <ChevronLeft size={18} />
                </button>
                <span>{Math.floor(offset / 10) + 1}</span>
                <button
                  className="icon-btn"
                  aria-label="Next page"
                  disabled={offset + 10 >= page.total || loading}
                  onClick={() => setOffset(offset + 10)}
                >
                  <ChevronRight size={18} />
                </button>
              </div>
            </div>
          </section>
          <footer className="page-footer">
            <span>
              <CheckCheck size={15} /> A little order goes a long way.
            </span>
            <span>OrderFlow · Operations workspace</span>
          </footer>
        </div>
      </main>
      {creating && (
        <CreateOrder
          onClose={() => setCreating(false)}
          onCreated={(order) => {
            setCreating(false);
            setSelected(order);
            setNotice("Order created successfully.");
            chooseStatus("");
            reload();
          }}
        />
      )}
      {selected && (
        <div
          className="drawer-backdrop"
          onClick={() => {
            if (!busy) setSelected(null);
          }}
        >
          <aside
            className="detail-drawer"
            aria-label="Order details"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="dialog-header">
              <div>
                <span className="eyebrow">ORDER DETAILS</span>
                <h2>#{selected.id.slice(0, 8).toUpperCase()}</h2>
              </div>
              <button
                className="icon-btn"
                aria-label="Close order details"
                disabled={busy}
                onClick={() => setSelected(null)}
              >
                <X size={21} />
              </button>
            </div>
            <span className={`badge ${selected.status.toLowerCase()}`}>
              <span />
              {labels[selected.status]}
            </span>
            <dl>
              <dt>Customer</dt>
              <dd>{selected.customer_id}</dd>
              <dt>Placed</dt>
              <dd>{dateTime(selected.created_at)}</dd>
              <dt>Last updated</dt>
              <dd>{dateTime(selected.updated_at)}</dd>
            </dl>
            <h3>Items</h3>
            {selected.items.map((item) => (
              <div className="detail-item" key={item.product_id}>
                <span className="detail-item-icon">
                  <Package size={18} />
                </span>
                <div>
                  <strong>{item.product_id}</strong>
                  <small>
                    {item.quantity} × {money(item.unit_price)}
                  </small>
                </div>
                <strong>
                  {money((item.quantity * Number(item.unit_price)).toFixed(2))}
                </strong>
              </div>
            ))}
            <div className="order-total">
              <span>
                Total <small>USD</small>
              </span>
              <strong>{money(selected.total)}</strong>
            </div>
            <div className="detail-actions">
              {nextStatus[selected.status] && (
                <button
                  className="primary"
                  disabled={busy}
                  onClick={() => void transition(nextStatus[selected.status]!)}
                >
                  Mark {labels[nextStatus[selected.status]!].toLowerCase()}
                  <ArrowRight size={17} />
                </button>
              )}
              {selected.status === "PENDING" && (
                <button
                  className="danger-btn"
                  disabled={busy}
                  onClick={() => setConfirmCancel(true)}
                >
                  Cancel order
                </button>
              )}
              {!nextStatus[selected.status] && (
                <p className="muted">
                  This order is {labels[selected.status].toLowerCase()}. No
                  further changes are available.
                </p>
              )}
            </div>
            {confirmCancel && (
              <div
                className="cancel-confirm"
                role="alertdialog"
                aria-label="Confirm cancellation"
              >
                <strong>Cancel this order?</strong>
                <p>This action cannot be undone.</p>
                <button
                  className="danger-btn"
                  disabled={busy}
                  onClick={() => void transition("CANCELLED")}
                >
                  Yes, cancel order
                </button>
                <button
                  className="text-btn"
                  disabled={busy}
                  onClick={() => setConfirmCancel(false)}
                >
                  Keep order
                </button>
              </div>
            )}
            <p className="order-id">Order ID: {selected.id}</p>
          </aside>
        </div>
      )}
    </div>
  );
}

from datetime import UTC, datetime, time

from sqlalchemy import ColumnElement, func, select, update
from sqlalchemy.orm import Session

from app.errors import DomainError
from app.models import Order, OrderItem, Status, utc_now
from app.schemas import OrderInput, OrderOutput, OrderPage, SearchFilters, Summary, money

TRANSITIONS: dict[Status, set[Status]] = {
    Status.PENDING: {Status.PROCESSING, Status.CANCELLED},
    Status.PROCESSING: {Status.SHIPPED},
    Status.SHIPPED: {Status.DELIVERED},
    Status.DELIVERED: set(),
    Status.CANCELLED: set(),
}


def create_order(session: Session, payload: OrderInput) -> Order:
    items = [
        OrderItem(
            product_id=i.product_id, quantity=i.quantity, unit_price_cents=int(i.unit_price * 100)
        )
        for i in payload.items
    ]
    order = Order(
        customer_id=payload.customer_id,
        items=items,
        total_cents=sum(i.quantity * i.unit_price_cents for i in items),
    )
    session.add(order)
    session.commit()
    session.refresh(order)
    return order


def get_order(session: Session, order_id: str) -> Order:
    order = session.get(Order, order_id)
    if order is None:
        raise DomainError(404, "Order not found")
    return order


def change_status(
    session: Session, order_id: str, target: Status, expected_version: int | None = None
) -> Order:
    order = get_order(session, order_id)
    current = Status(order.status)
    if expected_version is not None and order.version != expected_version:
        raise DomainError(409, "Order changed; refresh its details before retrying")
    if current == target:
        return order
    if target not in TRANSITIONS[current]:
        raise DomainError(409, f"Cannot change {current} to {target}")
    # Compare-and-swap in SQL: protects against API/API and API/scheduler races across processes.
    changed = session.execute(
        update(Order)
        .where(Order.id == order_id, Order.status == current, Order.version == order.version)
        .values(status=target.value, version=Order.version + 1, updated_at=utc_now())
        .returning(Order.id)
        .execution_options(synchronize_session=False)
    ).scalar_one_or_none()
    if changed is None:
        session.rollback()
        raise DomainError(409, "Order changed concurrently; refresh and retry")
    session.commit()
    session.expire_all()
    return get_order(session, order_id)


def process_pending(session: Session) -> int:
    changed = (
        session.execute(
            update(Order)
            .where(Order.status == Status.PENDING.value)
            .values(status=Status.PROCESSING.value, version=Order.version + 1, updated_at=utc_now())
            .returning(Order.id)
            .execution_options(synchronize_session=False)
        )
        .scalars()
        .all()
    )
    session.commit()
    return len(changed)


def list_orders(session: Session, filters: SearchFilters, offset: int, limit: int) -> OrderPage:
    conditions: list[ColumnElement[bool]] = []
    if filters.status is not None:
        conditions.append(Order.status == filters.status.value)
    if filters.customer_id is not None:
        conditions.append(Order.customer_id == filters.customer_id)
    if filters.min_total is not None:
        conditions.append(Order.total_cents >= int(filters.min_total * 100))
    if filters.max_total is not None:
        conditions.append(Order.total_cents <= int(filters.max_total * 100))
    if filters.since is not None:
        conditions.append(Order.created_at >= datetime.combine(filters.since, time.min, UTC))
    if filters.before is not None:
        conditions.append(Order.created_at < datetime.combine(filters.before, time.min, UTC))
    total = session.scalar(select(func.count()).select_from(Order).where(*conditions)) or 0
    orders = session.scalars(
        select(Order)
        .where(*conditions)
        .order_by(Order.created_at.desc(), Order.id)
        .offset(offset)
        .limit(limit)
    ).all()
    return OrderPage(
        orders=[OrderOutput.from_order(o) for o in orders], total=total, offset=offset, limit=limit
    )


def summary(session: Session) -> Summary:
    rows = session.execute(select(Order.status, func.count()).group_by(Order.status)).all()
    counts = {status.value: 0 for status in Status}
    counts.update({str(status): int(count) for status, count in rows})
    value = (
        session.scalar(
            select(func.sum(Order.total_cents)).where(Order.status != Status.CANCELLED.value)
        )
        or 0
    )
    return Summary(total_orders=sum(counts.values()), active_value=money(int(value)), counts=counts)

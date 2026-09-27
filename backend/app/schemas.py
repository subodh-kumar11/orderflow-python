from datetime import UTC, date, datetime
from decimal import Decimal
from typing import Annotated, Literal, Self

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from app.models import Order, Status

Identifier = Annotated[str, Field(min_length=1, max_length=100, strict=True)]
Money = Annotated[Decimal, Field(gt=0, le=1_000_000, decimal_places=2, allow_inf_nan=False)]


class InputModel(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)


class ItemInput(InputModel):
    product_id: Identifier
    quantity: Annotated[int, Field(ge=1, le=10000, strict=True)]
    unit_price: Money

    @field_validator("unit_price", mode="before")
    @classmethod
    def reject_bool(cls, value: object) -> object:
        if isinstance(value, bool):
            raise ValueError("Price must be a number, not a boolean")
        return value


class OrderInput(InputModel):
    customer_id: Identifier
    items: Annotated[list[ItemInput], Field(min_length=1, max_length=100)]

    @model_validator(mode="after")
    def unique_products(self) -> Self:
        if len({item.product_id for item in self.items}) != len(self.items):
            raise ValueError("Combine duplicate product IDs into one item")
        return self


class StatusInput(InputModel):
    status: Status
    expected_version: Annotated[int, Field(ge=1, strict=True)] | None = None


class ItemOutput(BaseModel):
    product_id: str
    quantity: int
    unit_price: str


def money(cents: int) -> str:
    return f"{Decimal(cents) / 100:.2f}"


def utc(value: datetime) -> datetime:
    return value.replace(tzinfo=UTC) if value.tzinfo is None else value.astimezone(UTC)


class OrderOutput(BaseModel):
    id: str
    customer_id: str
    items: list[ItemOutput]
    total: str
    currency: Literal["USD"] = "USD"
    status: Status
    version: int
    created_at: datetime
    updated_at: datetime

    @classmethod
    def from_order(cls, order: Order) -> Self:
        return cls(
            id=order.id,
            customer_id=order.customer_id,
            items=[
                ItemOutput(
                    product_id=i.product_id,
                    quantity=i.quantity,
                    unit_price=money(i.unit_price_cents),
                )
                for i in order.items
            ],
            total=money(order.total_cents),
            status=Status(order.status),
            version=order.version,
            created_at=utc(order.created_at),
            updated_at=utc(order.updated_at),
        )


class OrderPage(BaseModel):
    orders: list[OrderOutput]
    total: int
    offset: int
    limit: int


class SearchFilters(InputModel):
    status: Status | None = None
    customer_id: Identifier | None = None
    min_total: Annotated[Decimal, Field(ge=0, le=1_000_000_000_000, decimal_places=2)] | None = None
    max_total: Annotated[Decimal, Field(ge=0, le=1_000_000_000_000, decimal_places=2)] | None = None
    since: date | None = None
    before: date | None = None

    @model_validator(mode="after")
    def valid_ranges(self) -> Self:
        if self.min_total is not None and self.max_total is not None:
            if self.min_total > self.max_total:
                raise ValueError("Minimum total must not exceed maximum total")
        if self.since and self.before and self.since >= self.before:
            raise ValueError("since must be earlier than before")
        return self


class SearchInput(InputModel):
    query: Annotated[str, Field(min_length=1, max_length=500)]
    use_ai: bool = False
    offset: Annotated[int, Field(ge=0)] = 0
    limit: Annotated[int, Field(ge=1, le=100)] = 20


class SearchOutput(OrderPage):
    filters: SearchFilters
    parser: Literal["rules", "ai"]


class Summary(BaseModel):
    total_orders: int
    active_value: str
    counts: dict[str, int]

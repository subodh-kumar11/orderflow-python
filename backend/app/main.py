from collections.abc import AsyncIterator, Generator
from contextlib import asynccontextmanager
from typing import Annotated, cast
from uuid import UUID

from fastapi import Depends, FastAPI, Query, Request, Response
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session
from starlette.exceptions import HTTPException

from app import service
from app.config import Settings
from app.db import Database
from app.errors import (
    DomainError,
    Problem,
    database_handler,
    domain_handler,
    http_handler,
    unexpected_handler,
    validation_handler,
)
from app.models import Status
from app.scheduler import make_scheduler
from app.schemas import (
    OrderInput,
    OrderOutput,
    OrderPage,
    SearchFilters,
    SearchInput,
    SearchOutput,
    StatusInput,
    Summary,
)
from app.search import translate


def get_session(request: Request) -> Generator[Session, None, None]:
    db = cast(Database, request.app.state.db)
    yield from db.session()


SessionDep = Annotated[Session, Depends(get_session)]


def create_app(settings: Settings | None = None) -> FastAPI:
    config = settings or Settings()
    db = Database(config.database_url)

    @asynccontextmanager
    async def lifespan(app: FastAPI) -> AsyncIterator[None]:
        db.initialize()
        scheduler = make_scheduler(db, config.processing_interval_seconds)
        app.state.scheduler = scheduler
        if config.scheduler_enabled:
            scheduler.start()
        try:
            yield
        finally:
            if scheduler.running:
                scheduler.shutdown(wait=True)
            db.engine.dispose()

    app = FastAPI(
        title="OrderFlow API",
        version="1.0.0",
        lifespan=lifespan,
        description="Transactional order processing with scheduled fulfillment.",
        responses={
            code: {"model": Problem, "content": {"application/problem+json": {}}}
            for code in (404, 409, 422, 502, 503)
        },
    )
    app.state.db = db
    app.add_middleware(
        CORSMiddleware,
        allow_origins=config.cors_origins,
        allow_methods=["GET", "POST", "PATCH"],
        allow_headers=["Content-Type"],
    )
    app.add_exception_handler(DomainError, domain_handler)  # type: ignore[arg-type]
    app.add_exception_handler(RequestValidationError, validation_handler)  # type: ignore[arg-type]
    app.add_exception_handler(HTTPException, http_handler)  # type: ignore[arg-type]
    app.add_exception_handler(SQLAlchemyError, database_handler)  # type: ignore[arg-type]
    app.add_exception_handler(Exception, unexpected_handler)

    @app.get("/health", tags=["Operations"])
    def health(session: SessionDep) -> dict[str, str]:
        session.execute(text("SELECT 1"))
        return {"status": "healthy"}

    @app.get("/api/config", tags=["Operations"])
    def public_config() -> dict[str, object]:
        return {
            "ai_enabled": config.ai_provider != "disabled"
            and bool(config.ai_api_key.get_secret_value()),
            "processing_interval_seconds": config.processing_interval_seconds,
        }

    @app.post("/api/orders", status_code=201, response_model=OrderOutput, tags=["Orders"])
    def create(payload: OrderInput, response: Response, session: SessionDep) -> OrderOutput:
        order = service.create_order(session, payload)
        response.headers["Location"] = f"/api/orders/{order.id}"
        return OrderOutput.from_order(order)

    @app.get("/api/orders", response_model=OrderPage, tags=["Orders"])
    def listing(
        session: SessionDep,
        status: Status | None = None,
        customer_id: Annotated[str | None, Query(min_length=1, max_length=100)] = None,
        offset: Annotated[int, Query(ge=0)] = 0,
        limit: Annotated[int, Query(ge=1, le=100)] = 20,
    ) -> OrderPage:
        return service.list_orders(
            session, SearchFilters(status=status, customer_id=customer_id), offset, limit
        )

    @app.get("/api/orders/summary", response_model=Summary, tags=["Orders"])
    def totals(session: SessionDep) -> Summary:
        return service.summary(session)

    @app.post("/api/orders/search", response_model=SearchOutput, tags=["Search"])
    async def search(payload: SearchInput, session: SessionDep) -> SearchOutput:
        filters, parser = await translate(payload.query, payload.use_ai, config)
        page = service.list_orders(session, filters, payload.offset, payload.limit)
        return SearchOutput(**page.model_dump(), filters=filters, parser=parser)

    @app.get("/api/orders/{order_id}", response_model=OrderOutput, tags=["Orders"])
    def get(order_id: UUID, session: SessionDep) -> OrderOutput:
        return OrderOutput.from_order(service.get_order(session, str(order_id)))

    @app.patch("/api/orders/{order_id}/status", response_model=OrderOutput, tags=["Orders"])
    def change(order_id: UUID, payload: StatusInput, session: SessionDep) -> OrderOutput:
        return OrderOutput.from_order(
            service.change_status(session, str(order_id), payload.status, payload.expected_version)
        )

    @app.post("/api/orders/{order_id}/cancel", response_model=OrderOutput, tags=["Orders"])
    def cancel(order_id: UUID, session: SessionDep) -> OrderOutput:
        return OrderOutput.from_order(
            service.change_status(session, str(order_id), Status.CANCELLED)
        )

    return app


app = create_app()

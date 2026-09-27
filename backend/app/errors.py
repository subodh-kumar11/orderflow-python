import logging
from http import HTTPStatus

from fastapi import Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from sqlalchemy.exc import SQLAlchemyError
from starlette.exceptions import HTTPException

logger = logging.getLogger(__name__)


class Problem(BaseModel):
    type: str = "about:blank"
    title: str
    status: int
    detail: str
    instance: str


class DomainError(Exception):
    def __init__(self, status: int, detail: str) -> None:
        self.status = status
        self.detail = detail


def response(request: Request, status: int, detail: str) -> JSONResponse:
    body = Problem(
        title=HTTPStatus(status).phrase, status=status, detail=detail, instance=request.url.path
    )
    return JSONResponse(
        body.model_dump(), status_code=status, media_type="application/problem+json"
    )


async def domain_handler(request: Request, error: DomainError) -> JSONResponse:
    return response(request, error.status, error.detail)


async def validation_handler(request: Request, error: RequestValidationError) -> JSONResponse:
    # Do not echo request bodies or Pydantic input values into errors.
    detail = "; ".join(f"{'.'.join(map(str, e['loc']))}: {e['msg']}" for e in error.errors())
    return response(request, 422, detail)


async def http_handler(request: Request, error: HTTPException) -> JSONResponse:
    return response(request, error.status_code, str(error.detail))


async def database_handler(request: Request, error: SQLAlchemyError) -> JSONResponse:
    logger.error("Database operation failed: %s", type(error).__name__)
    return response(request, 503, "Database is temporarily unavailable; please retry.")


async def unexpected_handler(request: Request, error: Exception) -> JSONResponse:
    logger.error("Unexpected server failure: %s", type(error).__name__)
    return response(request, 500, "An unexpected error occurred.")

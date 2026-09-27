from collections.abc import Generator
from typing import Any

from sqlalchemy import Engine, create_engine, event
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.models import Base


class Database:
    def __init__(self, url: str) -> None:
        options: dict[str, Any] = {"pool_pre_ping": True}
        if url.startswith("sqlite"):
            options["connect_args"] = {"check_same_thread": False, "timeout": 15}
            if ":memory:" in url:
                options["poolclass"] = StaticPool
        self.engine: Engine = create_engine(url, **options)
        if url.startswith("sqlite"):
            event.listen(self.engine, "connect", self._configure_sqlite)
        self.sessions = sessionmaker(self.engine, expire_on_commit=False)

    @staticmethod
    def _configure_sqlite(connection: Any, _: Any) -> None:
        cursor = connection.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.execute("PRAGMA journal_mode=WAL")
        cursor.close()

    def initialize(self) -> None:
        # Initial schema for the take-home. Use migrations for subsequent schema changes.
        Base.metadata.create_all(self.engine)

    def session(self) -> Generator[Session, None, None]:
        with self.sessions() as session:
            yield session

from collections.abc import Generator

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.db import Base, get_session
from app.main import create_app
from app.models import (  # noqa: F401
    Account,
    BillInstance,
    Commitment,
    Entity,
    ImportLog,
    Profile,
    Transaction,
)


@pytest.fixture()
def db_session() -> Generator[Session]:
    engine = create_engine(
        "sqlite+pysqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)
    TestingSessionLocal = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)

    with TestingSessionLocal() as session:
        yield session

    Base.metadata.drop_all(engine)


@pytest.fixture()
def api_client(db_session: Session):
    app = create_app()

    def override_session() -> Generator[Session]:
        yield db_session

    app.dependency_overrides[get_session] = override_session
    return app

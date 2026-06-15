from __future__ import annotations

import hashlib
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Account, Entity, ImportLog, Profile, Transaction
from app.schemas.imports import SnoopImportCommitResult
from app.services.snoop_import import (
    initial_transaction_type,
    parse_snoop_csv,
    preview_snoop_csv,
    suggest_account_type,
)

HOUSEHOLD_ENTITY_NAME = "Household"
DEFAULT_PROFILE_NAME = "Primary user"


def commit_snoop_csv(
    contents: bytes,
    source_filename: str,
    session: Session,
) -> SnoopImportCommitResult:
    preview = preview_snoop_csv(contents, source_filename=source_filename)
    rows, warnings = parse_snoop_csv(contents)

    entity = get_or_create_household_entity(session)
    profile = get_or_create_default_profile(session, entity)

    account_cache: dict[tuple[str, str], Account] = {}
    created_account_count = 0
    reused_account_count = 0
    imported_transaction_count = 0
    skipped_duplicate_count = 0
    seen_fingerprints: set[str] = set()

    import_log = ImportLog(
        entity_id=entity.id,
        source="snoop_csv",
        source_filename=source_filename,
        source_fingerprint=hashlib.sha256(contents).hexdigest(),
        row_count=preview.row_count,
        valid_row_count=preview.valid_row_count,
        duplicate_fingerprint_count=preview.duplicate_fingerprint_count,
        imported_transaction_count=0,
        skipped_duplicate_count=0,
        date_start=rows[0].transaction_date if rows else None,
        date_end=rows[0].transaction_date if rows else None,
    )
    if rows:
        import_log.date_start = min(row.transaction_date for row in rows)
        import_log.date_end = max(row.transaction_date for row in rows)
    session.add(import_log)
    session.flush()

    for row in rows:
        if row.fingerprint in seen_fingerprints or transaction_exists(
            session,
            entity.id,
            row.fingerprint,
        ):
            skipped_duplicate_count += 1
            seen_fingerprints.add(row.fingerprint)
            continue

        account_key = (row.account_provider, row.account_name)
        account = account_cache.get(account_key)
        if account is None:
            account, was_created = get_or_create_account(session, entity, profile, *account_key)
            account_cache[account_key] = account
            if was_created:
                created_account_count += 1
            else:
                reused_account_count += 1

        session.add(
            Transaction(
                entity_id=entity.id,
                account_id=account.id,
                import_id=import_log.id,
                transaction_date=row.transaction_date,
                merchant_name=row.merchant_name,
                description=row.description,
                amount=row.amount,
                direction="inflow" if row.amount > Decimal("0") else "outflow",
                source_category=row.category,
                status="pending" if row.status.lower() == "pending" else "posted",
                transaction_type=initial_transaction_type(row.category),
                fingerprint=row.fingerprint,
                notes=row.notes,
                sub_type=row.sub_type,
            )
        )
        imported_transaction_count += 1
        seen_fingerprints.add(row.fingerprint)

    import_log.imported_transaction_count = imported_transaction_count
    import_log.skipped_duplicate_count = skipped_duplicate_count
    session.commit()

    return SnoopImportCommitResult(
        import_id=import_log.id,
        entity_id=entity.id,
        entity_name=entity.name,
        profile_id=profile.id,
        profile_name=profile.name,
        row_count=preview.row_count,
        imported_transaction_count=imported_transaction_count,
        skipped_duplicate_count=skipped_duplicate_count,
        created_account_count=created_account_count,
        reused_account_count=reused_account_count,
        date_start=import_log.date_start.isoformat() if import_log.date_start else None,
        date_end=import_log.date_end.isoformat() if import_log.date_end else None,
        warnings=[*preview.warnings, *warnings],
    )


def get_or_create_household_entity(session: Session) -> Entity:
    entity = session.scalar(
        select(Entity).where(Entity.name == HOUSEHOLD_ENTITY_NAME, Entity.type == "household")
    )
    if entity:
        return entity

    entity = Entity(name=HOUSEHOLD_ENTITY_NAME, type="household")
    session.add(entity)
    session.flush()
    return entity


def get_or_create_default_profile(session: Session, entity: Entity) -> Profile:
    profile = session.scalar(
        select(Profile).where(Profile.entity_id == entity.id, Profile.name == DEFAULT_PROFILE_NAME)
    )
    if profile:
        return profile

    profile = Profile(entity_id=entity.id, name=DEFAULT_PROFILE_NAME, role="owner")
    session.add(profile)
    session.flush()
    return profile


def get_or_create_account(
    session: Session,
    entity: Entity,
    profile: Profile,
    provider: str,
    source_account_name: str,
) -> tuple[Account, bool]:
    account = session.scalar(
        select(Account).where(
            Account.entity_id == entity.id,
            Account.provider == provider,
            Account.source_account_name == source_account_name,
        )
    )
    if account:
        return account, False

    account_type = suggest_account_type(provider, source_account_name)
    include_as_cash = account_type not in {"credit_card", "loan", "bnpl"}
    account = Account(
        entity_id=entity.id,
        profile_id=profile.id,
        provider=provider,
        display_name=source_account_name,
        source_account_name=source_account_name,
        account_type=account_type,
        include_in_cash_on_hand=include_as_cash,
        include_in_forecast=include_as_cash,
    )
    session.add(account)
    session.flush()
    return account, True


def transaction_exists(session: Session, entity_id: str, fingerprint: str) -> bool:
    return (
        session.scalar(
            select(Transaction.id).where(
                Transaction.entity_id == entity_id,
                Transaction.fingerprint == fingerprint,
            )
        )
        is not None
    )

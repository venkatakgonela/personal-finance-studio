from typing import Annotated

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from sqlalchemy.orm import Session

from app.db import get_session
from app.schemas.data import ResetDataResult
from app.schemas.imports import SnoopImportCommitResult, SnoopImportPreview
from app.services.data_reset import reset_household_data
from app.services.import_commit import commit_snoop_csv
from app.services.snoop_import import SnoopImportError, preview_snoop_csv

router = APIRouter()


@router.post("/snoop/preview", response_model=SnoopImportPreview)
async def preview_snoop_import(file: Annotated[UploadFile, File()]) -> SnoopImportPreview:
    if not file.filename or not file.filename.lower().endswith(".csv"):
        raise HTTPException(status_code=400, detail="Upload a Snoop CSV file.")

    contents = await file.read()
    try:
        return preview_snoop_csv(contents, source_filename=file.filename)
    except SnoopImportError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.post("/snoop/commit", response_model=SnoopImportCommitResult)
async def commit_snoop_import(
    file: Annotated[UploadFile, File()],
    session: Annotated[Session, Depends(get_session)],
) -> SnoopImportCommitResult:
    if not file.filename or not file.filename.lower().endswith(".csv"):
        raise HTTPException(status_code=400, detail="Upload a Snoop CSV file.")

    contents = await file.read()
    try:
        return commit_snoop_csv(contents, source_filename=file.filename, session=session)
    except SnoopImportError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.post("/reset", response_model=ResetDataResult)
def reset_imported_data(
    session: Annotated[Session, Depends(get_session)],
) -> ResetDataResult:
    return reset_household_data(session)

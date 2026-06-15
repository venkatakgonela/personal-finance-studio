from pydantic import BaseModel


class ResetDataResult(BaseModel):
    deleted: dict[str, int]
    entity_name: str
    profile_name: str
    status: str

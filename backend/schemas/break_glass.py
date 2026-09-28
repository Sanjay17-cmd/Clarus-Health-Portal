from pydantic import BaseModel, Field, field_validator


class BreakGlassRequestCreate(BaseModel):
    patient_id: int
    justification: str
    password: str

    @field_validator("justification")
    @classmethod
    def validate_justification(cls, value: str) -> str:
        value = value.strip()
        if len(value) < 10:
            raise ValueError("Justification must be at least 10 characters")
        return value


class BreakGlassShareCreate(BaseModel):
    request_id: int
    group_id: int
    doctor_ids: list[int] = Field(min_length=1, max_length=20)


class DownloadPermissionRequestCreate(BaseModel):
    group_id: int
    justification: str

    @field_validator("justification")
    @classmethod
    def validate_justification(cls, value: str) -> str:
        value = value.strip()
        if len(value) < 10:
            raise ValueError("Justification must be at least 10 characters")
        return value


class AdminPermissionDecision(BaseModel):
    approve: bool
    notes: str | None = None
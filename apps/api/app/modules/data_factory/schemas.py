"""Household preset contracts; other presets can define their own record models."""

from typing import Literal, TypedDict

from pydantic import BaseModel, Field


class HouseholdRecord(TypedDict):
    household_id: str
    household_head: str
    barangay: str
    household_size: int
    monthly_income: int
    income_category: Literal["Low", "Middle", "High"]


class Household(BaseModel):
    household_id: str
    household_head: str
    barangay: str
    household_size: int = Field(ge=1, le=12)
    monthly_income: int = Field(ge=3000, le=80000)
    income_category: Literal["Low", "Middle", "High"]


class HouseholdDataset(BaseModel):
    success: Literal[True] = True
    dataset: Literal["households"] = "households"
    total_records: int
    seed: int
    synthetic: Literal[True] = True
    data: list[Household]

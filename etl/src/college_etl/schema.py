"""Pydantic mirror of packages/dataset/src/schema.ts. emit validates every document against it."""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

MetricFlag = Literal[
    "imputed_zero", "system_level", "reported_with_parent", "derived", "manual", "suppressed"
]


class School(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: int = Field(gt=0)
    name: str = Field(min_length=1)
    aliases: list[str] | None = None
    city: str
    state: str = Field(pattern=r"^[A-Z]{2}$")
    control: Literal["public", "private_nonprofit"]
    locale: Literal["city", "suburb", "town", "rural"] | None
    lat: float | None = None
    lon: float | None = None
    domain: str | None
    ugSize: int = Field(ge=0)
    values: dict[str, float | None]
    flags: dict[str, MetricFlag] | None = None
    reportedWith: dict[str, int] | None = None


class MetricMeta(BaseModel):
    model_config = ConfigDict(extra="forbid")

    key: str
    source: str
    fields: str
    vintage: str
    note: str
    coverage: float = Field(ge=0, le=1)


class Universe(BaseModel):
    rule: str
    count: int


class Snapshot(BaseModel):
    model_config = ConfigDict(extra="forbid")

    schemaVersion: Literal[1]
    snapshotId: str
    generatedAt: str
    contentHash: str = Field(pattern=r"^[0-9a-f]{64}$")
    universe: Universe
    sources: list[dict]
    metrics: list[MetricMeta]
    schools: list[School]

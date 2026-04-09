from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Literal
from uuid import uuid4

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator


def _utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _new_id(prefix: str) -> str:
    return f"{prefix}_{uuid4().hex}"


class MediaProfile(BaseModel):
    model_config = ConfigDict(extra="allow")

    duration_ms: int | None = Field(default=None, ge=0)
    width: int | None = Field(default=None, ge=0)
    height: int | None = Field(default=None, ge=0)
    frame_rate: float | None = Field(default=None, ge=0)
    timebase: str | None = None
    rate_mode: Literal["cfr", "vfr", "unknown"] = "unknown"
    codec: str | None = None
    audio_codec: str | None = None


class MediaRef(BaseModel):
    model_config = ConfigDict(extra="allow")

    media_id: str
    source_uri: str
    source_filename: str
    source_hash: str | None = None
    processing_profile_id: str | None = None
    media_profile: MediaProfile | None = None


class MediaLocator(BaseModel):
    model_config = ConfigDict(extra="allow")

    source_uri: str
    t_start_ms: int = Field(ge=0)
    t_end_ms: int | None = Field(default=None, ge=0)
    frame_index: int | None = Field(default=None, ge=0)
    pts_ns: int | None = Field(default=None, ge=0)

    @model_validator(mode="after")
    def validate_time_range(self) -> "MediaLocator":
        if self.t_end_ms is not None and self.t_end_ms < self.t_start_ms:
            raise ValueError("t_end_ms must be greater than or equal to t_start_ms")
        return self

    def to_media_fragment(self) -> str:
        start = self.t_start_ms / 1000
        if self.t_end_ms is None:
            return f"{self.source_uri}#t={start:.3f}"
        end = self.t_end_ms / 1000
        return f"{self.source_uri}#t={start:.3f},{end:.3f}"


class RegionBox(BaseModel):
    model_config = ConfigDict(extra="allow")

    x: float = Field(ge=0)
    y: float = Field(ge=0)
    w: float = Field(ge=0)
    h: float = Field(ge=0)


class Anchor(BaseModel):
    model_config = ConfigDict(extra="allow")

    anchor_id: str = Field(default_factory=lambda: _new_id("anchor"))
    media_id: str
    t_start_ms: int = Field(ge=0)
    t_end_ms: int | None = Field(default=None, ge=0)
    duration_ms: int | None = Field(default=None, ge=0)
    frame_index: int | None = Field(default=None, ge=0)
    pts_ns: int | None = Field(default=None, ge=0)
    anchor_type: Literal["point", "interval", "frame_region"] = "point"

    @model_validator(mode="after")
    def sync_duration_and_range(self) -> "Anchor":
        if self.t_end_ms is not None and self.t_end_ms < self.t_start_ms:
            raise ValueError("t_end_ms must be greater than or equal to t_start_ms")
        if self.duration_ms is None and self.t_end_ms is not None:
            self.duration_ms = self.t_end_ms - self.t_start_ms
        if self.anchor_type == "point" and self.t_end_ms is None:
            self.t_end_ms = self.t_start_ms
            self.duration_ms = 0
        return self


class EvidenceObject(BaseModel):
    model_config = ConfigDict(extra="allow")

    id: str = Field(default_factory=lambda: _new_id("evidence"))
    object_type: str
    anchor_id: str
    payload: dict[str, Any] = Field(default_factory=dict)
    confidence: float | None = Field(default=None, ge=0.0, le=1.0)
    support_level: str | None = None
    created_by: str
    version: str = "v1"
    derived_from: list[str] = Field(default_factory=list)
    raw_or_corrected: Literal["raw", "derived", "corrected", "imported"] = "raw"


class ActivityRecord(BaseModel):
    model_config = ConfigDict(extra="allow")

    activity_id: str = Field(default_factory=lambda: _new_id("activity"))
    activity_type: str
    used: list[str] = Field(default_factory=list)
    generated: list[str] = Field(default_factory=list)
    parameters: dict[str, Any] = Field(default_factory=dict)
    timestamp: str = Field(default_factory=_utc_now_iso)
    associated_agent: str | None = None

    @field_validator("timestamp")
    @classmethod
    def validate_timestamp(cls, value: str) -> str:
        datetime.fromisoformat(value.replace("Z", "+00:00"))
        return value


class TraceEnvelope(BaseModel):
    model_config = ConfigDict(extra="allow")

    media_ref: MediaRef
    anchors: list[Anchor] = Field(default_factory=list)
    objects: list[EvidenceObject] = Field(default_factory=list)
    activities: list[ActivityRecord] = Field(default_factory=list)


def build_media_locator(
    media_ref: MediaRef,
    anchor: Anchor,
) -> MediaLocator:
    return MediaLocator(
        source_uri=media_ref.source_uri,
        t_start_ms=anchor.t_start_ms,
        t_end_ms=anchor.t_end_ms,
        frame_index=anchor.frame_index,
        pts_ns=anchor.pts_ns,
    )

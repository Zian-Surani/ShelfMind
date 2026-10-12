from __future__ import annotations

from pydantic import BaseModel, Field
from typing import Literal
from uuid import UUID


class DecisionModifyRequest(BaseModel):
    quantity: int = Field(ge=0)
    reason: str = Field(min_length=1, max_length=500)


class ImageReviewRequest(BaseModel):
    request_id: UUID
    product_id: str = Field(min_length=1, max_length=64)
    image_ids: list[str] = Field(min_length=1, max_length=12)
    confirmed_quantity: int = Field(ge=0, le=10000, strict=True)
    quantity_verified: Literal[True]


class DecisionRejectRequest(BaseModel):
    reason: str = Field(min_length=1, max_length=500)


class SaleRequest(BaseModel):
    product_id: str
    quantity: int = Field(gt=0)
    promotion_flag: bool = False
    demand_regime: str = "NORMAL"


class ShelfReallocationRequest(BaseModel):
    product_id: str
    delta_positions: int = Field(ge=-10, le=10)


class ShelfRestockRequest(BaseModel):
    product_name: str
    count: int = Field(gt=0)


class SimulationStepRequest(BaseModel):
    days: int = Field(default=1, ge=1, le=30)
    algorithm: str = "VALUE_ITERATION"


class SimulationRunRequest(BaseModel):
    days: int = Field(default=7, ge=1, le=120)
    algorithm: str = "VALUE_ITERATION"


class RLRunRequest(BaseModel):
    algorithm: str | None = None
    episodes: int = Field(default=400, ge=1, le=10000)
    iterations: int = Field(default=100, ge=1, le=1000)
    seed: int = 20260914


class AgentQueryRequest(BaseModel):
    query: str = Field(min_length=1, max_length=1000)


class StoreSettingsRequest(BaseModel):
    autonomyMode: Literal["RECOMMEND_ONLY", "HUMAN_APPROVAL", "AUTO_UNDER_THRESHOLD"]
    maxAutoQuantity: int = Field(ge=0, le=10000)
    maxAutoSpend: float = Field(ge=0, le=10000000, allow_inf_nan=False)
    serviceLevelTarget: float = Field(ge=0, le=100, allow_inf_nan=False)
    storeName: str = Field(min_length=1, max_length=160)
    managerName: str = Field(min_length=1, max_length=120)
    enableSound: bool
    mascotReactivity: Literal["calm", "balanced", "enthusiastic"]

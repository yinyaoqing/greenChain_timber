"""林區 API（§8.1–8.3）：提交、清單、詳情."""

import uuid
from typing import Literal

import asyncpg
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from app.core.auth import get_current_user_id
from app.db import queries
from app.db.pool import get_conn
from app.services.carbon_calc import estimate_carbon
from app.services.geo_service import (
    GeometryError,
    geometry_hash,
    polygon_area_ha,
    validate_polygon,
)

router = APIRouter(prefix="/api/forest", tags=["forest"])

MIN_AREA_HA = 0.1
MAX_AREA_HA = 1000.0


class ForestSubmission(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    species: Literal["taiwania", "acacia", "fraxinus"]
    avg_age: int = Field(ge=1, le=100)
    density: int = Field(ge=100, le=10000)
    geometry: dict


@router.post("", status_code=201)
async def submit_forest(
    body: ForestSubmission,
    user_id: uuid.UUID = Depends(get_current_user_id),
    conn: asyncpg.Connection = Depends(get_conn),
):
    # 1. 幾何驗證（FR-3.3）—— 422
    try:
        validate_polygon(body.geometry)
    except GeometryError as exc:
        raise HTTPException(
            status_code=422, detail={"code": exc.code, "message": exc.message}
        ) from exc

    # 2. 面積範圍（FR-2.4 後端複驗）—— 422
    area_ha = polygon_area_ha(body.geometry)
    if not MIN_AREA_HA <= area_ha <= MAX_AREA_HA:
        raise HTTPException(
            status_code=422,
            detail={
                "code": "area_out_of_range",
                "message": f"面積 {area_ha} ha 超出允許範圍 {MIN_AREA_HA}–{MAX_AREA_HA} ha",
            },
        )

    # 3. 防重疊（FR-3.1–3.2）—— 409
    conflicts = await queries.find_overlaps(conn, body.geometry)
    if conflicts:
        raise HTTPException(status_code=409, detail={"conflicts": conflicts})

    # 4. 估算（FR-4）+ 入庫（單一 transaction）
    estimate = estimate_carbon(body.species, body.avg_age, body.density, area_ha)
    try:
        plot = await queries.insert_plot_with_estimates(
            conn,
            owner_id=user_id,
            name=body.name,
            species=body.species,
            avg_age=body.avg_age,
            density=body.density,
            geometry=body.geometry,
            area_ha=area_ha,
            geo_hash=geometry_hash(body.geometry),
            estimate=estimate,
        )
    except asyncpg.UniqueViolationError as exc:
        # geo_hash 撞 UNIQUE：與既有林區幾何完全相同
        raise HTTPException(
            status_code=409, detail={"conflicts": [], "message": "相同幾何的林區已存在"}
        ) from exc

    return {
        "plot": plot,
        "estimates": [
            {"year_offset": y.year_offset, "co2e_tons": y.co2e_tons} for y in estimate.yearly
        ],
        "chain": {"status": "pending"},  # W3 接上 chain_service
    }


@router.get("")
async def list_forest(
    user_id: uuid.UUID = Depends(get_current_user_id),
    conn: asyncpg.Connection = Depends(get_conn),
):
    return await queries.list_plots(conn)


@router.get("/{plot_id}")
async def get_forest(
    plot_id: uuid.UUID,
    user_id: uuid.UUID = Depends(get_current_user_id),
    conn: asyncpg.Connection = Depends(get_conn),
):
    plot = await queries.get_plot(conn, plot_id)
    if plot is None:
        raise HTTPException(status_code=404, detail="plot not found")
    return plot

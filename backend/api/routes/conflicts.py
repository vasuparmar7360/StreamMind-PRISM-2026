from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query, Path as FastAPIPath
from sqlalchemy.orm import Session
from backend.db.session import get_db
from backend.services.conflict_detection_service import ConflictDetectionService
from backend.models.conflict import (
    ConflictListResponse,
    ConflictDetailResponse,
    ConflictResolveRequest,
    ConflictResolveResponse,
    ConflictCountResponse,
    ConflictResolution,
)

router = APIRouter(prefix="/conflicts", tags=["conflicts"])


@router.get(
    "",
    response_model=ConflictListResponse,
    summary="List all detected conflicts",
)
async def list_conflicts(
    status: Optional[str] = Query(
        None,
        description="Filter by status: open | resolved | dismissed",
    ),
    db: Session = Depends(get_db),
):
    """
    Returns all persisted conflicts, optionally filtered by status.

    Use `?status=open` to find conflicts that still require human review.
    """
    conflicts = ConflictDetectionService.get_conflicts(db, status=status)
    return {"total": len(conflicts), "conflicts": conflicts}


@router.get(
    "/count",
    response_model=ConflictCountResponse,
    summary="Get conflict counts (useful for dashboard overview)",
)
async def count_conflicts(db: Session = Depends(get_db)):
    """
    Returns the number of open conflicts and the total conflict count.
    Intended for the Overview dashboard counter (Phase 19 prep).
    """
    open_count = ConflictDetectionService.count_open_conflicts(db)
    all_conflicts = ConflictDetectionService.get_conflicts(db)
    return {"open_conflicts": open_count, "total_conflicts": len(all_conflicts)}


@router.get(
    "/{conflict_id}",
    response_model=ConflictDetailResponse,
    summary="Get full details for a single conflict",
)
async def get_conflict(
    conflict_id: str = FastAPIPath(..., description="Unique conflict ID"),
    db: Session = Depends(get_db),
):
    """
    Returns complete conflict details including:
    - Existing decision (value, source document, source date)
    - Candidate value (value, source document, evidence excerpt, source date)
    - Resolution information if already resolved
    """
    detail = ConflictDetectionService.get_conflict_detail(db, conflict_id)
    if not detail:
        raise HTTPException(status_code=404, detail="Conflict not found.")
    return detail


@router.post(
    "/{conflict_id}/resolve",
    response_model=ConflictResolveResponse,
    summary="Manually resolve a conflict",
)
async def resolve_conflict(
    body: ConflictResolveRequest,
    conflict_id: str = FastAPIPath(..., description="Unique conflict ID"),
    db: Session = Depends(get_db),
):
    """
    Resolves an open conflict with an explicit user decision.

    **accept_candidate** — The candidate value replaces the existing active decision.
      - Existing decision → `replaced`
      - New active decision created with full lineage.

    **keep_existing** — The existing decision remains active.
      - Conflict closed, no decision changes.

    **dismiss** — The conflict is dismissed as non-meaningful.
      - Conflict status set to `dismissed`, no decision changes.
    """
    result = ConflictDetectionService.resolve_conflict(
        db=db,
        conflict_id=conflict_id,
        resolution=body.resolution.value,
    )

    if "error" in result:
        err = result["error"]
        if err == "not_found":
            raise HTTPException(status_code=404, detail="Conflict not found.")
        if err == "already_resolved":
            raise HTTPException(
                status_code=409,
                detail=f"Conflict is already in status: {result.get('status', 'unknown')}",
            )
        if err == "invalid_resolution":
            raise HTTPException(status_code=400, detail="Invalid resolution value.")
        raise HTTPException(status_code=400, detail=err)

    return result

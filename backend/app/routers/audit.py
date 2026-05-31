"""
Audit logging API endpoints.

Provides endpoints for admin users to view audit trail of system activities
including sales modifications, deletions, and other tracked user actions.
"""

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from sqlalchemy import text
from datetime import datetime
from typing import Optional
from app.core import database
from .. import models, schemas
from . auth import get_current_user
from ..services import audit

router = APIRouter(prefix="/api/v1/audit", tags=["audit"])


def verify_admin(current_user: models.User = Depends(get_current_user)) -> models.User:
    if current_user.role != "Admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only Admin users can access audit logs",
        )
    return current_user


@router.get("/logs", response_model=schemas.AuditLogsResponseSchema)
def get_audit_logs(
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    user_id: Optional[int] = Query(None),
    action: Optional[str] = Query(None),
    table_name: Optional[str] = Query(None),
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(verify_admin),
) -> dict:
    """
    Retrieve audit logs with optional filtering and pagination.

    Query Parameters:
        - page: Page number (default: 1)
        - per_page: Records per page (default: 20, max: 100)
        - user_id: Filter by user ID
        - action: Filter by action type (created, edited, deleted, voided)
        - table_name: Filter by table name (sales, items, etc.)
        - start_date: Filter logs from this date (ISO format: YYYY-MM-DD)
        - end_date: Filter logs up to this date (ISO format: YYYY-MM-DD)

    Returns:
        Paginated audit logs with user information and filtering metadata
    """
    # Parse date strings if provided
    start_dt = None
    end_dt = None
    try:
        if start_date:
            start_dt = datetime.fromisoformat(start_date)
        if end_date:
            end_dt = datetime.fromisoformat(end_date)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid date format. Use ISO format: YYYY-MM-DD",
        )

    # Get audit logs
    result = audit.get_audit_logs(
        db=db,
        user_id=user_id,
        action=action,
        table_name=table_name,
        start_date=start_dt,
        end_date=end_dt,
        page=page,
        per_page=per_page,
    )

    # Build response with user names included
    logs_with_users = []
    for log in result["logs"]:
        user = db.query(models.User).filter(models.User.user_id == log.user_id).first()
        logs_with_users.append(
            schemas.AuditLogSchema(
                audit_id=log.audit_id,
                user_id=log.user_id,
                action=log.action,
                table_name=log.table_name,
                record_id=log.record_id,
                action_timestamp=log.action_timestamp,
                reason=log.reason,
            )
        )

    return schemas.AuditLogsResponseSchema(
        total=result["total"],
        page=result["page"],
        per_page=result["per_page"],
        total_pages=result["total_pages"],
        logs=logs_with_users,
    )


@router.get("/logs/recent")
def get_recent_logs(
    limit: int = Query(50, ge=1, le=500),
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(verify_admin),
):
    """
    Get the most recent audit log entries.

    Query Parameters:
        - limit: Maximum number of logs to retrieve (default: 50, max: 500)

    Returns:
        List of recent audit logs
    """
    logs = audit.get_recent_audit_logs(db, limit=limit)
    return {
        "count": len(logs),
        "logs": [
            {
                "audit_id": log.audit_id,
                "user_id": log.user_id,
                "action": log.action,
                "table_name": log.table_name,
                "record_id": log.record_id,
                "action_timestamp": log.action_timestamp,
                "reason": log.reason,
            }
            for log in logs
        ],
    }


@router.get("/logs/sales/{sale_id}")
def get_sale_audit_logs(
    sale_id: int,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(verify_admin),
):
    """
    Get all audit log entries for a specific sale.

    Path Parameters:
        - sale_id: The sale ID to retrieve audit logs for

    Returns:
        List of audit logs for the specified sale
    """
    logs = (
        db.query(models.AuditLog)
        .filter(
            (models.AuditLog.table_name == "sales")
            & (models.AuditLog.record_id == sale_id)
        )
        .order_by(models.AuditLog.action_timestamp.desc())
        .all()
    )

    if not logs:
        return {"sale_id": sale_id, "logs": []}

    return {
        "sale_id": sale_id,
        "count": len(logs),
        "logs": [
            {
                "audit_id": log.audit_id,
                "user_id": log.user_id,
                "action": log.action,
                "action_timestamp": log.action_timestamp,
                "reason": log.reason,
            }
            for log in logs
        ],
    }


@router.get("/logs/formatted")
def get_formatted_audit_logs(
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=200),
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(verify_admin),
):
    """
    Return formatted audit logs with columns: TIMESTAMP | USER | ACTION | MODULE | DETAILS

    - ACTION values normalized to: EDIT, DELETE, ADD, LOGIN, LOGOUT, BACKUP
    - MODULE is a human-friendly name (Sales, Inventory, Users, System)
    - DETAILS built from `reason`, `sales.modification_reason`, or action-specific text
    """

    offset = (page - 1) * per_page

    sql = text("""
        SELECT
            DATE_FORMAT(al.action_timestamp, :date_fmt) AS timestamp,
            COALESCE(NULLIF(u.full_name, ''), 'System') AS user_name,
            CASE al.action
                WHEN 'edited' THEN 'EDIT'
                WHEN 'deleted' THEN 'DELETE'
                WHEN 'added' THEN 'ADD'
                WHEN 'login' THEN 'LOGIN'
                WHEN 'logout' THEN 'LOGOUT'
                WHEN 'backup' THEN 'BACKUP'
                ELSE UPPER(al.action)
            END AS action,
            CASE LOWER(al.table_name)
                WHEN 'sales' THEN 'Sales'
                WHEN 'items' THEN 'Inventory'
                WHEN 'users' THEN 'Users'
                WHEN 'system' THEN 'System'
                ELSE CONCAT(UPPER(SUBSTRING(al.table_name,1,1)),LOWER(SUBSTRING(al.table_name,2)))
            END AS module,
            CASE
                WHEN al.action = 'edited' THEN COALESCE(al.reason, s.modification_reason, 'No reason given')
                WHEN al.action = 'deleted' THEN COALESCE(al.reason, 'No reason given')
                WHEN al.action = 'added' THEN CONCAT('Added new record to ',
                    CASE LOWER(al.table_name) WHEN 'items' THEN 'Items' WHEN 'sales' THEN 'Sales' WHEN 'users' THEN 'Users' ELSE al.table_name END)
                WHEN al.action = 'login' THEN 'User logged in'
                WHEN al.action = 'logout' THEN 'User logged out'
                WHEN al.action = 'backup' THEN 'Database backup performed'
                ELSE COALESCE(al.reason, 'No details')
            END AS details
        FROM audit_logs al
        LEFT JOIN users u ON u.user_id = al.user_id
        LEFT JOIN sales s ON al.table_name = 'sales' AND s.sale_id = al.record_id
        ORDER BY al.action_timestamp DESC
        LIMIT :limit OFFSET :offset
    """)

    results = db.execute(sql, {
        "limit": per_page, 
        "offset": offset,
        "date_fmt": "%M %e, %Y %l:%i %p"
        }).mappings().all()

    rows = []
    for r in results:
        # r keys follow the select aliases
        rows.append({
            "timestamp": r["timestamp"],
            "user": r["user_name"],
            "action": r["action"],
            "module": r["module"],
            "details": r["details"],
        })

    return {"page": page, "per_page": per_page, "logs": rows}

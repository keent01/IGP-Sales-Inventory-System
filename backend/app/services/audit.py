"""
Audit logging service for tracking user actions and transaction modifications.

Implements audit logging for important system activities including sales transactions,
inventory changes, and user modifications.
"""

from datetime import datetime
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_
from .. import models


def log_action(
    db: Session,
    user_id: int,
    action: str,
    table_name: str,
    record_id: int,
    reason: str | None = None,
) -> models.AuditLog:
    """
    Log a user action to the audit trail.

    Args:
        db: Database session
        user_id: ID of the user performing the action
        action: Type of action (e.g., "created", "edited", "deleted", "voided")
        table_name: Name of the table being modified
        record_id: ID of the record being modified
        reason: Optional reason for the modification (required for edits)

    Returns:
        The created AuditLog instance
    """
    audit_log = models.AuditLog(
        user_id=user_id,
        action=action,
        table_name=table_name,
        record_id=record_id,
        action_timestamp=datetime.utcnow(),
        reason=reason,
    )
    db.add(audit_log)
    db.commit()
    db.refresh(audit_log)
    return audit_log


def get_audit_logs(
    db: Session,
    user_id: int | None = None,
    action: str | None = None,
    table_name: str | None = None,
    start_date: datetime | None = None,
    end_date: datetime | None = None,
    page: int = 1,
    per_page: int = 20,
) -> dict:
    """
    Retrieve audit logs with optional filtering and pagination.

    Args:
        db: Database session
        user_id: Filter by user ID
        action: Filter by action type
        table_name: Filter by table name
        start_date: Filter logs from this date onwards
        end_date: Filter logs up to this date
        page: Page number (1-based)
        per_page: Number of records per page

    Returns:
        Dict containing total count, page info, and audit log records with user names
    """
    query = db.query(models.AuditLog).join(
        models.User, models.AuditLog.user_id == models.User.user_id
    )

    # Apply filters
    if user_id is not None:
        query = query.filter(models.AuditLog.user_id == user_id)
    if action is not None:
        query = query.filter(models.AuditLog.action == action)
    if table_name is not None:
        query = query.filter(models.AuditLog.table_name == table_name)
    if start_date is not None:
        query = query.filter(models.AuditLog.action_timestamp >= start_date)
    if end_date is not None:
        query = query.filter(models.AuditLog.action_timestamp <= end_date)

    # Get total count before pagination
    total_count = query.count()

    # Apply pagination
    offset = (page - 1) * per_page
    logs = (
        query.order_by(models.AuditLog.action_timestamp.desc())
        .offset(offset)
        .limit(per_page)
        .all()
    )

    return {
        "total": total_count,
        "page": page,
        "per_page": per_page,
        "total_pages": (total_count + per_page - 1) // per_page,
        "logs": logs,
    }


def get_recent_audit_logs(
    db: Session, limit: int = 50
) -> list[models.AuditLog]:
    """
    Get the most recent audit logs.

    Args:
        db: Database session
        limit: Maximum number of logs to retrieve

    Returns:
        List of audit logs ordered by timestamp descending
    """
    return (
        db.query(models.AuditLog)
        .order_by(models.AuditLog.action_timestamp.desc())
        .limit(limit)
        .all()
    )

# Audit Logging Implementation Guide

## Overview

Complete audit logging system has been implemented for the EVSU-OC IGP Sales and Inventory Management System, complying with SRS requirements:

- **FR-05**: Admin users can edit sales transactions with required modification reasons
- **FR-16**: Admin-only access to sales edit/delete operations
- **Security**: Complete audit trail for all important user activities and transaction modifications

---

## Architecture

### 1. Database Model

**Table**: `audit_logs`

| Field | Type | Description |
|-------|------|-------------|
| `audit_id` | Integer (PK) | Unique audit log identifier |
| `user_id` | Integer (FK) | User who performed the action |
| `action` | String(50) | Action type: created, edited, deleted, voided |
| `table_name` | String(50) | Table being modified: sales, items, etc. |
| `record_id` | Integer | ID of the record modified |
| `action_timestamp` | DateTime | When the action occurred |
| `reason` | Text | Reason for modification (required for edits) |

Existing in [backend/app/models.py](backend/app/models.py#L62)

---

## Implementation Components

### 2. Audit Service Module

**File**: `backend/app/services/audit.py`

Core functions for audit logging:

#### `log_action(db, user_id, action, table_name, record_id, reason=None)`
- Logs a user action to the audit trail
- Automatically timestamps the action
- Commits to database immediately
- Used by all endpoints that modify data

**Usage Example**:
```python
audit.log_action(
    db=db,
    user_id=current_user.user_id,
    action="edited",
    table_name="sales",
    record_id=sale_id,
    reason="Price correction requested by accounting"
)
```

#### `get_audit_logs(db, user_id=None, action=None, table_name=None, start_date=None, end_date=None, page=1, per_page=20)`
- Retrieves filtered audit logs with pagination
- Supports filtering by user, action, table, and date range
- Returns paginated results with total count
- Used by audit view API endpoints

#### `get_recent_audit_logs(db, limit=50)`
- Gets the N most recent audit log entries
- Ordered by timestamp (newest first)
- Useful for activity summaries

### 3. API Endpoints

**Base Path**: `/api/v1/audit`

All audit endpoints require admin authentication.

#### GET `/api/v1/audit/logs`

Retrieve audit logs with filtering and pagination.

**Query Parameters**:
| Parameter | Type | Description | Required |
|-----------|------|-------------|----------|
| `page` | int | Page number (default: 1) | No |
| `per_page` | int | Records per page, 1-100 (default: 20) | No |
| `user_id` | int | Filter by user ID | No |
| `action` | string | Filter by action (created, edited, deleted, voided) | No |
| `table_name` | string | Filter by table name | No |
| `start_date` | string | Filter from date (YYYY-MM-DD format) | No |
| `end_date` | string | Filter to date (YYYY-MM-DD format) | No |

**Response**:
```json
{
  "total": 150,
  "page": 1,
  "per_page": 20,
  "total_pages": 8,
  "logs": [
    {
      "audit_id": 42,
      "user_id": 3,
      "action": "edited",
      "table_name": "sales",
      "record_id": 125,
      "action_timestamp": "2026-05-28T10:30:45",
      "reason": "Corrected student name and program"
    }
  ]
}
```

#### GET `/api/v1/audit/logs/recent`

Get the most recent audit log entries.

**Query Parameters**:
| Parameter | Type | Description |
|-----------|------|-------------|
| `limit` | int | Max logs to retrieve (default: 50, max: 500) |

**Response**:
```json
{
  "count": 25,
  "logs": [...]
}
```

#### GET `/api/v1/audit/logs/sales/{sale_id}`

Get all audit entries for a specific sale.

**Path Parameters**:
| Parameter | Type | Description |
|-----------|------|-------------|
| `sale_id` | int | The sale ID to retrieve logs for |

**Response**:
```json
{
  "sale_id": 125,
  "count": 3,
  "logs": [
    {
      "audit_id": 40,
      "user_id": 1,
      "action": "created",
      "action_timestamp": "2026-05-25T14:22:10",
      "reason": null
    },
    {
      "audit_id": 42,
      "user_id": 3,
      "action": "edited",
      "action_timestamp": "2026-05-28T10:30:45",
      "reason": "Corrected student program"
    }
  ]
}
```

---

## Sales Transaction Endpoints with Audit Logging

### Edit Sale: PUT `/api/sales/{sale_id}`

**Admin-only** endpoint to edit completed sales transactions.

**Request Body**:
```json
{
  "modification_reason": "Price correction due to inventory discrepancy"
}
```

**Requirements**:
- User must have Admin role
- Modification reason is mandatory (non-empty)
- Original sale must exist and not be deleted

**Response**:
```json
{
  "status": "success",
  "message": "Sale transaction updated successfully",
  "sale_id": 125,
  "last_modified_at": "2026-05-28T10:30:45",
  "last_modified_by": "John Doe"
}
```

**Audit Log Created**:
- Action: `"edited"`
- Table: `"sales"`
- Record ID: sale_id
- Reason: modification_reason (stored for compliance)

### Delete Sale: DELETE `/api/sales/{sale_id}`

**Admin-only** endpoint to void/delete sales transactions.

**Behavior**:
- Performs soft delete (sets `is_deleted = 1`)
- Restocks all items from the transaction
- Records action in audit trail with reason "Sale voided by admin"

**Response**:
```json
{
  "status": "success",
  "message": "Sale voided and items restocked",
  "sale_id": 125,
  "items_restocked": 3
}
```

---

## Database Schema Updates

The system automatically adds required columns on startup:

```sql
ALTER TABLE users ADD COLUMN force_password_change TINYINT(1) DEFAULT 0;
ALTER TABLE users ADD COLUMN failed_login_attempts INT DEFAULT 0;
ALTER TABLE users ADD COLUMN locked_until DATETIME NULL;
```

These are handled in [backend/app/main.py](backend/app/main.py#L40-L51).

---

## Pydantic Schemas

### AuditLogSchema
Represents a single audit log entry:
```python
{
    "audit_id": int,
    "user_id": int,
    "action": str,
    "table_name": str,
    "record_id": int,
    "action_timestamp": datetime,
    "reason": Optional[str]
}
```

### SaleEditRequest
Request schema for editing sales:
```python
{
    "modification_reason": str  # Required, non-empty
}
```

### AuditLogsResponseSchema
Paginated audit logs response with metadata:
```python
{
    "total": int,
    "page": int,
    "per_page": int,
    "total_pages": int,
    "logs": List[AuditLogSchema]
}
```

---

## Usage Examples

### Example 1: Edit a Sale with Audit Logging

```bash
# Request
PUT /api/sales/125
Content-Type: application/json
Authorization: Bearer {admin_token}

{
  "modification_reason": "Student program corrected from BSIT to BSCS"
}

# Response
{
  "status": "success",
  "message": "Sale transaction updated successfully",
  "sale_id": 125,
  "last_modified_at": "2026-05-28T10:30:45",
  "last_modified_by": "Admin User Name"
}

# Audit Trail Entry Created
audit_id: 45
user_id: 3
action: "edited"
table_name: "sales"
record_id: 125
action_timestamp: "2026-05-28T10:30:45"
reason: "Student program corrected from BSIT to BSCS"
```

### Example 2: View Audit Logs for a Sale

```bash
# Request
GET /api/v1/audit/logs/sales/125
Authorization: Bearer {admin_token}

# Response
{
  "sale_id": 125,
  "count": 3,
  "logs": [
    {
      "audit_id": 40,
      "user_id": 1,
      "action": "created",
      "action_timestamp": "2026-05-25T14:22:10",
      "reason": null
    },
    {
      "audit_id": 42,
      "user_id": 3,
      "action": "edited",
      "action_timestamp": "2026-05-28T10:30:45",
      "reason": "Corrected student program"
    },
    {
      "audit_id": 45,
      "user_id": 3,
      "action": "edited",
      "action_timestamp": "2026-05-28T11:15:22",
      "reason": "Price correction"
    }
  ]
}
```

### Example 3: Filter Audit Logs by Date Range

```bash
# Request
GET /api/v1/audit/logs?start_date=2026-05-01&end_date=2026-05-28&action=edited&per_page=25&page=1
Authorization: Bearer {admin_token}

# Response: Shows all edited transactions in May, paginated
{
  "total": 87,
  "page": 1,
  "per_page": 25,
  "total_pages": 4,
  "logs": [
    {
      "audit_id": 45,
      "user_id": 3,
      "action": "edited",
      "table_name": "sales",
      "record_id": 125,
      "action_timestamp": "2026-05-28T11:15:22",
      "reason": "Price correction"
    },
    ...
  ]
}
```

---

## Security & Access Control

### Admin-Only Verification

All audit endpoints and sensitive operations use the `verify_admin()` dependency:

```python
def verify_admin(current_user: models.User = Depends(get_current_user)) -> models.User:
    if current_user.role != "Admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only Admin users can access audit logs",
        )
    return current_user
```

### Requirements Met

✅ **FR-05**: Admins can edit sales transactions with required modification reasons
✅ **FR-16**: Only admins can edit/delete completed sales transactions
✅ **Security**: Complete audit trail for all user activities
✅ **Compliance**: Audit logs cannot be modified or deleted (soft delete of sales only)

---

## Files Created/Modified

### Created Files
- [backend/app/services/audit.py](backend/app/services/audit.py) - Audit service functions
- [backend/app/services/__init__.py](backend/app/services/__init__.py) - Services module
- [backend/app/routers/audit.py](backend/app/routers/audit.py) - Audit API endpoints

### Modified Files
- [backend/app/main.py](backend/app/main.py) - Added audit router, removed old audit endpoint
- [backend/app/routers/sales.py](backend/app/routers/sales.py) - Added edit/delete endpoints with audit logging
- [backend/app/schemas.py](backend/app/schemas.py) - Added audit log schemas and SaleEditRequest

### No Changes
- [backend/app/models.py](backend/app/models.py) - AuditLog model already exists

---

## Testing

### Test Edit Sale
```bash
curl -X PUT http://127.0.0.1:8000/api/sales/1 \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"modification_reason": "Test modification"}'
```

### Test View Audit Logs
```bash
curl http://127.0.0.1:8000/api/v1/audit/logs \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
```

### Test View Sale Audit Trail
```bash
curl http://127.0.0.1:8000/api/v1/audit/logs/sales/1 \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
```

---

## Error Handling

### Common Errors

| Status | Error | Cause |
|--------|-------|-------|
| 401 | "Not authenticated" | Missing or invalid token |
| 403 | "Only Admin users can..." | User is not admin |
| 400 | "Modification reason is required" | Edit without reason |
| 404 | "Sale not found" | Invalid sale ID |

---

## Future Enhancements

1. **Automated Cleanup**: Archive audit logs older than 1 year
2. **Export**: Generate audit reports (PDF/CSV)
3. **Alerts**: Real-time notifications for sensitive operations
4. **Rollback**: Ability to undo modifications (if needed)
5. **Digital Signing**: Cryptographic signatures on audit logs

---

## Questions?

Refer to SRS sections:
- **Section 3.1**: Use Case UC-01 (Login) and associated flows
- **Section 5.5**: FR-05 (Sales Edit Permissions)
- **Section 5.16**: FR-16 (Sales Delete Permissions)
- **Section 6**: Security and Compliance Requirements

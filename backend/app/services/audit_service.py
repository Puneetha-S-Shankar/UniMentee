# services/audit_service.py
from sqlalchemy.orm import Session
from sqlalchemy import text
import json

def log_action(db: Session, university_id: int, actor_user_id: int,
               action: str, entity_type: str, entity_id: int,
               old_value: dict = None, new_value: dict = None,
               ip_address: str = None):
    """
    Insert into audit_logs. This table is APPEND-ONLY (REVOKE UPDATE/DELETE in DB).
    Call this from service layer only — never from routers or repositories.
    """
    db.execute(text(
        """INSERT INTO audit_logs
           (university_id, actor_user_id, action, entity_type, entity_id,
            old_value, new_value, ip_address)
           VALUES (:uid, :actor, :action, :etype, :eid, :old, :new, :ip)"""
    ), {
        'uid': university_id,
        'actor': actor_user_id,
        'action': action,
        'etype': entity_type,
        'eid': entity_id,
        'old': json.dumps(old_value) if old_value else None,
        'new': json.dumps(new_value) if new_value else None,
        'ip': ip_address
    })
    # Caller must db.commit() after log_action so the INSERT is persisted.

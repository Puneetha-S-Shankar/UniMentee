-- audit_logs: aligned with app.services.audit_service inserts and ORM model app.models.admin.AuditLog
-- Run once on PostgreSQL. If upgrading from legacy columns (actor_id, changes), rename/migrate data first.

CREATE TABLE IF NOT EXISTS audit_logs (
    log_id         BIGSERIAL PRIMARY KEY,
    university_id  BIGINT NOT NULL,
    entity_type    VARCHAR(50) NOT NULL,
    entity_id      BIGINT,
    action         VARCHAR(50) NOT NULL,
    actor_user_id  BIGINT REFERENCES users (user_id),
    old_value      TEXT,
    new_value      TEXT,
    ip_address     VARCHAR(128),
    created_at     TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ix_audit_logs_university_id ON audit_logs (university_id);
CREATE INDEX IF NOT EXISTS ix_audit_logs_entity_type ON audit_logs (entity_type);
CREATE INDEX IF NOT EXISTS ix_audit_logs_actor_user_id ON audit_logs (actor_user_id);
CREATE INDEX IF NOT EXISTS ix_audit_logs_log_id ON audit_logs (log_id);

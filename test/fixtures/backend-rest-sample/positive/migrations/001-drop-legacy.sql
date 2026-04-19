-- Phase 51 fixture — non-reversible-migration POSITIVE case.
-- DROP COLUMN without down() / reversibility comment.

ALTER TABLE users DROP COLUMN legacy_email;
ALTER TABLE posts DROP COLUMN deprecated_field;

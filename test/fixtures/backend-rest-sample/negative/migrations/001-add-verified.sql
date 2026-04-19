-- Phase 51 fixture — non-reversible-migration NEGATIVE case.
-- Expand-contract pattern with reversibility comment + additive change.

-- expand-contract: this migration is reversible via inverse-add-column
ALTER TABLE users ADD COLUMN email_verified BOOLEAN DEFAULT false;

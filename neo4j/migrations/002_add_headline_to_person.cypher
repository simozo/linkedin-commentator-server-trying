// Migration 002 — Add headline property to Person nodes
// headline is captured from LinkedIn feed and stored on every Person MERGE.
// Existing nodes without headline will have the property set to empty string
// on next encounter; this migration just documents the schema addition.
MATCH (p:Person)
WHERE p.headline IS NULL
SET p.headline = '';

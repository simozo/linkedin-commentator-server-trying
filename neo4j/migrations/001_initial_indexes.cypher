// Migration 001 — Initial indexes on core node properties
CREATE INDEX person_slug IF NOT EXISTS FOR (n:Person) ON (n.slug);
CREATE INDEX post_urn    IF NOT EXISTS FOR (n:Post)   ON (n.urn);
CREATE INDEX topic_name  IF NOT EXISTS FOR (n:Topic)  ON (n.name);
CREATE INDEX user_id     IF NOT EXISTS FOR (n:User)   ON (n.id);

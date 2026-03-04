package database

import (
	"context"
	"log"
	"os"
	"path/filepath"
	"sort"
	"strings"

	"github.com/neo4j/neo4j-go-driver/v5/neo4j"
)

// RunMigrations applies any pending .cypher migration files from the given directory.
// Each applied migration is recorded as a (:Migration {id}) node so it won't run again.
func RunMigrations(migrationsDir string) {
	ctx := context.Background()
	session := Neo4jDriver.NewSession(ctx, neo4j.SessionConfig{AccessMode: neo4j.AccessModeWrite})
	defer session.Close(ctx)

	// Ensure the Migration constraint exists
	_, _ = session.Run(ctx,
		"CREATE CONSTRAINT migration_id IF NOT EXISTS FOR (m:Migration) REQUIRE m.id IS UNIQUE",
		nil,
	)

	// Read all .cypher files
	entries, err := os.ReadDir(migrationsDir)
	if err != nil {
		log.Printf("Migrations: cannot read dir %s: %v\n", migrationsDir, err)
		return
	}

	var files []string
	for _, e := range entries {
		if !e.IsDir() && strings.HasSuffix(e.Name(), ".cypher") {
			files = append(files, e.Name())
		}
	}
	sort.Strings(files)

	applied := 0
	for _, filename := range files {
		id := strings.TrimSuffix(filename, ".cypher")

		// Check if already applied
		res, err := session.Run(ctx,
			"MATCH (m:Migration {id: $id}) RETURN m",
			map[string]any{"id": id},
		)
		if err != nil {
			log.Printf("Migrations: error checking %s: %v\n", id, err)
			continue
		}
		if res.Next(ctx) {
			// Already applied
			continue
		}

		// Read and execute the file (statement by statement, split on ";")
		content, err := os.ReadFile(filepath.Join(migrationsDir, filename))
		if err != nil {
			log.Printf("Migrations: cannot read %s: %v\n", filename, err)
			continue
		}

		statements := splitStatements(string(content))
		failed := false
		for _, stmt := range statements {
			stmt = strings.TrimSpace(stmt)
			if stmt == "" {
				continue
			}
			if _, err := session.Run(ctx, stmt, nil); err != nil {
				log.Printf("Migrations: error running statement in %s: %v\nStatement: %s\n", filename, err, stmt)
				failed = true
				break
			}
		}

		if failed {
			continue
		}

		// Record migration as applied
		if _, err := session.Run(ctx,
			"CREATE (:Migration {id: $id, applied_at: datetime()})",
			map[string]any{"id": id},
		); err != nil {
			log.Printf("Migrations: failed to record %s: %v\n", id, err)
			continue
		}

		log.Printf("Migrations: applied %s\n", filename)
		applied++
	}

	if applied == 0 {
		log.Println("Migrations: nothing to apply")
	} else {
		log.Printf("Migrations: %d migration(s) applied\n", applied)
	}
}

// splitStatements splits a Cypher file on ";" ignoring comment lines.
func splitStatements(content string) []string {
	var statements []string
	var current strings.Builder

	for _, line := range strings.Split(content, "\n") {
		trimmed := strings.TrimSpace(line)
		if strings.HasPrefix(trimmed, "//") {
			continue
		}
		current.WriteString(line)
		current.WriteByte('\n')
		if strings.HasSuffix(trimmed, ";") {
			stmt := strings.TrimSuffix(strings.TrimSpace(current.String()), ";")
			statements = append(statements, stmt)
			current.Reset()
		}
	}

	// Catch statements without trailing semicolon
	if tail := strings.TrimSpace(current.String()); tail != "" {
		statements = append(statements, tail)
	}

	return statements
}

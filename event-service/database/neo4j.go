package database

import (
	"context"
	"log"
	"os"

	"github.com/neo4j/neo4j-go-driver/v5/neo4j"
)

var Neo4jDriver neo4j.DriverWithContext

func ConnectNeo4j() {
	uri := os.Getenv("NEO4J_URI")
	user := os.Getenv("NEO4J_USER")
	password := os.Getenv("NEO4J_PASSWORD")

	driver, err := neo4j.NewDriverWithContext(uri, neo4j.BasicAuth(user, password, ""))
	if err != nil {
		log.Fatal("Failed to connect to Neo4j. \n", err)
	}

	err = driver.VerifyConnectivity(context.Background())
	if err != nil {
		log.Fatal("Failed to verify Neo4j connectivity. \n", err)
	}

	Neo4jDriver = driver
	log.Println("Connected to Neo4j")
}

// EnsureIndexes creates indexes on the most queried properties.
// Uses IF NOT EXISTS so it is safe to call on every startup.
func EnsureIndexes() {
	ctx := context.Background()
	session := Neo4jDriver.NewSession(ctx, neo4j.SessionConfig{AccessMode: neo4j.AccessModeWrite})
	defer session.Close(ctx)

	indexes := []string{
		"CREATE INDEX person_slug IF NOT EXISTS FOR (n:Person) ON (n.slug)",
		"CREATE INDEX post_urn   IF NOT EXISTS FOR (n:Post)   ON (n.urn)",
		"CREATE INDEX topic_name IF NOT EXISTS FOR (n:Topic)  ON (n.name)",
		"CREATE INDEX user_id    IF NOT EXISTS FOR (n:User)   ON (n.id)",
	}

	for _, q := range indexes {
		if _, err := session.Run(ctx, q, nil); err != nil {
			log.Printf("Warning: failed to create index (%s): %v\n", q, err)
		}
	}
	log.Println("Neo4j indexes ensured")
}

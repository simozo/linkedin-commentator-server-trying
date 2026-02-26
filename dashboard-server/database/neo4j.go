package database

import (
	"context"
	"log"
	"os"

	"github.com/neo4j/neo4j-go-driver/v5/neo4j"
)

var Neo4jDriver neo4j.DriverWithContext
var Ctx = context.Background()

func ConnectNeo4j() {
	uri := os.Getenv("NEO4J_URI")
	if uri == "" {
		uri = "bolt://localhost:7687"
	}
	user := os.Getenv("NEO4J_USER")
	if user == "" {
		user = "neo4j"
	}
	pass := os.Getenv("NEO4J_PASSWORD")
	if pass == "" {
		pass = "password123"
	}

	driver, err := neo4j.NewDriverWithContext(uri, neo4j.BasicAuth(user, pass, ""))
	if err != nil {
		log.Fatalf("Failed to connect to Neo4j: %v", err)
	}

	if err := driver.VerifyConnectivity(Ctx); err != nil {
		log.Fatalf("Neo4j connectivity check failed: %v", err)
	}

	Neo4jDriver = driver
	log.Println("Connected to Neo4j")
}

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

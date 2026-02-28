package main

import (
	"context"
	"fmt"
	"log"
	"os"

	"github.com/joho/godotenv"
	"github.com/neo4j/neo4j-go-driver/v5/neo4j"
)

func main() {
	if err := godotenv.Load("../event-service/.env"); err != nil {
		log.Println("No .env file found")
	}

	uri := os.Getenv("NEO4J_URI")
	user := os.Getenv("NEO4J_USER")
	pass := os.Getenv("NEO4J_PASSWORD")

	ctx := context.Background()
	driver, err := neo4j.NewDriverWithContext(uri, neo4j.BasicAuth(user, pass, ""))
	if err != nil {
		log.Fatal(err)
	}
	defer driver.Close(ctx)

	session := driver.NewSession(ctx, neo4j.SessionConfig{AccessMode: neo4j.AccessModeRead})
	defer session.Close(ctx)

	fmt.Println("--- NEO4J INSPECTION ---")

	// Count Persons
	res, err := session.Run(ctx, "MATCH (n:Person) RETURN count(n)", nil)
	if err == nil && res.Next(ctx) {
		fmt.Printf("Total Persons: %v\n", res.Record().Values[0])
	} else if err != nil {
		fmt.Printf("Error counting Persons: %v\n", err)
	}

	// Count Mentions
	res, err = session.Run(ctx, "MATCH ()-[r:MENTIONS]->() RETURN count(r)", nil)
	if err == nil && res.Next(ctx) {
		fmt.Printf("Total MENTIONS relationships: %v\n", res.Record().Values[0])
	} else if err != nil {
		fmt.Printf("Error counting Mentions: %v\n", err)
	}

	// List some persons
	fmt.Println("\nRecent Persons (slugs):")
	res, err = session.Run(ctx, "MATCH (n:Person) RETURN n.slug, n.name LIMIT 10", nil)
	if err == nil {
		for res.Next(ctx) {
			fmt.Printf("- %v (%v)\n", res.Record().Values[0], res.Record().Values[1])
		}
	} else {
		fmt.Printf("Error listing persons: %v\n", err)
	}

	fmt.Println("--- END INSPECTION ---")
}

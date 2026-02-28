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
	godotenv.Load(".env")
	uri := os.Getenv("NEO4J_URL")
	user := os.Getenv("NEO4J_USER")
	pass := os.Getenv("NEO4J_PASSWORD")

	if uri == "" {
		uri = "bolt://localhost:7687"
	}

	driver, err := neo4j.NewDriverWithContext(uri, neo4j.BasicAuth(user, pass, ""))
	if err != nil {
		log.Fatal(err)
	}
	defer driver.Close(context.Background())

	ctx := context.Background()
	session := driver.NewSession(ctx, neo4j.SessionConfig{AccessMode: neo4j.AccessModeRead})
	defer session.Close(ctx)

	targetID := "7" // Looking for the user ID from logs

	result, err := session.ExecuteRead(ctx, func(tx neo4j.ManagedTransaction) (any, error) {
		query := `
		MATCH (u:User {id: $userId})-[a:ACTION]->(p:Post)
		WHERE a.type = 'comment_generated'
		RETURN a.timestamp as ts, p.urn as urn, date(datetime(a.timestamp)) as day, date() as today
		ORDER BY ts DESC
		`
		res, err := tx.Run(ctx, query, map[string]any{"userId": targetID})
		if err != nil {
			return nil, err
		}

		var logs []string
		for res.Next(ctx) {
			rec := res.Record()
			ts, _ := rec.Get("ts")
			urn, _ := rec.Get("urn")
			day, _ := rec.Get("day")
			today, _ := rec.Get("today")
			logs = append(logs, fmt.Sprintf("TS: %v | URN: %v | Day: %v | Today: %v", ts, urn, day, today))
		}
		return logs, nil
	})

	if err != nil {
		log.Fatal(err)
	}

	fmt.Printf("Found %d comments for user %s:\n", len(result.([]string)), targetID)
	for _, l := range result.([]string) {
		fmt.Println(l)
	}
}

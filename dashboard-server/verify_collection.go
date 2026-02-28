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
	if err := godotenv.Load(); err != nil {
		log.Println("No .env file found")
	}

	uri := os.Getenv("NEO4J_URI")
	user := os.Getenv("NEO4J_USER")
	pass := os.Getenv("NEO4J_PASSWORD")

	ctx := context.Background()
	driver, err := neo4j.NewDriverWithContext(uri, neo4j.BasicAuth(user, pass, ""))
	if err != nil {
		log.Fatalf("Failed to create driver: %v", err)
	}
	defer driver.Close(ctx)

	session := driver.NewSession(ctx, neo4j.SessionConfig{AccessMode: neo4j.AccessModeRead})
	defer session.Close(ctx)

	fmt.Println("--- VERIFICA DATA COLLECTION (HASHTAG & TAGS) ---")

	// 1. Check Topics (Hashtags)
	topicResult, _ := session.ExecuteRead(ctx, func(tx neo4j.ManagedTransaction) (any, error) {
		query := `MATCH (t:Topic) RETURN t.name as name LIMIT 10`
		res, _ := tx.Run(ctx, query, nil)
		var names []string
		for res.Next(ctx) {
			val, _ := res.Record().Get("name")
			names = append(names, val.(string))
		}
		return names, nil
	})

	// 2. Check Mentions (Persons/Companies tagged)
	mentionResult, _ := session.ExecuteRead(ctx, func(tx neo4j.ManagedTransaction) (any, error) {
		query := `
		MATCH (p:Post)-[r:MENTIONS]->(m)
		RETURN labels(m)[0] as type, m.name as name, p.urn as post LIMIT 10
		`
		res, _ := tx.Run(ctx, query, nil)
		var mentions []string
		for res.Next(ctx) {
			r := res.Record()
			t, _ := r.Get("type")
			n, _ := r.Get("name")
			mentions = append(mentions, fmt.Sprintf("[%s] %s (in post %s)", t, n, r.Values[2]))
		}
		return mentions, nil
	})

	topics := []string{}
	if topicResult != nil {
		topics = topicResult.([]string)
	}

	mentions := []string{}
	if mentionResult != nil {
		mentions = mentionResult.([]string)
	}

	fmt.Printf("\nFound %d recent Topics (Hashtags):\n", len(topics))
	for _, name := range topics {
		fmt.Printf("- #%s\n", name)
	}

	fmt.Printf("\nFound %d recent Mentions (@tags):\n", len(mentions))
	for _, m := range mentions {
		fmt.Printf("- %s\n", m)
	}

	fmt.Println("\n--- FINE VERIFICA ---")
}

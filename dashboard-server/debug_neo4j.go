package main

import (
	"context"
	"fmt"
	"log"

	"github.com/neo4j/neo4j-go-driver/v5/neo4j"
)

func main() {
	uri := "bolt://localhost:7687"
	ctx := context.Background()
	driver, err := neo4j.NewDriverWithContext(uri, neo4j.BasicAuth("neo4j", "password123", ""))
	if err != nil {
		log.Fatal(err)
	}
	defer driver.Close(ctx)

	session := driver.NewSession(ctx, neo4j.SessionConfig{AccessMode: neo4j.AccessModeRead})
	defer session.Close(ctx)

	fmt.Println("=== Checking User nodes ===")
	_, _ = session.ExecuteRead(ctx, func(tx neo4j.ManagedTransaction) (any, error) {
		res, _ := tx.Run(ctx, "MATCH (u:User) RETURN u.id as id, type(u.id) as type", nil)
		for res.Next(ctx) {
			id, _ := res.Record().Get("id")
			fmt.Printf("User ID: %v (Type: %T)\n", id, id)
		}
		return nil, nil
	})

	fmt.Println("\n=== Checking Bridge Path (Me -> Bridge -> Target) ===")
	_, _ = session.ExecuteRead(ctx, func(tx neo4j.ManagedTransaction) (any, error) {
		query := `
		MATCH (u:User)-[:ACTION]->(p1:Post)<-[r1:COMMENTED_ON]-(bridge:Person)
		MATCH (bridge)-[r2:COMMENTED_ON]->(p2:Post)<-[r3:COMMENTED_ON]-(target:Person)
		RETURN u.id as uid, bridge.slug as bslug, target.slug as tslug, p1.urn as p1, p2.urn as p2
		`
		res, _ := tx.Run(ctx, query, nil)
		for res.Next(ctx) {
			rec := res.Record()
			uid, _ := rec.Get("uid")
			bslug, _ := rec.Get("bslug")
			tslug, _ := rec.Get("tslug")
			p1, _ := rec.Get("p1")
			p2, _ := rec.Get("p2")
			fmt.Printf("Bridge: %v -> %v -> %v (via %v, %v)\n", uid, bslug, tslug, p1, p2)
		}
		return nil, nil
	})
}

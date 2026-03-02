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
	godotenv.Load("../../.env")
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

	fmt.Println("--- DIAGNOSTICA TREND '#sistema' ---")

	// Query 1: Check if Topic exists
	fmt.Println("\n1. Verifica Topic:")
	res1, _ := session.Run(ctx, "MATCH (t:Topic {name: 'sistema'}) RETURN t", nil)
	if res1.Next(ctx) {
		fmt.Println("   [OK] Topic 'sistema' trovato.")
	} else {
		fmt.Println("   [ERR] Topic 'sistema' NON trovato (controlla case sensitive).")
	}

	// Query 2: Check posts for this topic and their authors
	fmt.Println("\n2. Ispezione Post e Autori per '#sistema':")
	query2 := `
	MATCH (p:Post)-[:HAS_TOPIC]->(t:Topic {name: 'sistema'})
	OPTIONAL MATCH (p)-[:AUTHORED_BY]->(auth)
	RETURN p, labels(auth) as auth_labels, auth
	LIMIT 3
	`
	res2, _ := session.Run(ctx, query2, nil)
	for res2.Next(ctx) {
		rec := res2.Record()
		pNode, _ := rec.Get("p")
		aLabels, _ := rec.Get("auth_labels")
		aNode, _ := rec.Get("auth")

		p := pNode.(neo4j.Node)
		fmt.Printf("   - Post Labels: %v\n", p.Labels)
		fmt.Println("     Post Props:")
		for k, v := range p.Props {
			fmt.Printf("       %s: %v\n", k, v)
		}

		if aNode != nil {
			auth := aNode.(neo4j.Node)
			fmt.Printf("     Autore Labels: %v\n", aLabels)
			fmt.Println("     Autore Props:")
			for k, v := range auth.Props {
				fmt.Printf("       %s: %v\n", k, v)
			}
		} else {
			fmt.Println("     [ERR] Nessun autore trovato per questo post!")
		}
	}

	// Query 3: Check User and Action
	fmt.Println("\n3. Verifica User 7 e Azioni:")
	res3, _ := session.Run(ctx, "MATCH (u:User {id: '7'})-[r:ACTION]->(p:Post) RETURN count(r) as action_count", nil)
	if res3.Next(ctx) {
		count, _ := res3.Record().Get("action_count")
		fmt.Printf("   - User '7' (string) ha %v azioni.\n", count)
	}

	res4, _ := session.Run(ctx, "MATCH (u:User {id: 7})-[r:ACTION]->(p:Post) RETURN count(r) as action_count", nil)
	if res4.Next(ctx) {
		count, _ := res4.Record().Get("action_count")
		fmt.Printf("   - User 7 (int) ha %v azioni.\n", count)
	}
}

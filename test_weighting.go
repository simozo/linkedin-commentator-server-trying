package main

import (
	"bytes"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"
)

type AuthRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

type AuthResponse struct {
	Token         string `json:"token"`
	SigningSecret string `json:"signing_secret"`
}

type Mention struct {
	Name string `json:"name"`
	Slug string `json:"slug"`
	Type string `json:"type"`
}

type CoCommenter struct {
	Name           string `json:"name"`
	Slug           string `json:"slug"`
	CommentSnippet string `json:"comment_snippet"`
}

type Event struct {
	UserID          string        `json:"user_id"`
	PostUrn         string        `json:"post_urn"`
	Action          string        `json:"action"`
	AuthorSlug      string        `json:"author_slug"`
	AuthorName      string        `json:"author_name"`
	InteractionType string        `json:"interaction_type"`
	InteractorName  string        `json:"interactor_name"`
	InteractorSlug  string        `json:"interactor_slug"`
	Mentions        []Mention     `json:"mentions"`
	CoCommenters    []CoCommenter `json:"co_commenters"`
	Timestamp       time.Time     `json:"timestamp"`
}

func main() {
	fmt.Println("=== 1. Logging into Auth Service ===")
	authReq := AuthRequest{Email: "test@example.com", Password: "password123"}
	authReqBody, _ := json.Marshal(authReq)
	resp, err := http.Post("http://localhost:4000/login", "application/json", bytes.NewBuffer(authReqBody))
	if err != nil {
		fmt.Printf("Error logging in: %v\n", err)
		return
	}
	var authResp AuthResponse
	json.NewDecoder(resp.Body).Decode(&authResp)
	resp.Body.Close()

	if authResp.Token == "" {
		fmt.Println("Failed to get token!")
		return
	}

	fmt.Println("=== 2. Creating a valid bridge path for Warm Reach Map ===")
	// Logic: Me -> Post A <- BridgePerson -> Post B <- TargetPerson

	// 1. Me visited Post A, where BridgePerson also commented
	sendEvent(authResp, Event{
		PostUrn:    "urn:li:activity:post_a_bridge",
		Action:     "post_viewed",
		AuthorSlug: "author_random_1",
		AuthorName: "Random Author",
		CoCommenters: []CoCommenter{
			{Name: "Bridge Person", Slug: "bridge_test", CommentSnippet: "This is a great insight!"},
		},
	})

	// 2. Both BridgePerson and TargetPerson commented on Post B
	sendEvent(authResp, Event{
		PostUrn:    "urn:li:activity:post_b_bridge",
		Action:     "post_viewed",
		AuthorSlug: "author_random_2",
		AuthorName: "Another Author",
		CoCommenters: []CoCommenter{
			{Name: "Bridge Person", Slug: "bridge_test", CommentSnippet: "I agree with the point above."},
			{Name: "Target Person", Slug: "target_person_test", CommentSnippet: "Very interesting point of view."},
		},
	})

	fmt.Println("\n=== SUCCESS: Bridge path events sent! ===")
	fmt.Println("1. Wait ~10s for 'event-service' to flush to Neo4j.")
	fmt.Println("2. Wait ~60s for 'WeightWorker' to run.")
	fmt.Println("3. Refresh the Dashboard Reach page.")
}

func sendEvent(auth AuthResponse, event Event) {
	if event.Timestamp.IsZero() {
		event.Timestamp = time.Now()
	}
	body, _ := json.Marshal(event)

	// Sign payload
	secretBytes, _ := hex.DecodeString(auth.SigningSecret)
	mac := hmac.New(sha256.New, secretBytes)
	mac.Write(body)
	signature := hex.EncodeToString(mac.Sum(nil))

	req, _ := http.NewRequest("POST", "http://localhost:3100/events", bytes.NewBuffer(body))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+auth.Token)
	req.Header.Set("X-Signature", signature)

	client := &http.Client{}
	resp, err := client.Do(req)
	if err != nil {
		fmt.Printf("Request error: %v\n", err)
		return
	}
	defer resp.Body.Close()
	b, _ := io.ReadAll(resp.Body)
	fmt.Printf("Sent %s: %s\n", event.PostUrn, string(b))
}

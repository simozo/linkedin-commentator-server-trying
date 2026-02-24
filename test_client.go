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
)

type AuthRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

type AuthResponse struct {
	Token         string `json:"token"`
	SigningSecret string `json:"signing_secret"`
}

type Event struct {
	URL    string `json:"url"`
	Title  string `json:"title"`
	Action string `json:"action"`
}

func main() {
	fmt.Println("=== 1. Logging into Auth Service ===")
	authReq := AuthRequest{
		Email:    "test@example.com",
		Password: "password123",
	}
	authReqBody, _ := json.Marshal(authReq)

	resp, err := http.Post("http://localhost:4000/login", "application/json", bytes.NewBuffer(authReqBody))
	if err != nil {
		fmt.Printf("Login failed: %v\n", err)
		return
	}
	defer resp.Body.Close()

	if resp.StatusCode != 200 {
		fmt.Printf("Login returned status code: %d\n", resp.StatusCode)
		return
	}

	var authResp AuthResponse
	json.NewDecoder(resp.Body).Decode(&authResp)
	fmt.Printf("Logged in! JWT: %s...\n", authResp.Token[:15])
	fmt.Printf("Signing Secret: %s\n", authResp.SigningSecret)

	fmt.Println("\n=== 2. Creating Event and Signing ===")
	eventReq := Event{
		URL:    "https://linkedin.com/feed",
		Title:  "LinkedIn Feed Test",
		Action: "visit",
	}
	eventReqBody, _ := json.Marshal(eventReq)

	// Sign payload
	mac := hmac.New(sha256.New, []byte(authResp.SigningSecret))
	mac.Write(eventReqBody)
	signature := hex.EncodeToString(mac.Sum(nil))
	fmt.Printf("Event Payload: %s\n", string(eventReqBody))
	fmt.Printf("Calculated HMAC: %s\n", signature)

	fmt.Println("\n=== 3. Sending Event to Event Service ===")
	req, err := http.NewRequest("POST", "http://localhost:3000/events", bytes.NewBuffer(eventReqBody))
	if err != nil {
		fmt.Printf("Failed to create request: %v\n", err)
		return
	}

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+authResp.Token)
	req.Header.Set("X-Signature", signature)

	client := &http.Client{}
	eventResp, err := client.Do(req)
	if err != nil {
		fmt.Printf("Failed to send event: %v\n", err)
		return
	}
	defer eventResp.Body.Close()

	bodyBytes, _ := io.ReadAll(eventResp.Body)
	fmt.Printf("Event Service Response (%d): %s\n", eventResp.StatusCode, string(bodyBytes))

	if eventResp.StatusCode == 200 {
		fmt.Println("\n=== SUCCESS: Event received and queued! Wait 10s to see it pop into Neo4j. ===")
	} else {
		fmt.Println("\n=== FAILED : Event not accepted by Event Service. ===")
	}
}

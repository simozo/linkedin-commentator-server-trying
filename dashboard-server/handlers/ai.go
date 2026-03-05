package handlers

import (
	"bytes"
	"context"
	"dashboard-server/database"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/neo4j/neo4j-go-driver/v5/neo4j"
)

const (
	AnthropicVersion = "2023-06-01"
	AnthropicURL     = "https://api.anthropic.com/v1/messages"
	AnthropicModel   = "claude-sonnet-4-5"
)

type AnthropicRequest struct {
	Model     string             `json:"model"`
	MaxTokens int                `json:"max_tokens"`
	System    string             `json:"system"`
	Messages  []AnthropicMessage `json:"messages"`
}

type AnthropicMessage struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

type AnthropicResponse struct {
	Content []struct {
		Type string `json:"type"`
		Text string `json:"text"`
	} `json:"content"`
	Error *struct {
		Message string `json:"message"`
	} `json:"error,omitempty"`
}

type AIRequest struct {
	PostText            string      `json:"postText"`
	CommentsText        string      `json:"commentsText"`
	ProfessionalContext string      `json:"professionalContext,omitempty"`
	UserName            string      `json:"userName,omitempty"`
	Purposes            []string    `json:"purposes,omitempty"`
	TriggerData         interface{} `json:"triggerData,omitempty"`
	Sector              string      `json:"sector,omitempty"`
	AuthorDegree        string      `json:"authorDegree,omitempty"`
	Tone                string      `json:"tone,omitempty"`
}

func callAnthropic(system string, userContent string) (string, error) {
	apiKey := os.Getenv("ANTHROPIC_API_KEY")
	if apiKey == "" {
		return "", fmt.Errorf("ANTHROPIC_API_KEY non configurata sul server")
	}

	reqBody := AnthropicRequest{
		Model:     AnthropicModel,
		MaxTokens: 2048,
		System:    system,
		Messages: []AnthropicMessage{
			{Role: "user", Content: userContent},
		},
	}

	jsonBody, _ := json.Marshal(reqBody)
	req, err := http.NewRequest("POST", AnthropicURL, bytes.NewBuffer(jsonBody))
	if err != nil {
		return "", err
	}

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("x-api-key", apiKey)
	req.Header.Set("anthropic-version", AnthropicVersion)

	client := &http.Client{}
	resp, err := client.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	body, _ := io.ReadAll(resp.Body)
	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("Anthropic API error: %d - %s", resp.StatusCode, string(body))
	}

	var anthropicResp AnthropicResponse
	if err := json.Unmarshal(body, &anthropicResp); err != nil {
		return "", err
	}

	if len(anthropicResp.Content) > 0 && anthropicResp.Content[0].Type == "text" {
		return anthropicResp.Content[0].Text, nil
	}

	return "", fmt.Errorf("Risposta Anthropic vuota o non valida")
}

func SuggestPurposes(c *fiber.Ctx) error {
	var req AIRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid request body"})
	}

	hasProfessionalContext := req.ProfessionalContext != ""
	systemPrompt := getSystemPrompt("purposes", hasProfessionalContext, req.UserName)
	userPrompt := buildPurposesPrompt(req)

	result, err := callAnthropic(systemPrompt, userPrompt)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}

	// Tentativo di parsing JSON robusto
	jsonStr := extractJSON(result)
	var parsedResponse interface{}
	if err := json.Unmarshal([]byte(jsonStr), &parsedResponse); err == nil {
		return c.JSON(parsedResponse)
	}

	return c.JSON(fiber.Map{"raw": result, "purposes": []string{}})
}

func GenerateComment(c *fiber.Ctx) error {
	var req AIRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid request body"})
	}

	userID := fmt.Sprint(c.Locals("user_id"))
	tier, _ := c.Locals("tier").(string)

	// Fall back to JWT claims if payload fields are empty
	if req.Sector == "" {
		if s, ok := c.Locals("sector").(string); ok {
			req.Sector = s
		}
	}
	if req.Tone == "" {
		if t, ok := c.Locals("tone").(string); ok {
			req.Tone = t
		}
		if req.Tone == "" {
			req.Tone = "professional"
		}
	}

	// Enforcement for Free tier
	if tier == "" || tier == "free" {
		ctx := context.Background()
		session := database.Neo4jDriver.NewSession(ctx, neo4j.SessionConfig{AccessMode: neo4j.AccessModeRead})
		defer session.Close(ctx)

		result, err := session.ExecuteRead(ctx, func(tx neo4j.ManagedTransaction) (any, error) {
			query := `
			MATCH (u:User {id: $userId})-[a:ACTION]->(p:Post)
			WHERE a.type = 'comment_generated' AND date(datetime(a.timestamp)) = date()
			RETURN count(a) AS count
			`
			rec, err := tx.Run(ctx, query, map[string]any{"userId": userID})
			if err != nil {
				return int64(0), err
			}
			if rec.Next(ctx) {
				count, _ := rec.Record().Get("count")
				return count.(int64), nil
			}
			return int64(0), nil
		})

		if err == nil && result.(int64) >= FreeDailyLimit {
			return c.Status(403).JSON(fiber.Map{
				"error":            "Limit reached",
				"is_limit_reached": true,
				"message":          "Hai raggiunto il limite di 5 commenti per oggi. Passa a Pro per commenti illimitati.",
			})
		}
	}

	systemPrompt := getSystemPrompt("comment", false, req.UserName)
	userPrompt := buildCommentPrompt(req)

	result, err := callAnthropic(systemPrompt, userPrompt)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}

	// Tentativo di parsing JSON robusto
	jsonStr := extractJSON(result)
	var parsedResponse interface{}
	if err := json.Unmarshal([]byte(jsonStr), &parsedResponse); err == nil {
		// Log the action to Neo4j to increment the count
		go logAIAction(userID, "comment_generated")
		return c.JSON(parsedResponse)
	}

	return c.JSON(fiber.Map{"comment": result})
}

func logAIAction(userID string, actionType string) {
	// We use the event-service pattern but here we can just write a quick ACTION node
	// Better: Use a simple Cypher query if we have Neo4j access
	ctx := context.Background()
	session := database.Neo4jDriver.NewSession(ctx, neo4j.SessionConfig{AccessMode: neo4j.AccessModeWrite})
	defer session.Close(ctx)

	session.ExecuteWrite(ctx, func(tx neo4j.ManagedTransaction) (any, error) {
		query := `
		MERGE (u:User {id: $userId})
		CREATE (u)-[:ACTION {type: $action, timestamp: $ts}]->(:Post {urn: 'ai_gen_internal'})
		`
		tx.Run(ctx, query, map[string]any{
			"userId": userID,
			"action": actionType,
			"ts":     time.Now().Format(time.RFC3339),
		})
		return nil, nil
	})
}

func extractJSON(s string) string {
	start := bytes.IndexByte([]byte(s), '{')
	end := bytes.LastIndexByte([]byte(s), '}')
	if start != -1 && end != -1 && end > start {
		return s[start : end+1]
	}
	return s
}

func getSystemPrompt(mode string, hasProfessionalContext bool, userName string) string {
	if mode == "purposes" {
		contextInstruction := ""
		if hasProfessionalContext {
			contextInstruction = ` Se ti viene fornito un "Contesto professionale dell'utente", il PRIMO scopo nella lista "purposes" deve essere uno scopo suggerito in base a quel contesto (es. coerente con il ruolo, le competenze o gli obiettivi professionali dell'utente); gli altri scopi restano generici e utili per il post.`
		}
		identityConstraint := ""
		if userName != "" {
			identityConstraint = fmt.Sprintf(`\n- IDENTITÀ UTENTE: L'utente si chiama "%s". NON suggerire MAI di rispondere ai commenti scritti da "%s". Se vedi un suo commento, ignoralo nella scelta dell'opzione strategica.`, userName, userName)
		}

		return `Sei un assistente esperto di personal branding su LinkedIn. Il tuo obiettivo è aiutare l'utente a generare engagement di valore e lead B2B attraverso i commenti.
Il tuo compito è analizzare il testo del post (e eventuali commenti esistenti) e:
1. Estrapolare un titolo sintetico dell'annuncio/post (max 10-12 parole).
2. Proporre 3-5 possibili SCOPI per un commento.
3. LOGICA STRATEGICA (Obbligatoria): Analizza i commenti esistenti. Uno degli scopi (preferibilmente il secondo) deve essere una "Opzione Strategica".
   - Identifica il commento che merita di più una risposta per aprire un thread di valore (es. un commento con un insight, una domanda o da un profilo rilevante).
   - Inserisci uno scopo nel formato: "Strategico: Rispondi a [Nome Autore] con un [Tipo di intervento: insight/domanda/esperienza] su [Argomento specifico] per stimolare la discussione".
   - Segui i principi del network strategico: valore aggiunto (>10 parole), domande aperte, costruzione di catene di conversazione.
   - Se non ci sono commenti, l'opzione strategica deve suggerire come stimolare la prima discussione sul post stesso.` + identityConstraint + `

` + contextInstruction + `
Rispondi SOLO con un JSON valido, senza altro testo prima o dopo, nel formato:
{"title": "Titolo sintetico del post", "purposes": ["Scopo 1", "Scopo 2", "Scopo 3", ...]}
Ogni scopo deve essere una breve frase in italiano.`
	}

	return `Sei un assistente che scrive commenti professionali e naturali per post LinkedIn.
Il tuo compito è scrivere UN SOLO commento rispettando le seguenti regole:

1. LINGUA: Identifica la lingua del post (o del commento a cui si risponde) e scrivi il commento NELLA STESSA LINGUA.
2. TRADUZIONE: Fornisci SEMPRE anche una traduzione in ITALIANO del commento che hai generato.
3. FORMATO: Rispondi ESCLUSIVAMENTE con un oggetto JSON valido (niente testo prima o dopo) nel seguente formato:
   {"comment": "testo del commento nella lingua originale", "translation": "traduzione del commento in italiano"}

REGOLE DI SCRITTURA (nel commento originale):
- Breve (2-4 frasi), tono professionale ma umano.
- Nessun emoji e nessun simbolo decorativo.
- Nessun trattino lungo (—, –, o simili): non usare il trattino per introdurre incisi o secondarie. Usa invece virgole, due punti, punto e virgola o frasi separate con il punto.
- Usa solo punteggiatura grammaticale standard.
- Non ringraziare l'autore del post a meno che il post non condivida un link a una risorsa o parli di esperienze personali. In tutti gli altri casi, entra direttamente nel merito senza preamboli.`
}

func buildPurposesPrompt(req AIRequest) string {
	text := fmt.Sprintf("Testo del post:\n%s\n", req.PostText)
	if req.CommentsText != "" {
		text += fmt.Sprintf("\nCommenti esistenti (per contesto):\n%s\n", req.CommentsText)
	}

	// Gestione triggerData (se presente)
	if req.TriggerData != nil {
		if td, ok := req.TriggerData.(map[string]interface{}); ok {
			isCommenter, _ := td["isCommenter"].(bool)
			authorName, _ := td["authorName"].(string)
			commentText, _ := td["commentText"].(string)
			if isCommenter {
				text += fmt.Sprintf("\nATTENZIONE: L'utente target %s ha commentato questo post con: \"%s\".\n", authorName, commentText)
				text += "DEVI includere come priorità (Opzione Strategica) una risposta diretta a questo commento specifico.\n"
			}
		}
	}

	if req.ProfessionalContext != "" {
		text += fmt.Sprintf("\nContesto professionale dell'utente (usa per proporre come primo scopo un suggerimento coerente con questo profilo):\n%s\n", req.ProfessionalContext)
	}
	text += "\nProponi 3-5 possibili scopi per un commento a questo post (solo JSON come indicato)."
	return text
}

func buildCommentPrompt(req AIRequest) string {
	text := fmt.Sprintf("Testo del post:\n%s\n", req.PostText)
	if req.CommentsText != "" {
		text += fmt.Sprintf("\nCommenti esistenti:\n%s\n", req.CommentsText)
	}

	// Gestione triggerData per commento
	if req.TriggerData != nil {
		if td, ok := req.TriggerData.(map[string]interface{}); ok {
			isCommenter, _ := td["isCommenter"].(bool)
			authorName, _ := td["authorName"].(string)
			commentText, _ := td["commentText"].(string)
			if isCommenter {
				text += fmt.Sprintf("\nL'utente ha scelto di rispondere specificamente a %s, che ha scritto: \"%s\".\n", authorName, commentText)
			}
		}
	}

	if req.Sector != "" {
		text += fmt.Sprintf("\nSettore professionale dell'utente: %s\n", req.Sector)
	}
	if req.AuthorDegree != "" {
		text += fmt.Sprintf("\nGrado di connessione con l'autore del post: %s\n", req.AuthorDegree)
	}
	toneLabels := map[string]string{
		"professional":   "professionale e autorevole",
		"direct":         "diretto e conciso",
		"conversational": "conversazionale e informale",
	}
	if label, ok := toneLabels[req.Tone]; ok {
		text += fmt.Sprintf("\nTono richiesto per il commento: %s\n", label)
	}

	purposesStr, _ := json.Marshal(req.Purposes)
	text += fmt.Sprintf("\nScopo/i scelto/i per il commento: %s\n", string(purposesStr))
	text += "\nGenera il commento e la relativa traduzione in italiano (solo JSON come indicato). Se stai rispondendo a un commento, scrivi una risposta diretta e naturale nella lingua del commento originale."
	return text
}

// OrbitingSuggestionResponse defines the AI output for a bridge strategy
type OrbitingSuggestionResponse struct {
	TargetName string `json:"targetName"`
	BridgeName string `json:"bridgeName"`
	Strategy   string `json:"strategy"`
	Reasoning  string `json:"reasoning"`
}

// GetOrbitingSuggestion handles GET /api/ai/orbiting-suggestion?target=slug
// It fetches relationship data from Neo4j and uses Claude to explain the best "orbiting" strategy.
func GetOrbitingSuggestion(c *fiber.Ctx) error {
	userID := fmt.Sprint(c.Locals("user_id"))
	targetSlug := c.Query("target")

	if targetSlug == "" {
		return c.Status(400).JSON(fiber.Map{"error": "Target slug is required"})
	}

	ctx := context.Background()
	session := database.Neo4jDriver.NewSession(ctx, neo4j.SessionConfig{AccessMode: neo4j.AccessModeRead})
	defer session.Close(ctx)

	// Fetch specific bridge data for this target
	result, err := session.ExecuteRead(ctx, func(tx neo4j.ManagedTransaction) (any, error) {
		query := `
		MATCH (me:User {id: $userId})-[:ACTION]->(p:Post)
		      <-[r1:COMMENTED_ON]-(bridge:Person)
		      -[r2:COMMENTED_ON]->(p2:Post)
		      <-[r3:COMMENTED_ON]-(target:Person {slug: $targetSlug})
		RETURN
		  target.name   AS target_name,
		  bridge.name   AS bridge_name,
		  p2.text       AS shared_post_text,
		  p2.urn        AS shared_post_urn,
		  sum(coalesce(r1.weight, 1) + coalesce(r2.weight, 1) + coalesce(r3.weight, 1)) AS path_strength
		ORDER BY path_strength DESC
		LIMIT 1
		`
		rec, err := tx.Run(ctx, query, map[string]any{"userId": userID, "targetSlug": targetSlug})
		if err != nil {
			return nil, err
		}
		if rec.Next(ctx) {
			r := rec.Record()
			getString := func(key string) string {
				v, _ := r.Get(key)
				if v == nil {
					return ""
				}
				return fmt.Sprint(v)
			}
			return map[string]string{
				"target_name":      getString("target_name"),
				"bridge_name":      getString("bridge_name"),
				"shared_post_text": getString("shared_post_text"),
				"shared_post_urn":  getString("shared_post_urn"),
			}, nil
		}
		return nil, fmt.Errorf("No bridge found for this target")
	})

	if err != nil {
		return c.Status(404).JSON(fiber.Map{"error": err.Error()})
	}

	data := result.(map[string]string)

	// Prepare AI Prompt
	systemPrompt := `Sei un esperto di strategie di networking su LinkedIn. 
Il tuo compito è spiegare a un utente come usare una "Persona Ponte" (Bridge) per farsi notare da un "Profilo Target".
L'utente vuole "entrare nell'orbita" del Target senza sembrare uno stalker o fare spam.

Rispondi ESCLUSIVAMENTE con un JSON valido:
{
  "targetName": "Nome del target",
  "bridgeName": "Nome del ponte",
  "strategy": "Un consiglio pratico di 2-3 frasi su cosa fare (es. commentare il post condiviso citando il ponte)",
  "reasoning": "Spiegazione logica di perché questo ponte è forte"
}`

	userPrompt := fmt.Sprintf(`
Target: %s
Persona Ponte: %s
Post condiviso da entrambi: %s

Suggerisci una strategia di "Orbiting" (avvicinamento indiretto) intelligente.`,
		data["target_name"], data["bridge_name"], data["shared_post_text"])

	aiResult, err := callAnthropic(systemPrompt, userPrompt)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "AI Suggestion failed: " + err.Error()})
	}

	jsonStr := extractJSON(aiResult)
	var response OrbitingSuggestionResponse
	if err := json.Unmarshal([]byte(jsonStr), &response); err != nil {
		return c.JSON(fiber.Map{"raw": aiResult})
	}

	return c.JSON(response)
}

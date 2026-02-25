package handlers

import (
	"crypto/rand"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"
	"strings"

	"auth-service/database"
	"auth-service/models"

	"github.com/gofiber/fiber/v2"
)

// oauthState is embedded in the OAuth2 state parameter to survive the round-trip.
type oauthState struct {
	Source string `json:"source"` // "plugin" or ""
	Nonce  string `json:"nonce"`  // random hex for basic CSRF protection
	Ext    string `json:"ext"`    // Chrome extension ID (passed from plugin)
}

// LinkedInInit redirects to the LinkedIn OAuth2 authorization page.
// Accepts optional ?source=plugin query param, which is preserved through the OAuth flow.
func LinkedInInit(c *fiber.Ctx) error {
	clientID := os.Getenv("LINKEDIN_CLIENT_ID")
	redirectURI := os.Getenv("LINKEDIN_REDIRECT_URI")

	source := c.Query("source")
	ext := c.Query("ext") // Chrome extension ID from plugin

	nonceBytes := make([]byte, 8)
	rand.Read(nonceBytes) //nolint:errcheck — rand.Read never fails on modern Go
	stateObj := oauthState{Source: source, Nonce: fmt.Sprintf("%x", nonceBytes), Ext: ext}
	stateJSON, _ := json.Marshal(stateObj)
	state := base64.RawURLEncoding.EncodeToString(stateJSON)

	authURL := fmt.Sprintf(
		"https://www.linkedin.com/oauth/v2/authorization?response_type=code&client_id=%s&redirect_uri=%s&scope=%s&state=%s",
		url.QueryEscape(clientID),
		url.QueryEscape(redirectURI),
		url.QueryEscape("openid profile email"),
		url.QueryEscape(state),
	)

	return c.Redirect(authURL, fiber.StatusFound)
}

// LinkedInCallback handles the OAuth2 callback from LinkedIn.
func LinkedInCallback(c *fiber.Ctx) error {
	// Decode state to recover source + ext (extension ID)
	source := ""
	ext := ""
	if rawState := c.Query("state"); rawState != "" {
		if decoded, err := base64.RawURLEncoding.DecodeString(rawState); err == nil {
			var stateObj oauthState
			if json.Unmarshal(decoded, &stateObj) == nil {
				source = stateObj.Source
				ext = stateObj.Ext
			}
		}
	}

	code := c.Query("code")
	if code == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Missing authorization code"})
	}

	// Step 1: Exchange code for access token
	accessToken, err := exchangeCodeForToken(code)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to exchange code: " + err.Error()})
	}

	// Step 2: Get user info from LinkedIn OpenID Connect /userinfo
	liUser, err := getLinkedInUserInfo(accessToken)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to get LinkedIn user info: " + err.Error()})
	}

	// Step 3: Upsert user in PostgreSQL
	var user models.User
	result := database.DB.Where("email = ?", liUser.Email).First(&user)
	if result.Error != nil {
		user = models.User{
			Email:        liUser.Email,
			AuthProvider: "linkedin",
			LinkedInID:   &liUser.Sub,
			AvatarURL:    &liUser.Picture,
			FullName:     &liUser.Name,
		}
		if err := database.DB.Create(&user).Error; err != nil {
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to create user"})
		}
	} else if user.AuthProvider == "local" {
		user.LinkedInID = &liUser.Sub
		user.AvatarURL = &liUser.Picture
		user.FullName = &liUser.Name
		database.DB.Save(&user)
	}

	// Step 4: Always set a web session cookie for the dashboard
	if err := createWebSession(user.ID, c); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to create session"})
	}

	// Step 5: Redirect to the Fiber callback page (localhost:4000/auth/callback)
	// Plugin flow: include JWT+HMAC+source+ext in URL so the HTML page JS can call sendMessage
	// Dashboard flow: no tokens in URL, session cookie already set → page JS redirects to /dashboard
	if source == "plugin" {
		jwtToken, signingSecret, err := generateSessionTokens(user.ID)
		if err != nil {
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to generate plugin session"})
		}
		redirectURL := fmt.Sprintf(
			"http://localhost:4000/auth/callback?token=%s&secret=%s&source=plugin&ext=%s",
			url.QueryEscape(jwtToken),
			url.QueryEscape(signingSecret),
			url.QueryEscape(ext),
		)
		return c.Redirect(redirectURL, fiber.StatusFound)
	}

	// Dashboard flow: tokens stay server-side, only cookie was set
	return c.Redirect("http://localhost:4000/auth/callback", fiber.StatusFound)
}

// --- LinkedIn API helpers ---

type linkedInUserInfo struct {
	Sub     string `json:"sub"`
	Name    string `json:"name"`
	Email   string `json:"email"`
	Picture string `json:"picture"`
}

func exchangeCodeForToken(code string) (string, error) {
	clientID := os.Getenv("LINKEDIN_CLIENT_ID")
	clientSecret := os.Getenv("LINKEDIN_CLIENT_SECRET")
	redirectURI := os.Getenv("LINKEDIN_REDIRECT_URI")

	data := url.Values{}
	data.Set("grant_type", "authorization_code")
	data.Set("code", code)
	data.Set("redirect_uri", redirectURI)
	data.Set("client_id", clientID)
	data.Set("client_secret", clientSecret)

	resp, err := http.PostForm("https://www.linkedin.com/oauth/v2/accessToken", data)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	body, _ := io.ReadAll(resp.Body)

	var tokenResp struct {
		AccessToken string `json:"access_token"`
		Error       string `json:"error"`
	}
	if err := json.Unmarshal(body, &tokenResp); err != nil {
		return "", fmt.Errorf("failed to parse token response")
	}
	if tokenResp.Error != "" {
		return "", fmt.Errorf("linkedin error: %s", tokenResp.Error)
	}
	if tokenResp.AccessToken == "" {
		return "", fmt.Errorf("empty access_token in response: %s", string(body))
	}

	return tokenResp.AccessToken, nil
}

func getLinkedInUserInfo(accessToken string) (*linkedInUserInfo, error) {
	req, err := http.NewRequest("GET", "https://api.linkedin.com/v2/userinfo", nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Authorization", "Bearer "+accessToken)
	req.Header.Set("Content-Type", "application/json")

	client := &http.Client{}
	resp, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	body, _ := io.ReadAll(resp.Body)

	if strings.Contains(string(body), `"status":`) && !strings.Contains(string(body), `"sub"`) {
		return nil, fmt.Errorf("linkedin userinfo error: %s", string(body))
	}

	var userInfo linkedInUserInfo
	if err := json.Unmarshal(body, &userInfo); err != nil {
		return nil, fmt.Errorf("failed to parse userinfo: %s", string(body))
	}

	if userInfo.Email == "" {
		return nil, fmt.Errorf("no email returned from LinkedIn. Ensure OpenID Connect scope includes 'email'")
	}

	return &userInfo, nil
}

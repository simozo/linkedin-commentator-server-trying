package handlers

import (
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"os"
	"time"

	"auth-service/database"
	"auth-service/models"

	"github.com/gofiber/fiber/v2"
	"github.com/golang-jwt/jwt/v5"
)


// SessionMeResponse is the payload returned by GET /me.
type SessionMeResponse struct {
	UserID             uint    `json:"user_id"`
	Email              string  `json:"email"`
	FullName           *string `json:"full_name,omitempty"`
	AvatarURL          *string `json:"avatar_url,omitempty"`
	AuthProvider       string  `json:"auth_provider"`
	Tier               string  `json:"tier"`
	OnboardingComplete bool    `json:"onboarding_complete"`
	OnboardingGoal     string  `json:"onboarding_goal,omitempty"`
	Sector             string  `json:"sector,omitempty"`
	Role               string  `json:"role,omitempty"`
	PreferredTone      string  `json:"preferred_tone,omitempty"`
	ExtensionLinked    bool    `json:"extension_linked"`
}

const sessionCookieName = "session"
const sessionTTL = 7 * 24 * time.Hour

// createWebSession generates a random session token, stores it in Redis,
// and sets an HttpOnly cookie on the response.
func createWebSession(userID uint, c *fiber.Ctx) error {
	tokenBytes := make([]byte, 32)
	if _, err := rand.Read(tokenBytes); err != nil {
		return fmt.Errorf("failed to generate session token: %w", err)
	}
	sessionToken := hex.EncodeToString(tokenBytes)

	ctx := database.Ctx
	if err := database.RedisClient.Set(ctx, "session:"+sessionToken, fmt.Sprint(userID), sessionTTL).Err(); err != nil {
		return fmt.Errorf("failed to store session in Redis: %w", err)
	}

	c.Cookie(&fiber.Cookie{
		Name:     sessionCookieName,
		Value:    sessionToken,
		HTTPOnly: true,
		SameSite: "Lax",
		Path:     "/",
		MaxAge:   int(sessionTTL.Seconds()),
	})
	return nil
}

// getUserIDFromSession reads the session cookie and returns the user_id from Redis.
// Returns 0 and an error if the session is invalid or expired.
func getUserIDFromSession(c *fiber.Ctx) (uint, error) {
	token := c.Cookies(sessionCookieName)
	if token == "" {
		return 0, fmt.Errorf("no session cookie")
	}
	ctx := database.Ctx
	val, err := database.RedisClient.Get(ctx, "session:"+token).Result()
	if err != nil {
		return 0, fmt.Errorf("session not found or expired")
	}
	var userID uint
	if _, err := fmt.Sscan(val, &userID); err != nil {
		return 0, fmt.Errorf("invalid session data")
	}
	return userID, nil
}

// Me handles GET /me — returns the authenticated user's info from the session cookie.
func Me(c *fiber.Ctx) error {
	userID, err := getUserIDFromSession(c)
	if err != nil {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "Unauthorized"})
	}

	var user models.User
	if err := database.DB.First(&user, userID).Error; err != nil {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "User not found"})
	}

	return c.JSON(SessionMeResponse{
		UserID:             user.ID,
		Email:              user.Email,
		FullName:           user.FullName,
		AvatarURL:          user.AvatarURL,
		AuthProvider:       user.AuthProvider,
		Tier:               user.Tier,
		OnboardingComplete: user.OnboardingComplete,
		OnboardingGoal:     user.OnboardingGoal,
		Sector:             user.Sector,
		Role:               user.Role,
		PreferredTone:      user.PreferredTone,
		ExtensionLinked:    user.ExtensionInstallToken != nil,
	})
}

// LogoutWeb handles POST /logout-web — clears the session cookie and Redis entry.
func LogoutWeb(c *fiber.Ctx) error {
	token := c.Cookies(sessionCookieName)
	if token != "" {
		ctx := database.Ctx
		database.RedisClient.Del(ctx, "session:"+token)
	}
	c.ClearCookie(sessionCookieName)
	return c.JSON(fiber.Map{"message": "Logged out"})
}

// OnboardingRequest is the body for POST /profile/onboarding.
type OnboardingRequest struct {
	Goal  string `json:"goal"`  // "presence" | "network"
	Sector string `json:"sector"`
	Role  string `json:"role"`
	Tone  string `json:"tone"`  // "professional" | "direct" | "conversational"
}

// SaveOnboarding handles POST /profile/onboarding — persists onboarding choices and marks the user as onboarded.
func SaveOnboarding(c *fiber.Ctx) error {
	userID, err := getUserIDFromSession(c)
	if err != nil {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "Unauthorized"})
	}

	var req OnboardingRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid request body"})
	}

	tone := req.Tone
	if tone == "" {
		tone = "professional"
	}

	updates := map[string]any{
		"onboarding_complete": true,
		"onboarding_goal":     req.Goal,
		"sector":              req.Sector,
		"role":                req.Role,
		"preferred_tone":      tone,
	}
	if err := database.DB.Model(&models.User{}).Where("id = ?", userID).Updates(updates).Error; err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Failed to save onboarding data"})
	}

	return c.JSON(fiber.Map{"ok": true})
}

// UpdateProfileRequest is the body for PUT /profile.
type UpdateProfileRequest struct {
	Goal   string `json:"goal"`
	Sector string `json:"sector"`
	Role   string `json:"role"`
	Tone   string `json:"tone"`
}

// UpdateProfile handles PUT /profile — updates AI preferences for the authenticated user.
func UpdateProfile(c *fiber.Ctx) error {
	userID, err := getUserIDFromSession(c)
	if err != nil {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "Unauthorized"})
	}

	var req UpdateProfileRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid request body"})
	}

	tone := req.Tone
	if tone == "" {
		tone = "professional"
	}

	updates := map[string]any{
		"onboarding_goal": req.Goal,
		"sector":          req.Sector,
		"role":            req.Role,
		"preferred_tone":  tone,
	}
	if err := database.DB.Model(&models.User{}).Where("id = ?", userID).Updates(updates).Error; err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Failed to update profile"})
	}

	return c.JSON(fiber.Map{"ok": true})
}

// RefreshPluginToken handles POST /plugin-token/refresh.
// Accepts a valid Bearer JWT and issues a fresh JWT + signing secret without requiring a session cookie.
func RefreshPluginToken(c *fiber.Ctx) error {
	authHeader := c.Get("Authorization")
	if authHeader == "" || len(authHeader) < 8 {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "Missing token"})
	}
	tokenString := authHeader[7:] // strip "Bearer "

	publicKeyBytes, err := os.ReadFile("private.pem") // we have the private key to derive public
	_ = publicKeyBytes
	// Parse + verify the existing JWT using the private key file to get the public key
	privateKeyBytes, err := os.ReadFile("private.pem")
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Could not read key"})
	}
	privateKey, err := jwt.ParseRSAPrivateKeyFromPEM(privateKeyBytes)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Could not parse key"})
	}

	token, err := jwt.Parse(tokenString, func(t *jwt.Token) (interface{}, error) {
		if _, ok := t.Method.(*jwt.SigningMethodRSA); !ok {
			return nil, fmt.Errorf("unexpected signing method")
		}
		return &privateKey.PublicKey, nil
	})

	// Allow slightly expired tokens (up to 1 hour grace) so refresh can happen even if just expired
	if err != nil && !isExpiredOnly(err) {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "Invalid token"})
	}

	claims, ok := token.Claims.(jwt.MapClaims)
	if !ok {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "Invalid claims"})
	}

	var userID uint
	switch v := claims["user_id"].(type) {
	case float64:
		userID = uint(v)
	default:
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "Invalid user_id"})
	}

	jwtToken, signingSecret, err := generateSessionTokens(userID)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Failed to generate token"})
	}

	return c.JSON(fiber.Map{
		"token":          jwtToken,
		"signing_secret": signingSecret,
	})
}

// isExpiredOnly returns true if the only JWT error is token expiry.
func isExpiredOnly(err error) bool {
	if err == nil {
		return false
	}
	return err.Error() == jwt.ErrTokenExpired.Error() ||
		contains(err.Error(), "token is expired")
}

func contains(s, substr string) bool {
	return len(s) >= len(substr) && (s == substr || len(s) > 0 && containsStr(s, substr))
}

func containsStr(s, substr string) bool {
	for i := 0; i <= len(s)-len(substr); i++ {
		if s[i:i+len(substr)] == substr {
			return true
		}
	}
	return false
}

// LinkExtensionRequest is the body for POST /link-extension.
type LinkExtensionRequest struct {
	InstallToken string `json:"install_token"`
}

// LinkExtension handles POST /link-extension — saves the extension install token for the authenticated user.
func LinkExtension(c *fiber.Ctx) error {
	userID, err := getUserIDFromSession(c)
	if err != nil {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "Unauthorized"})
	}

	var req LinkExtensionRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid request body"})
	}
	if req.InstallToken == "" {
		return c.Status(400).JSON(fiber.Map{"error": "install_token is required"})
	}

	if err := database.DB.Model(&models.User{}).Where("id = ?", userID).Update("extension_install_token", req.InstallToken).Error; err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Failed to save install token"})
	}

	return c.JSON(fiber.Map{"ok": true})
}


// GeneratePluginToken handles GET /plugin-token.
// Generates a fresh JWT + HMAC signing secret for the authenticated user's plugin.
func GeneratePluginToken(c *fiber.Ctx) error {
	userID, err := getUserIDFromSession(c)
	if err != nil {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "Unauthorized"})
	}

	jwtToken, signingSecret, err := generateSessionTokens(userID)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Failed to generate plugin token"})
	}

	return c.JSON(fiber.Map{
		"token":          jwtToken,
		"signing_secret": signingSecret,
	})
}

// generateSessionTokens creates a JWT and HMAC signing secret for the plugin.
func generateSessionTokens(userID uint) (string, string, error) {
	ttl := 24 * time.Hour

	claims := jwt.MapClaims{
		"user_id": userID,
		"exp":     time.Now().Add(ttl).Unix(),
	}

	// We need the user's tier to include it in the JWT
	var user models.User
	if err := database.DB.Select("tier", "sector", "preferred_tone", "role").First(&user, userID).Error; err == nil {
		claims["tier"] = user.Tier
		claims["sector"] = user.Sector
		claims["tone"] = user.PreferredTone
		claims["role"] = user.Role
	} else {
		claims["tier"] = "free"
	}

	token := jwt.NewWithClaims(jwt.SigningMethodRS256, claims)

	privateKeyBytes, err := os.ReadFile("private.pem")
	if err != nil {
		return "", "", fmt.Errorf("could not read private key: %w", err)
	}
	privateKey, err := jwt.ParseRSAPrivateKeyFromPEM(privateKeyBytes)
	if err != nil {
		return "", "", fmt.Errorf("could not parse private key: %w", err)
	}

	signedToken, err := token.SignedString(privateKey)
	if err != nil {
		return "", "", fmt.Errorf("could not sign token: %w", err)
	}

	secretBytes := make([]byte, 32)
	if _, err := rand.Read(secretBytes); err != nil {
		return "", "", fmt.Errorf("could not generate signing secret: %w", err)
	}
	signingSecret := hex.EncodeToString(secretBytes)

	ctx := database.Ctx
	if err := database.RedisClient.Set(ctx, "secret:"+fmt.Sprint(userID), signingSecret, ttl).Err(); err != nil {
		return "", "", fmt.Errorf("could not store session secret in Redis: %w", err)
	}

	return signedToken, signingSecret, nil
}

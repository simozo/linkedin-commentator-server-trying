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
	UserID       uint    `json:"user_id"`
	Email        string  `json:"email"`
	FullName     *string `json:"full_name,omitempty"`
	AvatarURL    *string `json:"avatar_url,omitempty"`
	AuthProvider string  `json:"auth_provider"`
	Tier         string  `json:"tier"`
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
		UserID:       user.ID,
		Email:        user.Email,
		FullName:     user.FullName,
		AvatarURL:    user.AvatarURL,
		AuthProvider: user.AuthProvider,
		Tier:         user.Tier,
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

// generateSessionTokens creates a JWT and HMAC signing secret for the plugin.
func generateSessionTokens(userID uint) (string, string, error) {
	ttl := 24 * time.Hour

	claims := jwt.MapClaims{
		"user_id": userID,
		"exp":     time.Now().Add(ttl).Unix(),
	}

	// We need the user's tier to include it in the JWT
	var user models.User
	if err := database.DB.Select("tier").First(&user, userID).Error; err == nil {
		claims["tier"] = user.Tier
	} else {
		claims["tier"] = "free" // Fallback
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

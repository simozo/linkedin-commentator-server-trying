package middleware

import (
	"fmt"
	"os"
	"strings"

	"dashboard-server/database"
	"dashboard-server/logger"

	"github.com/gofiber/fiber/v2"
	"github.com/golang-jwt/jwt/v5"
)

// AuthRequired reads the "session" cookie OR the "Authorization" header.
// It validates against Redis (cookies) or public.pem (JWT).
func AuthRequired(c *fiber.Ctx) error {
	// 1. Try Session Cookie (for Dashboard UI)
	token := c.Cookies("session")
	if token != "" {
		val, err := database.RedisClient.Get(database.Ctx, "session:"+token).Result()
		if err == nil {
			var userID uint
			if _, err := fmt.Sscan(val, &userID); err == nil {
				c.Locals("user_id", userID)
				c.Locals("tier", "free") // Dashboard session defaults to free for now
				return c.Next()
			}
		}
	}

	// 2. Try JWT Bearer (for Extension)
	authHeader := c.Get("Authorization")
	if authHeader != "" && strings.HasPrefix(authHeader, "Bearer ") {
		tokenString := strings.TrimPrefix(authHeader, "Bearer ")

		publicPem, err := os.ReadFile("public.pem")
		if err == nil {
			publicKey, err := jwt.ParseRSAPublicKeyFromPEM(publicPem)
			if err == nil {
				token, err := jwt.Parse(tokenString, func(t *jwt.Token) (interface{}, error) {
					if _, ok := t.Method.(*jwt.SigningMethodRSA); !ok {
						return nil, fiber.ErrUnauthorized
					}
					return publicKey, nil
				})

				if err == nil && token.Valid {
					if claims, ok := token.Claims.(jwt.MapClaims); ok {
						// Convert user_id from token (usually float64 in JWT) to uint
						if uid, ok := claims["user_id"]; ok {
							switch v := uid.(type) {
							case float64:
								c.Locals("user_id", uint(v))
							case string:
								var u uint
								fmt.Sscan(v, &u)
								c.Locals("user_id", u)
							}
						}
						// Extract Tier from JWT
						if tier, ok := claims["tier"].(string); ok {
							c.Locals("tier", tier)
						} else {
							c.Locals("tier", "free")
						}
						return c.Next()
					}
				}
			}
		}
	}

	logger.Warn("auth rejected: invalid or missing credentials", "ip", c.IP(), "path", c.Path())
	return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "Unauthorized"})
}

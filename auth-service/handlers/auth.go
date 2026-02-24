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
	"golang.org/x/crypto/bcrypt"
)

type AuthRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

func Register(c *fiber.Ctx) error {
	var req AuthRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid request body"})
	}

	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Failed to hash password"})
	}

	user := models.User{
		Email:    req.Email,
		Password: string(hashedPassword),
	}

	if err := database.DB.Create(&user).Error; err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Email already exists or failed to create user"})
	}

	return c.JSON(fiber.Map{"message": "User successfully registered"})
}

func Login(c *fiber.Ctx) error {
	var req AuthRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid request body"})
	}

	var user models.User
	if err := database.DB.Where("email = ?", req.Email).First(&user).Error; err != nil {
		return c.Status(401).JSON(fiber.Map{"error": "Invalid credentials"})
	}

	if err := bcrypt.CompareHashAndPassword([]byte(user.Password), []byte(req.Password)); err != nil {
		return c.Status(401).JSON(fiber.Map{"error": "Invalid credentials"})
	}

	// Generate JWT using RS256
	ttl := 24 * time.Hour
	claims := jwt.MapClaims{
		"user_id": user.ID,
		"exp":     time.Now().Add(ttl).Unix(),
	}

	token := jwt.NewWithClaims(jwt.SigningMethodRS256, claims)

	privateKeyBytes, err := os.ReadFile("private.pem")
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Could not read private key"})
	}

	privateKey, err := jwt.ParseRSAPrivateKeyFromPEM(privateKeyBytes)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Could not parse private key"})
	}

	t, err := token.SignedString(privateKey)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Could not login"})
	}

	// Generate Signing Secret for Plugin
	bytes := make([]byte, 32)
	if _, err := rand.Read(bytes); err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Failed to generate signing secret"})
	}
	signingSecret := hex.EncodeToString(bytes)

	// Save signing secret in Redis with TTL identical to JWT
	ctx := database.Ctx
	err = database.RedisClient.Set(ctx, "secret:"+fmt.Sprint(user.ID), signingSecret, ttl).Err()
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Failed to store session secret"})
	}

	return c.JSON(fiber.Map{
		"token":          t,
		"signing_secret": signingSecret,
	})
}

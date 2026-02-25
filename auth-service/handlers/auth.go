package handlers

import (
	"auth-service/database"
	"auth-service/models"

	"github.com/gofiber/fiber/v2"
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

	hashed := string(hashedPassword)
	user := models.User{
		Email:        req.Email,
		Password:     &hashed,
		AuthProvider: "local",
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

	if user.Password == nil {
		return c.Status(401).JSON(fiber.Map{"error": "This account uses LinkedIn login. Please sign in with LinkedIn."})
	}

	if err := bcrypt.CompareHashAndPassword([]byte(*user.Password), []byte(req.Password)); err != nil {
		return c.Status(401).JSON(fiber.Map{"error": "Invalid credentials"})
	}

	// Always create a web session cookie
	if err := createWebSession(user.ID, c); err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Failed to create session"})
	}

	// Also return JWT + HMAC secret for the plugin (used when source=plugin)
	jwtToken, signingSecret, err := generateSessionTokens(user.ID)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}

	return c.JSON(fiber.Map{
		"token":          jwtToken,
		"signing_secret": signingSecret,
	})
}

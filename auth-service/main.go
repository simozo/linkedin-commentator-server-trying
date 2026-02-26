package main

import (
	"log"
	"os"

	"auth-service/database"
	"auth-service/handlers"
	"auth-service/models"

	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/cors"
	"github.com/gofiber/fiber/v2/middleware/logger"
	"github.com/joho/godotenv"
)

func main() {
	if err := godotenv.Load(); err != nil {
		log.Println("No .env file found; using environment variables instead")
	}

	// Initialize Database Connections
	database.ConnectDB()
	database.ConnectRedis()

	// Migrate models
	database.DB.AutoMigrate(&models.User{})

	// Setup Fiber App
	app := fiber.New()
	app.Use(logger.New())
	app.Use(cors.New(cors.Config{
		AllowOrigins:     "http://localhost:3000,http://localhost:3003,http://localhost:4000,http://localhost:5001,http://localhost:3100",
		AllowHeaders:     "Origin, Content-Type, Accept, Authorization",
		AllowMethods:     "GET,POST,OPTIONS",
		AllowCredentials: true,
	}))

	// Routes — HTML Pages (served by Fiber templates)
	app.Get("/login", handlers.LoginPage)
	app.Get("/auth/callback", handlers.AuthCallbackPage)

	// Routes — Email/Password API
	app.Post("/register", handlers.Register)
	app.Post("/login", handlers.Login)

	// Routes — LinkedIn OAuth2
	app.Get("/auth/linkedin/login", handlers.LinkedInInit)
	app.Get("/auth/linkedin/callback", handlers.LinkedInCallback)

	// Routes — Session / Dashboard
	app.Get("/me", handlers.Me)
	app.Post("/logout-web", handlers.LogoutWeb)

	// Start server
	port := os.Getenv("PORT")
	if port == "" {
		port = "4000"
	}
	log.Fatal(app.Listen(":" + port))
}

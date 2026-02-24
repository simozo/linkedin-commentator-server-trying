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
		AllowOrigins: "*",
		AllowHeaders: "Origin, Content-Type, Accept, Authorization",
	}))

	// Routes
	app.Post("/register", handlers.Register)
	app.Post("/login", handlers.Login)

	// Start server
	port := os.Getenv("PORT")
	if port == "" {
		port = "4000"
	}
	log.Fatal(app.Listen(":" + port))
}

package handlers

import (
	"bytes"
	"html/template"
	"os"

	"github.com/gofiber/fiber/v2"
)

// templateData holds the values injected into the HTML templates.
type templateData struct {
	Source       string // "plugin" or ""
	Ext          string // Chrome extension ID passed by the plugin via ?ext=
	DashboardURL string // Base URL of the Next.js dashboard app
}

var (
	loginTmpl    = template.Must(template.ParseFiles("templates/login.html"))
	callbackTmpl = template.Must(template.ParseFiles("templates/callback.html"))
)

func dashboardURL() string {
	if u := os.Getenv("FRONTEND_URL"); u != "" {
		return u
	}
	return "http://localhost:3000"
}

// LoginPage serves the login HTML page.
// Accepts ?source=plugin and ?ext=<extensionId> query params from the plugin.
func LoginPage(c *fiber.Ctx) error {
	data := templateData{
		Source:       c.Query("source"),
		Ext:          c.Query("ext"),
		DashboardURL: dashboardURL(),
	}
	c.Set("Content-Type", "text/html; charset=utf-8")
	var buf bytes.Buffer
	if err := loginTmpl.Execute(&buf, data); err != nil {
		return c.Status(500).SendString("Template render error: " + err.Error())
	}
	return c.SendString(buf.String())
}

// AuthCallbackPage serves the OAuth callback HTML page.
// For plugin flow the page JS calls chrome.runtime.sendMessage with token+secret from URL params.
// For dashboard flow the page JS redirects to /dashboard on the Next.js frontend.
func AuthCallbackPage(c *fiber.Ctx) error {
	data := templateData{
		Source:       c.Query("source"),
		Ext:          c.Query("ext"),
		DashboardURL: dashboardURL(),
	}
	c.Set("Content-Type", "text/html; charset=utf-8")
	var buf bytes.Buffer
	if err := callbackTmpl.Execute(&buf, data); err != nil {
		return c.Status(500).SendString("Template render error: " + err.Error())
	}
	return c.SendString(buf.String())
}

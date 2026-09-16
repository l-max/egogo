package main

import (
	"fmt"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"strings"

	"github.com/egogo/pkg/models"
	"github.com/egogo/server/internal/api"
	"github.com/egogo/server/internal/auth"
	"github.com/egogo/server/internal/crypto"
	"github.com/egogo/server/internal/store"
	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/go-chi/cors"
)

func main() {
	port := os.Getenv("EGOGO_PORT")
	if port == "" {
		port = "8090"
	}

	dataDir := os.Getenv("EGOGO_DATA_DIR")
	if dataDir == "" {
		home, _ := os.UserHomeDir()
		dataDir = filepath.Join(home, ".egogo-server")
	}

	serverURL := os.Getenv("EGOGO_SERVER_URL")
	if serverURL == "" {
		serverURL = fmt.Sprintf("http://localhost:%s", port)
	}

	st, err := store.Open(dataDir)
	if err != nil {
		log.Fatal(err)
	}
	defer st.Close()

	authSvc, err := auth.NewService()
	if err != nil {
		log.Fatal(err)
	}

	enc, err := crypto.NewFromEnv()
	if err != nil {
		log.Fatal(err)
	}

	if err := bootstrapAdmin(st, authSvc); err != nil {
		log.Fatal(err)
	}

	apiServer := api.New(st, authSvc, enc, serverURL)

	r := chi.NewRouter()
	r.Use(middleware.Logger)
	r.Use(middleware.Recoverer)
	r.Use(cors.Handler(cors.Options{
		AllowedOrigins:   []string{"*"},
		AllowedMethods:   []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
		AllowedHeaders:   []string{"Accept", "Authorization", "Content-Type"},
		AllowCredentials: false,
		MaxAge:           300,
	}))

	r.Get("/health", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.Write([]byte(`{"status":"ok","service":"egogo-server"}`))
	})

	r.Get("/", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "text/html; charset=utf-8")
		w.Write([]byte(`<!DOCTYPE html>
<html lang="ru">
<head><meta charset="utf-8"><title>egogo server</title></head>
<body style="font-family:sans-serif;max-width:600px;margin:80px auto;color:#333">
<h1>egogo server</h1>
<p>Self-hosted сервер для управления проектами, пользователями и правами доступа.</p>
<p>API: <code>/api/v1</code> · Health: <code>/health</code></p>
</body></html>`))
	})

	r.Mount("/", apiServer.Routes())

	addr := fmt.Sprintf(":%s", port)
	log.Printf("egogo server listening on %s (data: %s)", serverURL, dataDir)
	log.Fatal(http.ListenAndServe(addr, r))
}

func bootstrapAdmin(st *store.Store, authSvc *auth.Service) error {
	count, err := st.UserCount()
	if err != nil {
		return err
	}
	if count > 0 {
		return nil
	}

	email := strings.TrimSpace(strings.ToLower(os.Getenv("EGOGO_ADMIN_EMAIL")))
	password := os.Getenv("EGOGO_ADMIN_PASSWORD")
	displayName := os.Getenv("EGOGO_ADMIN_NAME")
	if displayName == "" {
		displayName = "Admin"
	}
	if email == "" {
		email = "admin@test.com"
	}
	if password == "" {
		password = "egogo-admin"
		log.Printf("WARNING: using default admin password — set EGOGO_ADMIN_PASSWORD")
	}

	hash, err := auth.HashPassword(password)
	if err != nil {
		return err
	}
	user, err := st.CreateUser(email, displayName, models.RoleAdmin, hash)
	if err != nil {
		return err
	}
	log.Printf("bootstrap admin created: %s (id=%s)", user.Email, user.ID)
	_ = authSvc
	return nil
}

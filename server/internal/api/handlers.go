package api

import (
	"encoding/json"
	"errors"
	"net/http"
	"strings"
	"time"

	"github.com/egogo/pkg/models"
	"github.com/egogo/server/internal/auth"
	"github.com/egogo/server/internal/crypto"
	"github.com/egogo/server/internal/store"
	"github.com/go-chi/chi/v5"
)

type Server struct {
	store     *store.Store
	auth      *auth.Service
	encryptor *crypto.Encryptor
	serverURL string
}

func New(st *store.Store, authSvc *auth.Service, enc *crypto.Encryptor, serverURL string) *Server {
	return &Server{store: st, auth: authSvc, encryptor: enc, serverURL: serverURL}
}

func (s *Server) Routes() chi.Router {
	r := chi.NewRouter()
	r.Route("/api/v1", func(r chi.Router) {
		r.Post("/auth/login", s.handleLogin)
		r.Post("/auth/refresh", s.handleRefresh)
		r.Get("/auth/invite/info", s.handleInviteInfo)
		r.Post("/auth/invite/redeem", s.handleInviteRedeem)

		r.Group(func(r chi.Router) {
			r.Use(s.requireAuth)
			r.Get("/users/me", s.handleMe)
			r.Get("/projects", s.handleListProjects)
			r.Get("/projects/{id}", s.handleGetProject)
			r.Put("/projects/{id}", s.handleUpdateProject)

			r.Group(func(r chi.Router) {
				r.Use(s.requireAdmin)
				r.Get("/admin/users", s.handleListUsers)
				r.Post("/admin/users", s.handleCreateUser)
				r.Post("/admin/users/{id}/invite", s.handleCreateInvite)
				r.Post("/projects", s.handleCreateProject)
				r.Put("/admin/projects/{id}/permissions", s.handleSetProjectPermission)
			})
		})
	})
	return r
}

type errorResponse struct {
	Error string `json:"error"`
}

func writeJSON(w http.ResponseWriter, status int, v interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(v)
}

func writeError(w http.ResponseWriter, status int, msg string) {
	writeJSON(w, status, errorResponse{Error: msg})
}

func (s *Server) requireAuth(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		claims, err := s.claimsFromRequest(r)
		if err != nil {
			writeError(w, http.StatusUnauthorized, "unauthorized")
			return
		}
		ctx := withClaims(r.Context(), claims)
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

func (s *Server) requireAdmin(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		claims := claimsFromContext(r.Context())
		if claims == nil || claims.Role != models.RoleAdmin {
			writeError(w, http.StatusForbidden, "admin required")
			return
		}
		next.ServeHTTP(w, r)
	})
}

func (s *Server) claimsFromRequest(r *http.Request) (*auth.Claims, error) {
	header := r.Header.Get("Authorization")
	if header == "" {
		return nil, errors.New("missing authorization")
	}
	parts := strings.SplitN(header, " ", 2)
	if len(parts) != 2 || !strings.EqualFold(parts[0], "bearer") {
		return nil, errors.New("invalid authorization header")
	}
	claims, err := s.auth.ParseToken(parts[1])
	if err != nil || claims.Type != "access" {
		return nil, errors.New("invalid token")
	}
	return claims, nil
}

type loginRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

func (s *Server) handleLogin(w http.ResponseWriter, r *http.Request) {
	var req loginRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid json")
		return
	}
	req.Email = strings.TrimSpace(strings.ToLower(req.Email))
	if req.Email == "" || req.Password == "" {
		writeError(w, http.StatusBadRequest, "email and password required")
		return
	}

	user, err := s.store.GetUserByEmail(req.Email)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "internal error")
		return
	}
	if user == nil || user.PasswordHash == "" || !auth.CheckPassword(user.PasswordHash, req.Password) {
		writeError(w, http.StatusUnauthorized, "invalid credentials")
		return
	}

	tokens, err := s.auth.IssueTokens(user)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "internal error")
		return
	}
	writeJSON(w, http.StatusOK, map[string]interface{}{
		"tokens": tokens,
		"user":   publicUser(user),
	})
}

type refreshRequest struct {
	RefreshToken string `json:"refreshToken"`
}

func (s *Server) handleRefresh(w http.ResponseWriter, r *http.Request) {
	var req refreshRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid json")
		return
	}
	tokens, err := s.auth.Refresh(req.RefreshToken)
	if err != nil {
		writeError(w, http.StatusUnauthorized, "invalid refresh token")
		return
	}
	writeJSON(w, http.StatusOK, tokens)
}

func (s *Server) handleInviteInfo(w http.ResponseWriter, r *http.Request) {
	token := r.URL.Query().Get("token")
	if token == "" {
		writeError(w, http.StatusBadRequest, "token required")
		return
	}
	userID, _, err := s.auth.VerifyInviteToken(token)
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	stored, err := s.store.GetInviteToken(token)
	if err != nil || stored == nil || stored.Used {
		writeError(w, http.StatusBadRequest, "invite not found or already used")
		return
	}
	user, err := s.store.GetUserByID(userID)
	if err != nil || user == nil {
		writeError(w, http.StatusBadRequest, "user not found")
		return
	}
	writeJSON(w, http.StatusOK, map[string]interface{}{
		"email":       user.Email,
		"displayName": user.DisplayName,
		"expiresAt":   stored.ExpiresAt,
	})
}

type inviteRedeemRequest struct {
	Token    string `json:"token"`
	Password string `json:"password"`
}

func (s *Server) handleInviteRedeem(w http.ResponseWriter, r *http.Request) {
	var req inviteRedeemRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid json")
		return
	}
	if req.Token == "" || len(req.Password) < 8 {
		writeError(w, http.StatusBadRequest, "token and password (min 8 chars) required")
		return
	}

	userID, _, err := s.auth.VerifyInviteToken(req.Token)
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	stored, err := s.store.GetInviteToken(req.Token)
	if err != nil || stored == nil || stored.Used {
		writeError(w, http.StatusBadRequest, "invite not found or already used")
		return
	}
	if stored.UserID != userID {
		writeError(w, http.StatusBadRequest, "invite mismatch")
		return
	}

	hash, err := auth.HashPassword(req.Password)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "internal error")
		return
	}
	if err := s.store.UpdateUserPassword(userID, hash); err != nil {
		writeError(w, http.StatusInternalServerError, "internal error")
		return
	}
	if err := s.store.MarkInviteUsed(req.Token); err != nil {
		writeError(w, http.StatusInternalServerError, "internal error")
		return
	}

	user, err := s.store.GetUserByID(userID)
	if err != nil || user == nil {
		writeError(w, http.StatusInternalServerError, "internal error")
		return
	}
	tokens, err := s.auth.IssueTokens(user)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "internal error")
		return
	}
	writeJSON(w, http.StatusOK, map[string]interface{}{
		"tokens": tokens,
		"user":   publicUser(user),
	})
}

func (s *Server) handleMe(w http.ResponseWriter, r *http.Request) {
	claims := claimsFromContext(r.Context())
	user, err := s.store.GetUserByID(claims.UserID)
	if err != nil || user == nil {
		writeError(w, http.StatusNotFound, "user not found")
		return
	}
	writeJSON(w, http.StatusOK, publicUser(user))
}

type createUserRequest struct {
	Email       string          `json:"email"`
	DisplayName string          `json:"displayName"`
	Role        models.UserRole `json:"role"`
}

func (s *Server) handleCreateUser(w http.ResponseWriter, r *http.Request) {
	var req createUserRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid json")
		return
	}
	req.Email = strings.TrimSpace(strings.ToLower(req.Email))
	req.DisplayName = strings.TrimSpace(req.DisplayName)
	if req.Email == "" || req.DisplayName == "" {
		writeError(w, http.StatusBadRequest, "email and displayName required")
		return
	}
	if req.Role == "" {
		req.Role = models.RoleMember
	}
	if req.Role != models.RoleAdmin && req.Role != models.RoleMember && req.Role != models.RoleViewer {
		writeError(w, http.StatusBadRequest, "invalid role")
		return
	}

	existing, err := s.store.GetUserByEmail(req.Email)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "internal error")
		return
	}
	if existing != nil {
		writeError(w, http.StatusConflict, "user already exists")
		return
	}

	user, err := s.store.CreateUser(req.Email, req.DisplayName, req.Role, "")
	if err != nil {
		writeError(w, http.StatusInternalServerError, "internal error")
		return
	}
	writeJSON(w, http.StatusCreated, publicUser(user))
}

func (s *Server) handleListUsers(w http.ResponseWriter, r *http.Request) {
	users, err := s.store.ListUsers()
	if err != nil {
		writeError(w, http.StatusInternalServerError, "internal error")
		return
	}
	out := make([]map[string]interface{}, 0, len(users))
	for i := range users {
		out = append(out, publicUser(&users[i]))
	}
	writeJSON(w, http.StatusOK, out)
}

func (s *Server) handleCreateInvite(w http.ResponseWriter, r *http.Request) {
	userID := chi.URLParam(r, "id")
	user, err := s.store.GetUserByID(userID)
	if err != nil || user == nil {
		writeError(w, http.StatusNotFound, "user not found")
		return
	}

	expiresAt := time.Now().UTC().Add(auth.InviteTokenTTL)
	token, err := s.auth.GenerateInviteToken(userID, expiresAt)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "internal error")
		return
	}
	if err := s.store.CreateInviteToken(token, userID, expiresAt); err != nil {
		writeError(w, http.StatusInternalServerError, "internal error")
		return
	}

	inviteURL := auth.BuildInviteURL(s.serverURL, token)
	writeJSON(w, http.StatusCreated, map[string]interface{}{
		"token":     token,
		"inviteUrl": inviteURL,
		"expiresAt": expiresAt,
		"userId":    userID,
	})
}

type projectMeta struct {
	ID        string    `json:"id"`
	Name      string    `json:"name"`
	UpdatedAt time.Time `json:"updatedAt"`
}

type projectDetail struct {
	projectMeta
	Data json.RawMessage `json:"data"`
}

func (s *Server) handleListProjects(w http.ResponseWriter, r *http.Request) {
	claims := claimsFromContext(r.Context())
	isAdmin := claims.Role == models.RoleAdmin
	projects, err := s.store.ListProjectsForUser(claims.UserID, isAdmin)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "internal error")
		return
	}
	out := make([]projectMeta, 0, len(projects))
	for _, p := range projects {
		out = append(out, projectMeta{ID: p.ID, Name: p.Name, UpdatedAt: p.UpdatedAt})
	}
	writeJSON(w, http.StatusOK, out)
}

func (s *Server) handleGetProject(w http.ResponseWriter, r *http.Request) {
	claims := claimsFromContext(r.Context())
	projectID := chi.URLParam(r, "id")

	user, err := s.store.GetUserByID(claims.UserID)
	if err != nil || user == nil {
		writeError(w, http.StatusUnauthorized, "unauthorized")
		return
	}
	ok, _, err := s.store.UserCanAccessProject(user, projectID)
	if err != nil || !ok {
		writeError(w, http.StatusForbidden, "access denied")
		return
	}

	project, err := s.store.GetProject(projectID)
	if err != nil || project == nil {
		writeError(w, http.StatusNotFound, "project not found")
		return
	}

	plain, err := s.encryptor.Decrypt(project.Data)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "decryption failed")
		return
	}
	writeJSON(w, http.StatusOK, projectDetail{
		projectMeta: projectMeta{ID: project.ID, Name: project.Name, UpdatedAt: project.UpdatedAt},
		Data:        plain,
	})
}

type createProjectRequest struct {
	Name string          `json:"name"`
	Data json.RawMessage `json:"data"`
}

func (s *Server) handleCreateProject(w http.ResponseWriter, r *http.Request) {
	var req createProjectRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid json")
		return
	}
	req.Name = strings.TrimSpace(req.Name)
	if req.Name == "" {
		writeError(w, http.StatusBadRequest, "name required")
		return
	}
	if len(req.Data) == 0 {
		req.Data = json.RawMessage(`{"children":[]}`)
	}

	encrypted, err := s.encryptor.Encrypt(req.Data)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "encryption failed")
		return
	}
	project, err := s.store.CreateProject(req.Name, encrypted)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "internal error")
		return
	}
	writeJSON(w, http.StatusCreated, projectMeta{ID: project.ID, Name: project.Name, UpdatedAt: project.UpdatedAt})
}

func (s *Server) handleUpdateProject(w http.ResponseWriter, r *http.Request) {
	claims := claimsFromContext(r.Context())
	projectID := chi.URLParam(r, "id")

	user, err := s.store.GetUserByID(claims.UserID)
	if err != nil || user == nil {
		writeError(w, http.StatusUnauthorized, "unauthorized")
		return
	}
	canWrite, err := s.store.UserCanWriteProject(user, projectID)
	if err != nil || !canWrite {
		writeError(w, http.StatusForbidden, "access denied")
		return
	}

	var req createProjectRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid json")
		return
	}
	if req.Name == "" {
		writeError(w, http.StatusBadRequest, "name required")
		return
	}
	if len(req.Data) == 0 {
		writeError(w, http.StatusBadRequest, "data required")
		return
	}

	encrypted, err := s.encryptor.Encrypt(req.Data)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "encryption failed")
		return
	}
	if err := s.store.UpdateProject(projectID, req.Name, encrypted); err != nil {
		writeError(w, http.StatusInternalServerError, "internal error")
		return
	}
	project, _ := s.store.GetProject(projectID)
	writeJSON(w, http.StatusOK, projectMeta{ID: projectID, Name: req.Name, UpdatedAt: project.UpdatedAt})
}

type setPermissionRequest struct {
	UserID string          `json:"userId"`
	Role   models.UserRole `json:"role"`
}

func (s *Server) handleSetProjectPermission(w http.ResponseWriter, r *http.Request) {
	projectID := chi.URLParam(r, "id")
	project, err := s.store.GetProject(projectID)
	if err != nil || project == nil {
		writeError(w, http.StatusNotFound, "project not found")
		return
	}

	var req setPermissionRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid json")
		return
	}
	if req.UserID == "" {
		writeError(w, http.StatusBadRequest, "userId required")
		return
	}
	if req.Role == "" {
		req.Role = models.RoleMember
	}
	if req.Role != models.RoleAdmin && req.Role != models.RoleMember && req.Role != models.RoleViewer {
		writeError(w, http.StatusBadRequest, "invalid role")
		return
	}

	user, err := s.store.GetUserByID(req.UserID)
	if err != nil || user == nil {
		writeError(w, http.StatusNotFound, "user not found")
		return
	}
	if err := s.store.SetProjectPermission(req.UserID, projectID, req.Role); err != nil {
		writeError(w, http.StatusInternalServerError, "internal error")
		return
	}
	writeJSON(w, http.StatusOK, map[string]interface{}{
		"userId":    req.UserID,
		"projectId": projectID,
		"role":      req.Role,
	})
}

func publicUser(u *models.User) map[string]interface{} {
	return map[string]interface{}{
		"id":          u.ID,
		"email":       u.Email,
		"displayName": u.DisplayName,
		"role":        u.Role,
		"createdAt":   u.CreatedAt,
	}
}

package models

import "time"

type UserRole string

const (
	RoleAdmin  UserRole = "admin"
	RoleMember UserRole = "member"
	RoleViewer UserRole = "viewer"
)

type User struct {
	ID           string    `json:"id"`
	Email        string    `json:"email"`
	DisplayName  string    `json:"displayName"`
	Role         UserRole  `json:"role"`
	PasswordHash string    `json:"-"`
	CreatedAt    time.Time `json:"createdAt"`
}

type ProjectPermission struct {
	UserID    string   `json:"userId"`
	ProjectID string   `json:"projectId"`
	Role      UserRole `json:"role"`
}

type InviteToken struct {
	Token     string    `json:"token"`
	UserID    string    `json:"userId"`
	ExpiresAt time.Time `json:"expiresAt"`
	Used      bool      `json:"used"`
}

type Project struct {
	ID        string    `json:"id"`
	Name      string    `json:"name"`
	Data      []byte    `json:"-"`
	UpdatedAt time.Time `json:"updatedAt"`
}

type GitConfig struct {
	Enabled  bool   `json:"enabled"`
	RepoURL  string `json:"repoUrl"`
	Branch   string `json:"branch"`
	Username string `json:"username"`
}

package store

import (
	"database/sql"
	"fmt"
	"os"
	"path/filepath"
	"time"

	"github.com/egogo/pkg/models"
	"github.com/google/uuid"
	_ "modernc.org/sqlite"
)

type Store struct {
	db *sql.DB
}

func Open(dataDir string) (*Store, error) {
	if err := os.MkdirAll(dataDir, 0700); err != nil {
		return nil, err
	}
	dbPath := filepath.Join(dataDir, "egogo.db")
	db, err := sql.Open("sqlite", dbPath+"?_pragma=foreign_keys(1)&_pragma=journal_mode(WAL)")
	if err != nil {
		return nil, err
	}
	s := &Store{db: db}
	if err := s.migrate(); err != nil {
		db.Close()
		return nil, err
	}
	return s, nil
}

func (s *Store) Close() error {
	return s.db.Close()
}

func (s *Store) migrate() error {
	schema := `
CREATE TABLE IF NOT EXISTS users (
	id TEXT PRIMARY KEY,
	email TEXT NOT NULL UNIQUE,
	display_name TEXT NOT NULL,
	role TEXT NOT NULL,
	password_hash TEXT NOT NULL DEFAULT '',
	created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS invite_tokens (
	token TEXT PRIMARY KEY,
	user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
	expires_at TEXT NOT NULL,
	used INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS projects (
	id TEXT PRIMARY KEY,
	name TEXT NOT NULL,
	data BLOB NOT NULL,
	updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS project_permissions (
	user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
	project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
	role TEXT NOT NULL,
	PRIMARY KEY (user_id, project_id)
);
`
	if _, err := s.db.Exec(schema); err != nil {
		return err
	}
	return nil
}

func (s *Store) UserCount() (int, error) {
	var n int
	err := s.db.QueryRow(`SELECT COUNT(*) FROM users`).Scan(&n)
	return n, err
}

func (s *Store) CreateUser(email, displayName string, role models.UserRole, passwordHash string) (*models.User, error) {
	u := &models.User{
		ID:           uuid.NewString(),
		Email:        email,
		DisplayName:  displayName,
		Role:         role,
		PasswordHash: passwordHash,
		CreatedAt:    time.Now().UTC(),
	}
	_, err := s.db.Exec(
		`INSERT INTO users (id, email, display_name, role, password_hash, created_at) VALUES (?, ?, ?, ?, ?, ?)`,
		u.ID, u.Email, u.DisplayName, string(u.Role), u.PasswordHash, u.CreatedAt.Format(time.RFC3339),
	)
	if err != nil {
		return nil, err
	}
	return u, nil
}

func (s *Store) GetUserByID(id string) (*models.User, error) {
	return s.scanUser(s.db.QueryRow(
		`SELECT id, email, display_name, role, password_hash, created_at FROM users WHERE id = ?`, id,
	))
}

func (s *Store) GetUserByEmail(email string) (*models.User, error) {
	return s.scanUser(s.db.QueryRow(
		`SELECT id, email, display_name, role, password_hash, created_at FROM users WHERE email = ?`, email,
	))
}

func (s *Store) scanUser(row *sql.Row) (*models.User, error) {
	var u models.User
	var role, createdAt string
	err := row.Scan(&u.ID, &u.Email, &u.DisplayName, &role, &u.PasswordHash, &createdAt)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	u.Role = models.UserRole(role)
	t, err := time.Parse(time.RFC3339, createdAt)
	if err != nil {
		return nil, err
	}
	u.CreatedAt = t
	return &u, nil
}

func (s *Store) UpdateUserPassword(userID, passwordHash string) error {
	_, err := s.db.Exec(`UPDATE users SET password_hash = ? WHERE id = ?`, passwordHash, userID)
	return err
}

func (s *Store) ListUsers() ([]models.User, error) {
	rows, err := s.db.Query(`SELECT id, email, display_name, role, password_hash, created_at FROM users ORDER BY created_at`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var users []models.User
	for rows.Next() {
		var u models.User
		var role, createdAt string
		if err := rows.Scan(&u.ID, &u.Email, &u.DisplayName, &role, &u.PasswordHash, &createdAt); err != nil {
			return nil, err
		}
		u.Role = models.UserRole(role)
		t, err := time.Parse(time.RFC3339, createdAt)
		if err != nil {
			return nil, err
		}
		u.CreatedAt = t
		users = append(users, u)
	}
	return users, rows.Err()
}

func (s *Store) CreateInviteToken(token, userID string, expiresAt time.Time) error {
	_, err := s.db.Exec(
		`INSERT INTO invite_tokens (token, user_id, expires_at, used) VALUES (?, ?, ?, 0)`,
		token, userID, expiresAt.UTC().Format(time.RFC3339),
	)
	return err
}

func (s *Store) GetInviteToken(token string) (*models.InviteToken, error) {
	var it models.InviteToken
	var expiresAt string
	var used int
	err := s.db.QueryRow(
		`SELECT token, user_id, expires_at, used FROM invite_tokens WHERE token = ?`, token,
	).Scan(&it.Token, &it.UserID, &expiresAt, &used)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	t, err := time.Parse(time.RFC3339, expiresAt)
	if err != nil {
		return nil, err
	}
	it.ExpiresAt = t
	it.Used = used == 1
	return &it, nil
}

func (s *Store) MarkInviteUsed(token string) error {
	_, err := s.db.Exec(`UPDATE invite_tokens SET used = 1 WHERE token = ?`, token)
	return err
}

func (s *Store) CreateProject(name string, data []byte) (*models.Project, error) {
	p := &models.Project{
		ID:        uuid.NewString(),
		Name:      name,
		Data:      data,
		UpdatedAt: time.Now().UTC(),
	}
	_, err := s.db.Exec(
		`INSERT INTO projects (id, name, data, updated_at) VALUES (?, ?, ?, ?)`,
		p.ID, p.Name, p.Data, p.UpdatedAt.Format(time.RFC3339),
	)
	if err != nil {
		return nil, err
	}
	return p, nil
}

func (s *Store) GetProject(id string) (*models.Project, error) {
	var p models.Project
	var updatedAt string
	err := s.db.QueryRow(`SELECT id, name, data, updated_at FROM projects WHERE id = ?`, id).
		Scan(&p.ID, &p.Name, &p.Data, &updatedAt)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	t, err := time.Parse(time.RFC3339, updatedAt)
	if err != nil {
		return nil, err
	}
	p.UpdatedAt = t
	return &p, nil
}

func (s *Store) UpdateProject(id, name string, data []byte) error {
	_, err := s.db.Exec(
		`UPDATE projects SET name = ?, data = ?, updated_at = ? WHERE id = ?`,
		name, data, time.Now().UTC().Format(time.RFC3339), id,
	)
	return err
}

func (s *Store) ListProjectsForUser(userID string, isAdmin bool) ([]models.Project, error) {
	var rows *sql.Rows
	var err error
	if isAdmin {
		rows, err = s.db.Query(`SELECT id, name, data, updated_at FROM projects ORDER BY name`)
	} else {
		rows, err = s.db.Query(`
			SELECT p.id, p.name, p.data, p.updated_at
			FROM projects p
			INNER JOIN project_permissions pp ON pp.project_id = p.id
			WHERE pp.user_id = ?
			ORDER BY p.name`, userID)
	}
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	return scanProjects(rows)
}

func scanProjects(rows *sql.Rows) ([]models.Project, error) {
	var projects []models.Project
	for rows.Next() {
		var p models.Project
		var updatedAt string
		if err := rows.Scan(&p.ID, &p.Name, &p.Data, &updatedAt); err != nil {
			return nil, err
		}
		t, err := time.Parse(time.RFC3339, updatedAt)
		if err != nil {
			return nil, err
		}
		p.UpdatedAt = t
		projects = append(projects, p)
	}

	return projects, rows.Err()
}

func (s *Store) SetProjectPermission(userID, projectID string, role models.UserRole) error {
	_, err := s.db.Exec(`
		INSERT INTO project_permissions (user_id, project_id, role) VALUES (?, ?, ?)
		ON CONFLICT(user_id, project_id) DO UPDATE SET role = excluded.role`,
		userID, projectID, string(role),
	)
	return err
}

func (s *Store) GetProjectPermission(userID, projectID string) (*models.ProjectPermission, error) {
	var pp models.ProjectPermission
	var role string
	err := s.db.QueryRow(
		`SELECT user_id, project_id, role FROM project_permissions WHERE user_id = ? AND project_id = ?`,
		userID, projectID,
	).Scan(&pp.UserID, &pp.ProjectID, &role)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	pp.Role = models.UserRole(role)
	return &pp, nil
}

func (s *Store) UserCanAccessProject(user *models.User, projectID string) (bool, models.UserRole, error) {
	if user == nil {
		return false, "", fmt.Errorf("nil user")
	}
	if user.Role == models.RoleAdmin {
		return true, user.Role, nil
	}
	pp, err := s.GetProjectPermission(user.ID, projectID)
	if err != nil {
		return false, "", err
	}
	if pp == nil {
		return false, "", nil
	}
	return true, pp.Role, nil
}

func (s *Store) UserCanWriteProject(user *models.User, projectID string) (bool, error) {
	ok, role, err := s.UserCanAccessProject(user, projectID)
	if err != nil || !ok {
		return false, err
	}
	if user.Role == models.RoleAdmin {
		return true, nil
	}
	return role == models.RoleAdmin || role == models.RoleMember, nil
}

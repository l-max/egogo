package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"time"
)

type serverTokens struct {
	AccessToken  string `json:"accessToken"`
	RefreshToken string `json:"refreshToken"`
	ExpiresIn    int64  `json:"expiresIn"`
}

type serverUser struct {
	ID          string `json:"id"`
	Email       string `json:"email"`
	DisplayName string `json:"displayName"`
	Role        string `json:"role"`
}

type AuthResult struct {
	ProfileID    string `json:"profileId"`
	ServerURL    string `json:"serverUrl"`
	ServerName   string `json:"serverName"`
	DisplayName  string `json:"displayName"`
	Email        string `json:"email"`
	AccessToken  string `json:"accessToken"`
	RefreshToken string `json:"refreshToken"`
}

type PendingInvite struct {
	ServerURL string `json:"serverUrl"`
	Token     string `json:"token"`
	Email     string `json:"email"`
}

type InviteInfo struct {
	Email       string `json:"email"`
	DisplayName string `json:"displayName"`
}

func normalizeServerURL(raw string) string {
	u := strings.TrimSpace(raw)
	u = strings.TrimRight(u, "/")
	if !strings.HasPrefix(u, "http://") && !strings.HasPrefix(u, "https://") {
		u = "http://" + u
	}
	return u
}

func (a *App) serverHTTPClient() *http.Client {
	return &http.Client{Timeout: 30 * time.Second}
}

func serverPost[T any](client *http.Client, endpoint string, body interface{}, authHeader string) (*T, int, error) {
	var buf bytes.Buffer
	if body != nil {
		if err := json.NewEncoder(&buf).Encode(body); err != nil {
			return nil, 0, err
		}
	}
	req, err := http.NewRequest(http.MethodPost, endpoint, &buf)
	if err != nil {
		return nil, 0, err
	}
	req.Header.Set("Content-Type", "application/json")
	if authHeader != "" {
		req.Header.Set("Authorization", authHeader)
	}
	resp, err := client.Do(req)
	if err != nil {
		return nil, 0, err
	}
	defer resp.Body.Close()
	data, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, resp.StatusCode, err
	}
	if resp.StatusCode >= 400 {
		var errBody struct {
			Error string `json:"error"`
		}
		_ = json.Unmarshal(data, &errBody)
		if errBody.Error != "" {
			return nil, resp.StatusCode, fmt.Errorf("%s", errBody.Error)
		}
		return nil, resp.StatusCode, fmt.Errorf("request failed (%d)", resp.StatusCode)
	}
	var out T
	if len(data) > 0 {
		if err := json.Unmarshal(data, &out); err != nil {
			return nil, resp.StatusCode, err
		}
	}
	return &out, resp.StatusCode, nil
}

func serverGet[T any](client *http.Client, endpoint string, authHeader string) (*T, error) {
	req, err := http.NewRequest(http.MethodGet, endpoint, nil)
	if err != nil {
		return nil, err
	}
	if authHeader != "" {
		req.Header.Set("Authorization", authHeader)
	}
	resp, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	data, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}
	if resp.StatusCode >= 400 {
		var errBody struct {
			Error string `json:"error"`
		}
		_ = json.Unmarshal(data, &errBody)
		if errBody.Error != "" {
			return nil, fmt.Errorf("%s", errBody.Error)
		}
		return nil, fmt.Errorf("request failed (%d)", resp.StatusCode)
	}
	var out T
	if err := json.Unmarshal(data, &out); err != nil {
		return nil, err
	}
	return &out, nil
}

func (a *App) AuthLogin(serverURL, email, password string) (*AuthResult, error) {
	serverURL = normalizeServerURL(serverURL)
	email = strings.TrimSpace(strings.ToLower(email))
	client := a.serverHTTPClient()

	var resp struct {
		Tokens serverTokens `json:"tokens"`
		User   serverUser   `json:"user"`
	}
	_, err := func() (int, error) {
		r, code, e := serverPost[struct {
			Tokens serverTokens `json:"tokens"`
			User   serverUser   `json:"user"`
		}](client, serverURL+"/api/v1/auth/login", map[string]string{
			"email":    email,
			"password": password,
		}, "")
		if e != nil {
			return code, e
		}
		resp = *r
		return code, nil
	}()
	if err != nil {
		return nil, err
	}

	return a.saveAuthResult(serverURL, resp.User, resp.Tokens)
}

func (a *App) AuthRedeemInvite(serverURL, token, password string) (*AuthResult, error) {
	serverURL = normalizeServerURL(serverURL)
	client := a.serverHTTPClient()

	resp, _, err := serverPost[struct {
		Tokens serverTokens `json:"tokens"`
		User   serverUser   `json:"user"`
	}](client, serverURL+"/api/v1/auth/invite/redeem", map[string]string{
		"token":    token,
		"password": password,
	}, "")
	if err != nil {
		return nil, err
	}
	return a.saveAuthResult(serverURL, resp.User, resp.Tokens)
}

func (a *App) AuthInviteInfo(serverURL, token string) (*InviteInfo, error) {
	serverURL = normalizeServerURL(serverURL)
	client := a.serverHTTPClient()
	endpoint := serverURL + "/api/v1/auth/invite/info?token=" + url.QueryEscape(token)
	return serverGet[InviteInfo](client, endpoint, "")
}

func (a *App) AuthSignOut(profileID string) error {
	return a.removeRemoteProfile(profileID)
}

func (a *App) ParseInviteURL(rawURL string) (*PendingInvite, error) {
	u, err := url.Parse(strings.TrimSpace(rawURL))
	if err != nil {
		return nil, fmt.Errorf("invalid url")
	}
	if u.Scheme != "egogo" {
		return nil, fmt.Errorf("expected egogo:// scheme")
	}
	if u.Host != "auth" || !strings.HasPrefix(u.Path, "/invite") {
		return nil, fmt.Errorf("invalid invite url path")
	}
	token := u.Query().Get("token")
	serverURL := u.Query().Get("server")
	if token == "" || serverURL == "" {
		return nil, fmt.Errorf("token and server required")
	}
	return &PendingInvite{ServerURL: normalizeServerURL(serverURL), Token: token}, nil
}

func (a *App) SetPendingInvite(rawURL string) error {
	invite, err := a.ParseInviteURL(rawURL)
	if err != nil {
		return err
	}
	info, err := a.AuthInviteInfo(invite.ServerURL, invite.Token)
	if err != nil {
		return err
	}
	invite.Email = info.Email
	a.pendingInvite = invite
	return nil
}

func (a *App) GetPendingInvite() *PendingInvite {
	if a.pendingInvite == nil {
		return nil
	}
	copy := *a.pendingInvite
	return &copy
}

func (a *App) ClearPendingInvite() {
	a.pendingInvite = nil
}

func (a *App) saveAuthResult(serverURL string, user serverUser, tokens serverTokens) (*AuthResult, error) {
	serverName := serverDisplayName(serverURL)
	profileID := remoteProfileID(serverURL, user.ID)
	letter := strings.ToUpper(string([]rune(user.DisplayName)[0:1]))
	if letter == "" {
		letter = "R"
	}

	cred := remoteProfileCredentials{
		ProfileID:    profileID,
		ServerURL:    serverURL,
		ServerName:   serverName,
		DisplayName:  user.DisplayName,
		Email:        user.Email,
		AccessToken:  tokens.AccessToken,
		RefreshToken: tokens.RefreshToken,
		UserID:       user.ID,
	}
	if err := a.saveRemoteCredentials(cred); err != nil {
		return nil, err
	}

	a.pendingInvite = nil
	return &AuthResult{
		ProfileID:    profileID,
		ServerURL:    serverURL,
		ServerName:   serverName,
		DisplayName:  user.DisplayName,
		Email:        user.Email,
		AccessToken:  tokens.AccessToken,
		RefreshToken: tokens.RefreshToken,
	}, nil
}

func serverDisplayName(serverURL string) string {
	u, err := url.Parse(serverURL)
	if err != nil {
		return serverURL
	}
	host := u.Hostname()
	if host == "localhost" || host == "127.0.0.1" {
		return "Local server"
	}
	return host
}

func remoteProfileID(serverURL, userID string) string {
	h := sha256Hex(serverURL + ":" + userID)
	return "remote-" + h[:12]
}

func (a *App) SyncRemoteProjects(profileID string) (string, error) {
	cred, err := a.loadRemoteCredentials(profileID)
	if err != nil {
		return "", err
	}
	if cred == nil {
		return "", fmt.Errorf("profile not found")
	}

	client := a.serverHTTPClient()
	authHeader := "Bearer " + cred.AccessToken

	type projectMeta struct {
		ID   string `json:"id"`
		Name string `json:"name"`
	}
	metas, err := serverGet[[]projectMeta](client, cred.ServerURL+"/api/v1/projects", authHeader)
	if err != nil {
		if refreshed, refreshErr := a.refreshTokens(cred); refreshErr == nil {
			cred = refreshed
			authHeader = "Bearer " + cred.AccessToken
			metas, err = serverGet[[]projectMeta](client, cred.ServerURL+"/api/v1/projects", authHeader)
		}
		if err != nil {
			return "", err
		}
	}

	type projectDetail struct {
		ID   string          `json:"id"`
		Name string          `json:"name"`
		Data json.RawMessage `json:"data"`
	}

	projects := make([]map[string]interface{}, 0, len(*metas))
	for _, meta := range *metas {
		detail, err := serverGet[projectDetail](client, cred.ServerURL+"/api/v1/projects/"+meta.ID, authHeader)
		if err != nil {
			continue
		}
		var tree map[string]interface{}
		if err := json.Unmarshal(detail.Data, &tree); err != nil {
			tree = map[string]interface{}{"children": []interface{}{}}
		}
		tree["id"] = meta.ID
		tree["name"] = meta.Name
		tree["expanded"] = true
		if _, ok := tree["children"]; !ok {
			tree["children"] = []interface{}{}
		}
		projects = append(projects, tree)
	}

	out, err := json.Marshal(projects)
	if err != nil {
		return "", err
	}
	return string(out), nil
}

// CreateRemoteProject creates a project on the remote server (admin only)
// and returns its metadata as JSON: {"id","name","updatedAt"}.
func (a *App) CreateRemoteProject(profileID, name, data string) (string, error) {
	cred, err := a.loadRemoteCredentials(profileID)
	if err != nil {
		return "", err
	}
	if cred == nil {
		return "", fmt.Errorf("profile not found")
	}

	client := a.serverHTTPClient()
	authHeader := "Bearer " + cred.AccessToken

	type projectMeta struct {
		ID        string `json:"id"`
		Name      string `json:"name"`
		UpdatedAt string `json:"updatedAt"`
	}
	type createRequest struct {
		Name string          `json:"name"`
		Data json.RawMessage `json:"data"`
	}
	doCreate := func(hdr string) (*projectMeta, int, error) {
		return serverPost[projectMeta](client, cred.ServerURL+"/api/v1/projects", createRequest{
			Name: name,
			Data: json.RawMessage(data),
		}, hdr)
	}

	meta, _, err := doCreate(authHeader)
	if err != nil {
		if refreshed, refreshErr := a.refreshTokens(cred); refreshErr == nil {
			cred = refreshed
			authHeader = "Bearer " + cred.AccessToken
			meta, _, err = doCreate(authHeader)
		}
		if err != nil {
			return "", err
		}
	}

	out, err := json.Marshal(meta)
	if err != nil {
		return "", err
	}
	return string(out), nil
}

func (a *App) refreshTokens(cred *remoteProfileCredentials) (*remoteProfileCredentials, error) {
	client := a.serverHTTPClient()
	resp, _, err := serverPost[serverTokens](client, cred.ServerURL+"/api/v1/auth/refresh", map[string]string{
		"refreshToken": cred.RefreshToken,
	}, "")
	if err != nil {
		return nil, err
	}
	cred.AccessToken = resp.AccessToken
	cred.RefreshToken = resp.RefreshToken
	if err := a.saveRemoteCredentials(*cred); err != nil {
		return nil, err
	}
	return cred, nil
}

func (a *App) ListRemoteProfiles() (string, error) {
	profiles, err := a.loadAllRemoteProfiles()
	if err != nil {
		return "[]", err
	}
	type publicProfile struct {
		ID           string `json:"id"`
		Name         string `json:"name"`
		ServerName   string `json:"serverName"`
		ServerURL    string `json:"serverUrl"`
		Type         string `json:"type"`
		AvatarLetter string `json:"avatarLetter"`
		AvatarColor  string `json:"avatarColor"`
		IsLoggedIn   bool   `json:"isLoggedIn"`
		Email        string `json:"email"`
	}
	out := make([]publicProfile, 0, len(profiles))
	for _, p := range profiles {
		letter := strings.ToUpper(string([]rune(p.DisplayName)[0:1]))
		if letter == "" {
			letter = "R"
		}
		out = append(out, publicProfile{
			ID:           p.ProfileID,
			Name:         p.DisplayName,
			ServerName:   p.ServerName,
			ServerURL:    p.ServerURL,
			Type:         "remote",
			AvatarLetter: letter,
			AvatarColor:  avatarColorForID(p.ProfileID),
			IsLoggedIn:   true,
			Email:        p.Email,
		})
	}
	data, err := json.Marshal(out)
	if err != nil {
		return "[]", err
	}
	return string(data), nil
}

func avatarColorForID(id string) string {
	colors := []string{"#3b82f6", "#8b5cf6", "#ec4899", "#f59e0b", "#10b981", "#6366f1"}
	sum := 0
	for _, c := range id {
		sum += int(c)
	}
	return colors[sum%len(colors)]
}

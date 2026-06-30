package main

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"os"
	"path/filepath"
)

type remoteProfileCredentials struct {
	ProfileID    string `json:"profileId"`
	ServerURL    string `json:"serverUrl"`
	ServerName   string `json:"serverName"`
	DisplayName  string `json:"displayName"`
	Email        string `json:"email"`
	UserID       string `json:"userId"`
	AccessToken  string `json:"accessToken"`
	RefreshToken string `json:"refreshToken"`
}

func sha256Hex(s string) string {
	h := sha256.Sum256([]byte(s))
	return hex.EncodeToString(h[:])
}

func (a *App) credentialsDir() string {
	return filepath.Join(a.dataPath, "credentials")
}

func (a *App) credentialFile(profileID string) string {
	return filepath.Join(a.credentialsDir(), profileID+".json")
}

func (a *App) saveRemoteCredentials(cred remoteProfileCredentials) error {
	if err := os.MkdirAll(a.credentialsDir(), 0700); err != nil {
		return err
	}
	data, err := json.MarshalIndent(cred, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(a.credentialFile(cred.ProfileID), data, 0600)
}

func (a *App) loadRemoteCredentials(profileID string) (*remoteProfileCredentials, error) {
	data, err := os.ReadFile(a.credentialFile(profileID))
	if err != nil {
		if os.IsNotExist(err) {
			return nil, nil
		}
		return nil, err
	}
	var cred remoteProfileCredentials
	if err := json.Unmarshal(data, &cred); err != nil {
		return nil, err
	}
	return &cred, nil
}

func (a *App) loadAllRemoteProfiles() ([]remoteProfileCredentials, error) {
	dir := a.credentialsDir()
	entries, err := os.ReadDir(dir)
	if err != nil {
		if os.IsNotExist(err) {
			return nil, nil
		}
		return nil, err
	}
	var profiles []remoteProfileCredentials
	for _, e := range entries {
		if e.IsDir() || filepath.Ext(e.Name()) != ".json" {
			continue
		}
		data, err := os.ReadFile(filepath.Join(dir, e.Name()))
		if err != nil {
			continue
		}
		var cred remoteProfileCredentials
		if json.Unmarshal(data, &cred) == nil {
			profiles = append(profiles, cred)
		}
	}
	return profiles, nil
}

func (a *App) removeRemoteProfile(profileID string) error {
	if profileID == "" || profileID == "my" {
		return nil
	}
	_ = os.Remove(a.credentialFile(profileID))
	profileDir := a.profileDir(profileID)
	_ = os.RemoveAll(profileDir)
	return nil
}

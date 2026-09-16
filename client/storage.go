package main

import (
	"encoding/json"
	"os"
	"path/filepath"
)

type ProjectData struct {
	Projects     json.RawMessage `json:"projects"`
	Environments json.RawMessage `json:"environments"`
}

func (a *App) profileDir(profileID string) string {
	if profileID == "" {
		profileID = "my"
	}
	return filepath.Join(a.dataPath, "profiles", profileID)
}

func (a *App) ensureProfileDir(profileID string) error {
	return os.MkdirAll(a.profileDir(profileID), 0700)
}

func (a *App) readJSONFile(path string) (json.RawMessage, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return nil, err
	}
	return json.RawMessage(data), nil
}

func (a *App) writeJSONFile(path string, data json.RawMessage) error {
	var pretty json.RawMessage
	if json.Unmarshal(data, &pretty) == nil {
		if formatted, err := json.MarshalIndent(pretty, "", "  "); err == nil {
			data = formatted
		}
	}
	return os.WriteFile(path, data, 0600)
}

func (a *App) GetProjects(profileID string) (string, error) {
	if err := a.ensureProfileDir(profileID); err != nil {
		return "", err
	}
	path := filepath.Join(a.profileDir(profileID), "projects.json")
	data, err := os.ReadFile(path)
	if err != nil {
		if os.IsNotExist(err) {
			return "", nil
		}
		return "", err
	}
	return string(data), nil
}

func (a *App) SaveProjects(profileID string, data string) error {
	if err := a.ensureProfileDir(profileID); err != nil {
		return err
	}
	return a.writeJSONFile(filepath.Join(a.profileDir(profileID), "projects.json"), json.RawMessage(data))
}

func (a *App) GetEnvironments(profileID string) (string, error) {
	if err := a.ensureProfileDir(profileID); err != nil {
		return "", err
	}
	path := filepath.Join(a.profileDir(profileID), "environments.json")
	data, err := os.ReadFile(path)
	if err != nil {
		if os.IsNotExist(err) {
			return "", nil
		}
		return "", err
	}
	return string(data), nil
}

func (a *App) SaveEnvironments(profileID string, data string) error {
	if err := a.ensureProfileDir(profileID); err != nil {
		return err
	}
	return a.writeJSONFile(filepath.Join(a.profileDir(profileID), "environments.json"), json.RawMessage(data))
}

func (a *App) GetSession(profileID string) (string, error) {
	if err := a.ensureProfileDir(profileID); err != nil {
		return "", err
	}
	path := filepath.Join(a.profileDir(profileID), "session.json")
	data, err := os.ReadFile(path)
	if err != nil {
		if os.IsNotExist(err) {
			return "", nil
		}
		return "", err
	}
	return string(data), nil
}

func (a *App) SaveSession(profileID string, data string) error {
	if err := a.ensureProfileDir(profileID); err != nil {
		return err
	}
	return a.writeJSONFile(filepath.Join(a.profileDir(profileID), "session.json"), json.RawMessage(data))
}

func (a *App) GetCookies(profileID string) (string, error) {
	if err := a.ensureProfileDir(profileID); err != nil {
		return "", err
	}
	path := filepath.Join(a.profileDir(profileID), "cookies.json")
	data, err := os.ReadFile(path)
	if err != nil {
		if os.IsNotExist(err) {
			return "", nil
		}
		return "", err
	}
	return string(data), nil
}

func (a *App) SaveCookies(profileID string, data string) error {
	if err := a.ensureProfileDir(profileID); err != nil {
		return err
	}
	return a.writeJSONFile(filepath.Join(a.profileDir(profileID), "cookies.json"), json.RawMessage(data))
}

func (a *App) SetClipboard(text string) error {
	return clipboardSetText(a.ctx, text)
}

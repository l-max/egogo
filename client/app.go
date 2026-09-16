package main

import (
	"context"
	"encoding/json"
	"os"
	"path/filepath"
)

type Settings struct {
	Language      string `json:"language"`
	MyProfileName string `json:"myProfileName"`
}

type App struct {
	ctx           context.Context
	dataPath      string
	pendingInvite *PendingInvite
}

func NewApp() *App {
	home, _ := os.UserHomeDir()
	return &App{
		dataPath: filepath.Join(home, ".egogo"),
	}
}

func (a *App) startup(ctx context.Context) {
	a.ctx = ctx
	os.MkdirAll(a.dataPath, 0700)
}

func (a *App) settingsFile() string {
	return filepath.Join(a.dataPath, "settings.json")
}

func (a *App) GetSettings() Settings {
	data, err := os.ReadFile(a.settingsFile())
	if err != nil {
		return Settings{Language: "ru", MyProfileName: "My"}
	}
	var s Settings
	if json.Unmarshal(data, &s) != nil {
		return Settings{Language: "ru", MyProfileName: "My"}
	}
	if s.Language == "" {
		s.Language = "ru"
	}
	if s.MyProfileName == "" {
		s.MyProfileName = "My"
	}
	return s
}

func (a *App) SaveSettings(settings Settings) error {
	data, err := json.MarshalIndent(settings, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(a.settingsFile(), data, 0600)
}

func (a *App) GetDataPath() string {
	return a.dataPath
}

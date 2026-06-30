package main

import (
	"context"

	"github.com/wailsapp/wails/v2/pkg/runtime"
)

func clipboardSetText(ctx context.Context, text string) error {
	runtime.ClipboardSetText(ctx, text)
	return nil
}

package api

import (
	"context"

	"github.com/egogo/server/internal/auth"
)

type ctxKey int

const claimsKey ctxKey = 1

func withClaims(ctx context.Context, claims *auth.Claims) context.Context {
	return context.WithValue(ctx, claimsKey, claims)
}

func claimsFromContext(ctx context.Context) *auth.Claims {
	v, _ := ctx.Value(claimsKey).(*auth.Claims)
	return v
}

package auth

import (
	"crypto/hmac"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"errors"
	"fmt"
	"os"
	"strings"
	"time"

	"github.com/egogo/pkg/models"
	"github.com/golang-jwt/jwt/v5"
	"golang.org/x/crypto/bcrypt"
)

const (
	AccessTokenTTL  = 15 * time.Minute
	RefreshTokenTTL = 7 * 24 * time.Hour
	InviteTokenTTL  = 72 * time.Hour
)

type Service struct {
	secret []byte
}

type TokenPair struct {
	AccessToken  string `json:"accessToken"`
	RefreshToken string `json:"refreshToken"`
	ExpiresIn    int64  `json:"expiresIn"`
}

type Claims struct {
	UserID string          `json:"userId"`
	Email  string          `json:"email"`
	Role   models.UserRole `json:"role"`
	Type   string          `json:"type"`
	jwt.RegisteredClaims
}

func NewService() (*Service, error) {
	secret := os.Getenv("EGOGO_SECRET")
	if secret == "" {
		return nil, errors.New("EGOGO_SECRET is required")
	}
	return &Service{secret: []byte(secret)}, nil
}

func HashPassword(password string) (string, error) {
	hash, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return "", err
	}
	return string(hash), nil
}

func CheckPassword(hash, password string) bool {
	return bcrypt.CompareHashAndPassword([]byte(hash), []byte(password)) == nil
}

func (s *Service) IssueTokens(user *models.User) (*TokenPair, error) {
	access, err := s.signToken(user, "access", AccessTokenTTL)
	if err != nil {
		return nil, err
	}
	refresh, err := s.signToken(user, "refresh", RefreshTokenTTL)
	if err != nil {
		return nil, err
	}
	return &TokenPair{
		AccessToken:  access,
		RefreshToken: refresh,
		ExpiresIn:    int64(AccessTokenTTL.Seconds()),
	}, nil
}

func (s *Service) Refresh(refreshToken string) (*TokenPair, error) {
	claims, err := s.ParseToken(refreshToken)
	if err != nil {
		return nil, err
	}
	if claims.Type != "refresh" {
		return nil, errors.New("invalid token type")
	}
	user := &models.User{
		ID:    claims.UserID,
		Email: claims.Email,
		Role:  claims.Role,
	}
	return s.IssueTokens(user)
}

func (s *Service) ParseToken(token string) (*Claims, error) {
	parsed, err := jwt.ParseWithClaims(token, &Claims{}, func(t *jwt.Token) (interface{}, error) {
		if t.Method != jwt.SigningMethodHS256 {
			return nil, fmt.Errorf("unexpected signing method: %v", t.Header["alg"])
		}
		return s.secret, nil
	})
	if err != nil {
		return nil, err
	}
	claims, ok := parsed.Claims.(*Claims)
	if !ok || !parsed.Valid {
		return nil, errors.New("invalid token")
	}
	return claims, nil
}

func (s *Service) signToken(user *models.User, tokenType string, ttl time.Duration) (string, error) {
	now := time.Now()
	claims := Claims{
		UserID: user.ID,
		Email:  user.Email,
		Role:   user.Role,
		Type:   tokenType,
		RegisteredClaims: jwt.RegisteredClaims{
			Subject:   user.ID,
			IssuedAt:  jwt.NewNumericDate(now),
			ExpiresAt: jwt.NewNumericDate(now.Add(ttl)),
		},
	}
	return jwt.NewWithClaims(jwt.SigningMethodHS256, claims).SignedString(s.secret)
}

func (s *Service) GenerateInviteToken(userID string, expiresAt time.Time) (string, error) {
	nonce := make([]byte, 16)
	if _, err := rand.Read(nonce); err != nil {
		return "", err
	}
	payload := fmt.Sprintf("%s:%d:%s", userID, expiresAt.Unix(), hex.EncodeToString(nonce))
	mac := hmac.New(sha256.New, s.secret)
	mac.Write([]byte(payload))
	sig := mac.Sum(nil)
	raw := payload + ":" + base64.RawURLEncoding.EncodeToString(sig)
	return base64.RawURLEncoding.EncodeToString([]byte(raw)), nil
}

func (s *Service) VerifyInviteToken(token string) (userID string, expiresAt time.Time, err error) {
	decoded, err := base64.RawURLEncoding.DecodeString(token)
	if err != nil {
		return "", time.Time{}, errors.New("invalid invite token")
	}
	parts := strings.Split(string(decoded), ":")
	if len(parts) != 4 {
		return "", time.Time{}, errors.New("invalid invite token format")
	}
	userID = parts[0]
	var unix int64
	if _, err := fmt.Sscanf(parts[1], "%d", &unix); err != nil {
		return "", time.Time{}, errors.New("invalid invite token expiry")
	}
	expiresAt = time.Unix(unix, 0).UTC()
	payload := strings.Join(parts[:3], ":")
	sig, err := base64.RawURLEncoding.DecodeString(parts[3])
	if err != nil {
		return "", time.Time{}, errors.New("invalid invite token signature")
	}
	mac := hmac.New(sha256.New, s.secret)
	mac.Write([]byte(payload))
	if !hmac.Equal(sig, mac.Sum(nil)) {
		return "", time.Time{}, errors.New("invite token signature mismatch")
	}
	if time.Now().After(expiresAt) {
		return "", time.Time{}, errors.New("invite token expired")
	}
	return userID, expiresAt, nil
}

func BuildInviteURL(serverURL, token string) string {
	base := strings.TrimRight(serverURL, "/")
	return fmt.Sprintf("egogo://auth/invite?token=%s&server=%s", token, base)
}

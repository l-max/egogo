package main

import (
	"bytes"
	"encoding/base64"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"
)

type HTTPRequest struct {
	Method       string            `json:"method"`
	URL          string            `json:"url"`
	Headers      map[string]string `json:"headers"`
	Body         string            `json:"body"`
	BodyIsBase64 bool              `json:"bodyIsBase64"`
}

type HTTPCookie struct {
	Name   string `json:"name"`
	Value  string `json:"value"`
	Domain string `json:"domain"`
	Path   string `json:"path"`
}

type HTTPResponse struct {
	StatusCode int               `json:"statusCode"`
	Status     string            `json:"status"`
	Headers    map[string]string `json:"headers"`
	Cookies    []HTTPCookie      `json:"cookies"`
	Body       string            `json:"body"`
	Duration   int64             `json:"durationMs"`
	Error      string            `json:"error"`
}

func (a *App) SendRequest(req HTTPRequest) HTTPResponse {
	start := time.Now()

	if strings.TrimSpace(req.URL) == "" {
		return HTTPResponse{Error: "URL is required", Duration: time.Since(start).Milliseconds()}
	}

	method := strings.ToUpper(req.Method)
	if method == "" {
		method = http.MethodGet
	}

	var bodyReader io.Reader
	if req.Body != "" && method != http.MethodGet && method != http.MethodHead {
		if req.BodyIsBase64 {
			decoded, err := base64.StdEncoding.DecodeString(req.Body)
			if err != nil {
				return HTTPResponse{Error: err.Error(), Duration: time.Since(start).Milliseconds()}
			}
			bodyReader = bytes.NewReader(decoded)
		} else {
			bodyReader = strings.NewReader(req.Body)
		}
	}

	httpReq, err := http.NewRequestWithContext(a.ctx, method, req.URL, bodyReader)
	if err != nil {
		return HTTPResponse{Error: err.Error(), Duration: time.Since(start).Milliseconds()}
	}

	for key, value := range req.Headers {
		httpReq.Header.Set(key, value)
	}

	if req.Body != "" && httpReq.Header.Get("Content-Type") == "" {
		httpReq.Header.Set("Content-Type", "application/json")
	}

	client := &http.Client{
		Timeout: 30 * time.Second,
		CheckRedirect: func(req *http.Request, via []*http.Request) error {
			if len(via) >= 10 {
				return fmt.Errorf("too many redirects")
			}
			return nil
		},
	}

	resp, err := client.Do(httpReq)
	if err != nil {
		return HTTPResponse{Error: err.Error(), Duration: time.Since(start).Milliseconds()}
	}
	defer resp.Body.Close()

	bodyBytes, err := io.ReadAll(io.LimitReader(resp.Body, 10*1024*1024))
	if err != nil {
		return HTTPResponse{Error: err.Error(), Duration: time.Since(start).Milliseconds()}
	}

	headers := make(map[string]string, len(resp.Header))
	for key, values := range resp.Header {
		if strings.EqualFold(key, "Set-Cookie") {
			continue
		}
		headers[key] = strings.Join(values, ", ")
	}

	cookies := make([]HTTPCookie, 0, len(resp.Cookies()))
	for _, c := range resp.Cookies() {
		cookies = append(cookies, HTTPCookie{
			Name:   c.Name,
			Value:  c.Value,
			Domain: c.Domain,
			Path:   c.Path,
		})
	}

	return HTTPResponse{
		StatusCode: resp.StatusCode,
		Status:     resp.Status,
		Headers:    headers,
		Cookies:    cookies,
		Body:       string(bodyBytes),
		Duration:   time.Since(start).Milliseconds(),
	}
}

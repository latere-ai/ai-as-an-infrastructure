// Package authn adapts the latere OIDC client to the comments API's Identity
// interface and adds a same-origin double-submit CSRF check on the book domain.
package authn

import (
	"cmp"
	"crypto/rand"
	"crypto/subtle"
	"encoding/hex"
	"net/http"

	"latere.ai/x/pkg/oidc"

	"github.com/latere-ai/ai-as-an-infrastructure/internal/api"
)

const csrfCookie = "aaai-csrf"

// Identity resolves the current user from the OIDC session cookie and validates
// CSRF for writes. The session cookie is SameSite=Lax (so it is not sent on
// cross-site POSTs); the double-submit token is defense in depth on top of that.
type Identity struct {
	client *oidc.Client
	secure bool // Secure flag on the CSRF cookie (false for local http)
}

// New wraps an OIDC client. secure should be false only for local http dev.
func New(client *oidc.Client, secure bool) *Identity {
	return &Identity{client: client, secure: secure}
}

// User maps the OIDC user to the API user, or returns nil when anonymous.
func (i *Identity) User(w http.ResponseWriter, r *http.Request) *api.User {
	u := i.client.UserFromRequest(w, r)
	if u == nil {
		return nil
	}
	return &api.User{
		Sub:          u.Sub,
		Name:         cmp.Or(u.DisplayName, u.Name),
		Avatar:       cmp.Or(u.AvatarURL, u.Picture),
		IsSuperadmin: u.IsSuperadmin,
	}
}

// EnsureCSRF issues the double-submit token cookie if absent and returns it so
// /api/me can hand it to the SPA, which echoes it as the X-CSRF-Token header.
func (i *Identity) EnsureCSRF(w http.ResponseWriter, r *http.Request) string {
	if c, err := r.Cookie(csrfCookie); err == nil && c.Value != "" {
		return c.Value
	}
	tok := randToken()
	http.SetCookie(w, &http.Cookie{
		Name:     csrfCookie,
		Value:    tok,
		Path:     "/",
		SameSite: http.SameSiteLaxMode,
		Secure:   i.secure,
		// deliberately not HttpOnly: the SPA must read it to echo it back.
	})
	return tok
}

// CheckCSRF requires the X-CSRF-Token header to match the cookie.
func (i *Identity) CheckCSRF(r *http.Request) bool {
	c, err := r.Cookie(csrfCookie)
	if err != nil || c.Value == "" {
		return false
	}
	got := r.Header.Get("X-CSRF-Token")
	return len(got) == len(c.Value) && subtle.ConstantTimeCompare([]byte(got), []byte(c.Value)) == 1
}

func randToken() string {
	b := make([]byte, 16)
	_, _ = rand.Read(b)
	return hex.EncodeToString(b)
}

// SPDX-FileCopyrightText: 2026 Latere AI
// SPDX-License-Identifier: MIT

package api

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

// TestDecodeRejectsUnknownMembers pins that a request body naming a field
// the API does not define is a bad request, as is an empty body.
func TestDecodeRejectsUnknownMembers(t *testing.T) {
	for name, body := range map[string]string{
		"unknown": `{"body":"x","extra":1}`,
		"empty":   ``,
	} {
		t.Run(name, func(t *testing.T) {
			w := httptest.NewRecorder()
			r := httptest.NewRequest(http.MethodPost, "/", strings.NewReader(body))
			var v struct {
				Body string `json:"body"`
			}
			if decode(w, r, &v) {
				t.Fatal("decode accepted the body")
			}
			if w.Code != http.StatusBadRequest {
				t.Errorf("status = %d, want 400", w.Code)
			}
		})
	}
}

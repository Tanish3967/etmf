package main

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"etmf-gateway/internal/handlers"
	"etmf-gateway/internal/models"
)

func setupTestServer() http.Handler {
	server := handlers.NewGatewayServer()
	mux := http.NewServeMux()
	mux.HandleFunc("GET /health", server.HandleHealth)
	mux.HandleFunc("POST /api/auth/login", server.HandleLogin)
	mux.HandleFunc("GET /api/documents", server.HandleDocuments)
	mux.HandleFunc("POST /api/documents", server.HandleDocuments)
	mux.HandleFunc("POST /api/ai/orchestrate", server.HandleAIOrchestrate)
	return server.Middleware(mux)
}

func TestHealthCheck(t *testing.T) {
	handler := setupTestServer()
	req := httptest.NewRequest(http.MethodGet, "/health", nil)
	rr := httptest.NewRecorder()

	handler.ServeHTTP(rr, req)

	if rr.Code != http.StatusOK {
		t.Fatalf("Expected 200, got %d", rr.Code)
	}

	complianceHeader := rr.Header().Get("X-Compliance-Framework")
	if complianceHeader == "" {
		t.Errorf("Missing X-Compliance-Framework header")
	}
}

func TestLogin(t *testing.T) {
	handler := setupTestServer()
	loginPayload := models.LoginRequest{
		Email:    "e.vasquez@pharma.com",
		Password: "Admin1234!",
	}
	body, _ := json.Marshal(loginPayload)
	req := httptest.NewRequest(http.MethodPost, "/api/auth/login", bytes.NewBuffer(body))
	req.Header.Set("Content-Type", "application/json")
	rr := httptest.NewRecorder()

	handler.ServeHTTP(rr, req)

	if rr.Code != http.StatusOK {
		t.Fatalf("Expected 200, got %d", rr.Code)
	}

	var resp models.LoginResponse
	if err := json.Unmarshal(rr.Body.Bytes(), &resp); err != nil {
		t.Fatalf("Failed to parse login response: %v", err)
	}

	if resp.Token == "" {
		t.Errorf("Expected token in login response")
	}
}

func TestAIOrchestrateConditionA(t *testing.T) {
	handler := setupTestServer()
	orchReq := models.OrchestrationRequest{
		DocumentID:   "DOC-GO-TEST-A",
		TenantID:     "tenant-001",
		FileName:     "02.01.01_Protocol.pdf",
		DocumentText: "Clinical Study Protocol for Oncology Trial",
	}
	body, _ := json.Marshal(orchReq)
	req := httptest.NewRequest(http.MethodPost, "/api/ai/orchestrate", bytes.NewBuffer(body))
	req.Header.Set("Content-Type", "application/json")
	rr := httptest.NewRecorder()

	handler.ServeHTTP(rr, req)

	if rr.Code != http.StatusOK {
		t.Fatalf("Expected 200, got %d", rr.Code)
	}

	var resp models.OrchestrationResponse
	if err := json.Unmarshal(rr.Body.Bytes(), &resp); err != nil {
		t.Fatalf("Failed to parse orchestration response: %v", err)
	}

	if resp.AssignedStatus != "Pending Review" {
		t.Errorf("Expected Pending Review, got %s", resp.AssignedStatus)
	}
	if resp.DIAClassification.ConfidenceScore < 0.85 {
		t.Errorf("Expected confidence >= 0.85, got %f", resp.DIAClassification.ConfidenceScore)
	}
}

func TestAIOrchestrateConditionB(t *testing.T) {
	handler := setupTestServer()
	orchReq := models.OrchestrationRequest{
		DocumentID:   "DOC-GO-TEST-B",
		TenantID:     "tenant-001",
		FileName:     "1572_Form_Defective.pdf",
		DocumentText: "FDA Form 1572 missing signature unsigned",
	}
	body, _ := json.Marshal(orchReq)
	req := httptest.NewRequest(http.MethodPost, "/api/ai/orchestrate", bytes.NewBuffer(body))
	req.Header.Set("Content-Type", "application/json")
	rr := httptest.NewRecorder()

	handler.ServeHTTP(rr, req)

	if rr.Code != http.StatusOK {
		t.Fatalf("Expected 200, got %d", rr.Code)
	}

	var resp models.OrchestrationResponse
	if err := json.Unmarshal(rr.Body.Bytes(), &resp); err != nil {
		t.Fatalf("Failed to parse orchestration response: %v", err)
	}

	if resp.AssignedStatus != "Under Review" {
		t.Errorf("Expected Under Review, got %s", resp.AssignedStatus)
	}
	if len(resp.SmartQCFlags) == 0 {
		t.Errorf("Expected Smart QC flags to be present")
	}
}

func TestAIOrchestrateConditionC(t *testing.T) {
	handler := setupTestServer()
	orchReq := models.OrchestrationRequest{
		DocumentID:   "DOC-GO-TEST-C",
		TenantID:     "tenant-001",
		FileName:     "notes.pdf",
		DocumentText: "ambiguous notes receipt",
	}
	body, _ := json.Marshal(orchReq)
	req := httptest.NewRequest(http.MethodPost, "/api/ai/orchestrate", bytes.NewBuffer(body))
	req.Header.Set("Content-Type", "application/json")
	rr := httptest.NewRecorder()

	handler.ServeHTTP(rr, req)

	if rr.Code != http.StatusOK {
		t.Fatalf("Expected 200, got %d", rr.Code)
	}

	var resp models.OrchestrationResponse
	if err := json.Unmarshal(rr.Body.Bytes(), &resp); err != nil {
		t.Fatalf("Failed to parse orchestration response: %v", err)
	}

	if resp.AssignedStatus != "Draft" {
		t.Errorf("Expected Draft, got %s", resp.AssignedStatus)
	}
	if !resp.ManualTriageRequired {
		t.Errorf("Expected ManualTriageRequired to be true")
	}
}

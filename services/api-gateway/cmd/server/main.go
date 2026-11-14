package main

import (
	"fmt"
	"log"
	"net/http"
	"os"

	"etmf-gateway/internal/handlers"
)

func main() {
	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	server := handlers.NewGatewayServer()
	mux := http.NewServeMux()

	// Registered endpoints
	mux.HandleFunc("GET /health", server.HandleHealth)
	mux.HandleFunc("POST /api/auth/login", server.HandleLogin)
	mux.HandleFunc("GET /api/documents", server.HandleDocuments)
	mux.HandleFunc("POST /api/documents", server.HandleDocuments)
	mux.HandleFunc("POST /api/ai/orchestrate", server.HandleAIOrchestrate)

	handlerWithMiddleware := server.Middleware(mux)

	fmt.Printf("\n🚀 eTMF Go API Gateway running on http://localhost:%s\n", port)
	fmt.Println("📋 Compliance: ICH E6(R2) | 21 CFR Part 11 | EU Annex 11 | ALCOA+")
	fmt.Println("🔒 Security: JWT | MFA | RBAC | Audit Trail Seal")

	if err := http.ListenAndServe(":"+port, handlerWithMiddleware); err != nil {
		log.Fatalf("Server failed to start: %v", err)
	}
}

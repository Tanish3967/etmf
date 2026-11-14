package models

type DIAClassification struct {
	ZoneCode        string  `json:"zone_code"`
	SectionCode     string  `json:"section_code"`
	ArtifactCode    string  `json:"artifact_code"`
	ArtifactName    string  `json:"artifact_name"`
	ConfidenceScore float64 `json:"confidence_score"`
}

type DocumentMetadata struct {
	DocumentTitle    string  `json:"document_title"`
	EffectiveDate    *string `json:"effective_date"`
	SiteID           *string `json:"site_id"`
	InvestigatorName *string `json:"investigator_name"`
	HasSignature     bool    `json:"has_signature"`
}

type AIOrchestrationResult struct {
	DIAClassification DIAClassification `json:"dia_classification"`
	Metadata          DocumentMetadata  `json:"metadata"`
	SmartQCFlags      []string          `json:"smart_qc_flags"`
}

type GeneratedQuery struct {
	ID       string `json:"id"`
	Text     string `json:"text"`
	Severity string `json:"severity"`
	Status   string `json:"status"`
}

type ShadowAudit struct {
	AuditID       string   `json:"audit_id"`
	Compliance    []string `json:"compliance"`
	ImmutableHash string   `json:"immutable_hash"`
}

type OrchestrationRequest struct {
	DocumentID   string  `json:"document_id"`
	TenantID     string  `json:"tenant_id"`
	UserID       string  `json:"user_id"`
	StudyID      string  `json:"study_id"`
	DocumentText string  `json:"document_text"`
	FileName     string  `json:"file_name"`
	S3URI        *string `json:"s3_uri,omitempty"`
}

type OrchestrationResponse struct {
	EventType            string            `json:"event_type"`
	DocumentID           string            `json:"document_id"`
	TenantID             string            `json:"tenant_id"`
	AssignedStatus       string            `json:"assigned_status"`
	RoutingCondition     string            `json:"routing_condition"`
	ManualTriageRequired bool              `json:"manual_triage_required"`
	DIAClassification    DIAClassification `json:"dia_classification"`
	Metadata             DocumentMetadata  `json:"metadata"`
	SmartQCFlags         []string          `json:"smart_qc_flags"`
	GeneratedQueries     []GeneratedQuery  `json:"generated_queries"`
	ShadowAudit          ShadowAudit       `json:"shadow_audit"`
	Timestamp            string            `json:"timestamp"`
}

type LoginRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

type User struct {
	ID    string   `json:"id"`
	Name  string   `json:"name"`
	Email string   `json:"email"`
	Role  string   `json:"role"`
	Caps  []string `json:"caps"`
}

type LoginResponse struct {
	Token string `json:"token"`
	User  User   `json:"user"`
}

type Document struct {
	ID           string `json:"id"`
	TenantID     string `json:"tenant_id"`
	StudyID      string `json:"study_id"`
	ArtifactCode string `json:"artifact_code"`
	ArtifactName string `json:"artifact_name"`
	Zone         string `json:"zone"`
	Section      string `json:"section"`
	Title        string `json:"title"`
	Version      string `json:"version"`
	Status       string `json:"status"`
	FileName     string `json:"file_name"`
	CreatedBy    string `json:"created_by"`
	CreatedAt    string `json:"created_at"`
}

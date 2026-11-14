from typing import List, Optional
from pydantic import BaseModel, Field

class DIAClassification(BaseModel):
    zone_code: str = Field(..., description="The 2-digit Zone code (e.g., '01', '02', '03', '05').")
    section_code: str = Field(..., description="The 4-digit Section code (e.g., '01.01', '02.01', '05.02').")
    artifact_code: str = Field(..., description="The full Artifact code (e.g., 'TMF-01.01.001', 'TMF-02.01.001').")
    artifact_name: str = Field(..., description="The standard name of the DIA Artifact.")
    confidence_score: float = Field(..., ge=0.0, le=1.0, description="Confidence score between 0.0 and 1.0.")

class DocumentMetadata(BaseModel):
    document_title: str = Field(..., description="A concise descriptive title for the document.")
    effective_date: Optional[str] = Field(None, description="Effective or signature date in YYYY-MM-DD format.")
    site_id: Optional[str] = Field(None, description="Specific Site ID if site-level, or null.")
    investigator_name: Optional[str] = Field(None, description="Principal Investigator or Sub-Investigator name.")
    has_signature: bool = Field(..., description="True if document appears signed.")

class AIOrchestrationResult(BaseModel):
    dia_classification: DIAClassification
    metadata: DocumentMetadata
    smart_qc_flags: List[str] = Field(default_factory=list, description="Quality deficiencies flagged.")

class OrchestrationRequest(BaseModel):
    document_id: str
    tenant_id: str = "tenant-001"
    user_id: str = "usr-001"
    study_id: str = "study-001"
    document_text: str = ""
    file_name: str = ""
    s3_uri: Optional[str] = None

class GeneratedQuery(BaseModel):
    id: str
    text: str
    severity: str = "Major"
    status: str = "Open"

class ShadowAudit(BaseModel):
    audit_id: str
    compliance: List[str]
    immutable_hash: str

class OrchestrationResponse(BaseModel):
    event_type: str = "processing_complete"
    document_id: str
    tenant_id: str
    assigned_status: str
    routing_condition: str
    manual_triage_required: bool
    dia_classification: DIAClassification
    metadata: DocumentMetadata
    smart_qc_flags: List[str]
    generated_queries: List[GeneratedQuery] = []
    shadow_audit: ShadowAudit
    timestamp: str

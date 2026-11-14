import uuid
import hashlib
from datetime import datetime
from app.schemas import (
    AIOrchestrationResult,
    OrchestrationRequest,
    OrchestrationResponse,
    GeneratedQuery,
    ShadowAudit
)

def evaluate_and_route(req: OrchestrationRequest, result: AIOrchestrationResult) -> OrchestrationResponse:
    confidence = result.dia_classification.confidence_score
    has_deficiencies = len(result.smart_qc_flags) > 0

    assigned_status = "Draft"
    routing_condition = ""
    manual_triage_required = False
    generated_queries = []

    # Condition A (High Confidence):
    # confidence_score >= 0.85 AND smart_qc_flags is empty
    if confidence >= 0.85 and not has_deficiencies:
        assigned_status = "Pending Review"
        routing_condition = "Condition A (High Confidence >= 0.85 & Clean QC)"
        manual_triage_required = False

    # Condition B (Quality Deficiencies):
    # confidence_score >= 0.85 BUT smart_qc_flags contains issues
    elif confidence >= 0.85 and has_deficiencies:
        assigned_status = "Under Review"
        routing_condition = "Condition B (High Confidence >= 0.85 with Quality Issues)"
        manual_triage_required = False

        for flag in result.smart_qc_flags:
            q_id = str(uuid.uuid4())
            generated_queries.append(GeneratedQuery(
                id=q_id,
                text=f"AI QC Finding: {flag}",
                severity="Major",
                status="Open"
            ))

    # Condition C (Low Confidence / Ambiguous):
    # confidence_score < 0.85
    else:
        assigned_status = "Draft"
        routing_condition = "Condition C (Low Confidence < 0.85 - Requires Manual Triage)"
        manual_triage_required = True

    audit_id = str(uuid.uuid4())
    hash_payload = f"{req.document_id}:{assigned_status}:{confidence}:{datetime.utcnow().isoformat()}"
    immutable_hash = "sha256-" + hashlib.sha256(hash_payload.encode()).hexdigest()[:32]

    return OrchestrationResponse(
        event_type="processing_complete",
        document_id=req.document_id,
        tenant_id=req.tenant_id,
        assigned_status=assigned_status,
        routing_condition=routing_condition,
        manual_triage_required=manual_triage_required,
        dia_classification=result.dia_classification,
        metadata=result.metadata,
        smart_qc_flags=result.smart_qc_flags,
        generated_queries=generated_queries,
        shadow_audit=ShadowAudit(
            audit_id=audit_id,
            compliance=["ICH GCP E6(R2)", "21 CFR Part 11", "ALCOA+"],
            immutable_hash=immutable_hash
        ),
        timestamp=datetime.utcnow().isoformat() + "Z"
    )

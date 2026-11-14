import os
import sys

# Ensure app package is importable
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.schemas import OrchestrationRequest
from app.orchestrator import clinical_nlp_fallback
from app.routing import evaluate_and_route

def test_condition_a():
    req = OrchestrationRequest(
        document_id="DOC-TEST-001",
        file_name="02.01.01_Clinical_Protocol_v3.pdf",
        document_text="Clinical Study Protocol for PROTO-01 Oncology Trial. Signed by CMO. All pages complete."
    )
    result = clinical_nlp_fallback(req.document_text, req.file_name)
    response = evaluate_and_route(req, result)
    
    assert response.assigned_status == "Pending Review", f"Expected Pending Review, got {response.assigned_status}"
    assert response.dia_classification.confidence_score >= 0.85
    assert len(response.smart_qc_flags) == 0
    assert response.manual_triage_required is False
    print("  ✅ Condition A (High Confidence & Clean QC -> Pending Review) passed")

def test_condition_b():
    req = OrchestrationRequest(
        document_id="DOC-TEST-002",
        file_name="1572_Form_Site001.pdf",
        document_text="FDA Form 1572 Statement of Investigator. Site-001. Warning: [signature line empty] and blurry illegible text on page 2."
    )
    result = clinical_nlp_fallback(req.document_text, req.file_name)
    response = evaluate_and_route(req, result)

    assert response.assigned_status == "Under Review", f"Expected Under Review, got {response.assigned_status}"
    assert response.dia_classification.confidence_score >= 0.85
    assert len(response.smart_qc_flags) > 0
    assert len(response.generated_queries) > 0
    assert response.manual_triage_required is False
    print("  ✅ Condition B (High Confidence with QC Flags -> Under Review + Queries) passed")

def test_condition_c():
    req = OrchestrationRequest(
        document_id="DOC-TEST-003",
        file_name="receipt_notes.pdf",
        document_text="ambiguous draft notes expense receipt"
    )
    result = clinical_nlp_fallback(req.document_text, req.file_name)
    response = evaluate_and_route(req, result)

    assert response.assigned_status == "Draft", f"Expected Draft, got {response.assigned_status}"
    assert response.dia_classification.confidence_score < 0.85
    assert response.manual_triage_required is True
    print("  ✅ Condition C (Low Confidence < 0.85 -> Draft + Manual Triage) passed")

if __name__ == "__main__":
    print("\n======================================================")
    print("🐍 Python FastAPI AI Service — Orchestration Tests")
    print("======================================================\n")
    test_condition_a()
    test_condition_b()
    test_condition_c()
    print("\n✅ All 3 Python AI Service tests passed successfully!\n")

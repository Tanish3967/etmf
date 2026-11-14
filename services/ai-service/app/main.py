from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from app.schemas import OrchestrationRequest, OrchestrationResponse
from app.orchestrator import invoke_gemini, SYSTEM_INSTRUCTION
from app.routing import evaluate_and_route

app = FastAPI(
    title="eTMF Pro — AI Document Orchestrator Microservice",
    version="1.0.0",
    description="DIA TMF Reference Model v3.2 Auto-Classification and Smart QC Engine"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/health")
def health_check():
    return {
        "status": "healthy",
        "service": "etmf-ai-orchestrator",
        "compliance": ["ICH GCP E6(R2)", "21 CFR Part 11", "ALCOA+"],
        "model": "gemini-1.5-flash",
        "reference_model": "DIA TMF Reference Model v3.2"
    }

@app.get("/api/v1/schema")
def get_dia_schema():
    from app.schemas import AIOrchestrationResult
    return {
        "schema_version": "DIA TMF Reference Model v3.2",
        "json_schema": AIOrchestrationResult.model_json_schema()
    }

@app.get("/api/v1/prompts")
def get_prompts():
    return {
        "system_instruction": SYSTEM_INSTRUCTION,
        "supported_models": ["gemini-1.5-flash", "gemini-1.5-pro"]
    }

@app.post("/api/v1/orchestrate", response_model=OrchestrationResponse)
def orchestrate_document(req: OrchestrationRequest):
    if not req.document_id:
        raise HTTPException(status_code=400, detail="document_id is required")

    try:
        # Step 2: AI Processing (Gemini Invocation)
        ai_result = invoke_gemini(req.document_text, req.file_name)
        # Step 3: State Evaluation & Routing (Conditions A, B, C)
        response = evaluate_and_route(req, ai_result)
        return response
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=False)

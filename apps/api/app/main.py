
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api.v1.data_factory import router as data_factory_router

app = FastAPI(
    title="ALZA DevKit API",
    description="Private Developer Operations Platform",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type"],
)

app.include_router(data_factory_router)

@app.get("/api/v1/health")
def health_check():
    return {
        "status": "healthy",
        "application": "ALZA DevKit",
        "module": "Mock Data Factory",
        "version": "0.1.0",
    }

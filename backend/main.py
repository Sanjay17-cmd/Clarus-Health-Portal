"""Clarus Health Portal — FastAPI Application Entry Point (Phase 1 + 2 + 3A + 3B)."""
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from config import settings
from routers import auth, admin, doctor, patient, technician, specializations, notifications
from routers.reports import router as reports_router
from routers.shares import router as shares_router, public_router
from routers.admin_reports import router as admin_reports_router
from routers.archive import router as archive_router
from routers.disputes import router as disputes_router
from routers.patient_activity import router as patient_activity_router
from routers.break_glass import router as break_glass_router

app = FastAPI(
    title="Clarus Health Portal API",
    version="3.1.0",
    docs_url="/api/docs",
    redoc_url="/api/redoc",
    openapi_url="/api/openapi.json",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(specializations.router)
app.include_router(admin.router)
app.include_router(doctor.router)
app.include_router(patient.router)
app.include_router(technician.router)
app.include_router(notifications.router)
app.include_router(reports_router)
app.include_router(shares_router)
app.include_router(public_router)
app.include_router(admin_reports_router)
app.include_router(archive_router)
app.include_router(disputes_router)
app.include_router(patient_activity_router)
app.include_router(break_glass_router)


@app.exception_handler(Exception)
async def generic_exception_handler(request: Request, exc: Exception):
    import traceback
    traceback.print_exc()
    return JSONResponse(status_code=500, content={"detail": "An unexpected error occurred."})


@app.get("/api/health", tags=["health"])
def health_check():
    return {"status": "ok", "version": "3.1.0"}

import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.config import is_public_demo, get_allowed_origins, get_demo_db_path, get_deployment_mode
from app.database import init_db
from app.routes.transactions import router as transactions_router
from app.routes.habits import router as habits_router
from app.routes.notifications import router as notifications_router
from app.routes.system import router as system_router
from app.routes.learning import router as learning_router
from app.routes.auth import router as auth_router

logger = logging.getLogger("usually")

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Safe startup diagnostics (no secrets, no transaction contents)
    demo_path = get_demo_db_path()
    logger.info(f"[Usually Startup] Mode: {get_deployment_mode()} | Demo DB: {demo_path}")
    init_db()
    yield

app = FastAPI(
    title="Usually API",
    description="Local-first AI personal finance companion with longitudinal habit memory",
    version="0.2.0",
    lifespan=lifespan,
    docs_url=None if is_public_demo() else "/docs",
    redoc_url=None if is_public_demo() else "/redoc",
    openapi_url=None if is_public_demo() else "/openapi.json"
)

# Configurable CORS middleware
origins = get_allowed_origins()
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)

app.include_router(transactions_router)
app.include_router(habits_router)
app.include_router(notifications_router)
app.include_router(system_router)
app.include_router(learning_router)
app.include_router(auth_router)

@app.get("/")
def root():
    return {
        "app": "Usually",
        "description": "Your Money Has Habits",
        "docs": None if is_public_demo() else "/docs",
        "status": "online",
        "deployment_mode": get_deployment_mode()
    }

@app.get("/health")
def health():
    return {
        "status": "ok",
        "deployment_mode": get_deployment_mode(),
        "database": "connected"
    }

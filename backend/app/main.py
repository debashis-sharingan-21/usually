from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.database import init_db
from app.routes.transactions import router as transactions_router
from app.routes.habits import router as habits_router
from app.routes.system import router as system_router
from app.routes.learning import router as learning_router

@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    yield

app = FastAPI(
    title="Usually API",
    description="Local-first AI personal finance companion with longitudinal habit memory",
    version="0.2.0",
    lifespan=lifespan
)

# Enable CORS for local dev servers (Next.js port 3000 and legacy Vite port 5173)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(transactions_router)
app.include_router(habits_router)
app.include_router(system_router)
app.include_router(learning_router)

@app.get("/")
def root():
    return {
        "app": "Usually",
        "description": "Your Money Has Habits",
        "docs": "/docs",
        "status": "online",
        "phase": "2"
    }


"""
API v1 Router Aggregator for Recall AI.
"""

from fastapi import APIRouter

from app.api.v1.auth import router as auth_router
from app.api.v1.users import router as users_router
from app.api.v1.health import router as health_router
from app.api.v1.documents import router as documents_router
from app.api.v1.search import router as search_router
from app.api.v1.conversations import router as conversations_router
from app.api.v1.flashcards import router as flashcards_router, sets_alias_router
from app.api.v1.quizzes import router as quizzes_router
from app.api.v1.attempts import router as attempts_router
from app.api.v1.learning import router as learning_router

api_v1_router = APIRouter(prefix="/api/v1")

api_v1_router.include_router(auth_router)
api_v1_router.include_router(users_router)
api_v1_router.include_router(documents_router)
api_v1_router.include_router(search_router)
api_v1_router.include_router(conversations_router)
api_v1_router.include_router(flashcards_router)
api_v1_router.include_router(sets_alias_router)
api_v1_router.include_router(quizzes_router)
api_v1_router.include_router(attempts_router)
api_v1_router.include_router(learning_router)
# Include health checks both at /api/v1 and at root
api_v1_router.include_router(health_router)





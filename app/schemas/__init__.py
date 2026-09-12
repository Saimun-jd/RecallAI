"""
Recall AI Schemas Package.
Re-exports all LLM, Auth, User, and Common API schemas.
"""

from app.schemas.llm import (
    AtomicTopic,
    FlashcardItem,
    FlashcardList,
    SimpleFlashcard,
    SimpleFlashcardList,
    SectionExtraction,
    Chunk,
    DiagnosticQuestion,
    DiagnosticQuestionSet,
    SuggestedFlashcard,
    DiagnosticEvaluation,
    ChatMessage,
    ChatMessageDB,
    ChatRequest,
)

from app.schemas.auth import (
    UserRegisterRequest,
    UserLoginRequest,
    UserResponse,
    WorkspaceResponse,
    AuthResponse,
)

from app.schemas.user import (
    UserPreferencesResponse,
    UserPreferencesUpdateRequest,
)

from app.schemas.common import (
    ResponseEnvelope,
    ErrorDetail,
    ErrorBody,
    ErrorEnvelope,
    PaginationParams,
)

from app.schemas.document import (
    DocumentUploadResponse,
    DocumentDetailResponse,
    DocumentStatusResponse,
    ChunkItemResponse,
    ChunkListResponse,
    DocumentListResponse,
)

from app.schemas.search import (
    SearchResultItem,
    SearchResponse,
    RelatedDocumentItem,
    RelatedDocumentsResponse,
    ReindexResponse,
    StructuredContext,
)

from app.schemas.chat import (
    ConversationCreateRequest,
    ConversationUpdateRequest,
    ConversationResponse,
    ConversationDetailResponse,
    ConversationListResponse,
    SourceCitation,
    MessageResponse,
    SendMessageRequest,
    RAGResponse,
)

from app.schemas.flashcard import (
    FlashcardGenerateRequest,
    FlashcardResponse,
    FlashcardUpdateRequest,
    FlashcardSetResponse,
    FlashcardSetDetailResponse,
    FlashcardSetUpdateRequest,
    FlashcardSetListResponse,
)

from app.schemas.quiz import (
    QuizGenerateRequest,
    QuizQuestionResponse,
    QuizQuestionUpdateRequest,
    QuizResponse,
    QuizDetailResponse,
    QuizUpdateRequest,
    QuizListResponse,
)

from app.schemas.attempt import (
    MaskedQuizQuestionResponse,
    QuizAttemptStartResponse,
    SubmitAnswerItem,
    SubmitAnswersRequest,
    QuestionEvaluationResult,
    QuizAttemptResultResponse,
    QuizAttemptSummaryResponse,
    LearningProgressSummaryResponse,
    LearningItemResponse,
)





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
    ExamMisconception,
    DiagnosedGap,
    ExamTopicItem,
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

from app.schemas.review import (
    ReviewRatingEnum,
    StartReviewSessionRequest,
    ReviewSessionResponse,
    MaskedReviewContentResponse,
    RevealedReviewContentResponse,
    RateReviewRequest,
    RateReviewResponse,
    ReviewQueueItemResponse,
    ReviewStatisticsResponse,
)

from app.schemas.analytics import (
    ReviewWorkloadStats,
    LearningStateDistribution,
    TodayActivityStats,
    QuizPerformanceStats,
    FlashcardPerformanceStats,
    RatingDistributionItem,
    ReviewDetailedStats,
    DashboardSummaryResponse,
    DailyStudyActivity,
    StudyActivityResponse,
    DocumentLearningProgress,
    ConceptLearningProgress,
    StudySessionSummary,
)

from app.schemas.knowledge import (
    SourceReference,
    SummaryGenerateRequest,
    DocumentSummaryResponse,
    ConceptItemResponse,
    ConceptListResponse,
    ConceptGenerateRequest,
)

from app.schemas.billing import (
    PlanResponse,
    PlanListResponse,
    SubscriptionResponse,
    CheckoutRequest,
    CheckoutResponse,
    CancelSubscriptionRequest,
    UsageMetricItem,
    UsageSummaryResponse,
    BYOKStatusResponse,
    AccountOverviewResponse,
    EntitlementCheckResponse,
)


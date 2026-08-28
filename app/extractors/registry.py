import logging
from .base import BaseExtractor

logger = logging.getLogger(__name__)

EXTRACTOR_REGISTRY: dict[str, type[BaseExtractor]] = {}


def register_extractor(cls):
    """Decorator to register an extractor plugin."""
    EXTRACTOR_REGISTRY[cls.name] = cls
    return cls


def discover_extractors():
    """Import all extractor modules, keep only those whose deps are installed."""
    # Import modules to trigger @register_extractor
    try:
        from app.extractors import pymupdf4llm_extractor
    except ImportError as e:
        logger.debug(f"Failed to import pymupdf4llm_extractor: {e}")
        
    try:
        from app.extractors import marker_extractor
    except ImportError as e:
        logger.debug(f"Failed to import marker_extractor: {e}")
        
    try:
        from app.extractors import marker_api_extractor
    except ImportError as e:
        logger.debug(f"Failed to import marker_api_extractor: {e}")

    return {name: cls for name, cls in EXTRACTOR_REGISTRY.items() if cls.is_available()}


def get_extractor(name: str | None = None) -> BaseExtractor:
    """Get extractor by name, falling back to config default."""
    from app.config import settings
    from app.database import get_setting

    available = discover_extractors()
    
    # Read from DB override, fallback to config
    db_override = get_setting("pdf_extractor")
    target = name or db_override or settings.pdf_extractor
    
    if target in available:
        return available[target]()
        
    # If the user explicitly requested an extractor that isn't available, fail loudly.
    if name or db_override:
        raise RuntimeError(f"Configured extractor '{target}' is not available or missing dependencies. Please check your settings.")
        
    # Fallback to first available only if no specific extractor was requested
    if available:
        first_available = next(iter(available.keys()))
        logger.warning(f"Default extractor '{target}' not available. Falling back to '{first_available}'")
        return available[first_available]()
        
    raise RuntimeError("No extraction plugins available")

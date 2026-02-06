"""
ai-semantic-memory: Reusable semantic memory for LangGraph agents.
"""

from engram_ai.schema import (
    Durability,
    Memory,
    MemoryCreate,
    MemoryQuery,
    MemorySource,
    MemoryUpdate,
)
from engram_ai.store import build_postgres_store

__version__ = "0.1.0"

__all__ = [
    # Store
    "build_postgres_store",
    # Schema
    "Memory",
    "MemoryCreate",
    "MemoryUpdate",
    "MemoryQuery",
    "Durability",
    "MemorySource",
]

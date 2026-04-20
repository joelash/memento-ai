"""
Tests for memable 0.2.0 enhancements:
- metadata_filter on MemoryQuery
- created_by / updated_by on Memory
- MemoryPatch for lightweight updates
"""

import os
from uuid import uuid4

import pytest

from memable import (
    Durability,
    Memory,
    MemoryCreate,
    MemoryPatch,
    MemoryQuery,
    MemorySource,
    MemoryType,
    build_sqlite_store,
)


# ============================================================================
# Schema tests (no external deps)
# ============================================================================


class TestMemoryCreatedByUpdatedBy:
    """Tests for created_by / updated_by fields on Memory."""

    def test_memory_defaults_none(self):
        mem = Memory(text="Test")
        assert mem.created_by is None
        assert mem.updated_by is None

    def test_memory_with_created_by(self):
        mem = Memory(text="Test", created_by="joel")
        assert mem.created_by == "joel"
        assert mem.updated_by is None

    def test_memory_with_updated_by(self):
        mem = Memory(text="Test", created_by="joel", updated_by="sarah")
        assert mem.created_by == "joel"
        assert mem.updated_by == "sarah"

    def test_to_store_value_includes_audit_fields(self):
        mem = Memory(text="Test", created_by="joel", updated_by="sarah")
        value = mem.to_store_value()
        assert value["created_by"] == "joel"
        assert value["updated_by"] == "sarah"

    def test_to_store_value_none_audit_fields(self):
        mem = Memory(text="Test")
        value = mem.to_store_value()
        assert value["created_by"] is None
        assert value["updated_by"] is None

    def test_from_store_value_with_audit_fields(self):
        mem = Memory(text="Test", created_by="joel", updated_by="sarah")
        value = mem.to_store_value()
        restored = Memory.from_store_value(value)
        assert restored.created_by == "joel"
        assert restored.updated_by == "sarah"

    def test_from_store_value_missing_audit_fields(self):
        """Backward compat: old data without audit fields."""
        value = {
            "id": str(uuid4()),
            "text": "Old memory",
            "durability": "core",
            "confidence": 0.8,
            "source": "inferred",
        }
        restored = Memory.from_store_value(value)
        assert restored.created_by is None
        assert restored.updated_by is None


class TestMemoryCreateCreatedBy:
    """Tests for created_by on MemoryCreate."""

    def test_memory_create_with_created_by(self):
        mc = MemoryCreate(text="Test", created_by="joel")
        assert mc.created_by == "joel"

    def test_memory_create_default_none(self):
        mc = MemoryCreate(text="Test")
        assert mc.created_by is None

    def test_to_memory_preserves_created_by(self):
        mc = MemoryCreate(text="Test", created_by="joel")
        mem = mc.to_memory()
        assert mem.created_by == "joel"

    def test_to_memory_default_created_by(self):
        mc = MemoryCreate(text="Test")
        mem = mc.to_memory()
        assert mem.created_by is None


class TestMemoryQueryMetadataFilter:
    """Tests for metadata_filter on MemoryQuery."""

    def test_default_none(self):
        q = MemoryQuery(query="test")
        assert q.metadata_filter is None

    def test_with_filter(self):
        q = MemoryQuery(
            query="test",
            metadata_filter={"carrier": "ICW Group"},
        )
        assert q.metadata_filter == {"carrier": "ICW Group"}

    def test_with_multiple_filters(self):
        q = MemoryQuery(
            query="test",
            metadata_filter={"carrier": "ICW Group", "pipeline_type": "claims"},
        )
        assert q.metadata_filter["carrier"] == "ICW Group"
        assert q.metadata_filter["pipeline_type"] == "claims"


class TestMemoryPatch:
    """Tests for MemoryPatch model."""

    def test_all_none_by_default(self):
        p = MemoryPatch()
        assert p.tags is None
        assert p.metadata is None
        assert p.confidence is None
        assert p.durability is None
        assert p.memory_type is None
        assert p.updated_by is None

    def test_with_values(self):
        p = MemoryPatch(
            tags=["new_tag"],
            metadata={"carrier": "ICW"},
            confidence=0.95,
            durability=Durability.CORE,
            memory_type=MemoryType.RULE,
            updated_by="joel",
        )
        assert p.tags == ["new_tag"]
        assert p.metadata == {"carrier": "ICW"}
        assert p.confidence == 0.95
        assert p.durability == Durability.CORE
        assert p.memory_type == MemoryType.RULE
        assert p.updated_by == "joel"

    def test_confidence_bounds(self):
        with pytest.raises(ValueError):
            MemoryPatch(confidence=-0.1)
        with pytest.raises(ValueError):
            MemoryPatch(confidence=1.1)


# ============================================================================
# Store integration tests (requires OPENAI_API_KEY for embeddings)
# ============================================================================

def _skip_without_openai():
    if not os.environ.get("OPENAI_API_KEY"):
        pytest.skip("OPENAI_API_KEY not set")


class TestStoreMetadataFilter:
    """Tests for metadata_filter in search() and list_all()."""

    @pytest.fixture
    def store(self):
        with build_sqlite_store(":memory:") as s:
            s.setup()
            yield s

    @pytest.fixture
    def namespace(self):
        return ("test_user", "memories")

    def test_search_with_metadata_filter(self, store, namespace):
        _skip_without_openai()

        store.add(namespace, MemoryCreate(
            text="ICW claim mapping pattern",
            metadata={"carrier": "ICW Group", "type": "claim"},
        ))
        store.add(namespace, MemoryCreate(
            text="Liberty claim mapping pattern",
            metadata={"carrier": "Liberty Mutual", "type": "claim"},
        ))

        results = store.search(namespace, MemoryQuery(
            query="claim mapping",
            metadata_filter={"carrier": "ICW Group"},
        ))
        assert all(m.metadata.get("carrier") == "ICW Group" for m in results)

    def test_search_metadata_filter_multiple_keys(self, store, namespace):
        _skip_without_openai()

        store.add(namespace, MemoryCreate(
            text="ICW claim pattern",
            metadata={"carrier": "ICW Group", "type": "claim"},
        ))
        store.add(namespace, MemoryCreate(
            text="ICW policy pattern",
            metadata={"carrier": "ICW Group", "type": "policy"},
        ))

        results = store.search(namespace, MemoryQuery(
            query="ICW pattern",
            metadata_filter={"carrier": "ICW Group", "type": "claim"},
        ))
        assert len(results) >= 1
        for m in results:
            assert m.metadata.get("carrier") == "ICW Group"
            assert m.metadata.get("type") == "claim"

    def test_list_all_with_metadata_filter(self, store, namespace):
        _skip_without_openai()

        store.add(namespace, MemoryCreate(
            text="ICW pattern",
            metadata={"carrier": "ICW Group"},
        ))
        store.add(namespace, MemoryCreate(
            text="Liberty pattern",
            metadata={"carrier": "Liberty Mutual"},
        ))

        results = store.list_all(namespace, metadata_filter={"carrier": "ICW Group"})
        assert len(results) == 1
        assert results[0].metadata["carrier"] == "ICW Group"


class TestStoreCreatedBy:
    """Tests for created_by round-trip through store."""

    @pytest.fixture
    def store(self):
        with build_sqlite_store(":memory:") as s:
            s.setup()
            yield s

    @pytest.fixture
    def namespace(self):
        return ("test_user", "memories")

    def test_add_with_created_by(self, store, namespace):
        _skip_without_openai()

        stored = store.add(namespace, MemoryCreate(
            text="Test memory",
            created_by="joel",
        ))
        assert stored.created_by == "joel"

        retrieved = store.get(namespace, stored.id)
        assert retrieved is not None
        assert retrieved.created_by == "joel"

    def test_add_without_created_by(self, store, namespace):
        _skip_without_openai()

        stored = store.add(namespace, MemoryCreate(text="Test memory"))
        assert stored.created_by is None

        retrieved = store.get(namespace, stored.id)
        assert retrieved is not None
        assert retrieved.created_by is None


class TestStorePatch:
    """Tests for patch() method on SemanticMemoryStore."""

    @pytest.fixture
    def store(self):
        with build_sqlite_store(":memory:") as s:
            s.setup()
            yield s

    @pytest.fixture
    def namespace(self):
        return ("test_user", "memories")

    def test_patch_tags(self, store, namespace):
        _skip_without_openai()

        stored = store.add(namespace, MemoryCreate(
            text="Test memory",
            tags=["old_tag"],
        ))
        patched = store.patch(namespace, stored.id, MemoryPatch(
            tags=["new_tag", "another_tag"],
        ))
        assert patched.tags == ["new_tag", "another_tag"]

        # Verify persisted
        retrieved = store.get(namespace, stored.id)
        assert retrieved.tags == ["new_tag", "another_tag"]

    def test_patch_metadata_merges(self, store, namespace):
        _skip_without_openai()

        stored = store.add(namespace, MemoryCreate(
            text="Test memory",
            metadata={"carrier": "ICW", "existing": "value"},
        ))
        patched = store.patch(namespace, stored.id, MemoryPatch(
            metadata={"carrier": "Liberty", "new_key": "new_value"},
        ))
        assert patched.metadata["carrier"] == "Liberty"
        assert patched.metadata["existing"] == "value"
        assert patched.metadata["new_key"] == "new_value"

    def test_patch_confidence(self, store, namespace):
        _skip_without_openai()

        stored = store.add(namespace, MemoryCreate(
            text="Test memory",
            confidence=0.5,
        ))
        patched = store.patch(namespace, stored.id, MemoryPatch(confidence=0.95))
        assert patched.confidence == 0.95

    def test_patch_durability(self, store, namespace):
        _skip_without_openai()

        stored = store.add(namespace, MemoryCreate(
            text="Test memory",
            durability=Durability.EPISODIC,
        ))
        patched = store.patch(namespace, stored.id, MemoryPatch(
            durability=Durability.CORE,
        ))
        assert patched.durability == Durability.CORE

    def test_patch_updated_by(self, store, namespace):
        _skip_without_openai()

        stored = store.add(namespace, MemoryCreate(
            text="Test memory",
            created_by="joel",
        ))
        patched = store.patch(namespace, stored.id, MemoryPatch(
            updated_by="sarah",
        ))
        assert patched.created_by == "joel"
        assert patched.updated_by == "sarah"

    def test_patch_does_not_create_version_chain(self, store, namespace):
        _skip_without_openai()

        stored = store.add(namespace, MemoryCreate(text="Test memory"))
        store.patch(namespace, stored.id, MemoryPatch(confidence=0.99))

        # Same ID should still work - no new version created
        retrieved = store.get(namespace, stored.id)
        assert retrieved is not None
        assert retrieved.confidence == 0.99
        assert retrieved.supersedes is None
        assert retrieved.superseded_by is None

    def test_patch_none_fields_unchanged(self, store, namespace):
        _skip_without_openai()

        stored = store.add(namespace, MemoryCreate(
            text="Test memory",
            tags=["keep_me"],
            confidence=0.5,
            durability=Durability.SITUATIONAL,
        ))
        # Patch only confidence, leave everything else alone
        patched = store.patch(namespace, stored.id, MemoryPatch(confidence=0.99))
        assert patched.tags == ["keep_me"]
        assert patched.durability == Durability.SITUATIONAL
        assert patched.text == "Test memory"

    def test_patch_nonexistent_raises(self, store, namespace):
        _skip_without_openai()

        with pytest.raises(ValueError, match="not found"):
            store.patch(namespace, uuid4(), MemoryPatch(confidence=0.5))

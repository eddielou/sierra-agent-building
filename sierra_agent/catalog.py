"""Product search over the static ProductCatalog dataset.

The catalog is small, so retrieval is simple keyword scoring over each product's full text.
Schema-agnostic on purpose; swap for embeddings/a search service if the catalog grows.
"""
import json
import re
from pathlib import Path
from typing import Any, Dict, List, Optional

_STOPWORDS = {"a", "an", "the", "for", "and", "or", "i", "need", "want", "looking", "to", "of",
              "in", "on", "with", "do", "you", "have", "any", "some", "me", "my", "is", "are"}


def _tokens(text: str) -> List[str]:
    return [t for t in re.findall(r"[a-z0-9]+", text.lower()) if t not in _STOPWORDS]


class ProductCatalog:
    def __init__(self, products: List[Dict[str, Any]]):
        self._products = products
        self._index = [set(_tokens(json.dumps(p))) for p in products]

    @classmethod
    def from_file(cls, path: Path) -> "ProductCatalog":
        return cls(json.loads(Path(path).read_text()))

    def by_sku(self, sku: str) -> Optional[Dict[str, Any]]:
        return next((p for p in self._products if p.get("SKU") == sku), None)

    def search(self, query: str, limit: int = 5) -> List[Dict[str, Any]]:
        terms = set(_tokens(query))
        scored = [(len(terms & idx), p) for idx, p in zip(self._index, self._products)]
        hits = [(s, p) for s, p in scored if s > 0]
        hits.sort(key=lambda sp: -sp[0])
        return [p for _, p in hits[:limit]]

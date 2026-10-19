"""Order lookup against the static CustomerOrders dataset."""
import json
from pathlib import Path
from typing import Any, Dict, List, Optional

from .config import TRACKING_URL_TEMPLATE


def _pick(record: Dict[str, Any], *fragments: str) -> Any:
    """Return the value of the first key containing any fragment (case-insensitive).

    Keeps the loader tolerant of key-naming differences (e.g. OrderNumber vs order_number).
    """
    for key, value in record.items():
        if any(f in key.lower().replace("_", "") for f in fragments):
            return value
    return None


def _norm_order(value: Any) -> str:
    return str(value or "").strip().lstrip("#").upper()


def _norm_email(value: Any) -> str:
    return str(value or "").strip().lower()


class OrderStore:
    def __init__(self, orders: List[Dict[str, Any]]):
        self._orders = orders

    @classmethod
    def from_file(cls, path: Path) -> "OrderStore":
        return cls(json.loads(Path(path).read_text()))

    def lookup(self, email: str, order_number: str) -> Optional[Dict[str, Any]]:
        """Return the order only if BOTH email and order number match, else None.

        Requiring both means a guessed order number alone never reveals another customer's data.
        """
        for order in self._orders:
            if (_norm_order(_pick(order, "ordernum", "orderid")) == _norm_order(order_number)
                    and _norm_email(_pick(order, "email")) == _norm_email(email)):
                return self._present(order)
        return None

    @staticmethod
    def _present(order: Dict[str, Any]) -> Dict[str, Any]:
        result = {k: v for k, v in order.items() if "email" not in k.lower()}
        tracking = _pick(order, "tracking")
        result["tracking_url"] = (
            TRACKING_URL_TEMPLATE.format(trackingNumber=tracking) if tracking else None
        )
        return result

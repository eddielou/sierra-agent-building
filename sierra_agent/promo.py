"""Early Risers promotion: 10% off, 8:00-10:00 AM Pacific. Eligibility is decided in code, not by the LLM."""
import secrets
from datetime import datetime
from typing import Callable, Dict, Optional
from zoneinfo import ZoneInfo

from . import config

# Unambiguous alphabet (no 0/O/1/I) so codes are easy to read and type.
_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"


class EarlyRisersPromo:
    def __init__(self, now: Optional[Callable[[], datetime]] = None):
        self._tz = ZoneInfo(config.PROMO_TIMEZONE)
        self._now = now or (lambda: datetime.now(self._tz))
        self._issued: Dict[str, str] = {}  # session_id -> code
        self._all_codes = set()

    def _local_now(self) -> datetime:
        return self._now().astimezone(self._tz)

    def is_active(self) -> bool:
        return config.PROMO_START_HOUR <= self._local_now().hour < config.PROMO_END_HOUR

    def request_code(self, session_id: str) -> Dict[str, object]:
        now = self._local_now()
        window = f"{config.PROMO_START_HOUR}:00-{config.PROMO_END_HOUR}:00 AM Pacific Time"
        if not self.is_active():
            return {"eligible": False, "window": window,
                    "current_pacific_time": now.strftime("%-I:%M %p")}
        # Idempotent per session so asking twice doesn't mint multiple codes.
        code = self._issued.get(session_id) or self._mint()
        self._issued[session_id] = code
        return {"eligible": True, "code": code, "discount_percent": config.PROMO_DISCOUNT_PERCENT}

    def _mint(self) -> str:
        while True:
            code = "EARLY10-" + "".join(secrets.choice(_ALPHABET) for _ in range(6))
            if code not in self._all_codes:
                self._all_codes.add(code)
                return code

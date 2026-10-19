from datetime import datetime
from zoneinfo import ZoneInfo

from sierra_agent import config
from sierra_agent.catalog import ProductCatalog
from sierra_agent.orders import OrderStore
from sierra_agent.promo import EarlyRisersPromo

PT = ZoneInfo("America/Los_Angeles")


def promo_at(hour, minute=0):
    return EarlyRisersPromo(now=lambda: datetime(2026, 10, 19, hour, minute, tzinfo=PT))


def test_promo_window_boundaries():
    assert not promo_at(7, 59).request_code("s")["eligible"]
    assert promo_at(8, 0).request_code("s")["eligible"]
    assert promo_at(9, 59).request_code("s")["eligible"]
    assert not promo_at(10, 0).request_code("s")["eligible"]


def test_promo_timezone_conversion():
    # 9 AM Eastern is 6 AM Pacific -> closed; 11 AM Eastern is 8 AM Pacific -> open.
    est = ZoneInfo("America/New_York")
    closed = EarlyRisersPromo(now=lambda: datetime(2026, 10, 19, 9, tzinfo=est))
    opened = EarlyRisersPromo(now=lambda: datetime(2026, 10, 19, 11, tzinfo=est))
    assert not closed.request_code("s")["eligible"]
    assert opened.request_code("s")["eligible"]


def test_promo_codes_unique_per_session_and_stable_within_one():
    p = promo_at(9)
    a, b = p.request_code("a")["code"], p.request_code("b")["code"]
    assert a != b and p.request_code("a")["code"] == a

"""Runtime configuration: model, data paths, business constants, API key loading."""
import os
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA_DIR = ROOT / "data"
ORDERS_PATH = DATA_DIR / "CustomerOrders.json"
CATALOG_PATH = DATA_DIR / "ProductCatalog.json"

MODEL = "gpt-4.1-mini"
MAX_TOOL_ROUNDS = 6  # guard against runaway tool-call loops within a single user turn

TRACKING_URL_TEMPLATE = "https://tools.usps.com/go/TrackConfirmAction?tLabels={trackingNumber}"

PROMO_TIMEZONE = "America/Los_Angeles"
PROMO_START_HOUR = 8   # inclusive
PROMO_END_HOUR = 10    # exclusive
PROMO_DISCOUNT_PERCENT = 10


def load_api_key() -> str:
    """Read OPENAI_API_KEY from the environment, falling back to a local .env file."""
    key = os.environ.get("OPENAI_API_KEY")
    env_file = ROOT / ".env"
    if not key and env_file.exists():
        for line in env_file.read_text().splitlines():
            name, _, value = line.partition("=")
            if name.strip() == "OPENAI_API_KEY":
                key = value.strip().strip("'\"")
    if not key:
        raise RuntimeError("Set OPENAI_API_KEY in your environment or in a .env file.")
    return key

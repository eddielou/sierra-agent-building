from sierra_agent import config
from sierra_agent.catalog import ProductCatalog
from sierra_agent.orders import OrderStore


def test_order_requires_matching_email_and_number():
    store = OrderStore.from_file(config.ORDERS_PATH)
    order = store.lookup(" JOHN.DOE@example.com ", "w001")
    assert order["tracking_url"].endswith("tLabels=TRK123456789")
    assert not any("email" in k.lower() for k in order)
    assert store.lookup("jane.smith@example.com", "#W001") is None


def test_order_without_tracking_has_no_url():
    assert OrderStore.from_file(config.ORDERS_PATH).lookup(
        "alice.johnson@example.com", "#W003")["tracking_url"] is None


def test_catalog_search_and_sku():
    catalog = ProductCatalog.from_file(config.CATALOG_PATH)
    assert catalog.search("backpack for hiking")[0]["SKU"] == "SOBP001"
    assert catalog.search("kayak paddle") == []
    assert catalog.by_sku("SOTN002")["ProductName"].endswith("Skis")

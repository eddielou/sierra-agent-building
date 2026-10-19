"""Tool definitions exposed to the LLM. Each tool pairs a JSON schema with a plain-Python handler.

To add a capability: write a handler, add a Tool to `build_tools`. The agent loop needs no changes.
"""
import json
from dataclasses import dataclass
from typing import Any, Callable, Dict, List

from .catalog import ProductCatalog
from .orders import OrderStore
from .promo import EarlyRisersPromo


@dataclass
class Tool:
    name: str
    description: str
    parameters: Dict[str, Any]
    handler: Callable[..., Dict[str, Any]]

    def schema(self) -> Dict[str, Any]:
        return {"type": "function",
                "function": {"name": self.name, "description": self.description,
                             "parameters": self.parameters}}


class ToolRegistry:
    def __init__(self, tools: List[Tool]):
        self._tools = {t.name: t for t in tools}

    def schemas(self) -> List[Dict[str, Any]]:
        return [t.schema() for t in self._tools.values()]

    def call(self, name: str, raw_arguments: str) -> str:
        """Run a tool and return a JSON string. Errors are returned to the model, never raised."""
        tool = self._tools.get(name)
        if tool is None:
            return json.dumps({"error": f"Unknown tool '{name}'."})
        try:
            args = json.loads(raw_arguments or "{}")
            return json.dumps(tool.handler(**args), default=str)
        except Exception as exc:  # bad args, handler bug: let the model recover gracefully
            return json.dumps({"error": f"{type(exc).__name__}: {exc}"})


def build_tools(orders: OrderStore, catalog: ProductCatalog,
                promo: EarlyRisersPromo, session_id: str) -> ToolRegistry:
    def lookup_order(email: str, order_number: str) -> Dict[str, Any]:
        order = orders.lookup(email, order_number)
        if order is None:
            # Deliberately vague: don't reveal whether the email or the order number was wrong.
            return {"found": False,
                    "message": "No order matches that email and order number combination."}
        # Resolve SKUs to names; SKUs missing from the catalog are passed through unnamed.
        order["products"] = [
            {"sku": sku, "name": (catalog.by_sku(sku) or {}).get("ProductName")}
            for sku in order.pop("ProductsOrdered", [])]
        return {"found": True, "order": order}

    def search_products(query: str) -> Dict[str, Any]:
        return {"products": catalog.search(query)}

    def request_early_risers_code() -> Dict[str, Any]:
        return promo.request_code(session_id)

    return ToolRegistry([
        Tool(
            "lookup_order",
            "Look up an order's status and tracking link. Call ONLY once the customer has "
            "provided BOTH their email address and their order number.",
            {"type": "object",
             "properties": {"email": {"type": "string"}, "order_number": {"type": "string"}},
             "required": ["email", "order_number"]},
            lookup_order),
        Tool(
            "search_products",
            "Search the Sierra Outfitters product catalog by keywords (e.g. 'waterproof jacket'). "
            "Use it for any product question and base answers only on the results.",
            {"type": "object",
             "properties": {"query": {"type": "string"}},
             "required": ["query"]},
            search_products),
        Tool(
            "request_early_risers_code",
            "Generate the customer's Early Risers 10% discount code. Call ONLY when the customer "
            "explicitly asks for the Early Risers promotion/discount. The tool checks whether the "
            "promo window is open; never decide eligibility yourself.",
            {"type": "object", "properties": {}},
            request_early_risers_code),
    ])

"""The agent chat loop: send history to the LLM, execute any requested tools, repeat until text."""
import uuid
from typing import Any, Dict, List, Optional

from openai import OpenAI

from . import config
from .catalog import ProductCatalog
from .orders import OrderStore
from .promo import EarlyRisersPromo
from .prompts import SYSTEM_PROMPT
from .tools import ToolRegistry, build_tools


class Agent:
    def __init__(self, client: OpenAI, tools: ToolRegistry, model: str = config.MODEL):
        self._client = client
        self._tools = tools
        self._model = model
        self.messages: List[Dict[str, Any]] = [{"role": "system", "content": SYSTEM_PROMPT}]

    @classmethod
    def create(cls, client: Optional[OpenAI] = None,
               promo: Optional[EarlyRisersPromo] = None) -> "Agent":
        client = client or OpenAI(api_key=config.load_api_key())
        tools = build_tools(
            OrderStore.from_file(config.ORDERS_PATH),
            ProductCatalog.from_file(config.CATALOG_PATH),
            promo or EarlyRisersPromo(),
            session_id=str(uuid.uuid4()),
        )
        return cls(client, tools)

    def respond(self, user_message: str) -> str:
        self.messages.append({"role": "user", "content": user_message})
        for _ in range(config.MAX_TOOL_ROUNDS):
            completion = self._client.chat.completions.create(
                model=self._model, messages=self.messages, tools=self._tools.schemas())
            message = completion.choices[0].message
            self.messages.append(message.model_dump(exclude_none=True))
            if not message.tool_calls:
                return message.content or ""
            for call in message.tool_calls:
                result = self._tools.call(call.function.name, call.function.arguments)
                self.messages.append(
                    {"role": "tool", "tool_call_id": call.id, "content": result})
        return "Sorry, I hit a snag on the trail 🏔️ Could you try rephrasing that?"

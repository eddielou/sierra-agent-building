/** The agent chat loop: send history to the LLM, execute any requested tools, repeat until text. */
import { randomUUID } from "node:crypto";
import OpenAI from "openai";
import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";
import { ProductCatalog } from "./catalog.js";
import * as config from "./config.js";
import { OrderStore } from "./orders.js";
import { EarlyRisersPromo } from "./promo.js";
import { SYSTEM_PROMPT } from "./prompts.js";
import { buildTools, ToolRegistry } from "./tools.js";

export class Agent {
  readonly messages: ChatCompletionMessageParam[] = [{ role: "system", content: SYSTEM_PROMPT }];

  constructor(
    private readonly client: OpenAI,
    private readonly tools: ToolRegistry,
    private readonly model: string = config.MODEL,
  ) {}

  static create(opts: { client?: OpenAI; promo?: EarlyRisersPromo } = {}): Agent {
    const client = opts.client ?? new OpenAI({ apiKey: config.loadApiKey() });
    const tools = buildTools(
      OrderStore.fromFile(config.ORDERS_PATH),
      ProductCatalog.fromFile(config.CATALOG_PATH),
      opts.promo ?? new EarlyRisersPromo(),
      randomUUID(),
    );
    return new Agent(client, tools);
  }

  async respond(userMessage: string): Promise<string> {
    this.messages.push({ role: "user", content: userMessage });
    for (let round = 0; round < config.MAX_TOOL_ROUNDS; round++) {
      const completion = await this.client.chat.completions.create({
        model: this.model,
        messages: this.messages,
        tools: this.tools.schemas(),
      });
      const message = completion.choices[0].message;
      this.messages.push({
        role: "assistant",
        content: message.content,
        ...(message.tool_calls && { tool_calls: message.tool_calls }),
      });
      if (!message.tool_calls?.length) return message.content ?? "";
      for (const call of message.tool_calls) {
        if (call.type !== "function") continue;
        const result = this.tools.call(call.function.name, call.function.arguments);
        this.messages.push({ role: "tool", tool_call_id: call.id, content: result });
      }
    }
    return "Sorry, I hit a snag on the trail 🏔️ Could you try rephrasing that?";
  }
}

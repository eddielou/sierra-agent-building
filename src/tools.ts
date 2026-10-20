/**
 * Tool definitions exposed to the LLM. Each tool pairs a JSON schema with a plain-TS handler.
 *
 * To add a capability: write a handler, add a Tool to `buildTools`. The agent loop needs no changes.
 */
import type { ChatCompletionTool } from "openai/resources/chat/completions";
import type { ProductCatalog } from "./catalog.js";
import type { OrderStore } from "./orders.js";
import type { EarlyRisersPromo } from "./promo.js";

export interface Tool {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  handler: (args: any) => unknown;
}

export class ToolRegistry {
  private readonly tools: Map<string, Tool>;

  constructor(tools: Tool[]) {
    this.tools = new Map(tools.map((t) => [t.name, t]));
  }

  schemas(): ChatCompletionTool[] {
    return [...this.tools.values()].map((t) => ({
      type: "function",
      function: { name: t.name, description: t.description, parameters: t.parameters },
    }));
  }

  /** Run a tool and return a JSON string. Errors are returned to the model, never thrown. */
  call(name: string, rawArguments: string): string {
    const tool = this.tools.get(name);
    if (!tool) return JSON.stringify({ error: `Unknown tool '${name}'.` });
    try {
      return JSON.stringify(tool.handler(JSON.parse(rawArguments || "{}")));
    } catch (err) {
      // bad args, handler bug: let the model recover gracefully
      return JSON.stringify({ error: `${(err as Error).name}: ${(err as Error).message}` });
    }
  }
}

export function buildTools(
  orders: OrderStore,
  catalog: ProductCatalog,
  promo: EarlyRisersPromo,
  sessionId: string,
): ToolRegistry {
  return new ToolRegistry([
    {
      name: "lookup_order",
      description:
        "Look up an order's status and tracking link. Call ONLY once the customer has provided " +
        "BOTH their email address and their order number.",
      parameters: {
        type: "object",
        properties: { email: { type: "string" }, order_number: { type: "string" } },
        required: ["email", "order_number"],
      },
      handler: ({ email, order_number }: { email: string; order_number: string }) => {
        const order = orders.lookup(email, order_number);
        if (!order) {
          // Deliberately vague: don't reveal whether the email or the order number was wrong.
          return { found: false, message: "No order matches that email and order number combination." };
        }
        // Pre-render a display_name per item so the model copies it verbatim instead of juggling
        // SKUs and nulls (it once attached the wrong SKU to an unnamed item). SKUs missing from
        // the catalog are shown as "item <SKU>".
        const { ProductsOrdered, ...rest } = order;
        const products = ((ProductsOrdered as string[] | undefined) ?? []).map((sku) => ({
          display_name: (catalog.bySku(sku)?.ProductName as string | undefined) ?? `item ${sku}`,
        }));
        return { found: true, order: { ...rest, products } };
      },
    },
    {
      name: "search_products",
      description:
        "Search the Sierra Outfitters product catalog by keywords (e.g. 'waterproof jacket'). " +
        "Use it for any product question and base answers only on the results.",
      parameters: { type: "object", properties: { query: { type: "string" } }, required: ["query"] },
      handler: ({ query }: { query: string }) => ({ products: catalog.search(query) }),
    },
    {
      name: "request_early_risers_code",
      description:
        "Generate the customer's Early Risers 10% discount code. Call ONLY when the customer " +
        "explicitly asks for the Early Risers promotion/discount. The tool checks whether the " +
        "promo window is open; never decide eligibility yourself.",
      parameters: { type: "object", properties: {} },
      handler: () => promo.requestCode(sessionId),
    },
  ]);
}

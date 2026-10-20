# Sierra Outfitters Agent

A from-scratch tool-calling chat agent (no agent frameworks) in TypeScript on `gpt-4.1-mini`. It handles order status and tracking, product recommendations, and the Early Risers promotion, in an upbeat outdoors voice.

## Running the agent

Requires Node 20.12+ (for `process.loadEnvFile`).

```bash
npm install
echo "OPENAI_API_KEY=your-key" > .env   # gitignored; or export OPENAI_API_KEY in your shell
npm run chat
```

Type messages at the `You:` prompt and `quit` to exit. Try:
- `jane.smith@example.com #W002` (in-transit order with a tracking link)
- `Do you have skis?`
- `Can I get the Early Risers discount?` (only issues a code 8:00-10:00 AM Pacific)

**Testing the Early Risers promo:** the code is only issued 8:00-10:00 AM Pacific, so to try it at any time of day, pin the clock with `MOCK_TIME`, a Pacific `HH:MM` (24-hour) time on today's date:

```bash
MOCK_TIME=09:00 npm run chat    # inside the window: a code is issued
MOCK_TIME=18:01 npm run chat    # outside the window: declined
```

Then ask `Can I get the Early Risers discount?`. The window is inclusive at 8:00 and exclusive at 10:00, so `07:59` and `10:00` are declined while `08:00` and `09:59` are accepted.

**Debugging:** prefix any message with `/debug` to print that turn's full trace: each request sent to OpenAI, each response, every tool call (arguments, result, timing), and the validation report.

```
You: /debug do you have skis?
```

Other commands:

```bash
npm test             # vitest unit + agent-loop tests
npm run typecheck    # tsc --noEmit
```

## How it works

Each user message goes through a loop in `llmAgent.ts`:

1. Send the conversation and the tool schemas to OpenAI.
2. If the model asks for tools, run them and append the results, then call OpenAI again. If it returns text, that's the draft reply.
3. Run the draft through the response validators. A failing draft is regenerated once with feedback; a second failure returns a safe fallback.

## Project modules

| Path | Responsibility |
|---|---|
| `src/chat.ts` | Interactive CLI, including the `/debug` trace printer |
| `src/llmAgent.ts` | The LLM agent loop: OpenAI calls, tool execution, validation retry, trace events |
| `src/tools.ts` | Tool registry: JSON schemas plus handlers (`lookup_order`, `search_products`, `request_early_risers_code`). Add a feature by adding a `Tool` |
| `src/prompts.ts` | System prompt: persona, brand voice, catchphrases, behavioral rules |
| `src/orders.ts` | Order lookup; email and order number must both match |
| `src/catalog.ts` | Product search (keyword scoring) and SKU lookup |
| `src/promo.ts` | Early Risers eligibility (8-10 AM `America/Los_Angeles`, injectable clock) and unique code minting |
| `src/validation.ts` | Validator framework: `Validator` interface and `ResponseValidator` runner (reports only) |
| `src/validators.ts` | Concrete checks: grounded links/codes, promo gating, no invented prices |
| `src/config.ts` | Model, data paths, promo constants, retry limits, API key loading |
| `data/` | `CustomerOrders.json` and `ProductCatalog.json` (static datasets) |
| `tests/` | Domain tests, validator tests, and agent-loop tests with a scripted fake OpenAI client |

## Design decisions
- **Rules in code, language in the LLM.** Promo eligibility, code minting, and order verification are plain tested code. The model only decides *when* to call a tool and phrases the result, so it can't be talked into a discount.
- **Tool calling over prompt-stuffing.** Orders and the catalog stay out of the prompt, which avoids leaking other customers' data and scales past a tiny catalog.
- **Order privacy.** Lookup needs email *and* order number to match; failures are vague so they don't reveal which detail was wrong; email is stripped from results.
- **Promo codes** are random, unique, and idempotent per session, and only requested on an explicit ask (tool description plus prompt).
- **Response validation.** Replies are checked against that turn's tool results before reaching the customer: every link and code must have come from a tool, codes need an eligible promo result, and no prices are quoted (the catalog has none).
- **Tool errors** return to the model as JSON instead of throwing, so it can recover conversationally.
- **Observability.** The agent emits trace events through an optional callback, keeping logging out of the core loop.

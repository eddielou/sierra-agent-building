# Sierra Outfitters Agent

A from-scratch tool-calling chat agent (no agent frameworks) in TypeScript on `gpt-4.1-mini`.

```bash
npm install
echo "OPENAI_API_KEY=..." > .env      # gitignored
npm run chat
npm test            # vitest
npm run typecheck
```

## Layout
- `src/agent.ts` – the loop: LLM call → run requested tools → repeat until plain text (capped rounds).
- `src/tools.ts` – tool schemas + handlers; add a feature by adding a `Tool`.
- `src/orders.ts`, `catalog.ts`, `promo.ts` – deterministic domain logic, LLM-free and unit-tested.
- `src/prompts.ts` – persona, outdoors brand voice, guardrails.
- `data/` – `CustomerOrders.json` / `ProductCatalog.json`.
- `tests/` – domain tests plus an agent-loop test using a scripted fake OpenAI client.

## Design decisions
- **Rules in code, language in the LLM.** Promo eligibility (8–10 AM `America/Los_Angeles`, DST-safe via `Intl`, injectable clock), code minting, and order verification are code; the model only decides *when* to call a tool and phrases results.
- **Order privacy.** Lookup needs email *and* order number to match; failures are vague so they don't leak which was wrong; email is stripped from results.
- **Promo codes** are random, unique, and idempotent per session. Called only on an explicit request (tool description + prompt).
- **Catalog retrieval** is a tool (keyword scoring) rather than prompt-stuffing, so it scales and answers stay grounded in results.
- **Tool errors** return to the model as JSON instead of throwing.

## Known tradeoffs / next steps
- Catalog has no prices, so the agent never quotes one; some ordered SKUs (e.g. SOGK009) are missing from the catalog and are shown by SKU.
- Codes aren't persisted or redeemable (no checkout integration); in-memory only.
- Keyword search misses synonyms; swap for embeddings if the catalog grows.
- No streaming, no eval suite for conversation quality yet.

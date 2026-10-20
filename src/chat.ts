/** Interactive CLI: `npm run chat`. Type 'quit' to exit. */
import { createInterface } from "node:readline";
import { Agent, type TraceEvent } from "./llmAgent.js";
import { EarlyRisersPromo, pacificTimeToday } from "./promo.js";

/** MOCK_TIME (Pacific HH:MM, e.g. 07:59 or 18:01) pins the promo clock to that time today. */
function promoFromEnv(): EarlyRisersPromo | undefined {
  const raw = process.env.MOCK_TIME;
  if (!raw) return undefined;
  const fixed = pacificTimeToday(raw);
  console.log(`⏰ Promo clock mocked to ${raw.trim()} Pacific today\n`);
  return new EarlyRisersPromo(() => fixed);
}

const DEBUG_PREFIX = "/debug";
const dim = (text: string) => `\x1b[2m${text}\x1b[0m`;

/** Pretty-print one trace event to stderr-style debug output (stdout, dimmed). */
function printTrace(event: TraceEvent): void {
  if (event.type === "llm_request") {
    console.log(dim(`[debug] round ${event.round} · request to OpenAI (${event.model}, ${event.messages.length} messages, tools: ${event.tools.join(", ")})`));
    console.log(dim(JSON.stringify(event.messages, null, 2)));
  } else if (event.type === "llm_response") {
    console.log(dim(`[debug] round ${event.round} · OpenAI response (${event.model}, finish=${event.finishReason})`));
    console.log(dim(JSON.stringify({ message: event.message, usage: event.usage }, null, 2)));
  } else if (event.type === "validation") {
    console.log(dim(`[debug] validation: ${event.report.results.length} validator(s) run`));
    if (event.report.results.length) console.log(dim(JSON.stringify(event.report.results, null, 2)));
  } else {
    console.log(dim(`[debug] round ${event.round} · tool ${event.name}(${event.arguments}) → ${event.ms}ms`));
    console.log(dim(JSON.stringify(JSON.parse(event.result), null, 2)));
  }
}

async function main(): Promise<void> {
  const agent = Agent.create({ promo: promoFromEnv() });
  console.log("🏔️  Sierra Outfitters Support (type 'quit' to exit, '/debug <message>' to trace a turn)\n");
  console.log("Agent: Welcome to Sierra Outfitters! Onward into the unknown 🌲 How can I help today?\n");

  const rl = createInterface({ input: process.stdin });
  process.stdout.write("You: ");
  // Async iteration reads lines in order and also works with piped input.
  for await (const line of rl) {
    let user = line.trim();
    if (["quit", "exit"].includes(user.toLowerCase())) break;
    // "/debug <message>" sends the message with a full trace of LLM responses and tool calls.
    const debug = user.toLowerCase().startsWith(DEBUG_PREFIX);
    if (debug) user = user.slice(DEBUG_PREFIX.length).trim();
    if (user) {
      console.log();
      const reply = await agent.respond(user, debug ? printTrace : undefined);
      console.log(`${debug ? "\n" : ""}Agent: ${reply}\n`);
    }
    process.stdout.write("You: ");
  }
  rl.close();
}

main();

/** Interactive CLI: `npm run chat`. Type 'quit' to exit. */
import { createInterface } from "node:readline";
import { Agent } from "./agent.js";

async function main(): Promise<void> {
  const agent = Agent.create();
  console.log("🏔️  Sierra Outfitters Support (type 'quit' to exit)\n");
  console.log("Agent: Welcome to Sierra Outfitters! Onward into the unknown 🌲 How can I help today?\n");

  const rl = createInterface({ input: process.stdin });
  process.stdout.write("You: ");
  // Async iteration reads lines in order and also works with piped input.
  for await (const line of rl) {
    const user = line.trim();
    if (["quit", "exit"].includes(user.toLowerCase())) break;
    if (user) console.log(`\nAgent: ${await agent.respond(user)}\n`);
    process.stdout.write("You: ");
  }
  rl.close();
}

main();

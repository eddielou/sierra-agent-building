import type OpenAI from "openai";
import { describe, expect, it } from "vitest";
import { Agent } from "../src/agent.js";

type Reply = { content: string | null; tool_calls?: unknown[] };

/** Scripted stand-in for the OpenAI client: returns canned replies in order. */
const fakeClient = (replies: Reply[]) =>
  ({
    chat: { completions: { create: async () => ({ choices: [{ message: replies.shift() }] }) } },
  }) as unknown as OpenAI;

describe("agent loop", () => {
  it("executes tool calls then returns the final text", async () => {
    const toolCall = {
      id: "call_1",
      type: "function",
      function: {
        name: "lookup_order",
        arguments: JSON.stringify({ email: "jane.smith@example.com", order_number: "#W002" }),
      },
    };
    const agent = Agent.create({
      client: fakeClient([{ content: null, tool_calls: [toolCall] }, { content: "On its way!" }]),
    });

    expect(await agent.respond("where is my order?")).toBe("On its way!");
    const toolMsg = agent.messages.find((m) => m.role === "tool")!;
    expect(String(toolMsg.content)).toContain("TRK987654321");
  });

  it("gives up gracefully after too many tool rounds", async () => {
    const loop = { content: null, tool_calls: [{ id: "x", type: "function", function: { name: "nope", arguments: "{}" } }] };
    const agent = Agent.create({ client: fakeClient(Array(20).fill(loop)) });
    expect(await agent.respond("hi")).toContain("snag");
  });
});

import type OpenAI from "openai";
import { describe, expect, it } from "vitest";
import { Agent } from "../src/llmAgent.js";

type Reply = { content: string | null; tool_calls?: unknown[] };

/** Scripted stand-in for the OpenAI client: returns canned replies in order. */
const fakeClient = (replies: Reply[]) =>
  ({
    chat: { completions: { create: async () => ({ model: "fake", choices: [{ message: replies.shift(), finish_reason: "stop" }] }) } },
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

  it("emits trace events for LLM responses and tool calls", async () => {
    const toolCall = { id: "c", type: "function", function: { name: "search_products", arguments: '{"query":"skis"}' } };
    const agent = Agent.create({
      client: fakeClient([{ content: null, tool_calls: [toolCall] }, { content: "Skis!" }]),
    });
    const events: string[] = [];
    await agent.respond("skis?", (e) => events.push(e.type));
    expect(events).toEqual(["llm_request", "llm_response", "tool_call", "llm_request", "llm_response", "validation"]);
  });

  it("gives up gracefully after too many tool rounds", async () => {
    const loop = { content: null, tool_calls: [{ id: "x", type: "function", function: { name: "nope", arguments: "{}" } }] };
    const agent = Agent.create({ client: fakeClient(Array(20).fill(loop)) });
    expect(await agent.respond("hi")).toContain("snag");
  });

  it("regenerates once when validation fails, then returns the corrected reply", async () => {
    const agent = Agent.create({
      client: fakeClient([
        { content: "Track it: https://tools.usps.com/go/TrackConfirmAction?tLabels=FAKE" },
        { content: "Sorry, I can't find a link for that." },
      ]),
    });
    expect(await agent.respond("track my order")).toBe("Sorry, I can't find a link for that.");
    // The rejected draft is dropped from history; feedback is kept.
    expect(JSON.stringify(agent.messages)).not.toContain("FAKE\"");
    expect(agent.messages.some((m) => m.role === "system" && String(m.content).includes("rejected"))).toBe(true);
  });

  it("falls back to a safe reply if the retry also fails validation", async () => {
    const bad = { content: "It costs $49.99!" };
    const agent = Agent.create({ client: fakeClient([bad, bad]) });
    const reply = await agent.respond("how much is the backpack?");
    expect(reply).toContain("turned around");
    expect(reply).not.toContain("49.99");
  });
});

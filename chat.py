"""Interactive CLI: `python chat.py`. Type 'quit' to exit."""
from sierra_agent.agent import Agent


def main() -> None:
    agent = Agent.create()
    print("🏔️  Sierra Outfitters Support (type 'quit' to exit)\n")
    print("Agent: Welcome to Sierra Outfitters! Onward into the unknown 🌲 How can I help today?\n")
    while True:
        try:
            user = input("You: ").strip()
        except (EOFError, KeyboardInterrupt):
            break
        if user.lower() in {"quit", "exit"}:
            break
        if user:
            print(f"\nAgent: {agent.respond(user)}\n")


if __name__ == "__main__":
    main()

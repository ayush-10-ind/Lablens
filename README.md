# Setup (10 minutes)

1. Create your repo, then copy everything in this folder into its root (keep the hidden .agents folder).
2. Open the repo in Antigravity. Confirm AGENTS.md and the workflows are picked up (type / and look for slice and phone-check).
3. In Antigravity settings, set AI Credit Overages to Never unless you want to pay for extra usage.
4. Add MCP servers to ~/.gemini/config/mcp_config.json:
   - Context7: verify the current entry in its README. It is usually:
     {"mcpServers": {"context7": {"command": "npx", "args": ["-y", "@upstash/context7-mcp"]}}}
   - Stitch: in Stitch, use Export > MCP and follow the on-screen setup.
5. Install extensions: ESLint, Prettier, Tailwind CSS IntelliSense, Error Lens, Vitest.
6. Run /slice with the first prompt in docs/first-prompts.md.

Notes
- Keep the big docs in docs/. Antigravity rules files are capped at 12,000 characters, so AGENTS.md stays short and points to them.
- Do not install large skill libraries. They slow down agent startup.
- Copy .env.example to .env and never commit it.

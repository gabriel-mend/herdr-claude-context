# herdr-claude-context

A [Herdr.app](https://herdr.app) sidebar mod showing the **context-window usage of your Claude Code agents**.

- One row per agent: title, % used, a progress bar and `used / window` tokens.
- A **compact** button that types `/compact` into the agent (enabled only when it is `idle` or `done`), with a spinner while it compacts.
- Works across account profiles created by [herdr-claude-accounts](https://github.com/gabriel-mend/herdr-claude-accounts) (optional).

## Install

```sh
git clone https://github.com/gabriel-mend/herdr-claude-context ~/.config/herdr-app/mods/claude-context
herdr-app check ~/.config/herdr-app/mods/claude-context
```

Add it as a block in a personal layout (shipped layouts are read-only: `layout.clone` first):

```json
{ "id": "claude-context", "type": "block", "size": { "weight": 1 }, "min": 90, "content": { "mod": "claude-context" } }
```

## How it works

`ctx.py` reads the last assistant `usage` of each live session in `<profile>/projects/*/<sessionId>.jsonl` (input + cache tokens), or `postTokens` of the latest `compact_boundary` right after a compaction. Agents are matched to sessions by title, then by working directory. The window is 200k, or 1M when usage exceeds 200k or the model is `[1m]`.

Compaction uses `hc keys` instead of `hc send`: `send` wraps text as a message from another terminal, and Claude Code would not run it as a slash command.

Profiles come from `~/.claude/state/herdr-accounts.json` when present; otherwise only `~/.claude` is read.

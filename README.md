<p align="center"><img src="logo.svg" width="120" alt="herdr-claude-context logo"></p>

# herdr-claude-context

A Herdr.app sidebar mod showing the **context-window usage of your Claude Code agents**.

- One row per agent: title, % used, a progress bar and `used / window` tokens.
- A **compact** button that types `/compact` into the agent (enabled only when it is `idle` or `done`), with a spinner while it compacts.
- Works across account profiles created by [herdr-claude-accounts](https://github.com/gabriel-mend/herdr-claude-accounts) (optional).

## The Claude mods

Each one works on its own; together they share the account list.

| Repository | What it does |
| --- | --- |
| [herdr-claude-context](https://github.com/gabriel-mend/herdr-claude-context) (this one) | Context-window usage per agent, with a compact button |
| [herdr-claude-plan-usage](https://github.com/gabriel-mend/herdr-claude-plan-usage) | Claude 5h / 7d plan rate-limit usage |
| [herdr-claude-accounts](https://github.com/gabriel-mend/herdr-claude-accounts) | Switch between Claude accounts |

## Easy install (all 3 mods)

Needs Herdr.app, Claude Code, `git` and `python3`. Paste into a terminal; running it again updates the mods.

```sh
(
set -e
MODS="$HOME/.config/herdr-app/mods"
mkdir -p "$MODS" "$HOME/.claude/hooks"
for m in claude-context claude-plan-usage claude-accounts; do
  if [ -d "$MODS/$m/.git" ]; then git -C "$MODS/$m" pull --ff-only
  elif [ -e "$MODS/$m" ]; then echo "skipped $m: $MODS/$m exists and is not a git clone"
  else git clone "https://github.com/gabriel-mend/herdr-$m" "$MODS/$m"
  fi
done
cp "$MODS/claude-plan-usage/claude-hook/herdr-usage-statusline.py" "$HOME/.claude/hooks/"
python3 - <<'PY'
import json, os
p = os.path.expanduser("~/.claude/settings.json")
s = json.load(open(p)) if os.path.exists(p) else {}
if "statusLine" in s:
    print("statusLine already set: left unchanged (see herdr-claude-plan-usage)")
else:
    s["statusLine"] = {"type": "command", "command": "python3 ~/.claude/hooks/herdr-usage-statusline.py"}
    json.dump(s, open(p, "w"), indent=2)
    print("statusLine added")
PY
)
```

Then add the blocks to a personal layout. Shipped layouts are read-only, so clone one first (`layout.clone`; run `herdr-app commands` for its arguments). Put these inside the sidebar column of your file in `~/.config/herdr-app/layouts/`:

```json
{ "id": "claude-context",    "type": "block", "size": { "weight": 1 }, "min": 90, "content": { "mod": "claude-context" } },
{ "id": "claude-accounts",   "type": "block", "size": { "px": 150 },  "min": 60, "content": { "mod": "claude-accounts" } },
{ "id": "claude-plan-usage", "type": "block", "size": { "px": 78 },   "min": 60, "content": { "mod": "claude-plan-usage" } }
```

Switch to it with `herdr-app do layout.switch --name <your-layout>`. Changing to a layout without these blocks hides the mods.

## Install only this mod

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

## License

[MIT](LICENSE) © 2026 [Gabriel Mendonça Pereira](https://github.com/gabriel-mend) · [LinkedIn](https://www.linkedin.com/in/gabriel-mendonca-pereira/)

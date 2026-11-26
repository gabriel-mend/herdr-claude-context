#!/usr/bin/env python3
"""Prints JSON: context-window usage of every live Claude Code session, across account profiles."""
import glob, json, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import common


def read_transcript(path):
    usage = model = title = post = None
    with open(path, "rb") as f:
        f.seek(0, 2)
        f.seek(max(0, f.tell() - 3_000_000))
        for line in f.read().decode("utf-8", "ignore").splitlines():
            if '"ai-title"' in line:
                try: title = json.loads(line).get("aiTitle") or title
                except Exception: pass
            elif '"compact_boundary"' in line:
                try: d = json.loads(line)
                except Exception: continue
                if d.get("subtype") == "compact_boundary":
                    post = (d.get("compactMetadata") or {}).get("postTokens")
                    usage = None
            elif '"usage"' in line:
                try: d = json.loads(line)
                except Exception: continue
                m = d.get("message")
                if isinstance(m, dict) and m.get("usage") and not d.get("isSidechain"):
                    usage, model, post = m["usage"], m.get("model", ""), None
    used = None
    if usage:
        used = (usage.get("input_tokens", 0) + usage.get("cache_creation_input_tokens", 0)
                + usage.get("cache_read_input_tokens", 0))
    elif post:
        used = post
    return used, model, title


cfg = common.load()
sessions = []
for acct in cfg["accounts"]:
    base = acct["dir"]
    for sf in glob.glob(f"{base}/sessions/*.json"):
        try:
            s = json.load(open(sf))
            os.kill(s["pid"], 0)  # skip dead sessions
        except Exception:
            continue
        hits = glob.glob(f"{base}/projects/*/{s['sessionId']}.jsonl")
        if not hits:
            continue
        used, model, title = read_transcript(hits[0])
        win = 1_000_000 if used and (used > 200_000 or "[1m]" in (model or "")) else 200_000
        sessions.append({"id": s["sessionId"], "cwd": s["cwd"], "title": title or s.get("name"),
                         "used": used, "window": win, "model": model, "account": acct["id"]})
print(json.dumps({"sessions": sessions}))

import json, os, subprocess, sys, tempfile, unittest

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def assistant(inp, create=0, read=0, model="claude-sonnet", **extra):
    usage = {"input_tokens": inp, "cache_creation_input_tokens": create, "cache_read_input_tokens": read}
    return {"type": "assistant", "message": {"model": model, "usage": usage}, **extra}


class ContextTest(unittest.TestCase):
    def sessions(self, lines, pid=None):
        """Run ctx.py against a throwaway HOME holding one session with this transcript."""
        with tempfile.TemporaryDirectory() as home:
            base = f"{home}/.claude"
            os.makedirs(f"{base}/sessions")
            os.makedirs(f"{base}/projects/p")
            with open(f"{base}/sessions/1.json", "w") as f:
                json.dump({"pid": pid or os.getpid(), "sessionId": "s1", "cwd": "/repo"}, f)
            with open(f"{base}/projects/p/s1.jsonl", "w") as f:
                f.write("\n".join(json.dumps(x, separators=(",", ":")) for x in lines))
            out = subprocess.run([sys.executable, f"{ROOT}/ctx.py"], env={**os.environ, "HOME": home},
                                 capture_output=True, text=True, check=True)
            return json.loads(out.stdout)["sessions"]

    def test_sums_input_and_cache_tokens_of_the_last_reply(self):
        [s] = self.sessions([{"type": "ai-title", "aiTitle": "Fix login"}, assistant(1), assistant(10, 20, 30)])
        self.assertEqual((s["used"], s["window"], s["title"]), (60, 200_000, "Fix login"))

    def test_ignores_subagent_replies(self):
        [s] = self.sessions([assistant(100), assistant(999, isSidechain=True)])
        self.assertEqual(s["used"], 100)

    def test_uses_post_tokens_right_after_compaction(self):
        boundary = {"type": "system", "subtype": "compact_boundary", "compactMetadata": {"postTokens": 5000}}
        [s] = self.sessions([assistant(150_000), boundary])
        self.assertEqual(s["used"], 5000)

    def test_reply_after_compaction_replaces_post_tokens(self):
        boundary = {"type": "system", "subtype": "compact_boundary", "compactMetadata": {"postTokens": 5000}}
        [s] = self.sessions([assistant(150_000), boundary, assistant(7000)])
        self.assertEqual(s["used"], 7000)

    def test_large_context_uses_the_1m_window(self):
        [s] = self.sessions([assistant(250_000)])
        self.assertEqual(s["window"], 1_000_000)

    def test_skips_dead_sessions(self):
        dead = subprocess.Popen([sys.executable, "-c", ""])
        dead.wait()
        self.assertEqual(self.sessions([assistant(1)], pid=dead.pid), [])


if __name__ == "__main__":
    unittest.main()

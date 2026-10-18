#!/usr/bin/env python3
"""Compare the Python prompt port with the site's TypeScript on real dataset questions. usage: verify_prompt_port.py <repo> <portfolio.json> <data_dir> [n]"""
import json, subprocess, sys, os, random
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent))
from prompt_port import build_instruction
repo, portfolio, data = Path(sys.argv[1]), Path(sys.argv[2]).resolve(), Path(sys.argv[3]).resolve(); n = int(sys.argv[4]) if len(sys.argv) > 4 else 120
rows = [json.loads(l) for f in ["train", "validation", "test"] for l in open(data / f"portfolio_assistant_{f}.jsonl")] + [json.loads(l) for l in open(data / "portfolio_assistant_probes.jsonl")]
random.Random(1).shuffle(rows)
by_kind, pick = {}, []
for r in rows:
    if by_kind.get(r["kind"], 0) < 8: by_kind[r["kind"]] = by_kind.get(r["kind"], 0) + 1; pick.append(r)
pick = pick[:n]
qs = []
for i, r in enumerate(pick):
    m = r["messages"]; hist = [{"question": m[j]["content"][10:-11], "answer": m[j + 1]["content"]} for j in range(1, len(m) - 2, 2)]
    qs.append({"id": f"v{i}", "question": r["question"], "history": hist})
(data / "_vq.json").write_text(json.dumps(qs))
shutil_target = repo / "scripts" / "gen_prompts.ts"
subprocess.run(["cp", str(Path(__file__).with_name("gen_prompts.ts")), str(shutil_target)], check=True)
r = subprocess.run(["npx", "tsx", "scripts/gen_prompts.ts", str(portfolio), str(data / "_vq.json"), str(data / "_vo.json")], cwd=repo, capture_output=True, text=True, env={**os.environ, "NODE_OPTIONS": "--conditions=react-server"})
if r.returncode: sys.exit(r.stderr[-1500:])
out = json.loads((data / "_vo.json").read_text())
bad = [o["id"] for o in out if build_instruction(o["facts"], o["records"]) != o["instruction"]]
fixtures = [{"question": o["question"], "facts": {k: v for k, v in o["facts"].items() if k != "records"}, "records": o["records"], "instruction": o["instruction"]} for o in out[:40]]
(data / "portfolio_os_prompt_fixtures.json").write_text(json.dumps(fixtures))
(data / "_vq.json").unlink(); (data / "_vo.json").unlink()
print(json.dumps({"checked": len(out), "mismatches": len(bad), "mismatch_ids": bad[:5], "kinds": sorted(by_kind)}))
sys.exit(1 if bad else 0)

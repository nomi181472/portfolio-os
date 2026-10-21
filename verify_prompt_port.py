#!/usr/bin/env python3
"""Check that prompt_port.build_instruction() reproduces the site's TypeScript prompts.
  python verify_prompt_port.py portfolio_os_training_data.json                       # offline: compares against the TypeScript outputs stored in the JSON fixtures
  python verify_prompt_port.py portfolio_os_training_data.json <repo> <portfolio.json> [n]   # also re-runs the TypeScript on n dataset questions"""
import json, os, subprocess, sys, tempfile, random
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent))
from prompt_port import build_instruction
data = json.loads(Path(sys.argv[1]).read_text())
bad = [i for i, f in enumerate(data["fixtures"]) if build_instruction(f["facts"], f["records"]) != f["instruction"]]
print(json.dumps({"fixtures": len(data["fixtures"]), "mismatches": len(bad)}))
ok = not bad
if len(sys.argv) >= 4:
    repo, portfolio = Path(sys.argv[2]), Path(sys.argv[3]).resolve(); n = int(sys.argv[4]) if len(sys.argv) > 4 else 120
    rows = data["train"] + data["validation"] + data["test"] + data["probes"]
    random.Random(1).shuffle(rows); per, pick = {}, []
    for r in rows:
        if per.get(r["kind"], 0) < 8: per[r["kind"]] = per.get(r["kind"], 0) + 1; pick.append(r)
    pick = pick[:n]; qs = []
    for i, r in enumerate(pick):
        m = r["messages"]; qs.append({"id": f"v{i}", "question": r["question"], "history": [{"question": m[j]["content"][10:-11], "answer": m[j + 1]["content"]} for j in range(1, len(m) - 2, 2)]})
    with tempfile.TemporaryDirectory() as td:
        qf, of = Path(td) / "q.json", Path(td) / "o.json"; qf.write_text(json.dumps(qs))
        subprocess.run(["cp", str(Path(__file__).with_name("gen_prompts.ts")), str(repo / "scripts" / "gen_prompts.ts")], check=True)
        r = subprocess.run(["npx", "tsx", "scripts/gen_prompts.ts", str(portfolio), str(qf), str(of)], cwd=repo, capture_output=True, text=True, env={**os.environ, "NODE_OPTIONS": "--conditions=react-server"})
        if r.returncode: sys.exit(r.stderr[-1500:])
        out = json.loads(of.read_text()); bad2 = [o["id"] for o in out if build_instruction(o["facts"], o["records"]) != o["instruction"]]
        print(json.dumps({"rerun_checked": len(out), "mismatches": len(bad2), "kinds": sorted(per)})); ok = ok and not bad2
sys.exit(0 if ok else 1)

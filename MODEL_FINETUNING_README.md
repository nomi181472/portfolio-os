# Portfolio OS × SmolLM2 fine-tuning toolkit

What this is: everything needed to fine-tune `HuggingFaceTB/SmolLM2-360M-Instruct` for the Portfolio OS site, in the **exact prompt format the site sends**, and ship it as the in-browser `smollm` model.

## 1. Apply the facts patch to the site (required)
The original evidence lines had only key / name / kind / 160-char summary, so the model could not know real URLs or tech stacks.
`portfolio_os_facts_patch.diff` adds `Link`, `Org`, `Period`, `Status`, `Tech`, `Depth` (skills), linked `backed by` receipts, `Location`, and raises the summary cap to 240 chars.
```bash
cd <repo root>            # the folder that contains portfolio-os/
git apply --check portfolio_os_facts_patch.diff && git apply portfolio_os_facts_patch.diff
```
Checked: applies cleanly to a fresh clone; the existing `agent-conversational-engine` tests (7/7) still pass; prompts grow by roughly 400 tokens.
**The model must be trained on the patched prompt. Do not deploy it against the unpatched one.**

## 2. (Re)generate the dataset whenever portfolio.json changes
```bash
cp gen_prompts.ts <repo>/portfolio-os/scripts/        # uses the site's own TypeScript to build prompts
cd <repo>/portfolio-os && npm i --no-save tsx zod@3.25.76 typescript @types/node
python build_portfolio_os_dataset.py --repo <repo>/portfolio-os --portfolio <repo>/portfolio-os/content/portfolio.json --out data/
python verify_prompt_port.py <repo>/portfolio-os <repo>/portfolio-os/content/portfolio.json data/   # Python prompt builder == TypeScript
```
`portfolio_os_dataset.zip` already contains the output for the portfolio.json I was given (680 examples + 14 probes).

## 3. Train (Colab / Kaggle)
Open `smollm2_portfolio_assistant_finetuning_onnx.ipynb`, keep `dataset_mode="portfolio_os"`, upload `portfolio_os_dataset.zip` when asked, run `RUN_MODE="quick"` first, then `"full"`.
Outputs: LoRA adapter, merged model, ONNX, **int8 Transformers.js folder** `artifacts/transformersjs/SmolLM2-360M-Portfolio-ONNX/`, evaluation reports.

## 4. Deploy
1. Upload that folder to a Hugging Face model repo (`onnx/model_int8.onnx` + tokenizer/config files).
2. `registry_snippet.ts` (in the folder) shows the new `SMOLLM_MODEL` entry with the real byte count; update `registry.ts`, the id in `workers/agent.worker.ts`, and the pinned-bytes test.
3. `node smoke_test.mjs` in that folder confirms it loads with `dtype: 'int8'`.
4. Add `sanitizeLinks.ts` to the engine: `stripUnknownLinks(text, allowedLinksFromInstruction(instruction))` removes any link the model invents.

## Known limits
* Answers in the dataset are composed from templates and checked for grounding; they teach behaviour, not eloquence. Add real recruiter questions + hand-written answers for better tone.
* The model sees only what retrieval returns (typically 2-8 records; retrieval is lexical and sometimes misses). Quality is bounded by retrieval.
* The site states "8+ years", but the prompt facts carry only the *documented* career (5 years). The model is trained to quote the documented figure.
* Validated here: prompt port vs TypeScript, dataset grounding, training/export pipeline on a tiny model, Transformers.js loading (Node CPU). **Not validated here:** training quality on the real 360M model, int8 quality on the real model, in-browser (WASM) speed and memory.

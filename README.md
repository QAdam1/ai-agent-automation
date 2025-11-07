# AI Agent Automation Runtime

This project provides an experimental QA automation harness where a language model plans,
executes, observes, and self-heals end-to-end WebDriverIO scenarios that are written in
plain Gherkin. The framework reads the raw scenario text after Cucumber executes the
no-op step definitions and drives the UI using the agent loop described in the
specification.

## Key capabilities

- ✅ **Gherkin-native input** – standard `.feature` files are collected via Cucumber hooks
  and passed directly to the agent without bespoke step definitions.
- ✅ **Observe → Plan → Act → Verify** loop – the agent plans one action at a time, executes
  the tool call, captures a compact DOM snapshot, and verifies the expectation before
  moving to the next action.
- ✅ **Self-healing** – locator healing attempts simple fallbacks (text-based selectors or
  `data-testid`) before asking the planner to re-evaluate.
- ✅ **Caching** – successful plans are written to `features/.plans/*.plan.json` and replayed
  deterministically on future runs. Cached plans are skipped from git via `.gitignore`.
- ✅ **Artifacts** – each turn produces a screenshot and JSON transcript under
  `artifacts/<feature-scenario>/` so the execution can be inspected offline.
- ✅ **Safety controls** – navigation calls honour a whitelist, token output is limited,
  and only a restricted tool set is exposed to the planner.

## Project layout

```
├─ features/
│  ├─ example.feature        # sample Gherkin scenario
│  └─ .plans/                # cached action plans (gitignored)
├─ src/
│  ├─ agent/                 # planner, executor, observer, verifier, cache
│  ├─ runtime/               # runtime orchestration + dependency factory
│  └─ support/               # WDIO+Cucumber hooks and no-op step definitions
├─ artifacts/                # execution artifacts (gitignored)
├─ wdio.conf.ts              # WDIO configuration
└─ README.md
```

## Getting started

1. Install dependencies:

   ```bash
   npm install
   ```

2. Configure environment variables:

   - `OPENAI_API_KEY` – required for live planning.
   - `BASE_URL` – root URL under test (defaults to `http://localhost:3000`).
   - Optional tuning variables: `AGENT_MAX_ACTIONS`, `AGENT_MAX_REPLANS`,
     `AGENT_URL_WHITELIST`, `AI_MODEL`, `AI_MODEL_FALLBACK`.

3. Run the WDIO runner:

   ```bash
   npm run wdio -- --cucumberOpts.tagExpression "@ai"
   ```

The first run will call the planner for each step; once the scenario passes, the plan is
cached under `features/.plans/` and will be replayed without additional model calls.

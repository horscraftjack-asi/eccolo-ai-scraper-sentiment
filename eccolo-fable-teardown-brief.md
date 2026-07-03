---
type: session brief
model: Claude Fable 5
purpose: full teardown of the two Eccolo repos, output a phased dev plan for Opus/Sonnet to execute
feeds: G3
---

# Step 1 — Get the context.md from Claude Code first

Run this in Claude Code, in each repo (or one combined session if Code has access to both):

```
Write context.md documenting this repo for a handoff to a different AI model that has
no prior knowledge of this codebase. Include:

- What this repo does and how it fits into Eccolo as a whole
- Architecture: stack, key modules, how data flows through the pipeline
  (edit performance data → source YouTube video → comment scrape →
  sentiment analysis → insight output)
- The unification: this repo used to be standalone, was merged into a new
  shared UI last night — what changed, what's now shared vs still separate,
  anything half-migrated
- The sentiment analyser: it used to run inside Claude directly; it now runs
  in-app via API call. Document that migration — what the API integration
  looks like, what changed in the data flow, whether the old in-Claude path
  is fully removed or still referenced anywhere
- Known rough edges, TODOs, or things you (Claude) flagged but didn't fix
  during past sessions
- Anything that was a deliberate tradeoff, so a future reader doesn't
  "fix" something that was intentional

Do not polish or omit — this is ground truth for architectural review, not
a clean writeup. Flag genuine uncertainty rather than guessing.
```

Pull both outputs into the Fable session as attachments/context before the brief below.

---

# Step 2 — The Fable 5 brief

## Purpose

Diagnose the current state of Eccolo's two repos post-unification and produce a phased development plan detailed enough for Opus or Sonnet to execute in Claude Code without further architectural judgement calls from you.

## What Eccolo is

Internal tool for social media and talent managers on our creator roster. The pipeline:

1. Surface which edits performed best in a given period (data analytics on edit performance)
2. Trace each top-performing edit back to its source YouTube video
3. Run a comment scrape + sentiment analysis on that source video
4. Turn that insight into content planning, course development, Q&A direction, and other IP development decisions — aimed at deepening audience engagement and converting toward owned-audience layers

Users are internal (talent/social managers), not creators or the public. This is an operations tool, not a product surface.

## Current state

- The two repos existed separately, each built for one stage of the pipeline
- Last night: a new unified UI (designed by Claude) went live across both — this is a fresh merge, not a settled architecture
- The sentiment analyser used to run as a Claude conversation; it's now called via API from inside the app. This is a real architectural shift, not a refactor — treat it as its own review surface, not a footnote
- context.md from both repos is attached — treat as ground truth over anything in this brief that conflicts with it

## What I need from the teardown

Not a general code review. Specifically:

1. **Coherence across the merge** — where do the two repos now agree and disagree architecturally? Data models, state handling, naming, anything that will cause friction as they're developed further as one thing rather than two things bolted together
2. **The sentiment API migration** — is it clean? Any remnants of the old in-Claude path still referenced? Does the new API call fit the rest of the pipeline's data flow or is it a foreign object bolted on?
3. **Pipeline integrity end to end** — does edit performance → source video → comment scrape → sentiment → insight actually hold together as one traceable chain, or are there breaks/manual steps hiding in the middle?
4. **Technical debt vs deliberate tradeoff** — use context.md to tell these apart. Don't recommend "fixing" something that was a real decision.
5. **What's actually blocking the next real feature** vs what's cosmetic. I want signal ranked by what unblocks G3-relevant work, not an exhaustive list of every imperfection.

## Output format required

A **phased plan**, not a report. Each phase needs:

- **Objective** — one sentence
- **Verifiable done state** — written so it could become a Claude Code `/goal` condition directly (e.g. "all endpoints in the sentiment module return the new schema and existing tests pass" — not "sentiment module is cleaned up")
- **What must not change** — constraints, so Opus/Sonnet doesn't take a phase as licence to rewrite adjacent things
- **Sequencing logic** — why this phase before the next one, where the real dependencies are

Close with: the single highest-leverage phase to run first, and why.

## Constraints

- This is a diagnosis and a plan, not an implementation. Don't write code.
- Where context.md is ambiguous or missing something you need, say so explicitly rather than assuming — I'll go find the answer before handing this to Code.
- Assume the executor (Opus or Sonnet in Claude Code) has the same context.md but not this conversation — the plan needs to stand alone.

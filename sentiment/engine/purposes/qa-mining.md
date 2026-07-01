---
type: sentiment-purpose-config
purpose_id: qa-mining
status: mature
schema_version: 1.0
updated: 2026-07-01
---

```yaml
purpose_id: qa-mining
display_name: Q&A Mining
one_line: Pull and rank the real, answerable audience questions worth answering directly — for an FAQ, a post-launch Q&A, an "answers the comments" segment, or an "Ask [creator]" tool.
```

> Client-agnostic. Creator voice, funnel, and sensitivities come from the **client config** (engine core Step 6). The centre of gravity is a **ranked list of real questions the creator can actually answer**, plus the backstories the content skipped. This is *not* content-ideation (what to make next) and *not* course-development (course modules) — the unit of output is **an answerable question**. Optionally takes a transcript (like course-development) to mark whether each question was already answered.

---

## objective

Extract, de-duplicate, and rank the questions the audience is genuinely asking, so the creator can answer them directly — an FAQ, a Q&A video, an "I answer the comments" segment, or content that feeds an "Ask [creator]" tool. Prioritise questions that are frequently asked, answerable well in an available format, and that add something the source content didn't. Every question must trace to real comments; group the many ways the same question is asked into one cluster.

## primary_reader

The creator and whoever produces the answers — the person scripting the FAQ/Q&A, or configuring a Q&A/knowledge tool. They should leave with a ranked, de-duplicated question list, each with a suggested answer format and whether the existing content already covers it.

## analysis_lenses

Layer these on top of the universal nine-category classification (engine core Step 3), focusing on the **question-led**, **confusion-led**, and **request-led** categories:

- **Answerability lens.** Can this be answered well, and how? (a one-line answer, a short demo, a full explainer, a comparison, a troubleshooting sequence.) Flag questions the creator *can't* credibly answer or that are out of scope.
- **Frequency + upvote lens.** How often is it asked, and how upvoted? This drives the ranking — answer the most-asked first.
- **Duplicate-clustering lens.** Group the same underlying question asked many different ways into one cluster; the cluster name is the real question, not any single phrasing.
- **Coverage lens (needs transcript).** Did the source content already answer it — fully, partly, or not at all? A question asked *despite* being covered signals the answer wasn't clear enough.
- **Backstory lens.** The "why didn't you mention X" / "what about Y" questions — context and follow-ups the content skipped that the audience wants filled in.

## output_structure

Always a single Markdown file, in this section order:

1. **Executive summary — the must-answer questions** — the handful the creator should answer first, in plain language. Lead with them. 200–400 words.
2. **What we analysed** — source(s), topic, comment count, whether a transcript was included, and any limitations.
3. **Ranked answerable questions** — the core section. Each as `### Question: [the real question, in plain words]` → **What they're really asking** · **Representative comments** (verbatim quotes) · **How often / prominence** · **Already answered in the source?** (`fully | partly | not` — needs transcript; else "unknown, no transcript") · **Best answer format** (one-liner / demo / explainer / comparison / troubleshooting) · **Priority** (high/medium/low).
4. **Already-answered vs still-open** — if a transcript was supplied, a short table mapping the top questions to coverage; if not, a one-line note that coverage couldn't be assessed.
5. **Backstories the audience wants** — the context/follow-up questions the content skipped, worth addressing directly.
6. **Suggested FAQ / Q&A structure** — how to group and sequence the answers (the running order for an FAQ page or "answers the comments" segment).
7. **Questions NOT to answer** — out-of-scope, unanswerable, or off-brand questions, so the creator can consciously skip them.
8. **Risks or cautions** — e.g. loud single questions vs broadly asked ones; commenters skewing advanced; some questions unanswerable without more info. Don't overstate.

## prioritisation_criteria

Rank questions that meet one or more:

1. **Frequency** — asked often, in many forms (recurrence, not one voice).
2. **Upvotes** — high-liked questions carry weight.
3. **Answerability** — can be answered well in a format the creator can produce.
4. **Adds something** — the source content didn't cover it, or covered it unclearly.
5. **Funnel fit** — answering it supports the client's journey (from the client config).

## evidence_rules

- **Quote real questions verbatim** as evidence for every cluster. Never invent a question or paraphrase into one the audience didn't ask.
- **Never introduce specifics the comments don't contain** — no products, tools, or details the audience didn't mention. Do not generate "questions people usually ask" from domain knowledge.
- **Prominence must be earned.** `strong`/high-priority = asked by many; a single question is an isolated voice → `weak`, labelled as such — never presented as a widely-asked cluster.
- **Use grounded quantities only** — "asked in many forms / several / a few / once", not invented figures.
- Distinguish genuine questions from **rhetorical or joking** ones (noise); don't rank a sarcastic line as a real question.
- If input is thin: surface the few real questions and say what more input would help. **Never invent questions.**

## tone

Plain, direct, useful — like a producer prepping a Q&A, not a strategist. Clear headings, verbatim questions, concrete answer formats. **British English.** No inspirational/consultant filler. Lead with the questions worth answering.

## summary_json_extensions

Beyond the contract §4 defaults, this purpose leans on `question_clusters[]`:
- each `question_clusters[]` item uses the contract's `covered_in_source` (`fully|partly|not`) and adds `answer_format` (`one-liner | demo | explainer | comparison | troubleshooting`) and `priority` (`high|medium|low`).
- `gaps[]` are used for **backstories the content skipped**: `opportunity` = the follow-up/context to provide.

## anti_patterns

Not a content slate (that's content-ideation). Not a course brief. Not a dump of every question with no ranking or de-duplication. Not questions the creator can't credibly answer. Not invented "frequently asked questions" from niche priors. It is a **ranked, de-duplicated, answerable question list**.

## final_quality_check

Before delivery, confirm: single Markdown file; the creator sees the must-answer questions immediately; every cluster is backed by **verbatim** questions; duplicates are merged into one cluster; prominence/priority is justified by frequency; single questions are labelled isolated; each carries an answer format and (with a transcript) a coverage flag; rhetorical/joke questions excluded; British English; no filler. If any answer is no, revise.

## minimum_viable_output

If questions are few, still produce a useful shorter list: the real questions present, their prominence, and a note on what further input would help. Be transparent; never pad with invented questions.

---

## Related Files
- [[SKILL]]
- [[course-development]]
- [[content-ideation]]
- [[ip-development]]

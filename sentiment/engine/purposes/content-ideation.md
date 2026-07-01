---
type: sentiment-purpose-config
purpose_id: content-ideation
status: mature
schema_version: 1.0
updated: 2026-07-01
---

```yaml
purpose_id: content-ideation
display_name: Content Ideation
one_line: Turn audience comments into a ranked, makeable slate of what to create next — videos, posts, shorts, newsletter beats, or KB articles.
```

> Client-agnostic. The creator's voice, funnel, and sensitivities come from the **client config** (engine core Step 6), not from here. The centre of gravity is **demand**: what the audience keeps asking for, the language they use, and what each idea wants to become. This is *not* course-development (that turns comments into course modules) and *not* qa-mining (that pulls answerable questions) — the unit of output here is **a next thing to make**.

---

## objective

Analyse audience comments to tell the creator **what to make next**, ranked by real demand. Surface the biggest recurring topic buckets, the exact audience language to hook them with, and the format each idea should take. Every idea must be grounded in what the comments actually say — not in what's generically popular in the niche. The job is to convert a comment set into a decisive, prioritised content slate the team can act on this week.

## primary_reader

The creator and whoever plans the content slate (the editor, the social lead, the newsletter writer, or — for a knowledge base — whoever commissions articles). They should be able to leave with a ranked list of ideas they could brief tomorrow, each with the evidence behind it and a suggested format.

## analysis_lenses

Layer these on top of the universal nine-category classification (engine core Step 3):

- **Demand lens.** Which topics recur, and how strongly? Group into the biggest comment buckets; weight by recurrence and `likes`. A bucket is only "big" if it recurs — a single loud comment is not demand.
- **Audience-language lens.** Capture the *exact words* the audience uses — the phrasings, questions, and framings that can become titles, hooks, thumbnails, and search-shaped headlines. Quote verbatim.
- **Format lens.** For each idea, what does it want to be? (short demo, long-form explainer, comparison, side-by-side, carousel, listicle, newsletter beat, KB article, live Q&A, etc.) Let the comment's intent decide the format.
- **Whitespace lens.** What are people asking for that hasn't been made yet? Separate "make more of what worked" from "make the thing they're asking for that doesn't exist".
- **Momentum lens.** What did *this* piece prove the audience wants more of? (e.g. a technique or aesthetic that drew "please do more of this".) These are the safest bets — appetite is already demonstrated.

## output_structure

Always a single Markdown file, in this section order:

1. **Executive summary — what to make next** — the strongest "make this" signals in plain language, and the single clearest next thing to produce. Lead with the decision. 200–400 words.
2. **What we analysed** — source(s), video/topic, comment count, whether a transcript was included, and any limitations.
3. **The demand picture** — the overall shape: what the audience is hungry for, the biggest buckets at a glance, and whether demand clusters around "more of the same" or "make the missing thing".
4. **Biggest comment buckets** — a table: `| Bucket | What the audience is saying | Prominence | Verbatim example |`. Recurring buckets only; prominence = strong/moderate/weak, earned by recurrence.
5. **Ranked content opportunities** — the core section. Each as `### Idea: [working title in the audience's own language]` → **Audience evidence** (verbatim quotes) · **Why now** (what makes this timely/proven) · **Suggested format** · **Effort vs impact** (rough) · **Funnel role** (what it does for the client's journey — from the client config).
6. **Audience language bank** — the exact phrases to reuse in titles, hooks, and descriptions, quoted verbatim, grouped by idea.
7. **Quick wins vs bigger bets** — split the ranked ideas by effort/impact so the team can sequence.
8. **Risks or cautions** — e.g. commenters may skew engaged/advanced; a vocal request may not represent broad demand; some ideas may be off-brand or off-funnel. Don't overstate.

*(If a transcript was supplied, note briefly where an idea repackages something the video already touched vs. genuinely new ground — but this purpose does not require the full transcript-mapping table that course-development uses.)*

## prioritisation_criteria

Rank ideas that meet one or more:

1. **Volume of demand** — many people asked for it (recurrence, not one loud voice).
2. **Proven appetite** — this piece already showed the audience wants more of it ("please do more of X").
3. **Freshness** — it hasn't been made yet (whitespace beats repetition).
4. **Funnel fit** — it moves people along the client's journey (from the client config).
5. **Format feasibility** — it can realistically be produced by this creator.
6. **Reusability** — the idea seeds a series, not just a one-off.

## evidence_rules

- **Quote real comments verbatim** as the evidence for every idea. Never paraphrase into a composite or invent a representative comment.
- **Never introduce specifics the comments don't contain** — no topics, products, or demand the audience didn't actually voice. Do not import "what usually does well in this niche" from domain knowledge; the comments are the only evidence for demand.
- **Prominence must be earned.** `strong` = recurring across many comments; a single comment is an isolated voice → `weak`, and labelled as such. Never present one request as a bucket.
- **Use grounded quantities only** — "recurring / several / a few / one", not invented figures.
- If input is thin: surface the few real signals, be transparent, and say what further input would sharpen the slate. **Never invent demand.**

## tone

Plain, direct, decisive — a content editor briefing the team, not a strategy deck. Clear headings, short entries, verbatim evidence, concrete formats. **British English.** No inspirational/consultant filler ("you've cracked something", "next level", "genuinely valuable"). Lead every idea with what to make and why the audience wants it.

## summary_json_extensions

Beyond the contract §4 defaults:
- on each `themes[]` item (used here as demand buckets): `demand_strength` (`strong|moderate|weak`) and `content_format_suggestion` (e.g. `short-demo | long-explainer | comparison | carousel | newsletter-beat | kb-article | live-qa`).
- `gaps[]` are used as **content opportunities**: `opportunity` = the makeable idea; add `idea_type` (`more-of-what-worked | make-the-missing-thing`).

## anti_patterns

Not a course brief (that's course-development). Not a generic "here are the themes" summary. Not a list of ideas without ranking or evidence. Not ideas invented from what's trendy in the niche. Not a repackaging of the transcript. It is a **decisive, evidence-ranked slate of what to make next**.

## final_quality_check

Before delivery, confirm: single Markdown file; the creator gets a clear "make this next" without reading it all; every idea is backed by a **verbatim** quote; prominence is justified by recurrence; single-comment items are labelled isolated; ideas carry a suggested format and funnel role; nothing is invented from niche priors; British English; no filler. If any answer is no, revise.

## minimum_viable_output

If comments are few or low-signal, still produce a useful (shorter) slate: the one or two real demand signals, the audience language present, and a note on what further input (more videos, a bigger scrape) would strengthen it. Be transparent; never pad with invented ideas.

---

## Related Files
- [[SKILL]]
- [[course-development]]
- [[qa-mining]]
- [[ip-development]]

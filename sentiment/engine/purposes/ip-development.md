---
type: sentiment-purpose-config
purpose_id: ip-development
status: mature
schema_version: 1.0
updated: 2026-07-01
---

```yaml
purpose_id: ip-development
display_name: IP Development
one_line: Identify product-shaped opportunities in the comments — recurring needs and buying signals that imply a tool, hub, product, or resource worth building.
```

> Client-agnostic. Creator voice, funnel, what they already sell, and sensitivities come from the **client config** (engine core Step 6). The centre of gravity is the **latent product**: a need stated often enough, or a buying signal strong enough, to imply something buildable — a tool, a resource hub, a physical/digital product, an affiliate/review layer. This is *not* content-ideation (a next thing to *make and post*) — an IP opportunity is a next thing to *build and sell or own*. The canonical example is the recurring "what's the X you're using / where do I get it" bucket (the Wirecutter signal).

---

## objective

Read audience comments for **product-shaped demand** — recurring needs, repeated buying signals, and workflow gaps that imply a product or owned asset rather than another piece of content. For each opportunity, state the underlying need, the evidence, a product hypothesis, and the cheapest way to validate it. Be disciplined about the difference between "would be nice" and "people are actively trying to buy this": only the latter is a real signal. Every opportunity must trace to real comments, not to what the category "should" sell.

## primary_reader

The creator and whoever owns product/commercial strategy (and, agency-side, whoever pitches new revenue lines). They should leave with a shortlist of product-shaped opportunities, each with the evidence, a hypothesis, a rough route to market, and a next validation step.

## analysis_lenses

Layer these on top of the universal nine-category classification (engine core Step 3), focusing on **request-led** and **experience-sharing** comments:

- **Recurring-need lens.** Needs stated often enough to imply a product, not just a one-off content request. Recurrence is the bar.
- **Buying-signal lens.** The "what are you using / where do I get it / what do you recommend / take my money" clusters — direct evidence of purchase intent. Quote verbatim.
- **Workflow-gap lens.** Friction the audience repeatedly works around (DIY hacks, jury-rigged solutions, "I wish there was…") that a product could remove.
- **Willingness lens.** Signs people would actually pay — already buying adjacent things, asking for a paid version, or expressing frustration strong enough to open a wallet. Separate this from mild interest.
- **Fit lens (from the client config).** Does the opportunity fit what the creator already sells and their funnel? A product that extends the existing offer beats a random new line.

## output_structure

Always a single Markdown file, in this section order:

1. **Executive summary — the clearest product opportunities** — the one or two most defensible product-shaped bets, in plain language, and why the comments support them. Lead with them. 200–400 words.
2. **What we analysed** — source(s), topic, comment count, whether a transcript was included, and any limitations.
3. **Recurring needs that imply a product** — a table: `| Need | What the audience is saying | Prominence | Verbatim example | Product hypothesis |`. Recurring needs only.
4. **Buying signals** — the "what's the X you're using / where do I get it" buckets, with verbatim quotes and how often they recur.
5. **Workflow gaps** — the friction people work around, and what product would remove it.
6. **Opportunity write-ups** — the core section. Each as `### Opportunity: [name]` → **Audience evidence** (verbatim) · **The need** · **Product hypothesis** (what it is) · **Route to market** (build / partner / affiliate / own-range) · **Fit with what they already sell** (from client config) · **Cheapest validation step**.
7. **What to validate next** — the single cheapest test for the top opportunity (a poll, a landing page, an affiliate link, a pre-order) before anyone builds.
8. **Risks or cautions** — the big one: **don't over-read demand.** A handful of "take my money" comments is interest, not a market. Note where a signal is thin, where it may not convert, and where it's off-strategy. Don't overstate.

## prioritisation_criteria

Rank opportunities that meet one or more:

1. **Strength + repetition of the need** — recurring, not a single dramatic comment.
2. **Explicit buying signal** — people are asking to buy / recommend / where-to-get, not just admiring.
3. **Commercial fit** — extends what the creator already sells or owns (from the client config).
4. **Feasibility** — buildable/partnerable at a realistic scale for this creator.
5. **Funnel fit** — deepens the owned-audience/product journey rather than a side quest.

## evidence_rules

- **Quote real comments verbatim** as evidence for every need and opportunity. Never invent a buying signal or paraphrase into a composite.
- **Never introduce specifics the comments don't contain** — no products, brands, or demand the audience didn't voice. Do not infer a market from what the niche "usually" monetises; the comments are the only evidence.
- **Prominence must be earned.** `strong` = a need recurring across many comments with real buying language; a single comment is an isolated voice → `weak`, labelled as such — never a "market".
- **Distinguish interest from intent.** "Cool, I'd love that" is weak; "where can I buy this / take my money / I've been searching for this" is a real signal. Say which you're seeing.
- **Use grounded quantities only** — "recurring / several / a few / one", not invented figures.
- If input is thin: name the few real signals, flag them as unvalidated, and give the cheapest validation step. **Never invent demand.**

## tone

Plain, direct, commercially honest — a product lead reading real signal, not a hype deck. Clear headings, verbatim evidence, explicit hypotheses and validation steps. **British English.** No inspirational/consultant filler, and no overclaiming market size from thin evidence. Lead with the defensible opportunity and its cheapest test.

## summary_json_extensions

Beyond the contract §4 defaults:
- on each `themes[]` item (used here as needs/opportunities): `signal_type` (`recurring-need | buying-signal | workflow-gap`), `signal_strength` (`strong|moderate|weak`), and `product_hypothesis` (one line).
- `gaps[]` are used for **validation steps**: `opportunity` = the product bet; add `validation_step` (the cheapest test).

## anti_patterns

Not a content slate (that's content-ideation). Not a course brief. Not content ideas dressed up as products. Not a single dramatic comment treated as a market. Not a market inferred from niche priors. Not overclaimed demand. It is a **disciplined shortlist of product-shaped opportunities, each with evidence, a hypothesis, and a validation step**.

## final_quality_check

Before delivery, confirm: single Markdown file; the reader sees the clearest opportunity immediately; every opportunity is backed by **verbatim** buying/need evidence; interest is distinguished from intent; prominence is justified by recurrence; single-comment signals are labelled isolated; each opportunity has a hypothesis, route to market, fit note, and a cheapest validation step; nothing is invented from niche priors; demand is not overstated; British English; no filler. If any answer is no, revise.

## minimum_viable_output

If signals are few, still produce a useful shorter read: the one or two real product-shaped signals, flagged as unvalidated, with the cheapest test for each — and a note that more input (more videos, a bigger scrape) is needed before building. Be transparent; never pad with invented demand.

---

## Related Files
- [[SKILL]]
- [[course-development]]
- [[content-ideation]]
- [[qa-mining]]

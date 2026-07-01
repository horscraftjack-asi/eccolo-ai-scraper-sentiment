---
type: sentiment-purpose-config
purpose_id: content-ideation
status: stub
schema_version: 1.0
updated: 2026-06-30
---

```yaml
purpose_id: content-ideation
display_name: Content Ideation
one_line: Find what to make next — the topics, audience language, and formats the comments are asking for.
```

> **STUB — shape only (v1).** Enough that the engine recognises this purpose and won't error, and that
> filling it later is *editing, not authoring*. It is **not** a production brief — don't expect
> mature output from a client run against this yet. The mature version is next-cycle work.

## objective

Turn audience comments into direction for **what to make next** — videos, posts, newsletter beats,
shorts. The centre of gravity is **demand**: which topics the audience keeps asking for, the language
they use to describe what they want, the biggest comment buckets, and what format each idea wants to
take. Not course modules (that's `course-development`); the unit of output is a *next thing to make*.

## analysis_lenses *(to develop)*
- Demand lens — which topics recur and how strongly (the biggest comment buckets).
- Audience-language lens — the exact words the audience uses (hooks, titles, search-shaped phrasing).
- Format lens — what each idea wants to be (short demo, long explainer, comparison, carousel, etc.).

## output_structure *(skeletal — to mature)*

1. **Executive summary** — the strongest "make this next" signals, in plain language.
2. **Top content opportunities** — ranked; each with audience evidence, why now, and a suggested format.
3. **Audience language bank** — the phrasing to reuse in titles/hooks.
4. **Biggest comment buckets** — the recurring topic clusters by prominence.
5. **Quick wins vs bigger bets** — effort/impact split.

## prioritisation_criteria *(to develop)*
Volume of demand · freshness / not-yet-covered · alignment with the client's funnel and phase.

## summary_json_extensions *(to develop)*
On `themes[]`: `content_format_suggestion` (e.g. `short-demo | long-explainer | comparison | carousel`).

## anti_patterns
Not a course brief. Not a generic "themes in the comments" summary. Not a list without ranked, makeable ideas.

---
## Related Files
- [[SKILL]]
- [[course-development]]

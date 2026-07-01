---
type: sentiment-purpose-config
purpose_id: ip-development
status: stub
schema_version: 1.0
updated: 2026-06-30
---

```yaml
purpose_id: ip-development
display_name: IP Development
one_line: Identify deeper IP / product opportunities — recurring needs that imply a tool, hub, or product.
```

> **STUB — shape only (v1).** Enough that the engine recognises this purpose and won't error, and that
> filling it later is *editing, not authoring*. **Not** a production brief — don't expect mature output
> from a client run against this yet. Mature version is next-cycle work.

## objective

Read comments for **product-shaped demand** — recurring needs, repeated "what's the X you're using"
questions, and workflow gaps that imply something buildable: a tool, a resource hub, a physical or
digital product. The centre of gravity is the **latent product**, not the next video. (The "what's the
X you're using" / Wirecutter-style buying-signal bucket is the canonical example.)

## analysis_lenses *(to develop)*
- Recurring-need lens — needs stated often enough to imply a product, not just a piece of content.
- Buying-signal lens — "what do you use / recommend / where do I get" clusters.
- Workflow-gap lens — friction the audience works around that a product could remove.

## output_structure *(skeletal — to mature)*

1. **Executive summary** — the clearest product-shaped opportunities.
2. **Recurring needs that imply a product** — each with audience evidence and the product hypothesis.
3. **Buying signals** — the "what's the X you're using" buckets, by prominence.
4. **Build / partner / affiliate framing** — rough route-to-market for each.
5. **What to validate next** — the cheapest test for each hypothesis.

## prioritisation_criteria *(to develop)*
Strength + repetition of the underlying need · commercial fit with what the client already sells · feasibility.

## summary_json_extensions *(to develop)*
On `themes[]`: `product_hypothesis` and `signal_type` (e.g. `recurring-need | buying-signal | workflow-gap`).

## anti_patterns
Not content ideas dressed up as products. Not a single dramatic comment treated as market demand.

---
## Related Files
- [[SKILL]]
- [[course-development]]

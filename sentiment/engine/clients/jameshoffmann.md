---
type: sentiment-client-config
schema_version: 1.0
maintained_by: NaaShika / Ziggurat
updated: 2026-06-30
---

```yaml
client_slug: jameshoffmann
client_name: James Hoffmann
```

> **Slug note (flag for Jack).** The design spec (§4.2) and the integration contract's own examples
> (§1.1) use `jameshoffmann`, and this config is built to that. But the canonical slug *registry* —
> per contract §1.1, the config files in `ziggurat-analytics-engine/configs/` — currently holds
> `hoffmann` (`hoffmann-analytics-config.md`, `client_slug: hoffmann`). That's a genuine spine
> mismatch: the analytics engine would key this creator as `hoffmann`, the sentiment engine as
> `jameshoffmann`, and the two side-outputs wouldn't join by ID. The contract says slug conflicts
> resolve **in favour of the registry**, so this should be reconciled deliberately (rename the
> analytics config to `jameshoffmann`, or rename this to `hoffmann`) before the feedback loop is
> built. Not blocking v1; surfaced rather than silently picked. **This config is the source of truth
> for who the creator is — it intentionally reuses the same facts as the analytics config, not forks
> them.**

This is a lightweight sibling of `hoffmann-analytics-config.md` — the purpose-agnostic "who is this
creator" facts, distilled. It is read by the sentiment engine to colour interpretation (Step 6). It is
short on purpose (~half a page of substance).

---

## who

James Hoffmann is the world's leading coffee educator — World Barista Champion (2007), author of
*The World Atlas of Coffee*, and co-founder of Square Mile Coffee Roasters. His YouTube channel is the
primary vehicle for deep-dive coffee education. His authority comes from deep knowledge, careful word
choice, rigorous testing, and a visible commitment to truth over trend. He takes himself lightly but
coffee seriously.

## voice

Honest, curious, enthusiastic — expert without arrogance, passionate without performance. Reads like a
conversation with a very knowledgeable friend sharing genuine discovery, not demonstrating status.
Recommendations in the report should sound like they're feeding *that* voice: precise, candid,
test-led, never hypey or "consultanty". Course material should feel more personal, candid, and
demonstrative than a YouTube video — that depth is the paid product's whole advantage.

## audience

Coffee enthusiasts spanning engaged home brewers through to working baristas — a wide sophistication
range in the same comment section. They value accurate, specific information over aspirational
lifestyle content; they respond to content that reveals *why* something works, tests received wisdom,
or explores an unexpected corner of coffee knowledge. They are sceptical of hype and reward
intellectual honesty. They engage in genuine technical detail when the content earns it — and the
comment section frequently contains real expertise and corrections (treat as community knowledge).
Because the range is wide, watch for the gap between advanced commenters and the home learner the
course is actually for.

## what_they_sell

Online async courses hosted on his website (e.g. *How to Make Great Espresso* / "Making Better Coffee
at Home", ~$250 tier). YouTube drives awareness and trust. Patreon is a direct-support and community
layer for the most engaged audience. Books sell through retail. The sentiment engine's course-dev
output exists to make the **paid course** more valuable than the free video.

## funnel

**Attention (social) → YouTube video → Course / Patreon consideration → Purchase / subscription.**
Social and YouTube are trust-building and curiosity-triggering, not direct conversion; the course and
Patreon are where the audience's trust converts. Insight should connect to *that* journey: where the
free video built trust but left a need the paid course can satisfy.

## strategic_phase

Steady-state course + Patreon ecosystem (2026) — audience deepening and course-pipeline building, no
single imminent launch. What matters now: content/insight that builds the trust and intellectual
credibility that makes course launches viable, and that identifies course-only depth the free videos
can't reach. When a course is actively launching, course-dev insight becomes directly tied to that
launch's modules.

## sensitivities

- Don't recommend anything that reads as generic coffee-lifestyle content — the distinctly-Hoffmann,
  test-led, "why it works" voice is the primary strategic asset; flag drift towards generic.
- Respect the truth-over-trend stance: never recommend overstating a claim or making one without the
  reasoning/test behind it.
- The comment audience skews more advanced than the paying home-learner the course targets — weight
  findings with that caveat (carried into the report's Risks section).

---

## Related Files
- [[SKILL]]
- [[course-development]]
- [[hoffmann-analytics-config]]
- [[Hoffmann TOV Guide]]

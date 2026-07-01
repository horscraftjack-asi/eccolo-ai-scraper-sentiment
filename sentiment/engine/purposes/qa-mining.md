---
type: sentiment-purpose-config
purpose_id: qa-mining
status: stub
schema_version: 1.0
updated: 2026-06-30
---

```yaml
purpose_id: qa-mining
display_name: Q&A Mining
one_line: Pull the real audience questions worth answering directly — for FAQs, post-launch Q&A, or "answers the comments" segments.
```

> **STUB — shape only (v1).** Enough that the engine recognises this purpose and won't error, and that
> filling it later is *editing, not authoring*. **Not** a production brief — don't expect mature output
> from a client run against this yet. Mature version is next-cycle work.

## objective

Extract and rank the **answerable questions** the audience is actually asking, so the creator can
respond directly — a post-launch Q&A, an FAQ, an "I answer the comments" segment. The centre of
gravity is a **ranked list of real questions** plus the backstories the content didn't tell. Optionally
takes a transcript (like `course-development`) to mark whether each question was already answered.

## analysis_lenses *(to develop)*
- Answerability lens — which questions can actually be answered well, and how (short answer / demo / explainer).
- Frequency + upvote lens — what to answer first.
- Backstory lens — the "why didn't you mention X" / context-the-content-skipped questions.

## output_structure *(skeletal — to mature)*

1. **Executive summary** — the must-answer questions.
2. **Ranked answerable questions** — each with frequency/prominence, paraphrase, and best answer format.
3. **Already-answered vs still-open** — against the transcript, if supplied.
4. **Backstories the audience wants** — context the content didn't give.
5. **Suggested Q&A / FAQ structure** — how to group and sequence the answers.

## prioritisation_criteria *(to develop)*
How often asked + upvoted · answerable in the format available · adds something the content didn't.

## summary_json_extensions *(to develop)*
`question_clusters[]` reuse `covered_in_source` (`fully|partly|not`); add `answer_format` (e.g. `short | demo | explainer`).

## anti_patterns
Not a course brief. Not a dump of every question. Not questions the creator can't credibly answer.

---
## Related Files
- [[SKILL]]
- [[course-development]]

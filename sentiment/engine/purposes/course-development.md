---
type: sentiment-purpose-config
purpose_id: course-development
status: mature
schema_version: 1.0
built_from:
  - james-hoffmann-course-sentiment-analysis-task.md
  - HOF_Comment_Analysis_Prompt.md
updated: 2026-06-30
---

```yaml
purpose_id: course-development
display_name: Course Development
one_line: Turn audience comments (plus the source video transcript) into module-development direction for a paid async course.
```

> This is the **mature, proven** purpose. It collapses Ziggurat's two existing Hoffmann briefs into
> one reusable config. The per-*video* vs per-*course* grain distinction those two files implied is
> handled by **run scope** (`per-video` | `synthesis`), not by separate purposes. The named video and
> "what the creator covered" are **run inputs (transcript + topic), never config.**

---

## objective

Analyse audience comments — and, where supplied, the source video transcript — to help a creator
develop or deepen a **paid asynchronous course**. The job is not to prove people liked a video and
not to report social performance. It is to show how the audience's response to free content reveals
what the paid course should teach more slowly, demonstrate more candidly, answer directly, or expand
beyond what the original video could do. The central instruction: *this report exists to help the
creator build a better course than the free video alone could provide.*

## primary_reader

The creator and their course team — the person deciding module content, the course writer building
the modules, and the producer planning what to film. They should be able to act on it: decide what to
include, what to slow down, what to demonstrate, what to answer directly, and what to add that the
video never covered. Section 1 (the executive insight) is for the creator personally; the body
(themes onward) is for the team and the course writer. Keep that distinction clear.

## analysis_lenses

Layer these on top of the universal nine-category classification (engine core Step 3). They are
*lenses* — ways of reading the already-classified set — not a new classification set.

- **Question lens.** Extract and group audience questions. For each cluster: the underlying thing
  people are trying to understand; whether the original video answered it fully / partially / not at
  all; whether the course should answer it directly; and the best course asset to answer it
  (explanation, demonstration, troubleshooting sequence, comparison, checklist, decision tree,
  worksheet, exercise).
- **Pain-point lens.** Find where the audience shows difficulty, frustration, uncertainty, or lack of
  confidence. Tells: "I don't understand…", "this is confusing", "I tried this but…", "what should I
  do if…", "I can't get…", "this didn't work for me", "too fast", "too dense", "I need a simpler
  version". For each: what the problem is, why it matters for home/at-home learners, whether the video
  caused / solved / exposed it, and what the course should do differently.
- **Transcript-mapping lens.** Map each major theme or question against the transcript using these
  labels: *Covered clearly · Covered too quickly · Covered but not practically enough · Implied but
  not explicit · Not covered · Covered but still confusing.* If something was covered but people still
  asked about it, that is valuable — it signals the course needs a slower explanation, a better
  example, a visual demonstration, or a different teaching sequence. Never treat transcript coverage
  as sufficient if comments show people still struggled.
- **Course-development lens.** Translate each major insight into module guidance: what this tells us
  about the learner; what the creator should include / expand / slow down / demonstrate / be more
  candid about; what the course writer should build around it; what becomes a practical learner takeaway.
- **Community-knowledge lens.** Flag tips, corrections, and supplementary information that *commenters*
  are sharing (the comment section is sometimes smarter than the video) — things the creator should
  validate, include, or address directly.

## output_structure

The report is **always a single Markdown file**, in this exact section order (this is the canonical
course-development structure — the §9 structure from the Hoffmann task brief, with the HOF per-video
brief folded in):

1. **Executive insight summary for [creator]** — a short message the creator could read without the
   rest of the report. What the audience most valued; what they struggled with; what they wanted more
   of; what it means for the course; where the creator can confidently go deeper; the clearest next
   step for module development. Direct, human, useful — not a corporate executive summary. 250–500
   words (150–200 if the input is small / per-video and tight).
2. **What we analysed** — sources of comments; video/topic; whether a transcript was included; any
   limitations in the source material. Don't over-explain methodology.
3. **Overall audience sentiment** — the general response: overall pattern; dominant positive themes;
   dominant negative/confused themes; whether the audience seems ready for deeper course material;
   what kind of learner is most represented in the comments.
4. **Main audience themes** — a table: `| Theme | What the audience is saying | Evidence from comments | Course implication |`. Strongest recurring themes only.
5. **Questions the course should answer** — grouped question clusters, each as:
   `### Question cluster: [Name]` → **What people are really asking** · **Representative questions or
   paraphrases** · **Was this covered in the video?** · **What the course should do** · **Best format**
   (explanation / demo / checklist / troubleshooting / decision tree / exercise / comparison / other).
6. **Pain points and confusion points** — a table:
   `| Pain point | How it appears in the comments | Why it matters | Course response |`. Focus on
   signals that the video was too fast/dense, that learners couldn't apply advice at home, that they
   lacked equipment/confidence/vocabulary/context, or that people wanted showing rather than telling.
7. **What the audience already values** — what people clearly appreciated (clarity, honesty, testing
   approach, demonstrations, comparisons, humour, challenging assumptions, technical depth,
   reassurance, taste-led judgement, practicality). For each, how the course can preserve or expand it.
8. **Transcript-to-course mapping** — a table:
   `| Audience need or question | Transcript coverage | Gap or opportunity | Course recommendation |`,
   using the transcript-coverage labels from the transcript-mapping lens. *(If no transcript was
   supplied, replace this section with a one-line note that mapping was not possible and why.)*
9. **Recommended course module opportunities** — each as `### Module opportunity: [Name]` →
   **Audience evidence** · **Why this belongs in the paid course** · **What [creator] should teach** ·
   **What [creator] should demonstrate** · **What the course writer should build around it** ·
   **Learner outcome.** Prioritise opportunities that add value beyond the free video.
10. **Suggested teaching assets** — practical assets the findings imply (short explainer, candid
    teaching segment, visual diagram, guided exercise, troubleshooting flowchart, decision tree,
    comparison, before/after demo, common-mistakes section, "[creator] answers the comments" segment,
    worksheet/checklist, glossary, calibration exercise). For each, the audience need it serves.
11. **Priority recommendations** — a ranked list, each as `1. **Recommendation:**` → **Why it
    matters** · **Evidence** · **Course action.** Practical and decisive.
12. **Risks or cautions** — e.g. comments may overrepresent advanced viewers; commenters may not
    represent paying customers; a vocal minority may skew apparent need; some requests may be out of
    scope; the transcript may not capture visual demonstrations. Don't overstate — use them to sharpen
    judgement.

## prioritisation_criteria

Prioritise insights meeting one or more (from the Hoffmann task brief §11):

1. Many people asked about it.
2. It reveals a clear learner pain point.
3. It shows where the original video was valuable but constrained by the format.
4. It identifies a gap the paid course can fill.
5. It helps the creator avoid simply repeating the free video.
6. It can become a specific module, lesson, demonstration, checklist, or exercise.
7. It would make the learner feel closer to the creator's thinking or process.
8. It increases the perceived value of the paid course.

## evidence_rules

- Quote short excerpts where useful; paraphrase when comments are repetitive.
- Don't over-weight one dramatic comment; distinguish repeated patterns from isolated opinions.
- Note whether a theme appears **strong / moderate / weak**. Use `likes` as a prominence signal.
- Preserve the audience's plain-language wording where it helps the team understand learners.
- With a transcript: refer to specific sections/moments if available; state whether it resolves,
  partly resolves, or does not resolve a question; don't treat coverage as sufficient if comments show
  people still struggled.
- If input is thin: be transparent, focus on visible patterns / obvious questions / repeated language /
  tentative implications, and say what further input would strengthen it. **Never invent evidence.**

## tone

Plain and direct. Clear headings, short paragraphs, useful tables, concrete recommendations, direct
links between audience evidence and course action. Write as someone trying to help the team make the
course better — not someone selling a strategy project. **British English.** Avoid: corporate jargon,
vague strategy language, inflated claims, filler, excessive methodology, long uninterpreted lists,
generic education language that could apply to any course.

## summary_json_extensions

Beyond the contract §4 defaults, this purpose adds per-theme and per-question coverage so the platform
can later join course-relevance against performance:

- on each `themes[]` item: `transcript_coverage` — one of `covered-clearly | covered-too-quickly |
  covered-not-practically | implied | not-covered | covered-still-confusing | n/a`.
- `question_clusters[]` use the contract's `covered_in_source` (`fully|partly|not`) and
  `course_relevance` (`module|section|demo`).
- `pain_points[]` use the contract's `course_response` (e.g. `demonstration|slower-explanation|checklist|troubleshooting`).
- `gaps[]` use the contract's `opportunity` (e.g. `course-only content`).

## anti_patterns

The report must NOT be (Hoffmann task brief §6 + HOF brief): corporate, fluffy, vague, performative,
written like a pitch deck, padded with obvious observations, focused only on social metrics or on
whether the video "performed", a generic sentiment summary detached from course design, a rewrite of
the transcript, or a list of every comment with no synthesis. It is **not** course copy or module
drafts (that's the writer's job), **not** a critique of the creator as a presenter, and **not** a
ranking of the creator against others. It is editorial intelligence that informs course-design decisions.

## final_quality_check

Before delivery, confirm: single Markdown file; the creator gets a clear immediate insight without
reading the whole thing; the team knows what to do next; sentiment is distinguished from course
relevance; what the audience valued and struggled with is identified; it shows where the course can go
deeper than the video; comments are mapped to the transcript (if supplied); no fluff; it doesn't just
summarise the video; it produces specific module-development recommendations. If any answer is no, revise.

---

## Related Files
- [[SKILL]]
- [[jameshoffmann]]
- [[james-hoffmann-course-sentiment-analysis-task]]
- [[HOF_Comment_Analysis_Prompt]]

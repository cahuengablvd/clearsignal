# Pre-launch fix list — the finish line

The owner's decision: no sales test until the site and the engine are right. This file exists so
that decision has an END. Everything remaining is listed below. Nothing else is in scope.

**Termination rule** (already established in `TASKS_RELEASE_CUT.md`, reused verbatim): defects
discovered *after* this list is agreed go to `DEFECTS_BACKLOG.md` and are fixed in weekly batches —
not folded into this sprint. A list that accepts new items while it is being worked never closes.

Detail for the P-items lives in `TASKS_AI_POSITIONING_AND_EVIDENCE.md` (Codex's memo + the Claude
review in section 15). Detail for the R-items lives in `DEFECTS_BACKLOG.md`. Do not restate them
here; the copies drift.

## Already verified fixed — do not re-open

Checked against the code on 2026-08-03, not against the backlog text:

- **R1** alias-aware GEO detection — confirmed on live monokelriga output (3/14 named, no answer
  naming the brand marked "Not named").
- **R2** `"provides services."` filler — string no longer exists in `lib/`.
- **R3** `MovingCompany` leaking to non-moving verticals — gated behind `isMovingBusiness()`, plus
  two validator guards against the guidance leak.
- **R5** recovery sweep money loop — `MAX_RECOVERY_ATTEMPTS = 2`, deterministic failures skipped,
  staleness keyed off `processing_started_at`.
- **R6** stale failure text in `admin_notes` — both success paths append an `OK:` line.
- **F6** currency stripped from prices — live monokelriga PDF shows `EUR 855` / `EUR 1125`.

## Batch 1 — measurement truth (public-facing)

Highest priority: these are claims that do not match what the code measures.

1. **P0.1** free score promises three engines, runs Claude only. Use the framing in review §15.4,
   not a bare deletion of engine names.
2. **P0.2** delete `domainClause` from `buildGeoSummary`. **Delete, do not relocate** — see §15.2.
3. **P0.4** drop the `slice(0, 3)` GEO evidence linkage on `ai_search` fixes.
4. **New contract test:** public engine claims must match the engines each path configures. This
   defect class has no test today, which is why P0.1 reached production.

## Batch 2 — contained quality and copy

5. **P0.3** `third_party_authority` treated as a signal the brand's own page is "missing". Note the
   file correction in §15.1: it lives in `lib/prompts.ts`, not `lib/geo/sources.ts`.
6. **P1.1** positioning copy + the "how is this different from SEO?" FAQ answer. One vocabulary per
   surface (§15.2).
7. **P1.4** friendlier client labels over the stored stage enum. Display only.

## Batch 3 — engine changes (one round, then stop)

Highest regression risk in this file. Each item ships with the failing test first.

8. **P1.2** align generated questions with the existing intent taxonomy.
9. **P1.3** feed a compact GEO evidence catalog into the action stage. **Watch the critical path:**
   `runFullAudit` sits under `maxDuration: 600` and this serializes GEO ahead of the action stage.
   If generation time regresses past ~7 minutes on a real run, stop and reconsider rather than
   raising the cap.
10. **R7 remainder** — contract tests over every enum the prompts promise, so a prompt edit that
    contradicts the schema fails CI instead of production.

## Batch 3.5 — cancel abandoned engine calls (inserted 2026-08-04, blocks the Batch 3 benchmark)

The Batch 3 benchmark uncovered `R10`: a logical timeout abandons the wait but not the request, so
Anthropic keeps searching and billing invisibly. This must land before Batch 3 can be benchmarked
again, because the benchmark itself is what the leak makes unaffordable.

- **Do not top up Anthropic to re-run the benchmark until this is fixed.** The next run would leak
  the same way.
- Thread an `AbortController` through the engine adapters and `lib/anthropic.ts`; abort on timeout;
  `clearTimeout` in a `finally`.
- Prove cancellation by observation: no usage logged for the aborted call after the abort. An absent
  error is not proof.
- While in this file, reconsider the blast radius: six parallel engine queries with `max_uses: 2`
  each is the multiplier that turns one stuck call into a meaningful cost. Consider a per-audit web
  search budget, but do not reduce engine coverage — the three-engine claim is now contractually
  bound to the public copy (`lib/engine-scope.ts`).

## Batch 4 — known report defects

11. **R9** schema gate blocks legacy re-renders into a dead end (warn, don't block, on the
    re-render path only).
12. **R8** marketplace JSON-LD ships the generic `Organization` + `FAQPage` pair.

## Verification (the actual definition of "done")

- Full test suite green, `tsc` clean, production build clean.
- Vercel deployed; Trigger deployed separately from `C:\csdeploy` if any worker code changed.
- **Two fresh paid-path audits** on the final build, in different verticals, each passing the
  mechanical client-safety scan (ligatures, operator outreach, template sentences, placeholder CTA
  fragments, future-date claims, foreign-vertical wording, currency intact).
- One of those two read end to end by a human — the owner — as if he were the customer.
- Live Stripe control purchase + refund (owner, blocked on funds — runs in parallel, does not block
  code).
- Legal review of `/terms`, `/privacy`, `/refund` (owner — runs in parallel).

When those pass, this file is closed and the two-week sales test in `validation/PLAN.md` starts.

## Explicitly NOT in this sprint

Recommendation-vs-mention classifier, Brand Evidence Footprint, broad third-party crawling, the AI
Visibility Study, monitoring, subscriptions, auth, dashboards, white-label, new engines, new report
sections, redesigns, product rename. All are P2 or rejected in the memo and stay there.

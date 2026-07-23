# Radar Lite — competitive intelligence, minimal version (Codex spec)

Agreed by owner + Claude + Codex. This replaces the full "ClearSignal Radar" plan for now; the
full version is gated (see "Upgrade gate" at the end). Budget cap: **$20/month**. Build estimate:
**2–4 working days** including tests and delivery.

## Where it lives — separate private repo (required)

Create a **new private repo `clearsignal-radar`**. Two reasons, both hard:
1. Snapshot commits must not enter the ClearSignal repo: **Vercel auto-deploys every push to
   `main`**, so daily snapshot commits would trigger pointless production deploys.
2. Snapshots of competitor pages are private working copies (fair-use for diffing); they must
   never end up in a public or deployable artifact.

Stack: **TypeScript** (Node 20+), no framework. Runs on **GitHub Actions cron**. No VPS, no
Docker, no Postgres, no dashboard, no Playwright.

## Repo layout

```
clearsignal-radar/
  watchlist.yaml          # sources of truth for what we watch
  snapshots/<slug>/<page-slug>.txt   # normalized main-content text only
  events.jsonl            # append-only log of detected significant changes
  digests/2026-WNN.md     # weekly digest archive
  hypotheses.md           # manually curated; Radar never writes here
  src/                    # fetch, normalize, diff, classify, digest, deliver
  tests/
  .github/workflows/radar.yml
```

## Watchlist (seed — owner can edit the YAML anytime)

Direct competitors (10), pages per competitor: pricing, product/features, changelog-or-blog
(2–3 URLs each; Codex resolves exact URLs during implementation):

Profound, Peec AI, Otterly.ai, Scrunch, AthenaHQ, Indexly, Semrush AI Visibility Toolkit,
Ahrefs Brand Radar, AI Labs Audit (white-label tier — closest to our agency pilot),
HubSpot AI Search Grader (free-scanner funnel reference).

Official technology sources (6, RSS where available; if a source has no RSS, watch its index
page as a normal watched URL):

Google Search Central blog, OpenAI news/help changelog, Anthropic news/docs, Perplexity blog,
Bing Webmaster blog, arXiv query for "generative engine optimization" / AI search visibility.

**Explicitly excluded from v1:** Telegram channels (even `t.me/s/` previews — partial coverage
creates a false sense of monitoring), Reddit, YouTube, any social; automatic discovery of new
players (owner does a manual sweep monthly); tech-stack fingerprinting; sentiment.

## Pipeline (deterministic first, LLM last)

1. **Fetch** each watched URL (plain HTTP, honest User-Agent, respect robots.txt; skip on 4xx/5xx
   and record the failure).
2. **Normalize:** extract main content (readability-style), drop nav/footer/script/style,
   cookie/consent text, social links, copyright lines, obvious dynamic elements (dates, counters).
   Output plain text. **Store only this** — never full HTML, never full articles.
3. **Hash + diff:** canonicalize URL, hash normalized text. If hash unchanged → done, nothing else
   runs. If changed → line diff against the previous snapshot.
4. **Significance filter (deterministic):** the diff matters only if changed lines > 3, or a price
   pattern changed (`€ | $ | /mo | /month` near digits), or a heading/feature-list line changed.
   Below threshold → commit new snapshot, log nothing.
5. **LLM classification — only for significant diffs** (this is a hard rule; the LLM never runs on
   unchanged or trivially-changed pages). Model: cheapest adequate (Haiku-class). Classify into:
   `pricing | feature | positioning | methodology | research | marketing_claim | noise`.
   Output: ≤2-sentence summary of *what changed*, excerpt ≤50 words, and an evidence label:
   - `observed` — the change is visible in the page text itself;
   - `claimed` — the page asserts something we cannot verify (marketing copy).
   The prompt must forbid inferring internal product mechanics from marketing text.
6. **Log** to `events.jsonl`: `{ts, competitor, url, class, evidence, summary, excerpt,
   hash_before, hash_after}`.
7. **Commit** snapshots + events (single commit per run).

Fetch cadence: daily (cheap, deterministic). Digest cadence: **weekly**.

## Weekly digest (Telegram)

- Sent Mondays 09:00 Europe/Riga via the existing ClearSignal Telegram bot
  (`TELEGRAM_BOT_TOKEN` / `TELEGRAM_CHAT_ID` as GitHub Actions secrets).
- **Max 5 items**, ranked by class priority: `methodology > pricing > feature > research >
  positioning`. Each item: class, `observed/claimed`, the 2-sentence summary, excerpt, URL.
- `marketing_claim` items may appear only in a collapsed "Claims (unverified)" tail section,
  never as one of the 5 action items, never phrased as a recommendation.
- `noise` never appears.
- **If nothing significant happened, the digest is one line: "No significant changes this week."**
  The system must not stretch to fill five slots — an empty week is a valid, expected output.
- Digest is also written to `digests/2026-WNN.md`.

## What Radar Lite must NOT do

- Never write to `hypotheses.md` (owner curates it by hand from digests).
- Never propose changes to ClearSignal audit logic. Anything product-facing goes: digest → owner
  reads → manual entry in `hypotheses.md` with provenance (competitor, evidence URL) → benchmark
  on the golden set → manual approval. Radar has no write path into the product.
- Never store full copies of third-party articles/PDFs; excerpts ≤50 words + link only.
- Never bypass logins, CAPTCHAs, paywalls; never use Playwright in v1.

## Budget guard

- Log LLM spend per run (tokens × price) into `events.jsonl` metadata.
- Hard cap **$20/month**: when cumulative monthly spend hits the cap, stop LLM calls, keep
  deterministic collection running, and flag "LLM budget exhausted" in the next digest.
  Exceeding the cap is itself a signal the filter is too loose — investigate, don't raise the cap.

## Tests (vitest)

- Normalization strips a cookie-banner + nav/footer fixture; output is stable across two runs.
- Diff detects a price change fixture (`€149 → €199`) as significant; a rotated-testimonial
  fixture as NOT significant.
- LLM is not invoked when the hash is unchanged (mock assert: zero calls).
- Digest formatter: caps at 5 items, collapses claims, emits the one-line empty message.
- Budget guard: at cap, LLM calls stop and the flag appears.

## Acceptance criteria

- Scheduled run completes on GitHub Actions with no manual steps; failures of individual URLs
  don't kill the run and are listed in the digest tail ("3 sources unreachable").
- A week with no real changes produces the one-line digest — verified by running against
  unchanged snapshots.
- Every digest item carries class, evidence label, excerpt and URL.
- No full-page HTML anywhere in the repo; snapshots are normalized text only.
- Repo is private; secrets only in Actions secrets, never committed.
- Total monthly cost ≤ $20 with the guard proven by test.

## Upgrade gate to full Radar (composite — ANY one of)

1. 5 paid ClearSignal orders; or
2. manual monitoring starts taking >1 h/week; or
3. customers ask for competitive-tracking features repeatedly; or
4. Radar Lite has produced ≥1 hypothesis that survived a benchmark; or
5. source volume outgrows the git-based process.

Until a gate condition fires, the answer to "should we extend Radar?" is no by default.

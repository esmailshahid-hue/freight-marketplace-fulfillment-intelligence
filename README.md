# Freight Marketplace Fulfillment & Capacity Intelligence

Phase 1 implements the deterministic business logic described in [the product specification](docs/freight_marketplace_fulfillment_capacity_v1_spec.md). It answers whether upcoming freight demand has enough qualified physical capacity and enough modeled effective capacity, and identifies operational actions when it does not.

Phase 2A adds a minimal functional browser UI over that stable foundation. This is a synthetic portfolio prototype, not production-ready software. The application has five table-based tabs, a shared bucket drilldown and scenario controls. There is no charting, authentication, database, external API, AI/LLM integration, tracking, routing, dispatch, OCR, TMS integration, or machine-learning model. Phase 3 adds CSV upload, mapping and validation using the same analytics. Exports and final visual polish remain outside the current scope.

## Run and verify

Use Node.js 22.12+ (validated here with Node 25.6.1):

```sh
npm ci
npm run generate:sample  # regenerate the committed CSVs, seed 42
npm test                 # all formula, validation, edge-case, and scenario tests
npm run typecheck        # includes scripts and tests
npm run lint
npm run build            # TypeScript plus Vite production build
npm run verify:scenarios # asserts planted scenarios, then prints actual metrics
npm run dev              # open the local URL printed by Vite
```

No credentials or environment secrets are required. The sample generator only writes `public/sample-data/`. Analytics perform no I/O and have no global mutable state.

## Phase 2A browser workflow

On startup, `App.tsx` captures one analysis timestamp and calls the existing `fetchSample()` utility. It fetches local sample metadata and all five CSV assets, validates them, shifts sample dates and validates the shifted result. Only validated data reaches `analyze()`. A failed request or blocking validation error shows a visible error and Retry button. Existing validation warnings remain available in Data status. Sample loading only reads the local sample assets; no external service or persistent storage is involved.

All baseline tabs use the same seven-day `Analysis` object and fixed analysis timestamp. This Phase 2A scope uses six Operations KPIs and a seven-day baseline, rather than the later specification's five-KPI/72-hour queue layout. Scenario Lab is explicitly separate: it calls `runScenario()` with percent controls converted to decimal arguments and the three supported threshold overrides. It does not replace scenario calculations with UI arithmetic. Tab switching preserves current controls; resetting restores the engine defaults and disables the lane override. Refreshing starts a new sample snapshot and clears all UI state.

| Browser view | Existing output used |
| --- | --- |
| Operations Queue | `analysis.kpis`, priority-ordered `analysis.actions`, bucket demand baselines and concentration fields |
| Capacity & Fulfillment | `analysis.buckets`; lane/equipment/date/status filters select visible rows without recomputing analytics |
| Pricing & Economics | Bucket economics, benchmark provenance/confidence, rate index, modeled acceptance and `rate_search.recommendation` |
| Supply Gaps | `analysis.supply_gaps` in existing rank order, including all score components and explanation text |
| Scenario Lab | `runScenario().baseline`, `.scenario`, and all four `.deltas` categories |
| Shared drilldown | Selected bucket's risk reason, root causes, warnings, `capacity.carriers`, individual `capacity.contributions`, rate recommendation and existing actions/evidence |

Scenario action drilldowns retain their context: new/changed actions open scenario buckets, while resolved actions open the original baseline bucket. This avoids presenting a resolved issue as current. The original analytics, decision rules, thresholds, scenario engine, generator, committed samples and planted-scenario tests were unchanged in Phase 2A; no analytics wiring defect was discovered.

UI files are `src/App.tsx`, `src/pages/*.tsx`, `src/components/*.tsx`, `src/ui/{format,selectors,scenarioControls}.ts`, `src/App.css`, `src/index.css`, and the page title in `index.html`. Helper tests are in `tests/ui-helpers.test.ts`. Tables use native buttons for keyboard access, tabs support arrow/Home/End navigation, and the native modal handles focus containment, Escape and focus return.

Browser validation covers automatic sample loading and KPI equality with the engine, all five tabs, capacity filtering and empty results, carrier aggregation (five carriers/six blocks), pricing expansion, supply-gap ordering, global and lane-specific scenario changes, threshold changes/excluded blocks, all four action-delta categories, baseline-vs-scenario drilldown context, reset, and failed-file Retry recovery. No charting or UI dependencies were added.

## Phase 3: analyze your own CSV files

Select **Upload own data**, then:

1. Choose a CSV in each of the four required dataset slots. Carrier payments is optional. Filenames need not match the sample filenames; each slot determines its contract. File cards show filename, bytes, detected record count, mapping status and validation status.
2. Review the column mappings. Each schema field shows its requirement, automatic match and a header dropdown. Exact normalized names and the existing controlled synonyms preselect unique matches. Required ambiguous or missing fields need a selection. Optional fields may stay unmapped; optional lane is computed from origin and destination. A column cannot be used twice. Unmap its current field first to move it.
3. Click **Validate data**. This captures the current application timestamp for the analysis session. All row validation goes through `validateCsv`, using the original CSV text and explicit mappings. Errors block analysis; warnings do not. Expand the retained past-due upcoming, future historical and future offer tables to inspect rows excluded from analytics.
4. Click **Analyze Data**. The same five tabs, deterministic `analyze()` / `runScenario()` engines, and drilldowns use only the validated uploaded datasets. Data status retains warnings and excluded rows. Missing payments disables only payment exposure actions.

**Manage uploaded data** reopens the editor with files and mappings intact. Any file read, replacement, removal or mapping change invalidates validation and analysis immediately. **Reset to sample data** clears uploads and mappings and remounts the existing sample loader with a new timestamp. Refresh also returns to the sample.

Upload state is a reducer in `src/ui/uploadState.ts`: it owns the source mode, file slots, reviewed mappings, validation snapshot and analyzed snapshot. Read tokens reject stale asynchronous results after replacement/removal/reset. `UploadWorkflow.tsx` renders that state; `ValidationResults.tsx` displays the existing validation output. `App.tsx` mounts either the sample loader or the upload workflow/workspace. The upload path never imports sample rows or invokes date shifting. Original text remains unchanged, and source data never mixes.

Your CSV files are analyzed in this browser session only. They are not uploaded or stored. No localStorage, IndexedDB, cookies, database, server upload or external API is used. Uploaded dates remain exactly as supplied; only the synthetic sample is shifted. Analysis timestamps display in Asia/Riyadh, as in the existing application.

Two presentation/validation wiring fixes were necessary: explicit optional unmapping now has `null` semantics at the validation boundary, and the pricing page uses the session currency instead of hardcoded SAR. No analytics formulas, thresholds, generator, committed samples or planted-scenario assertions changed. `tests/uploads.test.ts` covers the upload lifecycle, mappings, error/warning rules, temporal exclusions, source isolation, stale reads, reset and scenario propagation.

## Modules and entrypoints

- `src/data/schemas.ts`: TypeScript contracts, executable field schemas, filenames.
- `src/data/mapping.ts`: controlled synonyms and conservative header matching.
- `src/data/validation.ts`: Papa Parse CSV ingestion, normalization, blocking errors, row warnings, temporal exclusion, currency checking. Returns `data: null` when any blocking error exists. Past-due and future historical rows are retained separately and exposed in expandable validation tables.
- `src/data/synthetic.ts`: seeded synthetic dataset construction. Scenario names never enter the analytical inputs.
- `src/data/sampleLoader.ts`: serialization, sample-only date shifting, and an optional browser loader for all five static local sample files. Uploaded CSVs use `validateCsv` directly and are never shifted.
- `src/analytics/config.ts`: all specification defaults in one place.
- `src/analytics/reliability.ts`, `pricing.ts`, `capacity.ts`, `fulfillment.ts`, `history.ts`, `risk.ts`: pure calculations and fallback provenance.
- `src/analytics/rootCause.ts`, `actions.ts`, `supplyGaps.ts`: deterministic classification, seven action types, priorities, and recurring-gap ranking.
- `src/analytics/engine.ts`: `analyze(validatedData, analysisTime, configOverrides?, timeZone?)` calculates seven-day planning buckets, action queue, supply gaps, and portfolio metrics.
- `src/analytics/scenarios.ts`: `runScenario` applies global changes followed by one lane/equipment override, calls the same engine, and returns baseline/scenario metrics and action deltas. Inputs never mutate.
- `src/analytics/types.ts`: planning-bucket and action result contracts.
- `src/utils/`: date, grouping, median, clamping, and normalization helpers.
- `scripts/`: regeneration and human-readable scenario verification.
- `tests/`: independent formula/guard tests plus end-to-end assertions against the committed CSV files.

Example, outside UI rendering:

```ts
const validated = validateCsv(csvTextByDataset, analysisTime)
if (validated.data) {
  const baseline = analyze(validated.data, analysisTime)
  const comparison = runScenario(validated.data, analysisTime, {
    lane: {
      lane: 'Jeddah Islamic Port → Riyadh',
      equipment_type: 'Flatbed',
      demand: 0.25,
    },
  })
}
```

Explicit mappings can be passed as the fourth `validateCsv` argument, e.g. `{ upcoming: { planned_buy_rate: 'Carrier Rate' } }`. Ambiguous required mappings stay blocking until resolved. Pass `null` to explicitly leave an optional field unmapped (omitting a key retains automatic detection). Callers must use the validation boundary for raw input; `analyze` accepts already validated types and scenario-generated fractional quantities.

## Data contracts

| Dataset | Row grain | Unique key | Important constraints |
| --- | --- | --- | --- |
| `upcoming-loads.csv` | Load or identical commercial batch | `load_id` | Positive sell/buy rates; integer load count ≥1; past-due rows excluded; buy above sell allowed and flagged |
| `carrier-capacity.csv` | Non-overlapping carrier/lane/equipment/date block | `capacity_id` | Nonnegative integer trucks and deadhead; additive duplicate blocks warned |
| `historical-loads.csv` | One historical load | `load_id` | `fulfilled` is the fulfillment source of truth; blank service metrics excluded from denominators; assigned loads require positive final buy rate |
| `historical-offers.csv` | One carrier offer | `offer_id` | Positive offered buy rate; acceptance is explicitly observed, never inferred |
| `carrier-payments.csv` | Carrier exposure, optional | `carrier_id` | Nonnegative amounts; overdue ≤ open; exposure overlay only |

The full column contracts remain in specification §6 and `SCHEMAS`. Currency defaults to SAR; any mixed monetary currencies block analysis. Booleans accept `1/0`, `true/false`, `yes/no`. Required date fields are checked for real calendar dates. Invalid values do not silently become zero. Lane/equipment keys normalize case, whitespace, underscores and hyphens; `->` and `→` resolve to the same lane separator.

## Calculation philosophy

Planning grain is lane × equipment × local pickup date. Raw qualified capacity includes only active, matching, within-deadhead, sufficiently reliable rows. Reliability is exactly `0.50 × pickup OTD + 0.30 × delivery OTD + 0.20 × (1 − cancellation rate)`, clamped to [0,1]. Performance uses carrier/lane, then carrier overall, then marketplace averages, with the specified five-assignment guard.

Accepted-rate benchmarks use medians and the exact 30-day then 90-day segment hierarchy and sample guards. Five empirical rate bands determine acceptance, falling back to segment acceptance when a band has fewer than ten offers. The carrier-to-marketplace acceptance factor is guarded and clamped to [0.75,1.25]; modeled acceptance is clamped to [0.10,0.98]. No accepted-rate benchmark is fabricated.

Effective capacity is `Σ(trucks × modeled acceptance × reliability)`. It cannot exceed qualified physical capacity. Fulfillment is capped at demand; exposed load-equivalents cannot be negative. Portfolio fulfillment sums fulfilled load-equivalents, rather than averaging percentages or allowing surplus on one lane to fulfill another lane's shortage.

Commercial calculations weight rates by load counts. **Gross take-rate proxy** is `(sell revenue − planned carrier buy cost) / sell revenue`; it is only a demo gross-spread measure, not a real company's accounting definition or realized profit. **Modeled revenue exposure** is unfulfilled load-equivalents × weighted sell rate, not lost revenue.

Rate search evaluates unrounded rates at 1% increments from current through +20%, recalculating every carrier contribution and economics. It prefers the lowest commercially valid restoring rate, then the lowest valid material improvement if restoration is impossible. Output is a **Modeled rate scenario**, not an autonomous pricing instruction. Display suggestions round to SAR 25 without rounding calculations. Risk, cause precedence, action templates, action normalization and gap-score multipliers follow §§16–22.

Payment exposure never changes acceptance, reliability or capacity. It can only add a review action on a qualifying at-risk contribution. There is no assumption that payment status causes future capacity loss.

## Synthetic operating scenarios

The committed sample uses lane-specific SAR rate baselines, seeded within-lane price variation and carrier profiles. Twelve of 48 carriers serve multiple lanes, with matching execution and offer histories. Historical outcomes are stratified at carrier level and shuffled with seed 42 to avoid accidental all-good/all-bad thin samples; dates vary within the weekly demand envelope. Upcoming buckets contain commercially distinct batches. These are controlled synthetic operating patterns, not observed market quotes.

The committed sample contains 1,200 historical loads, 3,840 offers spanning the prior 90 days, 155 upcoming load-equivalents, 48 carriers, 12 lanes, five equipment types, seven customers and four business units. Geography and identities are illustrative; no company's operational data is used.

| Specification scenario | Expected detection and response |
| --- | --- |
| A — Port demand spike + pricing pressure | Exactly 35% weekly growth; qualified raw coverage ≥1, effective coverage <1; `PRICE_COMPETITIVENESS`, `RAISE_BUY_RATE`, separate `PREBOOK_CAPACITY` |
| B — Specialized physical shortage | Raw coverage <0.75, strong acceptance and reliable carriers; `SUPPLY_SHORTAGE`, `SECURE_CAPACITY`; first supply-gap rank |
| C — Commercial constraint | Restoring rates exist but all breach the floor; `COMMERCIAL_CONSTRAINT`, escalation, no rate-raise action |
| D — Concentration | Approximately 50% largest carrier contribution, spread across two additive blocks, otherwise healthy; backup-carrier action and separate Watch warning |
| E — Service-quality drag | Acceptance-adjusted coverage ≥1 but effective coverage <1; `SERVICE_QUALITY`, review reliable alternatives |
| F — Healthy controls | Seven groups, 84/155 loads (54.2%); effective coverage ≥1.20, no severe concentration, low/medium risk, no generated actions |

The task's A/B split port demand and pricing, C denotes physical shortage, and E denotes commercial constraint. Tests cover those named behaviors and also the specification's service-quality scenario, so no scenario is omitted because the letters differ.

`npm run verify:scenarios` first runs the planted-scenario assertions against disk CSVs and then prints calculated coverage, root causes, action types, KPIs and gap ranking. Reproducibility tests compare every committed CSV with seed-42 output. Scenario propagation tests also prove that +25% port demand creates physical-capacity actions, rate-band changes update acceptance and economics, and threshold changes do not mutate the baseline.

## Explicit interpretation choices and limitations

The carrier-level concentration correction below supersedes the original row-level interpretation of §15, as requested. No other formula or threshold was changed. The following unspecified or conflicting cases have explicit behavior:

1. **No usable history:** a wholly absent pickup/delivery denominator remains unavailable rather than being assigned a fabricated percentage. A row with unavailable reliability cannot qualify. If service is known but no historical offers exist, raw qualified capacity remains measurable; modeled acceptance is null, effective contribution is unquantifiable and omitted from the numeric sum, `estimate_available` is false, and a warning is returned. Numeric exposure in that case is conservative, not a fully estimated forecast. Known zero acceptance is distinct and uses the specified 0.10 clamp.
2. **Fallback windows:** carrier service and carrier/marketplace acceptance use all nonfuture supplied history; no additional lookback was specified for them. Pricing uses the configured windows. Date-only lookbacks include both calendar endpoints and exclude dates later than the local analysis date.
3. **Calendar convention:** complete weeks are Monday–Sunday. The first partially observed lane/equipment week is excluded; up to eight complete weeks are counted, including zero-demand weeks. Two complete weeks are required. The planning timezone defaults explicitly to `Asia/Riyadh` and is configurable; offset-less ISO datetimes use that timezone, not the machine timezone. Ambiguous local times at DST transitions should be supplied with an explicit offset.
4. **Date-only sample shifts:** pickup instants shift by exactly the analysis-time delta. History/payment calendar dates shift by the local calendar-day delta; capacity dates follow shifted pickup dates so an evening pickup crossing midnight retains its supply. Date-only fields cannot represent a sub-day delta. Complete-week baselines can vary slightly after shifting to another weekday. Uploaded dates never shift.
5. **Commercial precedence:** a commercial constraint requires at least one genuinely restoring higher-rate candidate, and all restoring candidates must breach the floor. Otherwise an empty set would incorrectly satisfy “every rate.” If a partial valid recommendation coexists with a commercial primary cause, the explicit scenario-C prohibition suppresses `RAISE_BUY_RATE`; escalation wins.
6. **Concentration:** sum effective contributions from all qualified blocks by carrier within each planning bucket, then divide each carrier total by bucket effective capacity. `capacity.carriers` exposes totals, shares and contributing capacity IDs; `capacity.contributions` retains individual rows. All risk, root-cause, concentration, backup-carrier and supply-gap calculations use that carrier-level top share. Payment exposure uses the same totals. Pair-level supply-gap concentration continues to use the maximum upcoming bucket share.
7. **Watch vs action severity:** an otherwise healthy concentrated bucket has a separate Watch warning. Its action severity still comes from the exact §21 priority formula. Fulfillment root causes are assigned only to buckets below 1.0 effective coverage; healthy contributors are retained as secondary context.
8. **Pair actions:** prebooking is emitted once per lane/equipment pair, anchored to its earliest upcoming bucket; its evidence includes the seven-day demand and baseline. Bucket exposure and urgency feed priority. Other action IDs are stable by type/bucket/carrier, enabling scenario action deltas.
9. **Empty demand:** zero-demand buckets are omitted. Empty-portfolio ratios are null, not artificial 0% or 100% fulfillment. Scenario demand/capacity remain decimal load-equivalents and clamp to nonnegative values. Scenario inputs are analytical API values; later UI controls must enforce the specification's user-control ranges.

Effective capacity is a planning model, not live availability. Capacity blocks assume no double counting or dynamic truck reuse across lanes. Rate-band relationships are empirical, not causal or ML, and need not be monotonic. There is no route feasibility, driver-hours, border/customs execution, payment execution, or live carrier integration. Supply-gap priority is a ranking heuristic, not a financial forecast.

CSV ingestion is browser-compatible and memory-only. The optional static sample loader reads local public assets; no operational data is sent to external services. There is no persistence, storage API, localStorage, cookie, or narration endpoint. The final polished application remains a separate implementation phase.

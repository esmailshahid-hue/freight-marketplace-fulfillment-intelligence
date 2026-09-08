# Freight Marketplace Fulfillment & Capacity Intelligence

Phase 1 implements the deterministic business logic described in [the product specification](docs/freight_marketplace_fulfillment_capacity_v1_spec.md). It answers whether upcoming freight demand has enough qualified physical capacity and enough modeled effective capacity, and identifies operational actions when it does not.

This is a synthetic portfolio prototype, not production-ready software. The React/Vite starter screen is intentionally unchanged. There is no dashboard, charting, authentication, database, external API, AI/LLM integration, tracking, routing, dispatch, OCR, TMS integration, or machine-learning model. The specification's later UI, export, and optional narration phases are not implemented or configured in this phase.

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
npm run dev              # existing starter only; no analytical UI yet
```

No credentials or environment secrets are required. The sample generator only writes `public/sample-data/`. Analytics perform no I/O and have no global mutable state.

## Modules and entrypoints

- `src/data/schemas.ts`: TypeScript contracts, executable field schemas, filenames.
- `src/data/mapping.ts`: controlled synonyms and conservative header matching.
- `src/data/validation.ts`: Papa Parse CSV ingestion, normalization, blocking errors, row warnings, temporal exclusion, currency checking. Returns `data: null` when any blocking error exists. Past-due and future historical rows are retained separately for later UI inspection.
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

Explicit mappings can be passed as the fourth `validateCsv` argument, e.g. `{ upcoming: { planned_buy_rate: 'Carrier Rate' } }`. Ambiguous mappings stay blocking until resolved; no mapping panel is built in this phase. Callers must use the validation boundary for raw input; `analyze` accepts already validated types and scenario-generated fractional quantities.

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

The committed sample contains 1,200 historical loads, 3,840 offers spanning the prior 90 days, 155 upcoming load-equivalents, 48 carriers, 12 lanes, five equipment types, seven customers and four business units. Geography and identities are illustrative; no company's operational data is used.

| Specification scenario | Expected detection and response |
| --- | --- |
| A — Port demand spike + pricing pressure | Exactly 35% weekly growth; qualified raw coverage ≥1, effective coverage <1; `PRICE_COMPETITIVENESS`, `RAISE_BUY_RATE`, separate `PREBOOK_CAPACITY` |
| B — Specialized physical shortage | Raw coverage <0.75, strong acceptance and reliable carriers; `SUPPLY_SHORTAGE`, `SECURE_CAPACITY`; first supply-gap rank |
| C — Commercial constraint | Restoring rates exist but all breach the floor; `COMMERCIAL_CONSTRAINT`, escalation, no rate-raise action |
| D — Concentration | 50% largest contribution, otherwise healthy; backup-carrier action and separate Watch warning |
| E — Service-quality drag | Acceptance-adjusted coverage ≥1 but effective coverage <1; `SERVICE_QUALITY`, review reliable alternatives |
| F — Healthy controls | Seven groups, 84/155 loads (54.2%); effective coverage ≥1.20, no severe concentration, low/medium risk, no generated actions |

The task's A/B split port demand and pricing, C denotes physical shortage, and E denotes commercial constraint. Tests cover those named behaviors and also the specification's service-quality scenario, so no scenario is omitted because the letters differ.

`npm run verify:scenarios` first runs the planted-scenario assertions against disk CSVs and then prints calculated coverage, root causes, action types, KPIs and gap ranking. Reproducibility tests compare every committed CSV with seed-42 output. Scenario propagation tests also prove that +25% port demand creates physical-capacity actions, rate-band changes update acceptance and economics, and threshold changes do not mutate the baseline.

## Explicit interpretation choices and limitations

No specified formula or threshold was changed. The following unspecified or conflicting cases have explicit behavior:

1. **No usable history:** a wholly absent pickup/delivery denominator remains unavailable rather than being assigned a fabricated percentage. A row with unavailable reliability cannot qualify. If service is known but no historical offers exist, raw qualified capacity remains measurable; modeled acceptance is null, effective contribution is unquantifiable and omitted from the numeric sum, `estimate_available` is false, and a warning is returned. Numeric exposure in that case is conservative, not a fully estimated forecast. Known zero acceptance is distinct and uses the specified 0.10 clamp.
2. **Fallback windows:** carrier service and carrier/marketplace acceptance use all nonfuture supplied history; no additional lookback was specified for them. Pricing uses the configured windows. Date-only lookbacks include both calendar endpoints and exclude dates later than the local analysis date.
3. **Calendar convention:** complete weeks are Monday–Sunday. The first partially observed lane/equipment week is excluded; up to eight complete weeks are counted, including zero-demand weeks. Two complete weeks are required. The planning timezone defaults explicitly to `Asia/Riyadh` and is configurable; offset-less ISO datetimes use that timezone, not the machine timezone. Ambiguous local times at DST transitions should be supplied with an explicit offset.
4. **Date-only sample shifts:** pickup instants shift by exactly the analysis-time delta. History/payment calendar dates shift by the local calendar-day delta; capacity dates follow shifted pickup dates so an evening pickup crossing midnight retains its supply. Date-only fields cannot represent a sub-day delta. Complete-week baselines can vary slightly after shifting to another weekday. Uploaded dates never shift.
5. **Commercial precedence:** a commercial constraint requires at least one genuinely restoring higher-rate candidate, and all restoring candidates must breach the floor. Otherwise an empty set would incorrectly satisfy “every rate.” If a partial valid recommendation coexists with a commercial primary cause, the explicit scenario-C prohibition suppresses `RAISE_BUY_RATE`; escalation wins.
6. **Concentration:** §15 explicitly calculates the maximum *capacity-row* share. That literal formula is retained, even when one carrier has multiple additive blocks. It can understate carrier-level concentration across split blocks. Payment contribution is summed by carrier. Pair-level supply-gap concentration uses the maximum upcoming bucket share because no pair aggregation rule is specified. These limitations are documented rather than silently changing the formulas.
7. **Watch vs action severity:** an otherwise healthy concentrated bucket has a separate Watch warning. Its action severity still comes from the exact §21 priority formula. Fulfillment root causes are assigned only to buckets below 1.0 effective coverage; healthy contributors are retained as secondary context.
8. **Pair actions:** prebooking is emitted once per lane/equipment pair, anchored to its earliest upcoming bucket; its evidence includes the seven-day demand and baseline. Bucket exposure and urgency feed priority. Other action IDs are stable by type/bucket/carrier, enabling scenario action deltas.
9. **Empty demand:** zero-demand buckets are omitted. Empty-portfolio ratios are null, not artificial 0% or 100% fulfillment. Scenario demand/capacity remain decimal load-equivalents and clamp to nonnegative values. Scenario inputs are analytical API values; later UI controls must enforce the specification's user-control ranges.

Effective capacity is a planning model, not live availability. Capacity blocks assume no double counting or dynamic truck reuse across lanes. Rate-band relationships are empirical, not causal or ML, and need not be monotonic. There is no route feasibility, driver-hours, border/customs execution, payment execution, or live carrier integration. Supply-gap priority is a ranking heuristic, not a financial forecast.

CSV ingestion is browser-compatible and memory-only. The optional static sample loader reads local public assets; no operational data is sent to external services. There is no persistence, storage API, localStorage, cookie, or narration endpoint. The later polished application remains a separate implementation phase.

# Freight Marketplace Fulfillment & Capacity Intelligence — v1 Build Specification

## 0. Mission & how to use this document

You are building a single, self-contained web application called **Freight Marketplace Fulfillment & Capacity Intelligence**.

The application is a portfolio MVP for a digital freight marketplace operations team. It analyzes upcoming shipper demand, declared/estimated carrier capacity, historical marketplace execution, and historical carrier-rate offers to answer one operating question:

> **Do we have enough realistically usable carrier capacity to fulfill upcoming freight demand at competitive carrier rates while preserving service and acceptable commercial economics? If not, what should Operations do next?**

The product must detect lane-level fulfillment risk, distinguish physical capacity shortage from pricing/service/concentration problems, quantify the operational and commercial exposure, and create a prioritized action queue. It must also support deterministic what-if scenarios for demand, capacity, carrier rates, and operating thresholds.

This is **not** a generic dashboard, TMS, dispatch system, or AI chatbot. The goal is a working, demo-ready decision-support product with transparent business logic.

When this specification gives an exact formula, threshold, schema, file name, status, or rule, implement it as written unless a later section explicitly overrides it.

Do not add functionality merely because it appears useful. V1 is intentionally constrained.

---

## 1. Product positioning

**Product name:** Freight Marketplace Fulfillment & Capacity Intelligence

**Subtitle:** Anticipates fulfillment risk across upcoming freight demand and recommends capacity, pricing and carrier actions while protecting service and commercial economics.

**Primary user:** Head of Operations / Marketplace Operations Lead

**Secondary users:**
- Supply / Fulfillment Manager
- Carrier Operations Manager
- Pricing / Commercial Manager
- Control Tower Lead
- Country Operations Manager

The product must be framed as a **generic freight-marketplace decision-support tool**. Do not use Trella branding, Trella logos, Trella proprietary terminology, or any wording that implies access to Trella internal data or systems.

---

## 2. Tech stack & hard constraints

### 2.1 Required stack

- **React 18+**
- **TypeScript**
- **Vite**
- **Papa Parse** or equivalent lightweight CSV parser
- A lightweight charting library such as **Recharts**
- **Vitest** for deterministic analytics tests
- One small **Vercel serverless function** for optional LLM-generated prose
- Plain CSS / CSS modules or a minimal utility approach; do not introduce a large UI framework unless necessary

### 2.2 Architecture principle

Enforce strict separation between:

1. **Data parsing / validation**
2. **Deterministic analytics**
3. **Decision / action rules**
4. **Scenario simulation**
5. **UI rendering**
6. **Optional LLM narration**

The LLM must never calculate fulfillment, capacity, rate benchmarks, acceptance probabilities, commercial metrics, risk scores, root causes, or action priorities.

### 2.3 Hard constraints — do NOT add any of these in v1

- No GPS or live vehicle tracking
- No route optimization
- No truck-to-load dispatch engine
- No multi-stop routing
- No driver-hours / HOS engine
- No customs workflow
- No OCR
- No POD / ePOD
- No invoice processing
- No carrier payment execution
- No real carrier APIs
- No TMS / ERP integration
- No authentication
- No user accounts
- No database
- No persistence between sessions
- No machine-learning model training
- No black-box AI risk scoring
- No multi-agent architecture
- No automated rate negotiation
- No automated carrier outreach
- No autonomous operational action
- No attempt to recreate Bosla, Sirb, or any named third-party product
- No broad "AI freight platform" positioning
- Do not invest in visual polish before analytics and scenario behavior are correct

---

## 3. Repo structure

Use the following structure unless a technical reason requires a minor deviation:

```text
freight-marketplace-intelligence/
├── src/
│   ├── components/
│   ├── pages/
│   │   ├── OperationsQueue.tsx
│   │   ├── CapacityFulfillment.tsx
│   │   ├── PricingEconomics.tsx
│   │   ├── SupplyGaps.tsx
│   │   └── ScenarioLab.tsx
│   ├── analytics/
│   │   ├── types.ts
│   │   ├── history.ts
│   │   ├── pricing.ts
│   │   ├── reliability.ts
│   │   ├── capacity.ts
│   │   ├── fulfillment.ts
│   │   ├── risk.ts
│   │   ├── rootCause.ts
│   │   ├── actions.ts
│   │   ├── supplyGaps.ts
│   │   └── scenarios.ts
│   ├── data/
│   │   ├── schemas.ts
│   │   ├── mapping.ts
│   │   ├── validation.ts
│   │   └── sampleLoader.ts
│   ├── utils/
│   ├── App.tsx
│   └── main.tsx
├── public/
│   └── sample-data/
│       ├── upcoming-loads.csv
│       ├── carrier-capacity.csv
│       ├── historical-loads.csv
│       ├── historical-offers.csv
│       ├── carrier-payments.csv
│       └── sample-metadata.json
├── scripts/
│   └── generate-sample-data.ts
├── api/
│   └── operations-brief.ts
├── tests/
│   ├── pricing.test.ts
│   ├── reliability.test.ts
│   ├── capacity.test.ts
│   ├── risk.test.ts
│   ├── actions.test.ts
│   └── scenarios.test.ts
├── .env.example
├── README.md
├── package.json
└── vite.config.ts
```

All analytics modules must be pure functions. They must not read files, call APIs, mutate global state, or call the LLM.

---

## 4. Analysis grain & terminology

### 4.1 Planning grain

The primary analytical grain is:

**lane × equipment_type × pickup_date**

Where:

- `lane` = `origin → destination`
- `pickup_date` = local calendar date extracted from `pickup_datetime`

V1 intentionally uses daily planning buckets rather than continuous route scheduling.

### 4.2 Important definitions

- **Upcoming demand** = sum of `load_count` for future loads in a planning bucket.
- **Raw qualified capacity** = physical truck capacity that meets the lane/equipment/date/deadhead/activity requirements.
- **Effective capacity** = raw qualified capacity adjusted for expected carrier acceptance and service reliability.
- **Effective capacity coverage** = effective capacity / upcoming demand.
- **Projected fulfillment** = minimum of demand and effective capacity.
- **Expected unfulfilled load-equivalents** = max(demand - effective capacity, 0).
- **Gross take-rate proxy** = `(sell revenue - planned carrier buy cost) / sell revenue`.

The phrase **take-rate proxy** must always be used in the UI. Never label it simply "Trella take rate" or imply it matches any company's internal accounting definition.

---

## 5. Required input datasets

V1 uses **four required CSV files** plus **one optional file**.

1. `upcoming-loads.csv` — required
2. `carrier-capacity.csv` — required
3. `historical-loads.csv` — required
4. `historical-offers.csv` — required
5. `carrier-payments.csv` — optional

The built-in demo must load all five sample files automatically.

Uploaded data stays in browser memory only.

---

# 6. Data contracts

## 6.1 Upcoming loads — `upcoming-loads.csv`

One row represents one upcoming load or a batch of commercially identical loads.

| Column | Type | Required | Rules |
|---|---|---:|---|
| `load_id` | string | Yes | Unique within file |
| `customer` | string | Yes | Non-blank |
| `business_unit` | string | Yes | Free text |
| `origin` | string | Yes | Non-blank |
| `destination` | string | Yes | Non-blank |
| `lane` | string | No | If blank, compute `origin → destination` |
| `pickup_datetime` | ISO-8601 datetime | Yes | Must parse successfully |
| `equipment_type` | string | Yes | Non-blank |
| `sell_rate` | number | Yes | > 0 |
| `planned_buy_rate` | number | Yes | > 0; may exceed sell rate |
| `priority` | enum | Yes | `Standard`, `High`, `Critical` |
| `load_count` | integer | Yes | >= 1 |
| `currency` | string | No | Default `SAR` |

### Upcoming-load rules

- A past pickup is not silently analyzed as future demand.
- If `pickup_datetime < analysis_time`, classify the row as **Past Due**, show it in a validation banner, exclude it from projected fulfillment and scenario KPIs, and keep it visible in a small "Past-due rows" table.
- Duplicate `load_id` values are blocking validation errors.
- `planned_buy_rate > sell_rate` is allowed but must be visibly flagged as negative gross spread.
- `load_count` must be a whole number.

---

## 6.2 Carrier capacity — `carrier-capacity.csv`

One row represents non-overlapping declared or estimated capacity for one carrier on one lane/equipment/date.

| Column | Type | Required | Rules |
|---|---|---:|---|
| `capacity_id` | string | Yes | Unique |
| `carrier_id` | string | Yes | Non-blank |
| `carrier_name` | string | Yes | Non-blank |
| `lane` | string | Yes | Exact normalized lane key |
| `equipment_type` | string | Yes | Exact normalized equipment key |
| `capacity_date` | date | Yes | `YYYY-MM-DD` |
| `available_trucks` | integer | Yes | >= 0 |
| `deadhead_km_to_origin` | number | Yes | >= 0 |
| `active` | boolean | Yes | Accept `1/0`, `true/false`, `yes/no` |
| `contract_status` | enum | Yes | `Preferred`, `Contract`, `Spot` |

### Capacity rules

- Capacity rows are additive by design.
- The file contract assumes each row represents a non-overlapping capacity block.
- If the same `carrier_id + lane + equipment_type + capacity_date` appears more than once, keep all rows but show a warning: **Possible duplicated capacity blocks — confirm these rows are additive.**
- `available_trucks = 0` is valid.
- Negative capacity or deadhead is a blocking error.

---

## 6.3 Historical loads — `historical-loads.csv`

One row per historical load. This dataset is used for demand history, historical fulfillment, service reliability, supply-gap recurrence, and lane execution context.

| Column | Type | Required | Rules |
|---|---|---:|---|
| `load_id` | string | Yes | Unique within file |
| `date` | date | Yes | Historical date |
| `customer` | string | Yes | Non-blank |
| `business_unit` | string | Yes | Free text |
| `origin` | string | Yes | Non-blank |
| `destination` | string | Yes | Non-blank |
| `lane` | string | No | Compute if blank |
| `equipment_type` | string | Yes | Non-blank |
| `carrier_id` | string | No | May be blank for unassigned/unfulfilled loads |
| `sell_rate` | number | Yes | > 0 |
| `final_buy_rate` | number | No | Blank if never assigned; otherwise > 0 |
| `fulfilled` | boolean | Yes | Parse common boolean representations |
| `pickup_ontime` | boolean | No | Blank if not applicable |
| `delivery_ontime` | boolean | No | Blank if not applicable |
| `cancelled` | boolean | Yes | Parse common boolean representations |
| `failure_reason` | string | No | Free text/category |
| `currency` | string | No | Default `SAR` |

### Historical-load rules

- Duplicate `load_id` is a blocking error.
- Historical loads later than `analysis_time` are excluded and warned.
- For `fulfilled = false`, `carrier_id` may be blank.
- If `cancelled = true`, the load counts as not fulfilled unless `fulfilled = true`; if contradictory, flag the row as inconsistent and use `fulfilled` as source of truth for fulfillment calculations.
- Pickup and delivery reliability calculations exclude blank metrics from their respective denominators.

---

## 6.4 Historical offers — `historical-offers.csv`

One row per carrier-rate offer. Multiple offers may exist for the same historical load.

| Column | Type | Required | Rules |
|---|---|---:|---|
| `offer_id` | string | Yes | Unique |
| `load_id` | string | No | Optional link to historical load |
| `date` | date | Yes | Historical date |
| `lane` | string | Yes | Non-blank |
| `equipment_type` | string | Yes | Non-blank |
| `carrier_id` | string | Yes | Non-blank |
| `offered_buy_rate` | number | Yes | > 0 |
| `accepted` | boolean | Yes | Common boolean representations |
| `sell_rate` | number | No | > 0 if supplied |
| `currency` | string | No | Default `SAR` |

### Historical-offer rules

- Duplicate `offer_id` is a blocking error.
- Historical offers later than `analysis_time` are excluded and warned.
- An offer may be rejected even when its rate is high; do not infer reasons.
- V1 treats acceptance as an empirical relationship, not a causal model.

---

## 6.5 Optional carrier payments — `carrier-payments.csv`

| Column | Type | Required | Rules |
|---|---|---:|---|
| `carrier_id` | string | Yes | Unique |
| `open_payable` | number | Yes | >= 0 |
| `overdue_payable` | number | Yes | >= 0 and <= open payable |
| `max_days_overdue` | integer | Yes | >= 0 |
| `last_payment_date` | date | No | Optional |
| `payment_status` | enum | Yes | `Current`, `Watch`, `Overdue` |
| `currency` | string | No | Default `SAR` |

Payment data never changes carrier capacity or acceptance probability in v1. It is an **exposure overlay only**.

Do not infer that overdue payment causes carrier churn or lower acceptance.

---

## 7. Currency rule

V1 supports a **single currency per analysis session**.

- Default sample currency: `SAR`.
- All monetary rows across all uploaded files must resolve to the same currency.
- If multiple currencies are detected, block analysis with: **V1 supports one currency per analysis. Convert rates to a common currency before upload.**
- Do not perform FX conversion.

---

## 8. Column mapping & normalization

Implement the same usability principle as the Supply Chain Workbench:

- case-insensitive matching
- trim leading/trailing whitespace
- normalize spaces, underscores, and hyphens
- normalize repeated whitespace
- recognize a controlled synonym dictionary
- automatically resolve only high-confidence matches
- open a compact mapping panel for ambiguous or missing required fields
- never modify the user's uploaded file

Examples:

- `truck_type`, `vehicle_type` → `equipment_type`
- `buy_price`, `carrier_rate` → `planned_buy_rate` or `offered_buy_rate` depending on dataset
- `shipper`, `client` → `customer`
- `qty`, `loads` → `load_count`
- `vendor_id` → `carrier_id`

Do not use an LLM for column mapping in v1.

---

# 9. Sample-data generator

## 9.1 Purpose

The application must be compelling with no user upload. Build a deterministic synthetic data generator with a fixed random seed.

The sample must contain realistic healthy behavior and planted operational problems that produce every major action type.

## 9.2 Sample scale

Generate approximately:

- **1,200 historical loads** over the prior 90 days
- **3,500–5,000 historical carrier offers** over the prior 90 days
- **140–180 upcoming load-equivalents** across the next 7 days
- **45–60 carriers**
- **12–15 lanes**
- **4–5 equipment types**
- **6–8 customers**
- **4 business units**: `Domestic`, `Ports`, `Projects`, `Cross-Border`

Use Saudi-style sample geography such as:

- Jeddah
- Jeddah Islamic Port
- Riyadh
- Dammam
- Jubail
- Tabuk / NEOM region
- selected generic cross-border destination labels

These are synthetic operating scenarios only. Do not imply they represent any company's actual network.

## 9.3 Stable demo dates

`sample-metadata.json` must contain:

```json
{
  "sample_as_of": "2026-09-07T08:00:00+03:00",
  "currency": "SAR",
  "seed": 42
}
```

When built-in sample data is loaded, shift all sample dates by the same delta between `sample_as_of` and the browser's current analysis time so that:

- historical records remain historical
- upcoming loads remain in the next seven days
- planted scenarios remain temporally coherent

Never shift user-uploaded data.

## 9.4 Normal baseline behavior

Most lane/equipment/date groups should be healthy:

- historical fulfillment generally 90–96%
- carrier pickup OTD generally 90–97%
- delivery OTD generally 88–96%
- cancellation generally 2–8%
- current planned carrier rates near historically accepted medians
- effective capacity coverage generally 1.15–1.45 on healthy groups

Do not make the entire sample red.

## 9.5 Required planted scenarios

Plant all of the following.

### Scenario A — Port demand spike + pricing pressure

A high-volume Jeddah-port-origin flatbed lane receives approximately **30–40% more upcoming weekly demand** than its recent historical weekly average.

Physical capacity should be near or above demand, but the current planned buy rate should sit in a historically weak acceptance band.

Expected result:

- raw coverage >= 1.0
- effective coverage < 1.0
- root cause: `PRICE_COMPETITIVENESS`
- action: `RAISE_BUY_RATE` if a commercially valid rate exists
- separate action: `PREBOOK_CAPACITY` because demand is >25% above baseline

### Scenario B — True specialized-equipment shortage

A Projects lane using specialized equipment should have:

- raw physical coverage < 0.75
- strong historical acceptance at current rate
- acceptable carrier reliability

Expected result:

- root cause: `SUPPLY_SHORTAGE`
- action: `SECURE_CAPACITY`
- supply-gap page ranks this lane near the top

### Scenario C — Commercial constraint

A lane should have enough physical capacity, but the rate increase needed to restore effective coverage to at least 1.0 would push the modeled gross take-rate proxy below the configured commercial floor.

Expected result:

- root cause: `COMMERCIAL_CONSTRAINT`
- no `RAISE_BUY_RATE` action
- action: `ESCALATE_COMMERCIAL_CONSTRAINT`

### Scenario D — Carrier concentration

One lane/equipment group should rely on one carrier for approximately **45–55% of effective capacity**.

Expected result:

- concentration risk elevated
- action: `ACTIVATE_BACKUP_CARRIERS`
- if the group is otherwise healthy, show a Watch-level concentration warning rather than forcing a fulfillment crisis

### Scenario E — Service-quality drag

A group should have adequate raw capacity and reasonable historical rate acceptance, but poor pickup/delivery/cancellation performance should reduce effective capacity below 1.0 coverage.

Expected result:

- root cause: `SERVICE_QUALITY`
- action should favor alternate/reliable capacity rather than rate increase

### Scenario F — Healthy controls

At least 40% of upcoming demand must sit in groups with:

- effective coverage >= 1.20
- no severe concentration
- reasonable rate competitiveness
- low/medium risk

This prevents the sample from looking artificially engineered.

---

# 10. Configurable thresholds

Put all defaults in one config module and expose the user-adjustable ones in a compact settings drawer.

```ts
MAX_DEADHEAD_KM = 150
MIN_RELIABILITY = 0.75
MIN_PERFORMANCE_SAMPLES = 5
RATE_LOOKBACK_DAYS = 30
RATE_FALLBACK_LOOKBACK_DAYS = 90
MIN_ACCEPTED_RATE_SAMPLES = 5
MIN_RATE_BAND_SAMPLES = 10
MIN_GLOBAL_RATE_SAMPLES = 20
COMMERCIAL_FLOOR = 0.10
DEMAND_SPIKE_THRESHOLD = 0.25
CONCENTRATION_WARNING = 0.35
CONCENTRATION_HIGH = 0.45
RATE_RECOMMENDATION_MAX_INCREASE = 0.20
RATE_SEARCH_INCREMENT = 0.01
MIN_MATERIAL_COVERAGE_IMPROVEMENT = 0.10
```

### Capacity status thresholds

```ts
HEALTHY_COVERAGE = 1.20
WATCH_COVERAGE = 1.00
AT_RISK_COVERAGE = 0.75
```

Status:

- `Healthy` if coverage >= 1.20
- `Watch` if 1.00 <= coverage < 1.20
- `At Risk` if 0.75 <= coverage < 1.00
- `Critical` if coverage < 0.75

### Fulfillment-risk bands

```ts
CRITICAL_RISK = 75
HIGH_RISK = 60
MEDIUM_RISK = 40
```

- `Critical` >= 75
- `High` 60–74.99
- `Medium` 40–59.99
- `Low` < 40

---

# 11. Historical performance engine

## 11.1 Carrier service metrics

For each `carrier_id + lane`, using historical loads:

### Pickup OTD

```text
pickup_ontime_pct = pickup_ontime_true / nonblank_pickup_ontime_rows
```

### Delivery OTD

```text
delivery_ontime_pct = delivery_ontime_true / nonblank_delivery_ontime_rows
```

### Cancellation rate

```text
cancellation_rate = cancelled_true / assigned_loads
```

Where `assigned_loads` = rows with nonblank `carrier_id`.

## 11.2 Performance fallback hierarchy

Use lane-specific performance only if the carrier has at least `MIN_PERFORMANCE_SAMPLES` assigned historical loads on that lane.

Fallback in this order:

1. carrier + lane
2. carrier across all lanes
3. marketplace-wide service averages

Every capacity row must retain a field showing which source was used:

- `carrier_lane`
- `carrier_overall`
- `marketplace_fallback`

## 11.3 Reliability factor

For valid inputs represented as decimals:

```text
reliability_factor =
    0.50 × pickup_ontime_pct
  + 0.30 × delivery_ontime_pct
  + 0.20 × (1 - cancellation_rate)
```

Clamp to `[0, 1]`.

A carrier is excluded from **qualified capacity** if `reliability_factor < MIN_RELIABILITY`.

Still show excluded capacity in drilldown as **Failed reliability threshold**.

---

# 12. Historical pricing engine

## 12.1 Accepted-rate benchmark

For each upcoming `lane + equipment_type`, find historical accepted offers within `RATE_LOOKBACK_DAYS`.

Benchmark-source hierarchy:

1. same `lane + equipment_type`, at least `MIN_ACCEPTED_RATE_SAMPLES` accepted offers
2. same `lane`, all equipment, at least `MIN_ACCEPTED_RATE_SAMPLES`
3. same `equipment_type`, all lanes, at least `MIN_RATE_BAND_SAMPLES`
4. global accepted offers, at least `MIN_GLOBAL_RATE_SAMPLES`

If the 30-day window fails, repeat the hierarchy using `RATE_FALLBACK_LOOKBACK_DAYS = 90`.

If no level is sufficient, pricing benchmark is **Unavailable**. Physical capacity analysis must still work, but:

- no rate-index metric
- no modeled acceptance from rate bands
- no rate-increase recommendation
- use historical carrier acceptance fallback only for effective-capacity estimation
- clearly mark pricing confidence as unavailable

### Benchmark formula

```text
median_accepted_buy_rate = median(offered_buy_rate where accepted = true)
```

## 12.2 Rate index

```text
rate_index = planned_buy_rate / median_accepted_buy_rate
```

## 12.3 Rate bands

Use exactly these bands:

- `< 0.90`
- `0.90–<0.97`
- `0.97–<1.03`
- `1.03–<1.10`
- `>= 1.10`

For every historical offer in the chosen benchmark segment:

```text
historical_rate_index = offered_buy_rate / segment_median_accepted_buy_rate
```

Then:

```text
band_acceptance_pct = accepted_offers_in_band / all_offers_in_band
```

Use a band-specific acceptance rate only when the band has at least `MIN_RATE_BAND_SAMPLES` offers.

If the selected band is thin, fallback to the overall acceptance rate for the chosen benchmark segment.

## 12.4 Carrier acceptance factor

From historical offers:

```text
carrier_acceptance_pct = accepted_offers_for_carrier / offers_for_carrier
marketplace_acceptance_pct = accepted_offers_all_carriers / offers_all_carriers
carrier_acceptance_factor = carrier_acceptance_pct / marketplace_acceptance_pct
```

Use the carrier factor only if the carrier has at least `MIN_RATE_BAND_SAMPLES` historical offers.

Otherwise `carrier_acceptance_factor = 1.0`.

Clamp factor to:

```text
0.75 <= carrier_acceptance_factor <= 1.25
```

## 12.5 Expected carrier acceptance

For each qualified carrier-capacity row:

```text
expected_acceptance =
  clamp(
    selected_band_acceptance_pct × carrier_acceptance_factor,
    0.10,
    0.98
  )
```

If pricing benchmark is unavailable:

- use the carrier's historical overall acceptance if sufficiently sampled;
- otherwise use marketplace overall acceptance;
- mark `acceptance_source = fallback_no_rate_benchmark`.

Never describe this as causal or predictive ML. In UI use wording such as **Modeled acceptance based on historical rate/acceptance behavior**.

---

# 13. Capacity engine

## 13.1 Qualified capacity

A capacity row qualifies for an upcoming planning bucket only if all are true:

1. `active = true`
2. exact normalized `lane` match
3. exact normalized `equipment_type` match
4. `capacity_date = pickup_date`
5. `deadhead_km_to_origin <= MAX_DEADHEAD_KM`
6. `reliability_factor >= MIN_RELIABILITY`

### Raw qualified capacity

```text
raw_qualified_capacity = Σ available_trucks
```

## 13.2 Effective capacity

For every qualified carrier-capacity row:

```text
carrier_effective_capacity =
  available_trucks × expected_acceptance × reliability_factor
```

Then:

```text
effective_capacity = Σ carrier_effective_capacity
```

Invariant:

```text
effective_capacity <= raw_qualified_capacity
```

If not, fail the test suite.

## 13.3 Capacity coverage

For every planning bucket:

```text
raw_capacity_coverage = raw_qualified_capacity / upcoming_loads

effective_capacity_coverage = effective_capacity / upcoming_loads
```

If `upcoming_loads = 0`, do not create a planning bucket.

## 13.4 Expected unfulfilled load-equivalents

```text
expected_unfulfilled = max(upcoming_loads - effective_capacity, 0)
```

Display one decimal in analytics tables.

For operational prose, round to the nearest whole load and say **approximately**.

## 13.5 Projected fulfilled load-equivalents

```text
projected_fulfilled = min(upcoming_loads, effective_capacity)
```

Portfolio projected fulfillment:

```text
projected_fulfillment_pct =
  Σ projected_fulfilled / Σ upcoming_loads
```

Label this exactly:

**Projected fulfillment based on current modeled capacity**

---

# 14. Commercial economics

## 14.1 Group revenue and planned buy cost

For each planning bucket:

```text
group_sell_revenue = Σ (sell_rate × load_count)

group_planned_buy_cost = Σ (planned_buy_rate × load_count)
```

## 14.2 Gross spread

```text
gross_spread = group_sell_revenue - group_planned_buy_cost
```

## 14.3 Gross take-rate proxy

```text
gross_take_rate_proxy = gross_spread / group_sell_revenue
```

If sell revenue <= 0, validation should already have failed.

The UI label must be:

**Gross take-rate proxy**

Tooltip:

> Demo measure calculated as (sell revenue - carrier buy cost) / sell revenue. Actual marketplace accounting definitions may differ.

## 14.4 Revenue exposure

For each planning bucket:

```text
avg_sell_rate_per_load = group_sell_revenue / upcoming_loads

revenue_exposure = expected_unfulfilled × avg_sell_rate_per_load
```

Label:

**Modeled revenue exposure**

Do not label it lost revenue.

---

# 15. Concentration engine

For every qualified capacity row:

```text
carrier_effective_share = carrier_effective_capacity / effective_capacity
```

Then:

```text
top_carrier_share = max(carrier_effective_share)
```

If effective capacity is zero, set top-carrier share to 0 and show `No effective capacity`.

Concentration statuses:

- `< 0.35` = Normal
- `0.35–<0.45` = Watch
- `>= 0.45` = High

---

# 16. Fulfillment-risk engine

## 16.1 Capacity-risk component

```text
capacity_risk =
  clamp(
    ((1.20 - effective_capacity_coverage) / 0.70) × 100,
    0,
    100
  )
```

This maps:

- coverage >= 1.20 → 0 risk
- coverage 0.50 or below → 100 risk

## 16.2 Pickup-urgency component

Use the earliest pickup time within the planning bucket.

```text
hours_to_pickup = earliest_pickup_datetime - analysis_time
```

Urgency score:

- `< 12 hours` → 100
- `12–<24` → 80
- `24–<48` → 60
- `48–<72` → 35
- `>=72` → 10

## 16.3 Weighted expected acceptance

```text
weighted_expected_acceptance =
  Σ (available_trucks × expected_acceptance)
  / Σ available_trucks
```

Use qualified capacity rows only.

If raw qualified capacity is zero, set acceptance to 0.

## 16.4 Rate-risk component

```text
rate_risk = 100 × (1 - weighted_expected_acceptance)
```

Clamp 0–100.

## 16.5 Concentration-risk component

Use:

- top share < 0.25 → 10
- 0.25–<0.35 → 30
- 0.35–<0.45 → 60
- >= 0.45 → 90

## 16.6 Final fulfillment-risk score

```text
fulfillment_risk_score =
    0.45 × capacity_risk
  + 0.20 × pickup_urgency
  + 0.20 × rate_risk
  + 0.15 × concentration_risk
```

Clamp 0–100.

## 16.7 Risk reason string

Every Medium/High/Critical result must generate a deterministic reason string using the top 2–3 contributing factors.

Example:

> High risk because effective capacity covers only 78% of demand, pickup is within 18 hours, and the current carrier rate falls in a historically low-acceptance band.

The reason string must come from rule-based templates, not from the LLM.

---

# 17. Root-cause engine

Every `At Risk` or `Critical` planning bucket must receive one primary root cause plus zero or more secondary contributors.

## 17.1 Helper metrics

### Acceptance-adjusted capacity before reliability

```text
acceptance_adjusted_capacity =
  Σ (available_trucks × expected_acceptance)
```

```text
acceptance_adjusted_coverage =
  acceptance_adjusted_capacity / upcoming_loads
```

### Rate-solution test

Run the rate recommendation search from Section 19 before final root-cause classification.

## 17.2 Root-cause rules

Apply this precedence order:

### 1. `COMMERCIAL_CONSTRAINT`

Use when:

- raw coverage >= 1.0
- effective coverage < 1.0
- there exists a simulated higher buy rate within +20% that materially improves coverage, but every rate that achieves coverage >=1.0 breaches `COMMERCIAL_FLOOR`

### 2. `SUPPLY_SHORTAGE`

Use when:

```text
raw_capacity_coverage < 1.0
```

### 3. `PRICE_COMPETITIVENESS`

Use when all are true:

- raw coverage >= 1.0
- effective coverage < 1.0
- weighted expected acceptance < 0.70
- a commercially valid higher-rate scenario improves effective coverage by at least `MIN_MATERIAL_COVERAGE_IMPROVEMENT`

### 4. `SERVICE_QUALITY`

Use when:

- acceptance-adjusted coverage >= 1.0
- effective coverage < 1.0

Meaning physical capacity and modeled acceptance are sufficient before service reliability is applied.

### 5. `CARRIER_CONCENTRATION`

Use when:

- top carrier share >= 0.45
- no stronger cause above applies

### 6. `LATE_BOOKING`

Use when:

- hours to pickup < 24
- no stronger cause above applies

### 7. `MIXED`

Use when none of the above cleanly explains the result.

Secondary contributors may include any triggered condition regardless of primary cause.

---

# 18. Historical demand baseline

Use historical loads to calculate demand baselines by `lane + equipment_type`.

## 18.1 Weekly baseline

Use the prior 8 complete weeks when available.

```text
historical_avg_weekly_loads =
  total historical load count over prior 8 complete weeks / number_of_weeks
```

If fewer than 4 complete weeks exist, use the available complete weeks.

If fewer than 2 complete weeks exist, demand-spike detection is unavailable for that lane/equipment pair.

## 18.2 Upcoming weekly demand

```text
upcoming_7d_loads =
  sum(load_count where pickup_datetime <= analysis_time + 7 days)
```

## 18.3 Demand growth

```text
demand_growth_pct =
  upcoming_7d_loads / historical_avg_weekly_loads - 1
```

Demand spike:

```text
demand_growth_pct >= DEMAND_SPIKE_THRESHOLD
```

Default threshold = +25%.

---

# 19. Rate recommendation engine

This engine finds the lowest group-level buy-rate increase that materially improves fulfillment while respecting the commercial floor.

## 19.1 Candidate rate grid

For a planning bucket:

```text
current_group_buy_rate = weighted average planned_buy_rate by load_count
```

Generate candidate rates from current rate through +20% in 1% increments:

```text
candidate_multiplier = 1.00, 1.01, 1.02, ... 1.20
candidate_buy_rate = current_group_buy_rate × candidate_multiplier
```

Round each displayed rate to nearest SAR 25 for the sample/demo UI, but use the unrounded candidate for calculations.

## 19.2 Recalculate at every candidate

For each candidate:

1. recompute rate index
2. choose rate band
3. recompute expected carrier acceptance for every qualified carrier
4. recompute effective capacity
5. recompute effective capacity coverage
6. recompute group buy cost
7. recompute gross take-rate proxy

## 19.3 Commercially valid candidate

A candidate is commercially valid when:

```text
gross_take_rate_proxy >= COMMERCIAL_FLOOR
```

## 19.4 Recommended candidate

Select the **lowest** candidate rate that satisfies either:

### Preferred target

```text
effective_capacity_coverage >= 1.0
```

OR, if no valid candidate reaches 1.0:

### Material improvement target

```text
candidate_coverage - current_coverage >= MIN_MATERIAL_COVERAGE_IMPROVEMENT
```

If no candidate within +20% is commercially valid and materially improves coverage, return no rate recommendation.

## 19.5 Rate recommendation output

Return:

- current buy rate
- recommended buy rate
- rate increase %
- current modeled acceptance
- new modeled acceptance
- current effective coverage
- new effective coverage
- current gross take-rate proxy
- new gross take-rate proxy
- commercial floor

Never present the recommendation as an autonomous pricing decision. Label it **Modeled rate scenario**.

---

# 20. Deterministic action engine

The action queue is the core product. Charts are secondary.

Every action object must contain:

```ts
{
  action_id,
  action_type,
  severity,
  lane,
  equipment_type,
  pickup_date,
  loads_exposed,
  risk_score,
  root_cause,
  modeled_revenue_exposure,
  evidence: string[],
  recommended_action: string,
  action_priority_score
}
```

## 20.1 Action types

### A. `RAISE_BUY_RATE`

Trigger when:

- current effective coverage < 1.0
- raw coverage >= 1.0
- rate recommendation engine finds a commercially valid rate
- recommended rate improves coverage by >= 0.10 or reaches >=1.0

Template:

> Model a carrier buy-rate increase from SAR X to approximately SAR Y. Historical rate/acceptance behavior suggests modeled acceptance could move from A% to B%, improving effective capacity coverage from C% to D% while keeping the gross take-rate proxy above the configured floor.

### B. `SECURE_CAPACITY`

Trigger when:

```text
raw_capacity_coverage < 1.0
```

Required additional physical trucks:

```text
additional_trucks_needed = ceil(upcoming_loads - raw_qualified_capacity)
```

Template:

> Secure approximately X additional qualified trucks for this lane/equipment/date. Current physical capacity covers only Y% of upcoming demand, so price changes alone cannot close the gap.

### C. `ACTIVATE_BACKUP_CARRIERS`

Trigger when:

- top carrier share >= 0.45
- upcoming loads >= 5

Template:

> Activate backup carrier capacity. The largest carrier represents X% of modeled effective capacity for Y upcoming loads.

### D. `ESCALATE_COMMERCIAL_CONSTRAINT`

Trigger when primary root cause = `COMMERCIAL_CONSTRAINT`.

Template:

> Escalate the commercial trade-off. The rate increase needed to restore modeled coverage would push the gross take-rate proxy below the configured floor. Review shipper pricing, service commitment, or alternate capacity rather than raising carrier rates automatically.

### E. `PREBOOK_CAPACITY`

Trigger when:

- demand growth >= +25%
- upcoming 7-day loads >= 5

Template:

> Pre-book incremental carrier capacity. Upcoming 7-day demand is X% above the recent weekly baseline on this lane/equipment combination.

### F. `REVIEW_SERVICE_QUALITY`

Trigger when primary root cause = `SERVICE_QUALITY`.

Template:

> Shift planned volume toward more reliable qualified carriers or secure backup capacity. Physical supply is adequate before service reliability is applied, but reliability-adjusted capacity falls below demand.

### G. `REVIEW_PAYMENT_EXPOSURE` — optional overlay

Trigger only when payment file exists and:

- payment_status = `Overdue`
- overdue payable > 0
- carrier supplies >= 15% of effective capacity on any At Risk/Critical bucket

Template:

> Review payment exposure for Carrier X. It contributes Y% of modeled effective capacity on an at-risk lane and currently has SAR Z overdue. This is an operational relationship flag only; v1 does not assume payment status causes capacity loss.

---

# 21. Action-priority score

Calculate only across active generated actions.

## 21.1 Normalization

For `loads_exposed` and `modeled_revenue_exposure`, use min-max normalization across the current action set:

```text
norm(x) = 100 × (x - min) / (max - min)
```

If all values are equal and >0, assign 50.
If all are zero, assign 0.

Use the existing 0–100 urgency and risk scores directly.

## 21.2 Priority formula

```text
action_priority_score =
    0.40 × normalized_loads_exposed
  + 0.25 × pickup_urgency
  + 0.20 × normalized_revenue_exposure
  + 0.15 × fulfillment_risk_score
```

Sort Operations Queue descending by this score.

Severity display:

- >= 75 → Critical
- 60–74.99 → High
- 40–59.99 → Medium
- <40 → Low

---

# 22. Supply-gap intelligence

This page answers:

> **Where should a marketplace prioritize incremental carrier supply?**

Calculate by `lane + equipment_type`.

## 22.1 Historical gap metrics

Use the prior 30 days:

```text
historical_unfulfilled_30d = count(fulfilled = false)

gap_days_30d = distinct dates with >=1 unfulfilled load
```

## 22.2 Upcoming gap

```text
upcoming_expected_unfulfilled_7d =
  Σ expected_unfulfilled across next 7 days
```

## 22.3 Average sell rate

Use weighted average sell rate from upcoming loads where available; otherwise historical loads.

## 22.4 Recurrence multiplier

```text
recurrence_multiplier = 1 + min(gap_days_30d / 10, 1)
```

Range: 1.0–2.0.

## 22.5 Concentration multiplier

```text
concentration_multiplier =
  1 + max(top_carrier_share - 0.35, 0)
```

## 22.6 Structural supply-gap score

```text
structural_supply_gap_score =
  (historical_unfulfilled_30d + upcoming_expected_unfulfilled_7d)
  × avg_sell_rate
  × recurrence_multiplier
  × concentration_multiplier
```

Rank descending.

This score is a prioritization heuristic, not a financial forecast. Label it **Supply-gap priority score** and show the components.

---

# 23. Scenario engine

Scenario Lab must recalculate the same deterministic engine with modified assumptions. Do not create a separate shortcut calculation path.

## 23.1 Global scenario controls

Allow:

- demand: `-50%` to `+50%`
- carrier capacity: `-50%` to `+50%`
- carrier buy rates: `-20%` to `+20%`
- commercial floor: `0%` to `30%`
- max deadhead: `50–500 km`
- minimum reliability: `0.50–0.95`

Use sensible step sizes:

- demand 5%
- capacity 5%
- rates 1%
- commercial floor 1 percentage point
- deadhead 25 km
- reliability 0.05

## 23.2 Lane-specific override

Allow one optional lane/equipment override at a time:

- select lane
- select equipment
- demand adjustment
- capacity adjustment
- rate adjustment

Lane-specific adjustments apply after global adjustments.

## 23.3 Scenario mutation rules

- demand adjustment multiplies `load_count`
- capacity adjustment multiplies `available_trucks`
- because trucks are discrete, keep adjusted capacity as a decimal internally for scenario math but display approximately
- rate adjustment multiplies `planned_buy_rate`
- threshold adjustments replace config values only for scenario run

## 23.4 Scenario comparison outputs

Always show baseline vs scenario for:

- projected fulfillment %
- effective capacity coverage
- expected unfulfilled load-equivalents
- modeled revenue exposure
- gross take-rate proxy
- count of High/Critical planning buckets
- number of generated actions

Then show:

- newly created actions
- actions resolved by scenario
- actions whose severity increased
- actions whose severity decreased

Example question the UI should support:

> What happens if port demand rises 25% next week?

---

# 24. Optional LLM operations brief

## 24.1 Separation rule

The LLM only writes prose from precomputed context.

It must not:

- calculate any number
- invent a lane/carrier/customer
- create a new action not present in the deterministic action queue
- infer root causes beyond supplied deterministic labels
- claim causality
- claim knowledge of Trella's internal operations

## 24.2 API configuration

Use:

```text
ANALYSIS_LLM_API_KEY
ANALYSIS_LLM_MODEL
ANALYSIS_LLM_BASE_URL
```

Put the provider call behind one function.

If no key is configured, hide the brief button and keep the rest of the app fully functional.

## 24.3 Context payload

Pass only compact computed results, e.g.:

```json
{
  "as_of": "...",
  "kpis": {
    "upcoming_loads": 162,
    "projected_fulfillment_pct": 88.6,
    "effective_capacity_coverage": 0.94,
    "expected_unfulfilled": 18.5,
    "modeled_revenue_exposure": 245000,
    "gross_take_rate_proxy": 0.127
  },
  "top_actions": [
    {
      "action_type": "SECURE_CAPACITY",
      "lane": "...",
      "equipment_type": "...",
      "loads_exposed": 6.2,
      "root_cause": "SUPPLY_SHORTAGE",
      "evidence": ["..."],
      "recommended_action": "..."
    }
  ],
  "top_supply_gaps": [...],
  "scenario": null
}
```

Limit lists to top 10–15 items.

## 24.4 System prompt — use verbatim

```text
You are a freight marketplace operations analyst assistant. You write concise
operational briefs for an operations leader based ONLY on the deterministic
analysis results provided in the user message.

Strict rules:
- Use only numbers, lanes, equipment types, carriers, customers, root causes,
  and recommendations that appear in the supplied context.
- Never calculate, estimate, or infer a number that is not supplied.
- Never create a new recommended action. Recommendations must come from the
  deterministic action queue in the context.
- Do not claim causality. Describe modeled relationships and observed historical
  behavior exactly as provided.
- Do not claim the data represents Trella or any other real company unless the
  context explicitly says so.
- Write for an operations leader, not a data scientist.
- Prioritize immediate operational exposure over generic commentary.
- Keep the entire brief under 300 words.

Produce exactly these sections:

1. What needs attention — the most material near-term fulfillment risks.
2. Why — the supplied deterministic root causes and supporting evidence.
3. Commercial / service exposure — only the supplied figures and labels.
4. Recommended actions — only actions already present in the deterministic queue.
5. Watch next — upcoming supply gaps or demand changes already identified in context.
```

## 24.5 Optional carrier-outreach draft

May be added only after the operations brief works.

It may draft text from a selected existing action, but cannot send anything.

---

# 25. UI requirements

Use a single-page application with five main tabs.

The default view must be **Operations Queue**.

Visual language should be consistent with the existing Supply Chain Workbench: clean enterprise layout, restrained styling, compact severity badges, strong tables, and minimal decoration.

The new app should feel more like a live decision console than a static analytics report.

---

## 25.1 Global header

Show:

**Freight Marketplace Fulfillment & Capacity Intelligence**

Subtitle:

**Anticipates fulfillment risk across upcoming freight demand and recommends capacity, pricing and carrier actions.**

Right-side controls:

- Load sample / Upload data
- Reset sample
- Settings
- Data status

Do not place AI branding in the header.

---

## 25.2 Global filters

Filters apply to all analytical tabs except where a scenario explicitly overrides them:

- business unit
- customer
- origin
- destination
- lane
- equipment type
- pickup horizon: 24h / 48h / 72h / 7d

Default horizon: **72 hours** on Operations Queue; **7 days** elsewhere.

---

## 25.3 Tab 1 — Operations Queue

This is the product landing screen.

### KPI tiles

Show exactly five:

1. Upcoming loads
2. Projected fulfillment
3. Effective capacity coverage
4. Expected load-equivalents exposed
5. Modeled revenue exposure

### Main action table

Columns:

- Priority
- Action
- Lane
- Equipment
- Pickup
- Loads exposed
- Root cause
- Evidence summary
- Commercial/service context

Default sort: action-priority score descending.

Selecting a row opens the drilldown drawer.

### Secondary section

Show top 5 upcoming demand spikes and top 5 concentration warnings.

---

## 25.4 Tab 2 — Capacity & Fulfillment

Required views:

1. lane/equipment/date planning table
2. demand vs raw capacity chart
3. demand vs effective capacity chart
4. fulfillment-risk heatmap
5. carrier contribution drilldown

Planning table columns:

- Lane
- Equipment
- Pickup date
- Upcoming loads
- Raw capacity
- Effective capacity
- Effective coverage
- Expected unfulfilled
- Risk score
- Risk band
- Root cause

Default sort: risk score descending.

---

## 25.5 Tab 3 — Pricing & Economics

Required metrics by planning bucket:

- weighted sell rate
- current planned buy rate
- median accepted historical buy rate
- rate index
- modeled acceptance
- gross spread
- gross take-rate proxy
- recommended modeled buy rate, if any

Required visual:

**Rate sensitivity panel** showing candidate rate increases vs:

- modeled acceptance
- effective coverage
- gross take-rate proxy

Clearly mark the configured commercial floor.

---

## 25.6 Tab 4 — Supply Gaps

Rank lane/equipment pairs by structural supply-gap score.

Columns:

- Rank
- Lane
- Equipment
- Historical unfulfilled 30d
- Gap days 30d
- Upcoming gap 7d
- Demand growth
- Top carrier share
- Avg sell rate
- Supply-gap priority score

Show a short deterministic explanation for the top five.

---

## 25.7 Tab 5 — Scenario Lab

Left panel:

- global scenario controls
- optional lane-specific override
- Reset Scenario button

Main area:

Baseline vs Scenario comparison cards and table.

Required comparison:

- fulfillment %
- effective coverage
- exposed load-equivalents
- modeled revenue exposure
- gross take-rate proxy
- High/Critical groups
- action count

Below:

- New actions
- Resolved actions
- Increased severity
- Reduced severity

Do not let scenario controls mutate the underlying base dataset.

---

# 26. Planning-bucket drilldown drawer

Clicking a planning bucket or action opens a drawer with:

### Header

`Lane / Equipment / Pickup Date`

### Summary

- Upcoming loads
- Raw qualified capacity
- Effective capacity
- Effective coverage
- Expected unfulfilled
- Weighted acceptance
- Reliability context
- Rate index
- Top carrier share
- Gross take-rate proxy

### Why at risk

Deterministic root cause + secondary contributors.

### Carrier table

- Carrier
- Available trucks
- Modeled acceptance
- Reliability factor
- Effective capacity contribution
- Effective share
- Performance source

### Recommended action

Display only deterministic action(s) attached to the bucket.

### Evidence

Show the exact supporting metrics used by the rule engine.

---

# 27. Data-quality behavior

Data issues must not be silently converted to zero unless the schema explicitly allows zero.

## 27.1 Blocking errors

Block analysis for:

- missing required column after mapping
- duplicate required unique IDs
- invalid dates in required date fields
- negative rates
- zero/negative sell rate
- zero/negative planned buy rate
- negative capacity
- negative deadhead distance
- `load_count < 1` or non-integer
- mixed currencies
- malformed required booleans

## 27.2 Non-blocking warnings

Warn but continue for:

- past-due upcoming loads
- future-dated historical rows
- repeated carrier/lane/equipment/date capacity rows
- low historical sample sizes causing fallback logic
- missing payment file
- missing pickup/delivery service metrics
- rate benchmark unavailable
- performance fallback to marketplace averages

## 27.3 Confidence labels

Where fallbacks occur, display one of:

- `High confidence` — lane/equipment benchmark and carrier-lane performance sufficiently sampled
- `Medium confidence` — one fallback level used
- `Low confidence` — broad/global fallback used
- `Unavailable` — metric cannot be computed

Do not roll these into one opaque composite confidence score.

---

# 28. Edge cases

Implement and test all of the following.

### 28.1 No physical capacity

If raw capacity = 0:

- raw coverage = 0
- effective capacity = 0
- effective coverage = 0
- expected unfulfilled = full demand
- root cause = `SUPPLY_SHORTAGE`
- action = `SECURE_CAPACITY`
- do not attempt rate recommendation

### 28.2 Physical capacity exists but no pricing benchmark

- calculate raw capacity
- estimate acceptance from carrier/marketplace historical acceptance fallback
- calculate effective capacity
- pricing fields show `Unavailable`
- do not recommend rate increase
- risk reason must mention limited pricing history if relevant

### 28.3 Carrier has no lane-specific performance

Fallback per Section 11.2 and display source.

### 28.4 Carrier fails minimum reliability

Exclude from qualified capacity but show as excluded supply in drilldown.

### 28.5 Planned buy rate above sell rate

Allow analysis.

- gross take-rate proxy is negative
- visibly flag commercial economics
- no rate increase recommendation
- if fulfillment depends on higher rates, root cause may become `COMMERCIAL_CONSTRAINT`

### 28.6 Effective capacity exceeds demand

Projected fulfilled = demand.
Expected unfulfilled = 0.
Do not show negative exposure.

### 28.7 One carrier provides all capacity

Top carrier share = 1.0.
Trigger concentration action when upcoming loads >=5.

### 28.8 Very thin historical data

Use fallback hierarchy.
Never fabricate a rate benchmark.

### 28.9 All actions have equal normalization values

Use normalization rule in Section 21.1; do not divide by zero.

### 28.10 Zero payment exposure

No payment action.

### 28.11 Scenario creates negative demand/capacity

Clamp adjusted demand and capacity to >=0.

### 28.12 Scenario demand produces fractional loads

Keep decimals internally and label as load-equivalents.

---

# 29. Deterministic testing requirements

Analytics are not complete until tests cover the planted scenarios and core invariants.

## 29.1 Required invariants

Test that:

```text
effective_capacity <= raw_qualified_capacity
projected_fulfilled <= upcoming_loads
expected_unfulfilled >= 0
0 <= reliability_factor <= 1
0.10 <= expected_acceptance <= 0.98
0 <= fulfillment_risk_score <= 100
0 <= action_priority_score <= 100
```

## 29.2 Scenario propagation tests

### Demand increase

Increasing demand by 25% on a constrained lane must not improve coverage or fulfillment percentage.

### Capacity increase

Increasing qualified capacity must not reduce raw coverage.

### Carrier-rate increase

When the candidate crosses into a historically stronger acceptance band, modeled acceptance and effective capacity must update.

### Commercial-floor constraint

A rate scenario that breaches the configured floor must not produce `RAISE_BUY_RATE`.

### Reliability threshold

Raising minimum reliability may reduce qualified capacity; lowering it must not reduce qualified capacity.

## 29.3 Planted-scenario tests

The generated sample must assert:

- Scenario A → `PRICE_COMPETITIVENESS`
- Scenario B → `SUPPLY_SHORTAGE`
- Scenario C → `COMMERCIAL_CONSTRAINT`
- Scenario D → concentration warning / backup-carrier action
- Scenario E → `SERVICE_QUALITY`
- Scenario F → Healthy control groups

If sample generation changes and these tests fail, fix the sample generator or logic before release.

---

# 30. UI acceptance criteria

V1 is not complete unless a first-time user can do all of the following without reading the README:

1. open the app and understand the top operational issue within approximately 10 seconds
2. click the highest-priority action and see why it exists
3. see the exact supporting capacity/rate/reliability figures
4. move to Pricing & Economics and understand the rate/service/commercial trade-off
5. run a +25% demand scenario and see all downstream metrics/actions update
6. reset back to baseline instantly
7. upload replacement CSVs and resolve column mappings
8. export the visible action queue as CSV

---

# 31. Export requirements

Provide client-side CSV export for:

1. Operations Action Queue
2. Capacity & Fulfillment planning table
3. Supply Gap ranking
4. Current Scenario comparison

Exports must reflect active filters and current sorting.

Include computed fields, not only source fields.

No server is required for exports.

---

# 32. Data privacy & session behavior

- CSV parsing runs in the browser.
- Analytics run in the browser.
- No uploaded file is stored.
- No database.
- No cookies required.
- No localStorage persistence in v1.
- Refreshing the page clears uploaded data and scenario state.
- Only compact deterministic summary data may be sent to the optional LLM endpoint after the user clicks Generate Operations Brief.
- Raw CSV contents must never be sent to the LLM endpoint.

---

# 33. Visual design constraints

Use the existing Supply Chain Workbench as the visual family reference, not as a codebase constraint.

Required visual character:

- clean enterprise UI
- strong information hierarchy
- restrained neutral palette
- severity color used sparingly
- compact tables
- consistent KPI cards
- readable tooltips for formulas
- responsive down to tablet width
- mobile may stack and horizontally scroll tables

Do not:

- add decorative gradients everywhere
- add animated backgrounds
- use oversized AI icons
- use chat bubbles as the primary interface
- create a dark terminal aesthetic
- create a map unless it materially improves a later version

---

# 34. README requirements

README must explain:

1. the freight-marketplace operating problem
2. what the product does
3. what it deliberately does not do
4. data files and schemas
5. exact calculation philosophy
6. how rate modeling works
7. why effective capacity differs from physical capacity
8. why the gross take-rate metric is only a proxy
9. deterministic analytics vs AI narration
10. how the sample scenarios are synthetic
11. how to run locally
12. how to configure the optional LLM endpoint
13. data privacy behavior
14. known v1 limitations

Do not describe the app as production-ready.

---

# 35. Required demo story

The built-in sample must support this exact portfolio walkthrough:

### Step 1 — Open Operations Queue

Show projected fulfillment below 100% and a small number of prioritized issues.

### Step 2 — Open the top pricing-driven action

Demonstrate:

- physical capacity is available
- effective capacity is lower
- current planned buy rate sits in a weaker historical acceptance band

### Step 3 — Show modeled rate scenario

Increase carrier buy rate.

The app must show:

- improved modeled acceptance
- improved effective coverage
- lower gross take-rate proxy

### Step 4 — Show the commercial floor

Demonstrate that additional rate increases eventually become commercially unattractive.

### Step 5 — Open true supply-shortage action

Show a case where price cannot solve the problem because physical trucks are insufficient.

### Step 6 — Open Supply Gaps

Show where additional carrier acquisition would have the highest structural value.

### Step 7 — Scenario Lab

Apply +25% demand to the port lane.

Show:

- lower projected fulfillment
- higher exposed load-equivalents
- newly created capacity actions
- changed action priorities

### Step 8 — Generate Operations Brief

The brief summarizes only already-computed findings and actions.

This walkthrough is the minimum standard for calling the project portfolio-ready.

---

# 36. Definition of v1 complete

V1 is complete only when all are true:

### Data

- all four required sample datasets load automatically
- optional payment dataset loads without being required
- uploads and mapping work
- validation is clear

### Analytics

- historical performance fallbacks work
- pricing benchmark fallbacks work
- rate bands work
- expected acceptance works
- effective capacity works
- risk score works
- root causes work
- rate recommendation works
- action queue works
- supply-gap score works

### Scenario engine

- demand/capacity/rate/threshold scenarios use the same analytics engine
- baseline never mutates
- action deltas are shown

### UI

- Operations Queue is understandable immediately
- drilldowns expose exact evidence
- scenario lab works without refresh
- exports work

### AI

- optional operations brief works from compact computed context only
- no raw CSV is sent
- app remains fully functional without API key

### Quality

- all required unit tests pass
- all planted scenario assertions pass
- no major console errors
- README accurately documents limitations

---

# 37. Explicit v1 limitations

Document these openly:

- effective capacity is a planning model, not live truck dispatch availability
- capacity is lane/equipment/date-specific and may not model dynamic truck reuse across lanes
- acceptance modeling is based on historical empirical rate bands, not causal inference or ML
- the same group-level modeled buy-rate scenario is applied to the planning bucket for sensitivity analysis
- no route feasibility / driver-hours logic
- no real-time carrier marketplace data
- no border/customs/document execution
- no invoice/payment execution
- no proof that payment status affects future capacity
- no claim that the gross take-rate proxy matches any real company's internal definition
- synthetic sample data is illustrative only

These limitations make the product more credible, not less.

---

# 38. Non-negotiable design principle

The product must follow this flow:

```text
RAW OPERATIONAL DATA
        ↓
DETERMINISTIC BUSINESS LOGIC
        ↓
FULFILLMENT / CAPACITY / ECONOMIC RISK
        ↓
ROOT CAUSE
        ↓
PRIORITIZED OPERATIONAL ACTION
        ↓
SCENARIO TESTING
        ↓
OPTIONAL LLM NARRATION
```

Never invert this flow.

The LLM is the final presentation layer, not the decision engine.

The product is successful when an experienced freight operator reacts to the underlying decision logic, not to the presence of AI.

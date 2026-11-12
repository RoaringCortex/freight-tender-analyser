# Freight Tender Analyser – Product Spec


## What the tool does

A transport buyer uploads forwarder quotes for an annual freight tender. The tool turns them into one comparable cost per container, scores them on price and non-price criteria with editable weights, and recommends a forwarder per lane with a clear explanation.

## Scenario (synthetic, fictional)

- Buyer: **Saint JAP**, a French importer of Japanese sake.
- Contract: one-year ocean freight contract (2027), monthly shipments.
- Origin and destination: Port of Osaka (JPOSA) → Marseille-Fos (FRFOS).
- Carrier used by the forwarders: PANDA Express.
- Container: **20' reefer** (sake must be temperature-controlled).
- Incoterm: FOB Osaka, so a quote covers ocean freight, surcharges and destination charges. Origin charges are excluded.
- Base currency for all totals: **USD**.
- Forwarders may quote in any currency (e.g. JPY, EUR, CNY, USD), even mixed within one quote. The tool converts every charge to USD automatically.

### The 3 lanes

| Lane | Name | Routing | Typical transit | Typical reliability | Operating window |
|---|---|---|---|---|---|
| 1 | Cape of Good Hope | JPOSA → CNNGB → TWKHH → SGSIN → ESVLC → FRFOS | 38–45 days | 85–90% | Year-round |
| 2 | Suez Canal | JPOSA → CNNGB → CNXMN → SGSIN → ITGIT → FRFOS | 28–34 days | 40–55% | Year-round |
| 3 | Arctic (NSR) | JPOSA → KRPUS → RUPEV → RUSBW → NLRTM → FRFOS | 22–25 days | 90% (in window) | Aug–Nov only |

These are typical ranges for each routing. **The tool always uses the values in each forwarder's own offer**, so transit time, free time and reliability can differ between forwarders on the same lane.

### The 4 forwarders (fictional)

| Forwarder | Pricing strategy | What the tool must handle |
|---|---|---|
| K-Logistics Spirit | Volume-discounted contract (high ocean tier) | Pick the rate tier that matches the annual volume entered by the buyer |
| Pacific Alliance Logistics | Dynamic market, flexible spot / named-account rates | Use the quoted rate and flag it as variable during the contract |
| Nippon Pacific Cargo | Premium Asian service, reliability-driven rates | Normal comparison; premium should show in the non-price scores |
| LHD Global Wave | Standard enterprise tier + IoT visibility add-ons | Show add-ons separately; the buyer chooses to include them in the total or not |

## Fixed decisions

- Quote formats: **PDF, Word (.docx), Excel (.xlsx), CSV**. Each forwarder uses a different format.
- AI provider: Google Gemini, called only from a server function.
- Hosting: Next.js on Vercel.
- All data is synthetic and all names are fictional.
- Out of scope (stated in the method note): customs duties, import VAT, alcohol excise, origin charges.

## AI is used in exactly two places

1. Reading PDF and Word quotes (Step 3).
2. Writing the award explanation text (Step 7).

Everything else (costs, scores, ranking, award, sensitivity) is plain, tested code. Every AI output is checked: by the buyer in Step 4, by the code in Step 7.

## Workflow

### Step 1 – Landing dashboard
- Tool name, one-sentence description, synthetic-data label.
- Main button: **Import tender**.
- The 3 lanes, empty until offers are imported.
- Link to the method note (what is included, excluded and why).

### Step 2 – Import tender
- Popup to drop all quote files at once (PDF, DOCX, XLSX, CSV).
- One file = one forwarder's quote. A quote covers all 3 lanes.
- List each file with name and type; the buyer can remove one before starting.
- Warn if a PDF has no readable text (scanned image), or if the file is the old .doc format.
- Button **Analyse offers** sends the files to the backend.

### Step 3 – Extraction (backend)
| File type | Get the content | Fill the standard offer format |
|---|---|---|
| XLSX / CSV | Code reads the columns | Code maps columns to fields (no AI) |
| PDF | Code extracts the text | Gemini |
| DOCX | Code extracts the text | Gemini |

Rules:
- Gemini only fills fields. It never calculates or judges.
- A field it cannot find stays empty and is flagged, never guessed.
- The API key lives only in `.env.local` and in Vercel environment variables.
- Save the input and output token counts of every Gemini call (for the environmental cost report).

### Standard offer format (one per forwarder per lane)
- forwarder name, lane (1, 2 or 3), container type (20' reefer)
- currency, valid from, valid to
- pricing type: fixed contract | volume-tiered | spot/variable
- ocean freight amount (for volume-tiered offers: a list of tiers, each with a volume range and a rate)
- surcharges: list of { name, amount, currency, per: "container" | "shipment", optional: true/false }
  - examples: BAF, low sulphur (LSS), peak season (PSS), EU ETS, ISPS, war risk, reefer surcharge, reefer power/plug-in, pre-trip inspection (PTI), destination terminal handling (DTHC), documentation / B/L fee, IoT tracking (optional add-on)
- transit time (days)
- demurrage free time (days) and detention free time (days)
- schedule reliability (%)
- operating window (e.g. year-round, Aug–Nov only)

### Step 4 – Verification screen
- One card per offer: extracted fields next to the original text.
- Empty or uncertain fields highlighted (e.g. "per container or per shipment?", "currency not found").
- Every field editable, like editing a spreadsheet cell.
- The buyer enters:
  - the **exchange rate table**: one row per currency found in the offers (e.g. JPY → USD, EUR → USD). Rates are filled in automatically from a free reference-rate source (Frankfurter API, api.frankfurter.dev, using European Central Bank rates, no API key), with the source and the date shown.
    - These are daily reference rates, not real-time market rates.
    - Default date: the **tender date** (an editable date field, e.g. the quote deadline), so every offer is converted at the same day's rate. Fetched with one request for all currencies at once.
    - The request runs in the server function. If the rate source is unreachable, the buyer types the rates in by hand.
  - containers per month (shipment size) and the resulting annual volume, used for volume tiers and per-shipment fees
- These inputs stay editable and are shown on every later screen.
- **Continue** is disabled until every offer is confirmed.

### Step 5 – Total cost per container
Total (USD) = ocean freight + sum of per-container surcharges + (sum of per-shipment fees ÷ containers per shipment)

- Every amount converted to USD with the exchange rate table from Step 4. All calculations, scores and the award use USD.
- The breakdown shows each charge in its original currency and in USD, so the buyer can check every conversion.
- Exchange rate conversion is plain code, never AI.
- Changing a rate in the table can change the ranking, because offers are quoted in different currencies. Show this clearly when it happens.
- Volume-tiered offers use the tier matching the annual volume.
- Optional add-ons are shown separately; a toggle includes them in the total.
- Show the full breakdown for each total, table-style, so the buyer can see why a low headline rate can end up most expensive.
- Flags, shown next to the total (never hidden in it): offer expires before the contract period, a usual charge is missing, currency unclear, spot/variable rate, lane not available year-round.

### Step 6 – Criteria and weights
| Criterion | Better when | Score 0–100 |
|---|---|---|
| Total cost per container (USD) | Lower | cheapest ÷ this offer × 100 |
| Transit time (days) | Lower | fastest ÷ this offer × 100 |
| Demurrage free time (days) | Higher | this offer ÷ best × 100 |
| Schedule reliability (%) | Higher | this offer ÷ best × 100 |

- These 4 are on by default. At least 3 non-price criteria must stay on (challenge requirement).
- Scores compare forwarders **within the same lane**.
- Weights are editable sliders that must total 100%; show the running total.
- Weighted score = sum of (criterion score × weight).
- Optional extra criteria can be added later (e.g. detention free time, sailing frequency, CO₂). Each needs a direction (higher or lower is better).

### Step 7 – Award view
- Per lane: ranked forwarders with total cost, each criterion score, weighted score; winner highlighted.
- Sensitivity line per lane, calculated by code, e.g. "If reliability weighs more than 35%, Nippon Pacific Cargo wins instead."
- **Explain this award** button: the code sends only its finished numbers to Gemini, which writes 2–4 plain sentences per lane. The code then checks every number in the text against its own results. If any number doesn't match, or the API fails, show a template sentence instead ("[Forwarder] is recommended: $X per container, score Y/100").
- The explanation is generated only when the button is clicked.
- **Change weights** returns to Step 6. **Add criterion** opens the criteria list. Everything recalculates instantly with no AI call.
- **Download as Excel** button for the award and breakdown.

## Build order

1. Skeleton: Next.js page with the synthetic-data label, on GitHub, live on Vercel.
2. Calculation module with automated tests that reproduce the team's hand-calculated totals exactly.
3. Steps 5–7 screens using the 4 test quotes loaded directly (Prototype 0 minimum).
4. Steps 1–2 plus XLSX/CSV reading.
5. Steps 3–4: PDF/DOCX extraction with Gemini and the verification screen.
6. The Explain this award button.

## Must work for Prototype 0

- Synthetic tender: 3 lanes, 4 forwarder offers in different formats (PDF, DOCX, XLSX, CSV).
- Total cost per container per lane, all surcharges, converted into one currency (USD) from whatever currencies the offers use.
- At least 3 non-price criteria with visible, editable weights.
- Award view showing the recommended forwarder per lane and what changes when weights change.
- A one-page method note.
- When an instructor changes a weight or a rate, the recommendation updates and still makes sense.
- Totals checked by hand for every offer on at least one lane, and they match the tool.

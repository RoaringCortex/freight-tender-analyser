# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

**Primary:** Transport buyers — logistics managers running an annual freight tender. They have domain expertise (they know what a BAF surcharge is) but no technical background. They work under time pressure, need defensible numbers, and will be questioned on every recommendation they make.

**Secondary:** Academic reviewers (capstone instructors) who evaluate the methodology, the AI use, and the correctness of the calculations. They follow the tool's logic but are not logistics specialists.

## Product Purpose

TenderAI turns heterogeneous forwarder quote files (PDF, Word, Excel, CSV) into one comparable cost per container, scores every offer on price and non-price criteria with editable weights, and produces a clear award recommendation per shipping lane with an AI-generated plain-language justification.

The buyer's job is reduced from manually reconciling quote formats in spreadsheets to four steps: upload → review extracted data → adjust weights → award.

## Positioning

TenderAI separates extraction (AI) from scoring (code). Every number the buyer sees was calculated by the code from confirmed inputs — not inferred by AI. AI appears in exactly two places: reading PDF and Word files, and writing the award explanation. That explanation is verified by the same code that produced the numbers; if any figure in the text doesn't match, a template sentence replaces it. The buyer can trust the recommendation without trusting AI blindly.

## Operating Context

- Annual freight tender cycle; the buyer receives 3–4 quotes in different file formats in one go.
- Fictional scenario used in this prototype: **Maison Japonaise**, a French importer of Japanese sake, shipping 20' reefer containers FOB Osaka (JPOSA) → Marseille-Fos (FRFOS) on a one-year contract.
- Three shipping lanes compared: Cape of Good Hope (38–45 days), Suez Canal (28–34 days), Arctic/NSR (22–25 days, Aug–Nov only).
- Four fictional forwarders: K-Logistics Spirit (volume-tiered), Pacific Alliance Logistics (spot/variable), Nippon Pacific Cargo (premium reliability), LHD Global Wave (IoT add-ons).
- All data is synthetic and fictional; this is explicitly disclosed in the UI.
- The buyer will show results to colleagues and may paste the award summary into a PowerPoint.

## Capabilities and Constraints

**What the tool does:**
- Extracts offer data from PDF, DOCX, XLSX, and CSV using code (structured formats) or Gemini (PDF/DOCX).
- Converts all amounts to USD using ECB reference rates (Frankfurter API, `api.frankfurter.dev`).
- Calculates total cost per container: ocean freight + per-container surcharges + (per-shipment fees ÷ containers per shipment).
- Scores offers per lane on four default criteria: total cost, transit time, demurrage free time, schedule reliability. Additional criteria can be added.
- Produces a weighted score and an award recommendation per lane.
- Generates an AI award explanation only on demand; every number in the text is validated against code results.

**Constraints:**
- Out of scope: customs duties, import VAT, alcohol excise, origin charges (Incoterm FOB — buyer's responsibility begins at Osaka port).
- All data is session-based (sessionStorage); data is lost on tab close. Settings (company name, criteria weights) persist in localStorage.
- Gemini API key lives only server-side (`.env.local` / Vercel env vars). AI is never called client-side.
- `CONTAINERS_PER_SHIPMENT = 2` (2 × 20' reefers per monthly shipment) in the prototype.
- Currency: USD base. Exchange rates are daily ECB reference rates, not live market rates.
- Volume-tiered pricing: the tier matching the entered annual volume is used automatically.

**Terminology used in the UI:**
- "Offer" = one forwarder's quote for one lane
- "Lane" = one routing (Cape, Suez, Arctic)
- "Tender date" = the date used for exchange rate lookup
- "Free time" = demurrage or detention days included at no charge
- "Reliability" = schedule on-time percentage stated in the quote
- "Weighted score" = sum of (criterion score × weight / 100)

## Brand Commitments

- **Product name:** TenderAI
- **Fictional buyer company:** Maison Japonaise (used as the scenario context in the prototype)
- **Disclosure:** The tool always labels its data as synthetic and fictional — this is never hidden
- **Voice:** Plain, direct, professional. No jargon the buyer doesn't already own. No hedging on AI outputs — if it's uncertain, the UI flags it explicitly.
- **Typography:** Geist Sans (UI) / Geist Mono (numbers, extracted values)
- **Color system:** Dark theme — slate-950 backgrounds, blue (#3b82f6) as primary accent

## Evidence on Hand

- Full product spec: `docs/spec.md`
- Real (fictional) quote files on the developer's machine: K-Logistics (PDF), LHD (PDF), Nippon Pacific (CSV × 3 lanes), Pacific Alliance (XLSX)
- Hand-calculated totals for at least one lane (used to verify calculation module)
- No real company data, real rates, or real forwarder names; all names and figures are invented

## Product Principles

1. **Code calculates, AI explains.** Every number the buyer acts on was produced by deterministic code from confirmed inputs. AI only reads documents and writes prose; it never owns a figure.
2. **Every field is editable.** The buyer can correct any AI extraction before the numbers are locked. Trust is earned by transparency, not authority.
3. **Methodology is visible.** What is included and excluded is documented and labelled in the UI. Scores show their formula. Flags appear next to totals, never hidden inside them.
4. **Buyer-first simplicity.** Four steps, no training required. Complexity lives in the breakdown panels, not the main flow.
5. **Synthetic context, real discipline.** The scenario is fictional, but the calculations, methodology, and AI safeguards are built to real standards — this is stated clearly so the tool is evaluated on its merits.

## Accessibility & Inclusion

No specific accessibility standard was confirmed. Apply WCAG 2.1 AA as a floor: sufficient contrast ratios on all text, keyboard navigation for all interactive elements, and screen-reader labels on icon-only controls.

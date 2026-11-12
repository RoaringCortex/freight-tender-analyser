// All monetary values are in USD. All quotes dated October 2026.
// Origin charges and customs are marked inScope:false per FOB Osaka incoterm.

export type Charge = {
  name: string;
  amountUSD: number;
  per: "container" | "shipment" | "filing";
  inScope: boolean;
};

export type Offer = {
  forwarder: string;
  lane: 1 | 2 | 3;
  source: "PDF" | "DOCX" | "XLSX" | "CSV";
  pricingType: "fixed" | "spot";
  oceanFreightUSD: number;
  surcharges: Charge[];
  transitDaysMin: number;
  transitDaysMax: number;
  demurrageFreeTimeDays: number;
  detentionFreeTimeDays: number;
  reliabilityPctMin: number;
  reliabilityPctMax: number;
  operatingWindow: string;
  notes: string;
};

export const OFFERS: Offer[] = [
  // ── K-LOGISTICS SPIRIT (PDF) ─────────────────────────────────────────────
  {
    forwarder: "K-Logistics Spirit",
    lane: 1,
    source: "PDF",
    pricingType: "fixed",
    oceanFreightUSD: 2450,
    surcharges: [
      { name: "Origin Local Charges",          amountUSD: 280,  per: "shipment",  inScope: false },
      { name: "Thermal Protection Add-on",     amountUSD: 350,  per: "container", inScope: true  },
      { name: "Destination Local Charges",     amountUSD: 450,  per: "container", inScope: true  },
      { name: "Customs & EMCS Excise Filing",  amountUSD: 150,  per: "filing",    inScope: false },
      { name: "War Risk & Emergency (BAF02)",  amountUSD: 530,  per: "container", inScope: true  },
    ],
    transitDaysMin: 38, transitDaysMax: 45,
    demurrageFreeTimeDays: 14, detentionFreeTimeDays: 7,
    reliabilityPctMin: 85, reliabilityPctMax: 90,
    operatingWindow: "Year-round",
    notes: "High schedule reliability; bypasses Suez geopolitical risk.",
  },
  {
    forwarder: "K-Logistics Spirit",
    lane: 2,
    source: "PDF",
    pricingType: "fixed",
    oceanFreightUSD: 2150,
    surcharges: [
      { name: "Origin Local Charges",          amountUSD: 280,  per: "shipment",  inScope: false },
      { name: "Thermal Protection Add-on",     amountUSD: 350,  per: "container", inScope: true  },
      { name: "Destination Local Charges",     amountUSD: 450,  per: "container", inScope: true  },
      { name: "Customs & EMCS Excise Filing",  amountUSD: 150,  per: "filing",    inScope: false },
      { name: "War Risk & Emergency (BAF02)",  amountUSD: 880,  per: "container", inScope: true  },
    ],
    transitDaysMin: 28, transitDaysMax: 34,
    demurrageFreeTimeDays: 14, detentionFreeTimeDays: 7,
    reliabilityPctMin: 40, reliabilityPctMax: 55,
    operatingWindow: "Year-round",
    notes: "Fastest year-round route; subject to Suez/Red Sea war risk premium.",
  },
  {
    forwarder: "K-Logistics Spirit",
    lane: 3,
    source: "PDF",
    pricingType: "fixed",
    oceanFreightUSD: 2800,
    surcharges: [
      { name: "Origin Local Charges",          amountUSD: 320,  per: "shipment",  inScope: false },
      { name: "Thermal Protection Add-on",     amountUSD: 550,  per: "container", inScope: true  },
      { name: "Destination Local Charges",     amountUSD: 450,  per: "container", inScope: true  },
      { name: "Customs & EMCS Excise Filing",  amountUSD: 150,  per: "filing",    inScope: false },
      { name: "War Risk & Emergency (BAF02)",  amountUSD: 530,  per: "container", inScope: true  },
    ],
    transitDaysMin: 22, transitDaysMax: 25,
    demurrageFreeTimeDays: 21, detentionFreeTimeDays: 7,
    reliabilityPctMin: 90, reliabilityPctMax: 90,
    operatingWindow: "Aug–Nov only",
    notes: "Ultra-fast seasonal window; requires ice-class reefer protection.",
  },

  // ── LHD GLOBAL WAVE (DOCX) ───────────────────────────────────────────────
  {
    forwarder: "LHD Global Wave",
    lane: 1,
    source: "DOCX",
    pricingType: "fixed",
    oceanFreightUSD: 2400,
    surcharges: [
      { name: "Origin Local Charges",          amountUSD: 290,  per: "shipment",  inScope: false },
      { name: "Thermal Protection Add-on",     amountUSD: 420,  per: "container", inScope: true  },
      { name: "Destination Local Charges",     amountUSD: 460,  per: "container", inScope: true  },
      { name: "Customs & EMCS Excise Filing",  amountUSD: 160,  per: "filing",    inScope: false },
      { name: "War Risk & Emergency (BAF02)",  amountUSD: 530,  per: "container", inScope: true  },
    ],
    transitDaysMin: 38, transitDaysMax: 45,
    demurrageFreeTimeDays: 14, detentionFreeTimeDays: 7,
    reliabilityPctMin: 85, reliabilityPctMax: 90,
    operatingWindow: "Year-round",
    notes: "WaveControl IoT telemetry throughout Cape circumnavigation.",
  },
  {
    forwarder: "LHD Global Wave",
    lane: 2,
    source: "DOCX",
    pricingType: "fixed",
    oceanFreightUSD: 2100,
    surcharges: [
      { name: "Origin Local Charges",          amountUSD: 290,  per: "shipment",  inScope: false },
      { name: "Thermal Protection Add-on",     amountUSD: 420,  per: "container", inScope: true  },
      { name: "Destination Local Charges",     amountUSD: 460,  per: "container", inScope: true  },
      { name: "Customs & EMCS Excise Filing",  amountUSD: 160,  per: "filing",    inScope: false },
      { name: "War Risk & Emergency (BAF02)",  amountUSD: 910,  per: "container", inScope: true  },
    ],
    transitDaysMin: 28, transitDaysMax: 34,
    demurrageFreeTimeDays: 14, detentionFreeTimeDays: 7,
    reliabilityPctMin: 40, reliabilityPctMax: 55,
    operatingWindow: "Year-round",
    notes: "Suez route with real-time temperature/humidity smart tracking.",
  },
  {
    forwarder: "LHD Global Wave",
    lane: 3,
    source: "DOCX",
    pricingType: "fixed",
    oceanFreightUSD: 2850,
    surcharges: [
      { name: "Origin Local Charges",          amountUSD: 310,  per: "shipment",  inScope: false },
      { name: "Thermal Protection Add-on",     amountUSD: 580,  per: "container", inScope: true  },
      { name: "Destination Local Charges",     amountUSD: 460,  per: "container", inScope: true  },
      { name: "Customs & EMCS Excise Filing",  amountUSD: 160,  per: "filing",    inScope: false },
      { name: "War Risk & Emergency (BAF02)",  amountUSD: 530,  per: "container", inScope: true  },
    ],
    transitDaysMin: 22, transitDaysMax: 25,
    demurrageFreeTimeDays: 21, detentionFreeTimeDays: 7,
    reliabilityPctMin: 90, reliabilityPctMax: 90,
    operatingWindow: "Aug–Nov only",
    notes: "High-tech monitoring across Arctic sea ice passage.",
  },

  // ── NIPPON PACIFIC CARGO (XLSX) ──────────────────────────────────────────
  {
    forwarder: "Nippon Pacific Cargo",
    lane: 1,
    source: "XLSX",
    pricingType: "fixed",
    oceanFreightUSD: 2500,
    surcharges: [
      { name: "Origin Local Charges",          amountUSD: 240,  per: "shipment",  inScope: false },
      { name: "Thermal Protection Add-on",     amountUSD: 390,  per: "container", inScope: true  },
      { name: "Destination Local Charges",     amountUSD: 440,  per: "container", inScope: true  },
      { name: "Customs & EMCS Excise Filing",  amountUSD: 180,  per: "filing",    inScope: false },
      { name: "War Risk & Emergency (BAF02)",  amountUSD: 530,  per: "container", inScope: true  },
    ],
    transitDaysMin: 38, transitDaysMax: 45,
    demurrageFreeTimeDays: 14, detentionFreeTimeDays: 7,
    reliabilityPctMin: 85, reliabilityPctMax: 90,
    operatingWindow: "Year-round",
    notes: "Direct origin control; zero-defect cargo handling.",
  },
  {
    forwarder: "Nippon Pacific Cargo",
    lane: 2,
    source: "XLSX",
    pricingType: "fixed",
    oceanFreightUSD: 2200,
    surcharges: [
      { name: "Origin Local Charges",          amountUSD: 240,  per: "shipment",  inScope: false },
      { name: "Thermal Protection Add-on",     amountUSD: 390,  per: "container", inScope: true  },
      { name: "Destination Local Charges",     amountUSD: 440,  per: "container", inScope: true  },
      { name: "Customs & EMCS Excise Filing",  amountUSD: 180,  per: "filing",    inScope: false },
      { name: "War Risk & Emergency (BAF02)",  amountUSD: 850,  per: "container", inScope: true  },
    ],
    transitDaysMin: 28, transitDaysMax: 34,
    demurrageFreeTimeDays: 14, detentionFreeTimeDays: 7,
    reliabilityPctMin: 40, reliabilityPctMax: 55,
    operatingWindow: "Year-round",
    notes: "Suez transit with NE France in-house customs clearance.",
  },
  {
    forwarder: "Nippon Pacific Cargo",
    lane: 3,
    source: "XLSX",
    pricingType: "fixed",
    oceanFreightUSD: 2750,
    surcharges: [
      { name: "Origin Local Charges",          amountUSD: 260,  per: "shipment",  inScope: false },
      { name: "Thermal Protection Add-on",     amountUSD: 520,  per: "container", inScope: true  },
      { name: "Destination Local Charges",     amountUSD: 440,  per: "container", inScope: true  },
      { name: "Customs & EMCS Excise Filing",  amountUSD: 180,  per: "filing",    inScope: false },
      { name: "War Risk & Emergency (BAF02)",  amountUSD: 530,  per: "container", inScope: true  },
    ],
    transitDaysMin: 22, transitDaysMax: 25,
    demurrageFreeTimeDays: 21, detentionFreeTimeDays: 7,
    reliabilityPctMin: 90, reliabilityPctMax: 90,
    operatingWindow: "Aug–Nov only",
    notes: "Rapid Arctic corridor transit for peak season delivery.",
  },

  // ── PACIFIC ALLIANCE LOGISTICS (XLSX) ────────────────────────────────────
  {
    forwarder: "Pacific Alliance Logistics",
    lane: 1,
    source: "XLSX",
    pricingType: "spot",
    oceanFreightUSD: 2650,
    surcharges: [
      { name: "Origin Local Charges",          amountUSD: 300,  per: "shipment",  inScope: false },
      { name: "Thermal Protection Add-on",     amountUSD: 450,  per: "container", inScope: true  },
      { name: "Destination Local Charges",     amountUSD: 420,  per: "container", inScope: true  },
      { name: "Customs & EMCS Excise Filing",  amountUSD: 200,  per: "filing",    inScope: false },
      { name: "War Risk & Emergency (BAF02)",  amountUSD: 530,  per: "container", inScope: true  },
    ],
    transitDaysMin: 38, transitDaysMax: 45,
    demurrageFreeTimeDays: 14, detentionFreeTimeDays: 7,
    reliabilityPctMin: 85, reliabilityPctMax: 90,
    operatingWindow: "Year-round",
    notes: "Cape circumvention option with named account space guarantee.",
  },
  {
    forwarder: "Pacific Alliance Logistics",
    lane: 2,
    source: "XLSX",
    pricingType: "spot",
    oceanFreightUSD: 2350,
    surcharges: [
      { name: "Origin Local Charges",          amountUSD: 300,  per: "shipment",  inScope: false },
      { name: "Thermal Protection Add-on",     amountUSD: 450,  per: "container", inScope: true  },
      { name: "Destination Local Charges",     amountUSD: 420,  per: "container", inScope: true  },
      { name: "Customs & EMCS Excise Filing",  amountUSD: 200,  per: "filing",    inScope: false },
      { name: "War Risk & Emergency (BAF02)",  amountUSD: 930,  per: "container", inScope: true  },
    ],
    transitDaysMin: 28, transitDaysMax: 34,
    demurrageFreeTimeDays: 14, detentionFreeTimeDays: 7,
    reliabilityPctMin: 40, reliabilityPctMax: 55,
    operatingWindow: "Year-round",
    notes: "Standard Red Sea passage with dynamic spot adjustments.",
  },
  {
    forwarder: "Pacific Alliance Logistics",
    lane: 3,
    source: "XLSX",
    pricingType: "spot",
    oceanFreightUSD: 2950,
    surcharges: [
      { name: "Origin Local Charges",          amountUSD: 350,  per: "shipment",  inScope: false },
      { name: "Thermal Protection Add-on",     amountUSD: 600,  per: "container", inScope: true  },
      { name: "Destination Local Charges",     amountUSD: 420,  per: "container", inScope: true  },
      { name: "Customs & EMCS Excise Filing",  amountUSD: 200,  per: "filing",    inScope: false },
      { name: "War Risk & Emergency (BAF02)",  amountUSD: 530,  per: "container", inScope: true  },
    ],
    transitDaysMin: 22, transitDaysMax: 25,
    demurrageFreeTimeDays: 21, detentionFreeTimeDays: 7,
    reliabilityPctMin: 90, reliabilityPctMax: 90,
    operatingWindow: "Aug–Nov only",
    notes: "Specialised seasonal booking for high-priority shipments.",
  },
];

export const LANES = [
  { number: 1 as const, name: "Cape of Good Hope", routing: "JPOSA → CNNGB → TWKHH → SGSIN → ESVLC → FRFOS" },
  { number: 2 as const, name: "Suez Canal",         routing: "JPOSA → CNNGB → CNXMN → SGSIN → ITGIT → FRFOS" },
  { number: 3 as const, name: "Arctic (NSR)",       routing: "JPOSA → KRPUS → RUPEV → RUSBW → NLRTM → FRFOS" },
];

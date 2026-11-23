import * as XLSX from "xlsx";

const GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-pro-preview:generateContent";

type CustomCriterionInput = { key: string; label: string; description: string };

function buildPrompt(customCriteria: CustomCriterionInput[] = []): string {
  const customSection = customCriteria.length > 0
    ? `\n\nAlso extract these custom values for each lane and add them as a "customValues" object:\n${customCriteria.map((c) => `- "${c.key}": ${c.description}`).join("\n")}\nIf a value is not found in the document, use null.\nExample: "customValues": { "${customCriteria[0].key}": 14 }`
    : `\n\nAdd "customValues": {} to each lane.`;
  return PROMPT_BASE + customSection;
}

const PROMPT_BASE = `You are extracting freight forwarder quote data from a shipping tender document.

The document contains quotes for one forwarder across up to three shipping lanes:
- Lane 1: Cape of Good Hope route (transit ~38-45 days, via South Africa)
- Lane 2: Suez Canal route (transit ~28-34 days, via Middle East/Mediterranean)
- Lane 3: Arctic Northern Sea Route (transit ~22-25 days, seasonal Aug-Nov only)

Extract ALL lanes present and return a JSON array where each element is one lane's quote.

Each element must follow this exact structure (all fields required):
{
  "forwarder": "exact company name from document",
  "lane": 1,
  "source": "PDF",
  "oceanFreightUSD": 2450,
  "surcharges": [
    { "name": "Thermal Protection Add-on", "amountUSD": 350, "per": "container", "inScope": true }
  ],
  "transitDaysMin": 38,
  "transitDaysMax": 45,
  "demurrageFreeTimeDays": 14,
  "detentionFreeTimeDays": 7,
  "reliabilityPctMin": 85,
  "reliabilityPctMax": 90,
  "operatingWindow": "Year-round",
  "currency": "USD",
  "notes": "brief description"
}

Rules:
- "per": use "container" if the charge is per TEU/container, "shipment" if per shipment/booking, "filing" if per customs entry
- "inScope": false for Origin Local Charges and Customs/Excise filing fees (excluded under FOB Osaka incoterm). true for all other charges.
- "currency": ISO 4217 three-letter code of the currency used for all monetary amounts in this quote (e.g. "USD", "JPY", "EUR"). Default to "USD" if not stated.
- All monetary amounts must be plain numbers in the stated currency — no currency symbols, no commas
- Return a JSON object with a single key "offers" containing the array: {"offers": [...]}
- No markdown, no code blocks, no explanation text`;

async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve((reader.result as string).split(",")[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

async function callGemini(
  apiKey: string,
  parts: object[],
  onRetry?: (attempt: number, max: number) => void,
): Promise<string> {
  const MAX_RETRIES = 4;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    const res = await fetch(`${GEMINI_URL}?key=${apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts }],
        generationConfig: { responseMimeType: "application/json" },
      }),
    });

    const json = await res.json();

    if (res.status === 429) {
      if (attempt === MAX_RETRIES) {
        throw new Error(`Rate limit exceeded after ${MAX_RETRIES} attempts. Wait a minute then retry.`);
      }
      onRetry?.(attempt, MAX_RETRIES);
      await new Promise((resolve) => setTimeout(resolve, 5000));
      continue;
    }

    const text: string | undefined = json?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (text) return text;

    throw new Error(
      `Gemini error (HTTP ${res.status}): ${JSON.stringify(json).slice(0, 300)}`,
    );
  }

  throw new Error("Max retries exceeded");
}

export async function extractOffersFromFile(
  file: File,
  apiKey: string,
  onRetry?: (attempt: number, max: number) => void,
  exchangeRates?: Record<string, number>,
  customCriteria?: CustomCriterionInput[],
): Promise<object[]> {
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  const prompt = buildPrompt(customCriteria);

  let offers: object[];
  if (ext === "pdf")  offers = await extractFromPDF(file, apiKey, onRetry, prompt);
  else if (ext === "xlsx" || ext === "xls") offers = await extractFromSpreadsheet(file, apiKey, "XLSX", onRetry, prompt);
  else if (ext === "csv")  offers = await extractFromSpreadsheet(file, apiKey, "CSV", onRetry, prompt);
  else if (ext === "docx" || ext === "doc") offers = await extractFromDocx(file, apiKey, onRetry, prompt);
  else throw new Error(`Unsupported file type: .${ext}`);

  return convertCurrency(offers, exchangeRates);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function convertCurrency(offers: object[], exchangeRates?: Record<string, number>): object[] {
  if (!exchangeRates) return offers;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return offers.map((o: any) => {
    const currency: string = o.currency ?? "USD";
    const rate = currency !== "USD" ? exchangeRates[currency] : null;
    if (!rate) return o;
    return {
      ...o,
      currency: "USD",
      _originalCurrency: currency,
      _originalOceanFreight: o.oceanFreightUSD,
      oceanFreightUSD: Math.round(o.oceanFreightUSD / rate),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      surcharges: (o.surcharges ?? []).map((s: any) => ({
        ...s,
        _originalAmount: s.amountUSD,
        amountUSD: Math.round(s.amountUSD / rate),
      })),
    };
  });
}

async function extractFromPDF(file: File, apiKey: string, onRetry?: (attempt: number, max: number) => void, prompt = buildPrompt()) {
  const base64 = await fileToBase64(file);
  const response = await callGemini(
    apiKey,
    [
      { inlineData: { mimeType: "application/pdf", data: base64 } },
      { text: `${prompt}\n\nThe source file type is PDF.` },
    ],
    onRetry,
  );
  return parseResponse(response, "PDF");
}

async function extractFromSpreadsheet(
  file: File,
  apiKey: string,
  source: "XLSX" | "CSV",
  onRetry?: (attempt: number, max: number) => void,
  prompt = buildPrompt(),
) {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: "buffer" });

  const csvParts: string[] = [];
  for (const sheetName of workbook.SheetNames) {
    const csv = XLSX.utils.sheet_to_csv(workbook.Sheets[sheetName]);
    if (csv.trim()) csvParts.push(`--- Sheet: ${sheetName} ---\n${csv}`);
  }

  const response = await callGemini(
    apiKey,
    [{ text: `${prompt}\n\nThe source file type is ${source}.\n\n---\n${csvParts.join("\n\n")}` }],
    onRetry,
  );
  return parseResponse(response, source);
}

async function extractFromDocx(file: File, apiKey: string, onRetry?: (attempt: number, max: number) => void, prompt = buildPrompt()) {
  const mammoth = await import("mammoth");
  const arrayBuffer = await file.arrayBuffer();
  const { value: text } = await mammoth.extractRawText({ arrayBuffer });

  if (text.trim().length < 50) {
    throw new Error(
      `"${file.name}" appears to contain image-only content. Please convert it to PDF and upload that instead.`,
    );
  }

  const response = await callGemini(
    apiKey,
    [{ text: `${prompt}\n\nThe source file type is DOCX.\n\n---\n${text}` }],
    onRetry,
  );
  return parseResponse(response, "DOCX");
}

function parseResponse(raw: string, source: string): object[] {
  let text = raw.trim();
  text = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "");

  try {
    const parsed = JSON.parse(text);
    const arr = Array.isArray(parsed) ? parsed : (parsed?.offers ?? []);
    if (!Array.isArray(arr)) throw new Error("No offers array found in response");
    return arr.map((o: object) => ({ ...o, source }));
  } catch {
    throw new Error(
      `Could not parse response as JSON. Raw response: ${raw.slice(0, 300)}`,
    );
  }
}

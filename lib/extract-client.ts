import * as XLSX from "xlsx";

const PROMPT = `You are extracting freight forwarder quote data from a shipping tender document.

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
  "pricingType": "fixed",
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
  "notes": "brief description"
}

Rules:
- "per": use "container" if the charge is per TEU/container, "shipment" if per shipment/booking, "filing" if per customs entry
- "inScope": false for Origin Local Charges and Customs/Excise filing fees (excluded under FOB Osaka incoterm). true for all other charges.
- All monetary amounts must be plain numbers in USD — no $ signs, no commas
- Return ONLY a valid JSON array — no markdown, no code blocks, no explanation text`;

const MODEL = "gemini-3.8-flash";
const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;
const MAX_RETRIES = 6;
const RETRY_DELAY_MS = 8000;

async function callGemini(
  apiKey: string,
  parts: object[],
): Promise<string> {
  const body = {
    contents: [{ parts }],
  };

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    const res = await fetch(`${API_URL}?key=${apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    const json = await res.json();

    // Try to extract text from the response body first, regardless of HTTP status
    const text: string | undefined =
      json?.candidates?.[0]?.content?.parts?.[0]?.text;

    if (text) return text;

    // No usable text — check if it's a 503 worth retrying
    const is503 =
      res.status === 503 ||
      JSON.stringify(json).includes("503") ||
      JSON.stringify(json).includes("overload") ||
      JSON.stringify(json).includes("high demand");

    if (!is503 || attempt === MAX_RETRIES) {
      throw new Error(
        `Gemini error (HTTP ${res.status}): ${JSON.stringify(json).slice(0, 300)}`,
      );
    }

    await new Promise((r) => setTimeout(r, RETRY_DELAY_MS));
  }

  throw new Error("Gemini did not return a response after all retries.");
}

export async function extractOffersFromFile(
  file: File,
  apiKey: string,
  onRetry?: (attempt: number, max: number) => void,
): Promise<object[]> {
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";

  if (ext === "pdf")  return extractFromPDF(file, apiKey);
  if (ext === "xlsx" || ext === "xls") return extractFromSpreadsheet(file, apiKey, "XLSX");
  if (ext === "csv")  return extractFromSpreadsheet(file, apiKey, "CSV");
  if (ext === "docx" || ext === "doc") return extractFromDocx(file, apiKey);

  throw new Error(`Unsupported file type: .${ext}`);
}

async function extractFromPDF(file: File, apiKey: string) {
  const buffer = await file.arrayBuffer();
  const base64 = arrayBufferToBase64(buffer);

  const text = await callGemini(apiKey, [
    { text: PROMPT + "\n\nThe source file type is PDF." },
    { inline_data: { mime_type: "application/pdf", data: base64 } },
  ]);

  return parseGeminiResponse(text, "PDF");
}

async function extractFromSpreadsheet(
  file: File,
  apiKey: string,
  source: "XLSX" | "CSV",
) {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: "buffer" });

  const csvParts: string[] = [];
  for (const sheetName of workbook.SheetNames) {
    const csv = XLSX.utils.sheet_to_csv(workbook.Sheets[sheetName]);
    if (csv.trim()) csvParts.push(`--- Sheet: ${sheetName} ---\n${csv}`);
  }

  const text = await callGemini(apiKey, [
    { text: PROMPT + `\n\nThe source file type is ${source}.` },
    { text: csvParts.join("\n\n") },
  ]);

  return parseGeminiResponse(text, source);
}

async function extractFromDocx(file: File, apiKey: string) {
  const mammoth = await import("mammoth");
  const arrayBuffer = await file.arrayBuffer();
  const { value: extracted } = await mammoth.extractRawText({ arrayBuffer });

  if (extracted.trim().length < 50) {
    throw new Error(
      `"${file.name}" appears to contain image-only content. Please convert it to PDF and upload that instead.`,
    );
  }

  const text = await callGemini(apiKey, [
    { text: PROMPT + "\n\nThe source file type is DOCX." },
    { text: extracted },
  ]);

  return parseGeminiResponse(text, "DOCX");
}

function parseGeminiResponse(raw: string, source: string): object[] {
  let text = raw.trim();
  text = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "");
  const match = text.match(/\[[\s\S]*\]/);
  if (match) text = match[0];

  try {
    const parsed = JSON.parse(text);
    if (!Array.isArray(parsed)) throw new Error("Response is not a JSON array");
    return parsed.map((o) => ({ ...o, source }));
  } catch {
    throw new Error(
      `Could not parse Gemini response as JSON. Raw response: ${raw.slice(0, 300)}`,
    );
  }
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

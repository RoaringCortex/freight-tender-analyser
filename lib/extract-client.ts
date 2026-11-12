import { GoogleGenerativeAI } from "@google/generative-ai";
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

export type ExtractionStatus = {
  file: string;
  status: "pending" | "extracting" | "done" | "error";
  error?: string;
};

const MODELS = [
  "gemini-3.8-flash",
  "gemini-2.5-flash",
  "gemini-2.5-flash-preview-05-20",
  "gemini-2.0-flash-lite",
];

export async function extractOffersFromFile(
  file: File,
  apiKey: string,
): Promise<object[]> {
  const genAI = new GoogleGenerativeAI(apiKey);
  let lastError: Error = new Error("No models available");

  for (const modelName of MODELS) {
    try {
      const model = genAI.getGenerativeModel({ model: modelName });
      const ext = file.name.split(".").pop()?.toLowerCase() ?? "";

      if (ext === "pdf")  return await extractFromPDF(file, model);
      if (ext === "xlsx" || ext === "xls") return await extractFromSpreadsheet(file, model, "XLSX");
      if (ext === "csv")  return await extractFromSpreadsheet(file, model, "CSV");
      if (ext === "docx" || ext === "doc") return await extractFromDocx(file, model);

      throw new Error(`Unsupported file type: .${ext}`);
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      const isTransient = lastError.message.includes("503") || lastError.message.includes("overload");
      if (!isTransient) throw lastError; // non-503 errors won't be fixed by trying another model
    }
  }

  throw new Error(`All Gemini models are currently busy. Please wait a minute and try again. (${lastError.message})`);
}

async function extractFromPDF(
  file: File,
  model: ReturnType<GoogleGenerativeAI["getGenerativeModel"]>,
) {
  const buffer = await file.arrayBuffer();
  const base64 = arrayBufferToBase64(buffer);

  const result = await model.generateContent([
    PROMPT + "\n\nThe source file type is PDF.",
    { inlineData: { mimeType: "application/pdf", data: base64 } },
  ]);

  return parseGeminiResponse(result.response.text(), "PDF");
}

async function extractFromSpreadsheet(
  file: File,
  model: ReturnType<GoogleGenerativeAI["getGenerativeModel"]>,
  source: "XLSX" | "CSV",
) {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: "buffer" });

  const csvParts: string[] = [];
  for (const sheetName of workbook.SheetNames) {
    const csv = XLSX.utils.sheet_to_csv(workbook.Sheets[sheetName]);
    if (csv.trim()) csvParts.push(`--- Sheet: ${sheetName} ---\n${csv}`);
  }

  const result = await model.generateContent([
    PROMPT + `\n\nThe source file type is ${source}.`,
    csvParts.join("\n\n"),
  ]);

  return parseGeminiResponse(result.response.text(), source);
}

async function extractFromDocx(
  file: File,
  model: ReturnType<GoogleGenerativeAI["getGenerativeModel"]>,
) {
  // Dynamic import so mammoth's browser bundle is used correctly
  const mammoth = await import("mammoth");
  const arrayBuffer = await file.arrayBuffer();
  const { value: text } = await mammoth.extractRawText({ arrayBuffer });

  if (text.trim().length < 50) {
    throw new Error(
      `"${file.name}" appears to contain image-only content — text extraction found nothing. ` +
        `Please convert it to PDF and upload that instead.`,
    );
  }

  const result = await model.generateContent([
    PROMPT + "\n\nThe source file type is DOCX.",
    text,
  ]);

  return parseGeminiResponse(result.response.text(), "DOCX");
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

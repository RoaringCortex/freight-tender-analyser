import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import * as XLSX from "xlsx";
import mammoth from "mammoth";

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

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const files = formData.getAll("files") as File[];

    if (!files.length) {
      return NextResponse.json({ error: "No files provided" }, { status: 400 });
    }

    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json({ error: "GEMINI_API_KEY is not set" }, { status: 500 });
    }

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const MODELS = ["gemini-3.8-flash", "gemini-2.5-flash", "gemini-2.0-flash-lite"];

    const allOffers: object[] = [];

    for (const file of files) {
      let lastError: Error | null = null;
      let succeeded = false;

      for (const modelName of MODELS) {
        for (let attempt = 1; attempt <= 3; attempt++) {
          try {
            const model = genAI.getGenerativeModel({ model: modelName });
            const offers = await extractFromFile(file, model);
            allOffers.push(...offers);
            succeeded = true;
            break;
          } catch (err) {
            lastError = err instanceof Error ? err : new Error(String(err));
            const is503 = lastError.message.includes("503");
            if (!is503) break; // non-503 errors won't be fixed by retrying
            if (attempt < 3) await new Promise((r) => setTimeout(r, 3000 * attempt));
          }
        }
        if (succeeded) break;
      }

      if (!succeeded) throw lastError;
    }

    return NextResponse.json({ offers: allOffers });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Extraction failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

async function extractFromFile(file: File, model: ReturnType<GoogleGenerativeAI["getGenerativeModel"]>) {
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";

  if (ext === "pdf") return extractFromPDF(file, model);
  if (ext === "xlsx" || ext === "xls") return extractFromSpreadsheet(file, model, "XLSX");
  if (ext === "csv") return extractFromSpreadsheet(file, model, "CSV");
  if (ext === "docx" || ext === "doc") return extractFromDocx(file, model);

  throw new Error(`Unsupported file type: .${ext}`);
}

async function extractFromPDF(file: File, model: ReturnType<GoogleGenerativeAI["getGenerativeModel"]>) {
  const buffer = await file.arrayBuffer();
  const base64 = Buffer.from(buffer).toString("base64");

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

async function extractFromDocx(file: File, model: ReturnType<GoogleGenerativeAI["getGenerativeModel"]>) {
  const buffer = Buffer.from(await file.arrayBuffer());
  const { value: text } = await mammoth.extractRawText({ buffer });

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

function parseGeminiResponse(raw: string, source: string) {
  let text = raw.trim();

  // Strip markdown code fences if Gemini added them despite instructions
  text = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "");

  // Find the JSON array even if there's surrounding text
  const match = text.match(/\[[\s\S]*\]/);
  if (match) text = match[0];

  try {
    const parsed = JSON.parse(text);
    if (!Array.isArray(parsed)) throw new Error("Response is not a JSON array");
    return parsed.map((o) => ({ ...o, source }));
  } catch {
    throw new Error(
      `Could not parse Gemini response as JSON. ` +
        `Raw response (first 400 chars): ${raw.slice(0, 400)}`,
    );
  }
}

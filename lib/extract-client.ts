import * as XLSX from "xlsx";

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const GROQ_MODEL = "openai/gpt-oss-20b";

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

async function callGroq(apiKey: string, content: string): Promise<string> {
  const res = await fetch(GROQ_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: GROQ_MODEL,
      temperature: 0,
      messages: [{ role: "user", content }],
    }),
  });

  const json = await res.json();

  const text: string | undefined = json?.choices?.[0]?.message?.content;
  if (text) return text;

  throw new Error(
    `Groq error (HTTP ${res.status}): ${JSON.stringify(json).slice(0, 300)}`,
  );
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
  const text = await extractTextFromPDF(file);

  if (text.trim().length < 50) {
    throw new Error(
      `"${file.name}" appears to be a scanned/image PDF with no readable text. Please use a text-based PDF.`,
    );
  }

  const response = await callGroq(
    apiKey,
    `${PROMPT}\n\nThe source file type is PDF.\n\n---\n${text}`,
  );

  return parseGroqResponse(response, "PDF");
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

  const response = await callGroq(
    apiKey,
    `${PROMPT}\n\nThe source file type is ${source}.\n\n---\n${csvParts.join("\n\n")}`,
  );

  return parseGroqResponse(response, source);
}

async function extractFromDocx(file: File, apiKey: string) {
  const mammoth = await import("mammoth");
  const arrayBuffer = await file.arrayBuffer();
  const { value: text } = await mammoth.extractRawText({ arrayBuffer });

  if (text.trim().length < 50) {
    throw new Error(
      `"${file.name}" appears to contain image-only content. Please convert it to PDF and upload that instead.`,
    );
  }

  const response = await callGroq(
    apiKey,
    `${PROMPT}\n\nThe source file type is DOCX.\n\n---\n${text}`,
  );

  return parseGroqResponse(response, "DOCX");
}

async function extractTextFromPDF(file: File): Promise<string> {
  const pdfjsLib = await import("pdfjs-dist");
  pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

  const pages: string[] = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const pageText = content.items
      .map((item) => ("str" in item ? item.str : ""))
      .join(" ");
    pages.push(pageText);
  }

  return pages.join("\n\n");
}

function parseGroqResponse(raw: string, source: string): object[] {
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
      `Could not parse response as JSON. Raw response: ${raw.slice(0, 300)}`,
    );
  }
}

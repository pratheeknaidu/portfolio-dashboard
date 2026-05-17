import { NextRequest, NextResponse } from "next/server";
import { verifyRequest } from "@/lib/verify-token";
import { importHoldings, ImportError, type ImportInput } from "@/lib/import";

export async function POST(req: NextRequest) {
  const authResult = await verifyRequest(req);
  if (authResult instanceof NextResponse) return authResult;

  const contentType = req.headers.get("content-type") || "";
  let input: ImportInput;

  if (contentType.includes("application/json")) {
    const { pasteText } = await req.json();
    if (!pasteText || typeof pasteText !== "string") {
      return NextResponse.json({ error: "No text provided" }, { status: 400 });
    }
    input = { pasteText };
  } else {
    const formData = await req.formData();
    const file = formData.get("file") as File;
    if (!file) {
      return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
    }
    input = { csvText: await file.text() };
  }

  try {
    const result = await importHoldings(authResult.uid, input);
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof ImportError) {
      return NextResponse.json({ error: err.message }, { status: err.statusCode });
    }
    console.error("Import failed:", err);
    return NextResponse.json({ error: "Import failed" }, { status: 500 });
  }
}

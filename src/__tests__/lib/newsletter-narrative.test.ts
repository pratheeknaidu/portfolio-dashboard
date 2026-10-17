/**
 * @jest-environment node
 */
import { writeNarrative } from "@/lib/newsletter/narrative";
import type { NewsletterReport } from "@/lib/newsletter/build-report";

const mockGenerate = jest.fn();
jest.mock("@google/genai", () => ({
  GoogleGenAI: jest.fn().mockImplementation(() => ({ models: { generateContent: mockGenerate } })),
}));

const report = { date: "2026-10-15" } as NewsletterReport;

describe("writeNarrative", () => {
  const env = process.env;
  beforeEach(() => {
    mockGenerate.mockReset();
    process.env = { ...env, GEMINI_API_KEY: "key" };
  });
  afterAll(() => {
    process.env = env;
  });

  it("returns null without calling Gemini when no key is set", async () => {
    delete process.env.GEMINI_API_KEY;
    expect(await writeNarrative(report)).toBeNull();
    expect(mockGenerate).not.toHaveBeenCalled();
  });

  it("asks a search-grounded Flash model and returns its text", async () => {
    mockGenerate.mockResolvedValue({ text: "  ### What drove yesterday\n- **NVDA** up  " });
    expect(await writeNarrative(report)).toBe("### What drove yesterday\n- **NVDA** up");
    expect(mockGenerate).toHaveBeenCalledWith(
      expect.objectContaining({
        model: "gemini-flash-latest",
        config: expect.objectContaining({ tools: [{ googleSearch: {} }] }),
      }),
    );
  });

  it("honours GEMINI_MODEL", async () => {
    process.env.GEMINI_MODEL = "gemini-other";
    mockGenerate.mockResolvedValue({ text: "x" });
    await writeNarrative(report);
    expect(mockGenerate).toHaveBeenCalledWith(expect.objectContaining({ model: "gemini-other" }));
  });

  it("returns null on errors such as quota exhaustion", async () => {
    jest.spyOn(console, "error").mockImplementation(() => {});
    mockGenerate.mockRejectedValue(new Error("429 RESOURCE_EXHAUSTED"));
    expect(await writeNarrative(report)).toBeNull();
  });
});

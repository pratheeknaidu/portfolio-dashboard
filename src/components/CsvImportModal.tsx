"use client";
import { useState, useRef, useEffect } from "react";
import { useAuth } from "@/lib/auth-context";

interface Props {
  onClose: () => void;
  onSuccess: () => void;
}

interface ImportResult {
  imported: string[];
  updated: string[];
  errors: string[];
}

type ImportMode = "paste" | "csv";

export function CsvImportModal({ onClose, onSuccess }: Props) {
  const { getIdToken } = useAuth();
  const fileRef = useRef<HTMLInputElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [mode, setMode] = useState<ImportMode>("paste");
  const [file, setFile] = useState<File | null>(null);
  const [pasteText, setPasteText] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const handleSubmit = async () => {
    setLoading(true);
    setError(null);

    try {
      const token = await getIdToken();
      let res: Response;

      if (mode === "csv") {
        if (!file) return;
        const formData = new FormData();
        formData.append("file", file);
        res = await fetch("/api/import", {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
          body: formData,
        });
      } else {
        res = await fetch("/api/import", {
          method: "POST",
          headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
          body: JSON.stringify({ pasteText }),
        });
      }

      if (!res.ok) throw new Error("Import failed");
      const data: ImportResult = await res.json();
      setResult(data);

      if (data.imported.length > 0 || data.updated.length > 0) {
        timerRef.current = setTimeout(onSuccess, 2000);
      }
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  };

  const handleResultClose = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (result && (result.imported.length > 0 || result.updated.length > 0)) {
      onSuccess();
    } else {
      onClose();
    }
  };

  const canSubmit = mode === "csv" ? !!file : pasteText.trim().length > 0;

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
      <div className="bg-surface-card border border-surface-border rounded-xl p-6 w-[480px] shadow-2xl">
        <h2 className="text-lg font-bold text-white mb-4">Import Holdings</h2>

        {!result ? (
          <>
            <div className="flex gap-1 mb-4 bg-surface-bg rounded-lg p-1">
              <button
                onClick={() => setMode("paste")}
                className={`flex-1 px-3 py-1.5 text-sm rounded-md transition ${mode === "paste" ? "bg-accent text-white" : "text-gray-400 hover:text-white"}`}
              >
                Paste from Robinhood
              </button>
              <button
                onClick={() => setMode("csv")}
                className={`flex-1 px-3 py-1.5 text-sm rounded-md transition ${mode === "csv" ? "bg-accent text-white" : "text-gray-400 hover:text-white"}`}
              >
                Upload CSV
              </button>
            </div>

            {mode === "paste" ? (
              <>
                <p className="text-xs text-gray-500 mb-2">
                  Go to Robinhood → Stocks, select all text from the positions list, and paste below.
                </p>
                <textarea
                  value={pasteText}
                  onChange={(e) => setPasteText(e.target.value)}
                  placeholder="Paste positions text here..."
                  aria-label="Paste positions"
                  className="w-full h-40 bg-surface-bg border border-surface-border rounded-lg p-3 text-sm text-gray-300 placeholder-gray-600 resize-none focus:outline-none focus:border-accent"
                />
              </>
            ) : (
              <>
                <label htmlFor="csv-file" className="block text-sm text-gray-400 mb-2">
                  Choose file
                </label>
                <input
                  id="csv-file"
                  ref={fileRef}
                  type="file"
                  accept=".csv"
                  aria-label="Choose file"
                  onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                  className="block w-full text-sm text-gray-300 mb-4"
                />
              </>
            )}

            {error && <p className="text-loss text-sm mb-2">{error}</p>}
            <div className="flex justify-end gap-3 mt-4">
              <button onClick={onClose} className="px-4 py-2 text-sm text-gray-400 hover:text-white">
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={!canSubmit || loading}
                className="px-4 py-2 text-sm bg-accent rounded-lg text-white disabled:opacity-50"
              >
                {loading ? "Importing..." : "Import"}
              </button>
            </div>
          </>
        ) : (
          <div className="space-y-2 text-sm">
            {result.imported.length > 0 && (
              <p className="text-gain">Imported: {result.imported.join(", ")}</p>
            )}
            {result.updated.length > 0 && (
              <p className="text-accent">Updated: {result.updated.join(", ")}</p>
            )}
            {result.errors.length > 0 && (
              <div className="text-loss">
                <p>Errors:</p>
                {result.errors.map((e, i) => <p key={i}>{e}</p>)}
              </div>
            )}
            <button onClick={handleResultClose} className="mt-4 px-4 py-2 text-sm bg-surface-border rounded text-white">
              Close
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

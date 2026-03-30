"use client";
import { useState, useRef } from "react";
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

export function CsvImportModal({ onClose, onSuccess }: Props) {
  const { getIdToken } = useAuth();
  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleUpload = async () => {
    if (!file) return;
    setLoading(true);
    setError(null);

    try {
      const token = await getIdToken();
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/import", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });

      if (!res.ok) throw new Error("Import failed");
      const data: ImportResult = await res.json();
      setResult(data);

      if (data.errors.length === 0) {
        setTimeout(onSuccess, 2000);
      }
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
      <div className="bg-surface-card border border-surface-border rounded-xl p-6 w-96 shadow-2xl">
        <h2 className="text-lg font-bold text-white mb-4">Import CSV</h2>

        {!result ? (
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
            {error && <p className="text-loss text-sm mb-2">{error}</p>}
            <div className="flex justify-end gap-3">
              <button onClick={onClose} className="px-4 py-2 text-sm text-gray-400 hover:text-white">
                Cancel
              </button>
              <button
                onClick={handleUpload}
                disabled={!file || loading}
                className="px-4 py-2 text-sm bg-accent rounded-lg text-white disabled:opacity-50"
              >
                {loading ? "Uploading..." : "Upload"}
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
            <button onClick={onClose} className="mt-4 px-4 py-2 text-sm bg-surface-border rounded text-white">
              Close
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

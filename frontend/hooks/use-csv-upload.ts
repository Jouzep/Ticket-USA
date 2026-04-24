"use client";

import Papa from "papaparse";
import { useCallback, useState } from "react";

export interface CsvPreviewRow {
  ticket_id?: string;
  first_name?: string;
  last_name?: string;
  dob?: string;
}

export interface CsvPreview {
  fileName: string;
  rowCount: number;
  preview: CsvPreviewRow[];
  missingColumns: string[];
}

const REQUIRED = ["ticket_id", "first_name", "last_name", "dob"];

export function useCsvUpload() {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<CsvPreview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [parsing, setParsing] = useState(false);

  const parseFile = useCallback(async (selected: File) => {
    setParsing(true);
    setError(null);
    setPreview(null);

    if (!selected.name.toLowerCase().endsWith(".csv")) {
      setError("Please upload a .csv file");
      setParsing(false);
      return;
    }
    if (selected.size > 5 * 1024 * 1024) {
      setError("File too large (max 5MB)");
      setParsing(false);
      return;
    }

    Papa.parse<CsvPreviewRow>(selected, {
      header: true,
      skipEmptyLines: true,
      preview: 5,
      transformHeader: (h) => h.trim().toLowerCase(),
      complete: (result) => {
        const fields = (result.meta.fields ?? []).map((f) => f.toLowerCase());
        const missing = REQUIRED.filter((c) => !fields.includes(c));
        setPreview({
          fileName: selected.name,
          rowCount: result.data.length,
          preview: result.data,
          missingColumns: missing,
        });
        setFile(selected);
        setParsing(false);
      },
      error: (err) => {
        setError(err.message || "Failed to parse CSV");
        setParsing(false);
      },
    });
  }, []);

  const reset = useCallback(() => {
    setFile(null);
    setPreview(null);
    setError(null);
  }, []);

  return { file, preview, error, parsing, parseFile, reset };
}

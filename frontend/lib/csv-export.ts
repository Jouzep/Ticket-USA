import type { TicketResult } from "@/types/events";

export function downloadResultsCsv(results: TicketResult[], filename = "ticket-results.csv") {
  if (results.length === 0) return;
  const cols: (keyof TicketResult)[] = [
    "ticket_id",
    "summons_number",
    "status",
    "violation_code",
    "violation_description",
    "issue_date",
    "plate",
    "state",
    "fine_amount",
    "penalty",
    "interest",
    "paid",
    "amount_due",
  ];
  const escape = (v: unknown): string => {
    if (v == null) return "";
    const s = String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const header = cols.join(",");
  const rows = results.map((r) => cols.map((c) => escape(r[c])).join(","));
  const csv = [header, ...rows].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

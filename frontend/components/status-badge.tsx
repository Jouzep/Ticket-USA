import { Badge } from "@/components/ui/badge";
import type { TicketStatusValue } from "@/types/events";

const VARIANT: Record<TicketStatusValue, "success" | "warning" | "danger" | "info" | "neutral"> = {
  OPEN: "danger",
  PARTIAL: "warning",
  "PAID IN FULL": "success",
  DISMISSED: "info",
  UNKNOWN: "neutral",
};

export function StatusBadge({ status }: { status: TicketStatusValue }) {
  return <Badge variant={VARIANT[status] ?? "neutral"}>{status}</Badge>;
}

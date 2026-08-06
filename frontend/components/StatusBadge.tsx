import type { PlotStatus } from "@/lib/types";
import { STATUS_LABEL } from "@/lib/types";

const STYLE: Record<PlotStatus, string> = {
  active: "bg-stone-100 text-stone-700",
  chain_pending: "bg-amber-100 text-amber-800",
  on_chain: "bg-emerald-100 text-emerald-800",
  rejected: "bg-red-100 text-red-700",
};

export default function StatusBadge({ status }: { status: PlotStatus }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${STYLE[status]}`}
    >
      {status === "chain_pending" && (
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-amber-500" />
      )}
      {STATUS_LABEL[status]}
    </span>
  );
}

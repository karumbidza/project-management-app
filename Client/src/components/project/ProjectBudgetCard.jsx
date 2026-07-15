/**
 * ProjectBudgetCard (FOLLO ENGINE)
 * Budget vs Committed (approved contractor quotes) vs Actual. Manager-only —
 * the endpoint 403s for the field, and we simply render nothing in that case.
 */
import { useEffect, useState } from "react";
import { useAuth } from "@clerk/clerk-react";
import { Wallet } from "lucide-react";
import { API_V1, apiCall } from "../../features/apiHelper";

const money = (n) =>
  n == null
    ? "—"
    : `$${Number(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

function Tile({ label, value, tone }) {
  const color =
    tone === "danger" ? "text-red-600 dark:text-red-400"
      : tone === "amber" ? "text-amber-600 dark:text-amber-400"
      : tone === "green" ? "text-green-600 dark:text-green-400"
      : "text-zinc-900 dark:text-zinc-100";
  return (
    <div className="flex flex-col">
      <span className="text-[11px] uppercase tracking-wide text-zinc-400">{label}</span>
      <span className={`text-lg font-semibold tabular-nums ${color}`}>{value}</span>
    </div>
  );
}

export default function ProjectBudgetCard({ projectId }) {
  const { getToken } = useAuth();
  const [data, setData] = useState(null);
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await apiCall(`${API_V1}/projects/${projectId}/cost-summary`, { method: "GET" }, getToken);
        if (alive) setData(res.data);
      } catch {
        if (alive) setHidden(true); // non-manager or error → hide the card entirely
      }
    })();
    return () => { alive = false; };
  }, [projectId, getToken]);

  if (hidden || !data) return null;

  // Nothing to show until there's a budget or an approved quote.
  if (data.budget == null && data.committed === 0 && data.actual === 0) return null;

  const committedTone = data.overBudget ? "danger" : "amber";
  const remainingTone = data.remaining != null && data.remaining < 0 ? "danger" : "green";

  return (
    <div className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl p-4 mb-6">
      <div className="flex items-center gap-2 mb-3">
        <Wallet className="w-4 h-4 text-zinc-500" />
        <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Budget</h3>
        {data.overBudget && (
          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300">
            Over budget
          </span>
        )}
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Tile label="Budget" value={money(data.budget)} />
        <Tile label="Committed" value={money(data.committed)} tone={committedTone} />
        <Tile label="Actual" value={money(data.actual)} tone="green" />
        <Tile
          label="Remaining"
          value={data.remaining == null ? "—" : money(data.remaining)}
          tone={remainingTone}
        />
      </div>
      {/* Committed vs budget bar */}
      {data.budget != null && data.budget > 0 && (
        <div className="mt-3 h-1.5 w-full rounded-full bg-zinc-100 dark:bg-zinc-800 overflow-hidden">
          <div
            className={`h-full transition-all ${data.overBudget ? "bg-red-500" : "bg-amber-500"}`}
            style={{ width: `${Math.min(100, (data.committed / data.budget) * 100)}%` }}
          />
        </div>
      )}
      <p className="mt-2 text-[11px] text-zinc-400">
        Committed = approved contractor quotes across this project’s tasks.
      </p>
    </div>
  );
}

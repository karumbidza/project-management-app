/**
 * TaskBreakdownPanel (FOLLO ENGINE)
 * The awarded contractor breaks a task into priced, scheduled subtasks and
 * submits the quote for PM approval. Once approved, subtasks are checked off to
 * drive the task's % (and the project's progress). Cost is only shown to the PM
 * and the owning contractor (server-gated via canSeeCost).
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@clerk/clerk-react";
import toast from "react-hot-toast";
import {
  Plus, Trash2, Check, Send, ThumbsUp, ThumbsDown,
  Pencil, X, ListChecks, Loader2,
} from "lucide-react";
import { API_V1, apiCall } from "../../features/apiHelper";

const money = (n) =>
  `$${Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const STATUS_PILL = {
  NONE:      { label: "Not started", cls: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300" },
  DRAFT:     { label: "Draft",       cls: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300" },
  SUBMITTED: { label: "Awaiting approval", cls: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300" },
  APPROVED:  { label: "Approved",    cls: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300" },
  REJECTED:  { label: "Sent back",   cls: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300" },
};

const emptyDraft = () => ({
  title: "", description: "", plannedStartDate: "", plannedEndDate: "",
  quotedCost: "", completionWeight: 1, lineItems: [],
});

export default function TaskBreakdownPanel({ taskId, isReadOnly = false, onProgressChange }) {
  const { getToken } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [draft, setDraft] = useState(emptyDraft());
  const [rejecting, setRejecting] = useState(false);
  const [rejectReason, setRejectReason] = useState("");

  const load = useCallback(async () => {
    try {
      const res = await apiCall(`${API_V1}/tasks/${taskId}/breakdown`, { method: "GET" }, getToken);
      setData(res.data);
    } catch (e) {
      toast.error(e.message || "Failed to load breakdown");
    } finally {
      setLoading(false);
    }
  }, [taskId, getToken]);

  useEffect(() => { load(); }, [load]);

  const status = data?.breakdownStatus || "NONE";
  const editable = ["NONE", "DRAFT", "REJECTED"].includes(status);
  const canManage = !!data?.canManage && !isReadOnly;
  const canApprove = !!data?.canApprove && !isReadOnly;
  const canSeeCost = !!data?.canSeeCost;
  const subtasks = data?.subtasks || [];

  // Derived quote total for the draft (line items override the lump sum).
  const draftTotal = useMemo(() => {
    if (draft.lineItems.length > 0) {
      return draft.lineItems.reduce((s, li) => s + Number(li.quantity || 0) * Number(li.unitCost || 0), 0);
    }
    return Number(draft.quotedCost || 0);
  }, [draft]);

  const refresh = async (progress) => {
    await load();
    if (progress != null && onProgressChange) onProgressChange(progress);
  };

  const buildBody = () => ({
    title: draft.title.trim(),
    description: draft.description?.trim() || null,
    plannedStartDate: draft.plannedStartDate || null,
    plannedEndDate: draft.plannedEndDate || null,
    quotedCost: draft.lineItems.length > 0 ? undefined : Number(draft.quotedCost || 0),
    completionWeight: Number(draft.completionWeight || 1),
    lineItems: draft.lineItems.length > 0
      ? draft.lineItems
          .filter((li) => li.label.trim())
          .map((li) => ({ label: li.label.trim(), quantity: Number(li.quantity || 0), unitCost: Number(li.unitCost || 0) }))
      : undefined,
  });

  const submitDraft = async () => {
    if (!draft.title.trim()) return toast.error("Give the subtask a title");
    setBusy(true);
    try {
      if (editingId) {
        await apiCall(`${API_V1}/tasks/subtasks/${editingId}`, { method: "PATCH", body: JSON.stringify(buildBody()) }, getToken);
      } else {
        await apiCall(`${API_V1}/tasks/${taskId}/subtasks`, { method: "POST", body: JSON.stringify(buildBody()) }, getToken);
      }
      setAdding(false); setEditingId(null); setDraft(emptyDraft());
      await refresh();
    } catch (e) {
      toast.error(e.message || "Could not save subtask");
    } finally { setBusy(false); }
  };

  const startEdit = (st) => {
    setEditingId(st.id);
    setAdding(true);
    setDraft({
      title: st.title || "",
      description: st.description || "",
      plannedStartDate: st.plannedStartDate ? st.plannedStartDate.slice(0, 10) : "",
      plannedEndDate: st.plannedEndDate ? st.plannedEndDate.slice(0, 10) : "",
      quotedCost: st.quotedCost != null ? String(st.quotedCost) : "",
      completionWeight: st.completionWeight || 1,
      lineItems: (st.lineItems || []).map((li) => ({ label: li.label, quantity: li.quantity, unitCost: li.unitCost })),
    });
  };

  const removeSubtask = async (id) => {
    if (!window.confirm("Delete this subtask?")) return;
    setBusy(true);
    try {
      await apiCall(`${API_V1}/tasks/subtasks/${id}`, { method: "DELETE" }, getToken);
      await refresh();
    } catch (e) { toast.error(e.message || "Could not delete"); }
    finally { setBusy(false); }
  };

  const toggle = async (st) => {
    setBusy(true);
    try {
      const res = await apiCall(
        `${API_V1}/tasks/subtasks/${st.id}/complete`,
        { method: "PATCH", body: JSON.stringify({ isComplete: !st.isComplete }) },
        getToken,
      );
      await refresh(res.data?.projectProgress);
    } catch (e) { toast.error(e.message || "Could not update"); }
    finally { setBusy(false); }
  };

  const lifecycle = async (action, extra) => {
    setBusy(true);
    try {
      const res = await apiCall(`${API_V1}/tasks/${taskId}/breakdown/${action}`, { method: "POST", body: JSON.stringify(extra || {}) }, getToken);
      setData(res.data);
      if (action === "approve" && onProgressChange) onProgressChange(res.data?.summary?.pct);
      setRejecting(false); setRejectReason("");
      toast.success(
        action === "submit" ? "Submitted for approval" : action === "approve" ? "Breakdown approved" : "Sent back for revision",
      );
    } catch (e) { toast.error(e.message || "Action failed"); }
    finally { setBusy(false); }
  };

  if (loading) {
    return (
      <div className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl p-4 flex items-center gap-2 text-sm text-zinc-500">
        <Loader2 className="w-4 h-4 animate-spin" /> Loading breakdown…
      </div>
    );
  }

  const pill = STATUS_PILL[status] || STATUS_PILL.NONE;
  const summary = data?.summary || { total: 0, complete: 0, pct: 0 };

  return (
    <div className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl p-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-2">
          <ListChecks className="w-4 h-4 text-zinc-500" />
          <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Breakdown &amp; quote</h3>
          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${pill.cls}`}>{pill.label}</span>
        </div>
        {summary.total > 0 && (
          <span className="text-xs text-zinc-500 tabular-nums">{summary.complete}/{summary.total} · {summary.pct}%</span>
        )}
      </div>

      {/* Progress bar */}
      {summary.total > 0 && (
        <div className="h-1.5 w-full rounded-full bg-zinc-100 dark:bg-zinc-800 mb-3 overflow-hidden">
          <div className="h-full bg-green-500 transition-all" style={{ width: `${summary.pct}%` }} />
        </div>
      )}

      {/* Quote total */}
      {canSeeCost && summary.total > 0 && (
        <div className="flex items-center justify-between text-xs mb-3 px-2.5 py-2 rounded-lg bg-zinc-50 dark:bg-zinc-900">
          <span className="text-zinc-500">Quoted total{status === "APPROVED" ? " (committed)" : ""}</span>
          <span className="font-semibold tabular-nums text-zinc-900 dark:text-zinc-100">{money(summary.totalQuoted)}</span>
        </div>
      )}

      {/* Rejection reason */}
      {status === "REJECTED" && data?.breakdownRejectionReason && (
        <div className="text-xs text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg px-2.5 py-2 mb-3">
          Sent back: {data.breakdownRejectionReason}
        </div>
      )}

      {/* Subtask list */}
      {subtasks.length === 0 && !adding && (
        <p className="text-xs text-zinc-400 py-2">
          {canManage ? "Break this task into priced, scheduled subtasks." : "No breakdown yet."}
        </p>
      )}
      <ul className="flex flex-col gap-1.5">
        {subtasks.map((st) => (
          <li key={st.id} className="flex items-start gap-2 py-1.5 border-b border-zinc-100 dark:border-zinc-800 last:border-0">
            <button
              disabled={!canManage || status !== "APPROVED" || busy}
              onClick={() => toggle(st)}
              className={`mt-0.5 w-4 h-4 shrink-0 rounded border flex items-center justify-center transition
                ${st.isComplete ? "bg-green-500 border-green-500 text-white" : "border-zinc-300 dark:border-zinc-600"}
                ${canManage && status === "APPROVED" ? "cursor-pointer hover:border-green-400" : "cursor-default opacity-70"}`}
              title={status === "APPROVED" ? "Toggle complete" : "Available once approved"}
            >
              {st.isComplete && <Check className="w-3 h-3" />}
            </button>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className={`text-sm truncate ${st.isComplete ? "line-through text-zinc-400" : "text-zinc-800 dark:text-zinc-200"}`}>
                  {st.title}
                </span>
                {canSeeCost && st.quotedCost != null && (
                  <span className="text-xs text-zinc-500 tabular-nums shrink-0">{money(st.quotedCost)}</span>
                )}
              </div>
              <div className="flex items-center gap-2 text-[11px] text-zinc-400">
                {(st.plannedStartDate || st.plannedEndDate) && (
                  <span>{(st.plannedStartDate || "").slice(0, 10)}{st.plannedEndDate ? ` → ${st.plannedEndDate.slice(0, 10)}` : ""}</span>
                )}
                {canSeeCost && st.lineItems?.length > 0 && <span>· {st.lineItems.length} item(s)</span>}
              </div>
            </div>
            {canManage && editable && (
              <div className="flex items-center gap-1 shrink-0">
                <button onClick={() => startEdit(st)} className="p-1 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200" title="Edit">
                  <Pencil className="w-3.5 h-3.5" />
                </button>
                <button onClick={() => removeSubtask(st.id)} className="p-1 text-zinc-400 hover:text-red-600" title="Delete">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </li>
        ))}
      </ul>

      {/* Add / edit form */}
      {adding && canManage && editable && (
        <div className="mt-3 p-3 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 flex flex-col gap-2">
          <input
            className="text-sm px-2.5 py-1.5 rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950"
            placeholder="Subtask title (e.g. First coat)"
            value={draft.title}
            onChange={(e) => setDraft({ ...draft, title: e.target.value })}
          />
          <div className="grid grid-cols-2 gap-2">
            <label className="text-[11px] text-zinc-500">Start
              <input type="date" className="w-full text-sm px-2 py-1 rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950"
                value={draft.plannedStartDate} onChange={(e) => setDraft({ ...draft, plannedStartDate: e.target.value })} />
            </label>
            <label className="text-[11px] text-zinc-500">Finish
              <input type="date" className="w-full text-sm px-2 py-1 rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950"
                value={draft.plannedEndDate} onChange={(e) => setDraft({ ...draft, plannedEndDate: e.target.value })} />
            </label>
          </div>

          {/* Line items */}
          {canSeeCost && (
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-medium text-zinc-500">Line items (materials + labour)</span>
                <button
                  className="text-[11px] text-blue-600 hover:underline flex items-center gap-0.5"
                  onClick={() => setDraft({ ...draft, lineItems: [...draft.lineItems, { label: "", quantity: 1, unitCost: 0 }] })}
                >
                  <Plus className="w-3 h-3" /> add line
                </button>
              </div>
              {draft.lineItems.map((li, i) => (
                <div key={i} className="flex items-center gap-1.5">
                  <input className="flex-1 text-xs px-2 py-1 rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950"
                    placeholder="e.g. Paint cans" value={li.label}
                    onChange={(e) => { const l = [...draft.lineItems]; l[i] = { ...l[i], label: e.target.value }; setDraft({ ...draft, lineItems: l }); }} />
                  <input type="number" min="0" className="w-14 text-xs px-2 py-1 rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950"
                    placeholder="qty" value={li.quantity}
                    onChange={(e) => { const l = [...draft.lineItems]; l[i] = { ...l[i], quantity: e.target.value }; setDraft({ ...draft, lineItems: l }); }} />
                  <input type="number" min="0" step="0.01" className="w-20 text-xs px-2 py-1 rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950"
                    placeholder="unit $" value={li.unitCost}
                    onChange={(e) => { const l = [...draft.lineItems]; l[i] = { ...l[i], unitCost: e.target.value }; setDraft({ ...draft, lineItems: l }); }} />
                  <button className="p-1 text-zinc-400 hover:text-red-600"
                    onClick={() => setDraft({ ...draft, lineItems: draft.lineItems.filter((_, j) => j !== i) })}>
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
              {/* Lump sum when not itemised */}
              {draft.lineItems.length === 0 && (
                <label className="text-[11px] text-zinc-500">Quote ($)
                  <input type="number" min="0" step="0.01" className="w-full text-sm px-2 py-1 rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950"
                    placeholder="Lump sum" value={draft.quotedCost} onChange={(e) => setDraft({ ...draft, quotedCost: e.target.value })} />
                </label>
              )}
              <div className="flex items-center justify-between text-[11px] pt-1">
                <span className="text-zinc-400">Weight
                  <input type="number" min="1" max="100" className="ml-1 w-12 px-1.5 py-0.5 rounded border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950"
                    value={draft.completionWeight} onChange={(e) => setDraft({ ...draft, completionWeight: e.target.value })} />
                </span>
                <span className="font-semibold text-zinc-700 dark:text-zinc-200">Subtotal {money(draftTotal)}</span>
              </div>
            </div>
          )}

          <div className="flex items-center gap-2 pt-1">
            <button disabled={busy} onClick={submitDraft}
              className="text-xs font-medium px-3 py-1.5 rounded-md bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 disabled:opacity-50">
              {editingId ? "Save" : "Add subtask"}
            </button>
            <button onClick={() => { setAdding(false); setEditingId(null); setDraft(emptyDraft()); }}
              className="text-xs text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200">Cancel</button>
          </div>
        </div>
      )}

      {/* Footer actions */}
      <div className="mt-3 flex items-center gap-2 flex-wrap">
        {canManage && editable && !adding && (
          <button onClick={() => { setAdding(true); setEditingId(null); setDraft(emptyDraft()); }}
            className="text-xs font-medium px-3 py-1.5 rounded-md border border-zinc-300 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-900 flex items-center gap-1">
            <Plus className="w-3.5 h-3.5" /> Add subtask
          </button>
        )}
        {canManage && editable && subtasks.length > 0 && (
          <button disabled={busy} onClick={() => lifecycle("submit")}
            className="text-xs font-medium px-3 py-1.5 rounded-md bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 flex items-center gap-1">
            <Send className="w-3.5 h-3.5" /> Submit for approval
          </button>
        )}
        {canApprove && status === "SUBMITTED" && !rejecting && (
          <>
            <button disabled={busy} onClick={() => lifecycle("approve")}
              className="text-xs font-medium px-3 py-1.5 rounded-md bg-green-600 text-white hover:bg-green-700 disabled:opacity-50 flex items-center gap-1">
              <ThumbsUp className="w-3.5 h-3.5" /> Approve
            </button>
            <button disabled={busy} onClick={() => setRejecting(true)}
              className="text-xs font-medium px-3 py-1.5 rounded-md border border-red-300 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center gap-1">
              <ThumbsDown className="w-3.5 h-3.5" /> Reject
            </button>
          </>
        )}
      </div>

      {/* Reject reason */}
      {canApprove && rejecting && (
        <div className="mt-2 flex flex-col gap-2">
          <textarea rows={2} className="text-sm px-2.5 py-1.5 rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950"
            placeholder="What needs changing?" value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} />
          <div className="flex items-center gap-2">
            <button disabled={busy} onClick={() => lifecycle("reject", { reason: rejectReason })}
              className="text-xs font-medium px-3 py-1.5 rounded-md bg-red-600 text-white hover:bg-red-700 disabled:opacity-50">Send back</button>
            <button onClick={() => { setRejecting(false); setRejectReason(""); }} className="text-xs text-zinc-500">Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}

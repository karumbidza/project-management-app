// FOLLO CALENDAR
// Operational scheduling calendar — Month / Week / Day / Agenda over the merged
// feed (tasks + milestones + deadlines + events). Used globally (/calendar) and
// per-project (?tab=calendar). Matches the app's zinc/blue design language.
import { useState, useEffect, useMemo, useCallback } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useAuth } from "@clerk/clerk-react";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import {
  format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, startOfDay, endOfDay,
  eachDayOfInterval, addMonths, addWeeks, addDays, isSameDay, isSameMonth, parseISO,
} from "date-fns";
import {
  Calendar as CalendarIcon, ChevronLeft, ChevronRight, Plus, X, MapPin, Users, Loader2,
} from "lucide-react";
import useUserRole from "../hooks/useUserRole";
import { updateTaskAsync } from "../features/taskSlice";
import {
  fetchCalendarFeed, createEventAsync, deleteEventAsync,
  fetchProjectWeatherAsync, setProjectLocationAsync,
} from "../features/calendarSlice";

const EVENT_TYPES = {
  PROJECT_MEETING: "Project meeting", SITE_MEETING: "Site meeting", CONTRACTOR_MEETING: "Contractor meeting",
  CLIENT_MEETING: "Client meeting", INSPECTION: "Inspection", SITE_VISIT: "Site visit", HANDOVER: "Handover",
  PROGRESS_REVIEW: "Progress review", INTERNAL_MEETING: "Internal meeting", SITE_ACTIVITY: "Site activity",
  MAINTENANCE: "Maintenance", APPOINTMENT: "Appointment", OTHER: "Other",
};
const PRIORITY_BORDER = {
  CRITICAL: "border-l-red-500", HIGH: "border-l-orange-500", MEDIUM: "border-l-amber-500", LOW: "border-l-zinc-400",
};
const FILTERS = [
  { key: "task", label: "Tasks", dot: "bg-red-500" },
  { key: "event", label: "Meetings", dot: "ring-2 ring-blue-500 ring-inset" },
  { key: "milestone", label: "Milestones", dot: "bg-blue-600 rotate-45" },
  { key: "deadline", label: "Deadlines", dot: "bg-red-500" },
];
const kindKey = (k) => (k === "project" ? "deadline" : k);
const d = (s) => (s ? parseISO(s) : null);

// WMO weather-code → [glyph, label] for the forecast overlay
const WMO = {
  0: ["☀", "Clear"], 1: ["🌤", "Mainly clear"], 2: ["⛅", "Partly cloudy"], 3: ["☁", "Overcast"],
  45: ["🌫", "Fog"], 48: ["🌫", "Rime fog"], 51: ["🌦", "Drizzle"], 53: ["🌦", "Drizzle"], 55: ["🌦", "Drizzle"],
  61: ["🌧", "Rain"], 63: ["🌧", "Rain"], 65: ["🌧", "Heavy rain"], 71: ["🌨", "Snow"], 80: ["🌦", "Showers"],
  81: ["🌦", "Showers"], 82: ["⛈", "Heavy showers"], 95: ["⛈", "Thunderstorm"], 96: ["⛈", "Thunderstorm"], 99: ["⛈", "Thunderstorm"],
};
const wmo = (c) => WMO[c] || ["·", "—"];
const dkey = (day) => format(day, "yyyy-MM-dd");

export default function CalendarView({ scope = "global", projectId = null }) {
  const { getToken } = useAuth();
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { isAdmin, canCreateTasks } = useUserRole();
  const { items, loading, weather } = useSelector((s) => s.calendar);

  const [view, setView] = useState(isAdmin ? "month" : "day");
  const [cursor, setCursor] = useState(new Date());
  const [selected, setSelected] = useState(startOfDay(new Date()));
  const [filters, setFilters] = useState(() => new Set(["task", "event", "milestone", "deadline", "weather"]));
  const [projectFilter, setProjectFilter] = useState("all");
  const [modalItem, setModalItem] = useState(null);
  const [showNew, setShowNew] = useState(false);
  const [showLocation, setShowLocation] = useState(false);

  // Fetch window for the current view (padded so day/week within a month reuse it)
  const win = useMemo(() => {
    if (view === "agenda") { const from = startOfDay(new Date()); return { from, to: addDays(from, 35) }; }
    if (view === "day") return { from: startOfDay(selected), to: endOfDay(selected) };
    if (view === "week") return { from: startOfWeek(cursor), to: endOfWeek(cursor) };
    return { from: startOfWeek(startOfMonth(cursor)), to: endOfWeek(endOfMonth(cursor)) };
  }, [view, cursor, selected]);

  const reload = useCallback(() => {
    dispatch(fetchCalendarFeed({
      getToken, scope, projectId, from: win.from.toISOString(), to: win.to.toISOString(),
    }));
  }, [dispatch, getToken, scope, projectId, win.from, win.to]);

  useEffect(() => { reload(); }, [reload]);

  // Weather overlay: only meaningful for a single project (project scope, or a
  // single project selected in the global view). Served from the cached endpoint.
  const wxProjectId = scope === "project" ? projectId : projectFilter !== "all" ? projectFilter : null;
  useEffect(() => {
    if (wxProjectId) dispatch(fetchProjectWeatherAsync({ getToken, projectId: wxProjectId, from: win.from.toISOString(), to: win.to.toISOString() }));
  }, [dispatch, getToken, wxProjectId, win.from, win.to]);
  const wxOn = filters.has("weather") && !!wxProjectId;
  const wxByDate = weather?.byDate || {};
  const wxFor = (day) => (wxOn ? wxByDate[dkey(day)] : null);
  const dayRisk = (day, dayItems) => { const w = wxFor(day); return !!(w && w.risky && dayItems.some((it) => it.isWeatherSensitive)); };

  // Project options (for the global create-event picker) derived from the feed
  const projectOptions = useMemo(() => {
    const m = new Map();
    for (const it of items) if (it.projectId && !m.has(it.projectId)) m.set(it.projectId, it.projectName || "Project");
    return [...m.entries()].map(([id, name]) => ({ id, name }));
  }, [items]);

  const passProject = (it) => projectFilter === "all" || it.projectId === projectFilter;
  const passFilter = (it) => filters.has(kindKey(it.kind));
  const visible = useMemo(() => items.filter((it) => passProject(it) && passFilter(it)), [items, filters, projectFilter]);

  const spanning = (it, day) => {
    const s = startOfDay(d(it.start) || day);
    const e = it.end ? startOfDay(d(it.end)) : s;
    const t = startOfDay(day).getTime();
    return t >= s.getTime() && t <= e.getTime();
  };
  const itemsForDay = (day) =>
    visible.filter((it) => spanning(it, day)).sort((a, b) => String(a.start).localeCompare(String(b.start)));

  // ── intelligence (client-derived, advisory) ────────────────────────────────
  const now = startOfDay(new Date());
  const insights = useMemo(() => {
    const out = [];
    for (const it of visible) {
      const s = d(it.start);
      if (!s) continue;
      if ((it.kind === "task" || it.kind === "deadline") && startOfDay(s) < now && it.status !== "DONE")
        out.push({ sev: "bg-red-500", title: it.kind === "deadline" ? "Overdue deadline" : "Overdue task", sub: `${it.title} · ${it.projectName || ""}`, item: it, rank: 0 });
      if (it.kind === "milestone" && startOfDay(s) >= now && startOfDay(s) <= addDays(now, 3))
        out.push({ sev: "bg-blue-600", title: "Milestone approaching", sub: `${it.title} · ${it.projectName || ""}`, item: it, rank: 2 });
    }
    // conflicts: same-day overlapping events sharing a participant
    const evs = visible.filter((it) => it.kind === "event" && it.start && it.end);
    for (let a = 0; a < evs.length; a++) for (let b = a + 1; b < evs.length; b++) {
      const x = evs[a], y = evs[b];
      if (!isSameDay(d(x.start), d(y.start))) continue;
      if (d(x.start) < d(y.end) && d(y.start) < d(x.end)) {
        const shared = (x.participants || []).map((p) => p.userId).filter((u) => (y.participants || []).some((p) => p.userId === u));
        if (shared.length) out.push({ sev: "bg-amber-500", title: "Schedule conflict", sub: `${x.title} vs ${y.title}`, item: x, rank: 1 });
      }
    }
    return out.sort((a, b) => a.rank - b.rank).slice(0, 6);
  }, [visible]);

  const upcoming = useMemo(() =>
    visible.filter((it) => d(it.start) && startOfDay(d(it.start)) >= now)
      .sort((a, b) => String(a.start).localeCompare(String(b.start))).slice(0, 6), [visible]);

  // ── navigation ──────────────────────────────────────────────────────────────
  const periodLabel = () => {
    if (view === "month") return format(cursor, "MMMM yyyy");
    if (view === "week") { const s = startOfWeek(cursor), e = endOfWeek(cursor); return `${format(s, "d MMM")} – ${format(e, "d MMM")}`; }
    if (view === "day") return format(selected, "EEEE, d MMMM");
    return "Next 35 days";
  };
  const nav = (dir) => {
    if (view === "month") setCursor((c) => addMonths(c, dir));
    else if (view === "week") setCursor((c) => addWeeks(c, dir));
    else if (view === "day") setSelected((s) => addDays(s, dir));
    else setCursor((c) => addMonths(c, dir));
  };
  const goToday = () => { setCursor(new Date()); setSelected(startOfDay(new Date())); };
  const switchView = (v) => { if (v === "day") setSelected(startOfDay(cursor)); if (v === "week" || v === "month") setCursor(selected); setView(v); };
  const selectDay = (day) => { setSelected(startOfDay(day)); if (view === "day") setCursor(day); };

  // ── actions ──────────────────────────────────────────────────────────────────
  const rescheduleTask = (taskId, day) => {
    const iso = startOfDay(day).toISOString();
    dispatch(updateTaskAsync({ taskId, taskData: { plannedStartDate: iso, plannedEndDate: iso, due_date: iso }, getToken }))
      .unwrap().then(() => { toast.success("Task rescheduled"); reload(); })
      .catch((e) => toast.error(e || "Could not reschedule"));
  };
  const completeTask = (taskId) => {
    dispatch(updateTaskAsync({ taskId, taskData: { status: "DONE" }, getToken }))
      .unwrap().then(() => { toast.success("Marked complete"); setModalItem(null); reload(); })
      .catch((e) => toast.error(e || "Could not complete"));
  };
  const removeEvent = (eventId) => {
    dispatch(deleteEventAsync({ getToken, eventId }))
      .unwrap().then(() => { toast.success("Event deleted"); setModalItem(null); reload(); })
      .catch((e) => toast.error(e || "Could not delete"));
  };

  // ── drag to reschedule (tasks) ────────────────────────────────────────────────
  const onDropDay = (e, day) => {
    e.preventDefault();
    const id = e.dataTransfer.getData("text/task");
    if (id) rescheduleTask(id, day);
  };

  // ── renderers ────────────────────────────────────────────────────────────────
  const Chip = ({ it }) => {
    const base = "w-full text-left truncate rounded px-1.5 py-0.5 text-[11px] leading-tight cursor-pointer";
    const open = (e) => { e.stopPropagation(); setModalItem(it); };
    if (it.kind === "task") {
      return (
        <button
          draggable
          onDragStart={(e) => e.dataTransfer.setData("text/task", it.id)}
          onClick={open}
          className={`${base} border-l-2 ${PRIORITY_BORDER[it.priority] || "border-l-zinc-400"} bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-200 ${it.status === "DONE" ? "opacity-50 line-through" : ""}`}
        >{it.title}</button>
      );
    }
    if (it.kind === "milestone")
      return <button onClick={open} className={`${base} font-semibold text-zinc-800 dark:text-zinc-100`}><span className="text-blue-600 dark:text-blue-400">◆</span> {it.title}</button>;
    if (it.kind === "deadline" || it.kind === "project")
      return <button onClick={open} className={`${base} font-semibold text-red-600 dark:text-red-400`}>⚑ {it.title}</button>;
    // event
    return (
      <button onClick={open} className={`${base} border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-200`}>
        <span className="inline-block w-1.5 h-1.5 rounded-full bg-zinc-400 mr-1 align-middle" />
        {it.start && !it.allDay ? format(d(it.start), "HH:mm") + " " : ""}{it.title}
      </button>
    );
  };

  const MonthGrid = () => {
    const days = eachDayOfInterval({ start: startOfWeek(startOfMonth(cursor)), end: endOfWeek(endOfMonth(cursor)) });
    return (
      <div>
        <div className="grid grid-cols-7 border-b border-zinc-200 dark:border-zinc-800">
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((w) => (
            <div key={w} className="px-2 py-2 text-[11px] font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">{w}</div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {days.map((day) => {
            const dayItems = itemsForDay(day);
            const shown = dayItems.slice(0, 2), extra = dayItems.length - shown.length;
            const other = !isSameMonth(day, cursor), today = isSameDay(day, new Date()), sel = isSameDay(day, selected);
            const wx = wxFor(day), risk = dayRisk(day, dayItems);
            return (
              <div
                key={day.toISOString()}
                onClick={() => selectDay(day)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => onDropDay(e, day)}
                className={`h-[116px] overflow-hidden border-b border-r border-zinc-200 dark:border-zinc-800 p-1.5 cursor-pointer flex flex-col gap-0.5
                  ${other ? "bg-zinc-50 dark:bg-zinc-950/40" : "bg-white dark:bg-zinc-900"} hover:bg-zinc-50 dark:hover:bg-zinc-800/50
                  ${sel ? "ring-2 ring-inset ring-blue-500" : ""}`}
              >
                <div className="flex items-center justify-between gap-1">
                  <span className={`text-xs font-semibold w-6 h-6 grid place-items-center rounded-full tabular-nums
                    ${today ? "bg-blue-600 text-white" : other ? "text-zinc-400" : "text-zinc-700 dark:text-zinc-300"}`}>{format(day, "d")}</span>
                  {wx && (
                    <span className={`text-[10px] whitespace-nowrap ${risk ? "text-amber-600 dark:text-amber-400 font-semibold" : "text-zinc-400"}`}>
                      {wmo(wx.weatherCode)[0]}{wx.precipProb != null ? ` ${wx.precipProb}%` : ""}{risk ? " ⚠" : ""}
                    </span>
                  )}
                </div>
                <div className="flex flex-col gap-0.5 overflow-hidden">
                  {shown.map((it) => <Chip key={it.id} it={it} />)}
                  {extra > 0 && <span className="text-[10px] text-zinc-500 dark:text-zinc-400 px-1">+{extra} more</span>}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const WeekGrid = () => {
    const days = eachDayOfInterval({ start: startOfWeek(cursor), end: endOfWeek(cursor) });
    return (
      <div className="grid grid-cols-7 min-h-[520px]">
        {days.map((day) => {
          const today = isSameDay(day, new Date());
          return (
            <div key={day.toISOString()} className="border-r border-zinc-200 dark:border-zinc-800 last:border-r-0 flex flex-col">
              <button onClick={() => selectDay(day)} className={`p-2 border-b border-zinc-200 dark:border-zinc-800 text-left ${today ? "bg-blue-50 dark:bg-blue-950/30" : ""}`}>
                <div className="text-[11px] uppercase text-zinc-500 dark:text-zinc-400">{format(day, "EEE")}</div>
                <div className="text-lg font-bold tabular-nums">{format(day, "d")}</div>
                {wxFor(day) && <div className={`text-[10px] ${dayRisk(day, itemsForDay(day)) ? "text-amber-600 dark:text-amber-400 font-semibold" : "text-zinc-400"}`}>{wmo(wxFor(day).weatherCode)[0]} {wxFor(day).precipProb ?? 0}%{dayRisk(day, itemsForDay(day)) ? " ⚠" : ""}</div>}
              </button>
              <div className="p-1.5 flex flex-col gap-1" onDragOver={(e) => e.preventDefault()} onDrop={(e) => onDropDay(e, day)}>
                {itemsForDay(day).map((it) => <Chip key={it.id} it={it} />)}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  const AgendaRow = ({ it }) => {
    const time = it.kind === "milestone" ? "◆" : it.kind === "deadline" || it.kind === "project" ? "⚑ due" : it.start && !it.allDay ? format(d(it.start), "HH:mm") : "all day";
    const sub = [it.projectName, it.assigneeId ? "assigned" : null, it.location].filter(Boolean).join(" · ");
    return (
      <button onClick={() => setModalItem(it)} className="w-full flex gap-3 px-2 py-2.5 border-t border-zinc-200 dark:border-zinc-800 text-left hover:bg-zinc-50 dark:hover:bg-zinc-800/50">
        <div className="w-16 shrink-0 text-xs text-zinc-500 dark:text-zinc-400 pt-0.5">{time}</div>
        <div className="min-w-0">
          <div className="font-semibold text-[13.5px] truncate">{it.title}</div>
          <div className="text-xs text-zinc-500 dark:text-zinc-400 flex gap-2 flex-wrap">
            <StatusBadge item={it} />{sub && <span>{sub}</span>}
          </div>
        </div>
      </button>
    );
  };

  const DayView = () => {
    const list = itemsForDay(selected);
    const w = wxFor(selected);
    return (
      <div className="p-4">
        <h2 className="text-xl font-bold tracking-tight mb-3">{format(selected, "EEEE, d MMMM")}</h2>
        {w && (
          <div className="flex items-center gap-3 mb-4 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/40 px-3.5 py-2.5 text-sm">
            <span className="text-2xl">{wmo(w.weatherCode)[0]}</span>
            <div>
              <div className="font-semibold">{wmo(w.weatherCode)[1]}{dayRisk(selected, list) ? <span className="text-amber-600 dark:text-amber-400"> · ⚠ weather risk</span> : ""}</div>
              <div className="flex gap-4 text-zinc-500 dark:text-zinc-400 flex-wrap">
                <span>Rain <b className="text-zinc-700 dark:text-zinc-200">{w.precipProb ?? 0}%</b></span>
                <span>Rainfall <b className="text-zinc-700 dark:text-zinc-200">{w.precipMm ?? 0}mm</b></span>
                {w.tempMinC != null && <span>Temp <b className="text-zinc-700 dark:text-zinc-200">{Math.round(w.tempMinC)}–{Math.round(w.tempMaxC)}°C</b></span>}
                {w.windKph != null && <span>Wind <b className="text-zinc-700 dark:text-zinc-200">{Math.round(w.windKph)}km/h</b></span>}
              </div>
            </div>
            <span className="ml-auto text-[11px] text-zinc-400 self-start">source: Open-Meteo</span>
          </div>
        )}
        {list.length ? list.map((it) => <AgendaRow key={it.id} it={it} />)
          : <div className="py-10 text-center text-sm text-zinc-500 dark:text-zinc-400">Nothing scheduled. Add an event with <b>+ New event</b>.</div>}
      </div>
    );
  };

  const AgendaView = () => {
    const groups = [];
    for (let i = 0; i < 35; i++) {
      const day = addDays(now, i), list = itemsForDay(day);
      if (list.length) groups.push({ day, list });
    }
    if (!groups.length) return <div className="p-10 text-center text-sm text-zinc-500 dark:text-zinc-400">No items in the next 35 days.</div>;
    return (
      <div className="p-2">
        {groups.map(({ day, list }) => (
          <div key={day.toISOString()}>
            <div className="px-2 py-2 text-xs font-bold uppercase tracking-wide text-zinc-500 dark:text-zinc-400 bg-zinc-50 dark:bg-zinc-800/40 border-t border-zinc-200 dark:border-zinc-800">
              {isSameDay(day, new Date()) ? "Today · " : ""}{format(day, "EEE d MMM")}
            </div>
            {list.map((it) => <AgendaRow key={it.id} it={it} />)}
          </div>
        ))}
      </div>
    );
  };

  // ── toolbar + shell ───────────────────────────────────────────────────────────
  return (
    <div>
      <div className="flex flex-wrap items-center gap-2 mb-3">
        {scope === "global" && (
          <div className="flex items-center gap-2 mr-1">
            <CalendarIcon size={18} className="text-blue-600" />
            <h1 className="text-lg font-bold tracking-tight">Calendar</h1>
          </div>
        )}
        {scope === "global" && projectOptions.length > 0 && (
          <select value={projectFilter} onChange={(e) => setProjectFilter(e.target.value)}
            className="h-8 rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-2 text-sm">
            <option value="all">All projects</option>
            {projectOptions.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        )}
        <div className="flex-1" />
        <div className="inline-flex bg-zinc-100 dark:bg-zinc-800 rounded-lg p-0.5">
          {["month", "week", "day", "agenda"].map((v) => (
            <button key={v} onClick={() => switchView(v)}
              className={`h-8 px-3 rounded-md text-sm capitalize ${view === v ? "bg-white dark:bg-zinc-900 shadow-sm text-zinc-900 dark:text-white" : "text-zinc-500 dark:text-zinc-400"}`}>{v}</button>
          ))}
        </div>
        {scope === "project" && canCreateTasks && !weather?.location && (
          <button onClick={() => setShowLocation(true)} className="h-8 px-3 inline-flex items-center gap-1.5 rounded-lg border border-zinc-300 dark:border-zinc-700 text-sm">
            <MapPin size={14} /> Set site location
          </button>
        )}
        <button onClick={() => setShowNew(true)} className="h-8 px-3 inline-flex items-center gap-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium">
          <Plus size={15} /> New event
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-2 mb-3">
        <div className="inline-flex items-center gap-1">
          <button onClick={goToday} className="h-8 px-3 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-sm">Today</button>
          <button onClick={() => nav(-1)} aria-label="Previous" className="h-8 w-8 grid place-items-center rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900"><ChevronLeft size={16} /></button>
          <button onClick={() => nav(1)} aria-label="Next" className="h-8 w-8 grid place-items-center rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900"><ChevronRight size={16} /></button>
        </div>
        <div className="text-base font-semibold min-w-[160px]">{periodLabel()}</div>
        {loading && <Loader2 size={15} className="animate-spin text-zinc-400" />}
        <div className="flex-1" />
        {FILTERS.map((f) => {
          const on = filters.has(f.key);
          return (
            <button key={f.key} onClick={() => setFilters((prev) => { const n = new Set(prev); n.has(f.key) ? n.delete(f.key) : n.add(f.key); return n; })}
              className={`h-7 px-2.5 inline-flex items-center gap-1.5 rounded-full border text-xs font-medium ${on ? "border-zinc-300 dark:border-zinc-600 text-zinc-700 dark:text-zinc-200" : "border-zinc-200 dark:border-zinc-800 text-zinc-400 opacity-60"}`}>
              <span className={`w-2 h-2 rounded-sm ${f.dot}`} /> {f.label}
            </button>
          );
        })}
        {wxProjectId && (
          <button onClick={() => setFilters((prev) => { const n = new Set(prev); n.has("weather") ? n.delete("weather") : n.add("weather"); return n; })}
            className={`h-7 px-2.5 inline-flex items-center gap-1.5 rounded-full border text-xs font-medium ${filters.has("weather") ? "border-zinc-300 dark:border-zinc-600 text-zinc-700 dark:text-zinc-200" : "border-zinc-200 dark:border-zinc-800 text-zinc-400 opacity-60"}`}>
            🌦 Weather
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-3.5 items-start">
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg min-h-[748px]">
          {view === "month" && <MonthGrid />}
          {view === "week" && <WeekGrid />}
          {view === "day" && <DayView />}
          {view === "agenda" && <AgendaView />}
        </div>
        {/* Day details rail */}
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg p-3.5">
          <h3 className="text-xs font-bold uppercase tracking-wide text-zinc-500 dark:text-zinc-400 mb-2.5">Day details</h3>
          <div className="text-[15px] font-bold tracking-tight">{format(selected, "EEEE, d MMMM")}</div>
          {wxFor(selected) && (
            <div className={`mt-1.5 text-[12.5px] ${dayRisk(selected, itemsForDay(selected)) ? "text-amber-600 dark:text-amber-400 font-medium" : "text-zinc-500 dark:text-zinc-400"}`}>
              {wmo(wxFor(selected).weatherCode)[0]} {wmo(wxFor(selected).weatherCode)[1]} · {wxFor(selected).precipProb ?? 0}% rain{dayRisk(selected, itemsForDay(selected)) ? " · ⚠ risk" : ""}
            </div>
          )}
          <div className="mt-2">
            {itemsForDay(selected).length
              ? itemsForDay(selected).map((it) => <AgendaRow key={it.id} it={it} />)
              : <div className="py-4 text-sm text-zinc-500 dark:text-zinc-400">Click a day to see everything on it.</div>}
          </div>
        </div>
      </div>

      {/* Bottom strip: Needs review + Upcoming */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3.5 mt-3.5">
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg p-3.5">
          <h3 className="text-xs font-bold uppercase tracking-wide text-zinc-500 dark:text-zinc-400 mb-2 flex items-center gap-2">
            Needs review <span className="bg-zinc-100 dark:bg-zinc-800 rounded-full text-[11px] px-1.5">{insights.length}</span>
          </h3>
          {insights.length ? insights.map((a, i) => (
            <button key={i} onClick={() => { setSelected(startOfDay(d(a.item.start))); setModalItem(a.item); }} className="w-full flex gap-2.5 py-2 border-t border-zinc-200 dark:border-zinc-800 first:border-t-0 text-left">
              <span className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${a.sev}`} />
              <div><div className="font-semibold text-[13px]">{a.title}</div><div className="text-xs text-zinc-500 dark:text-zinc-400 truncate">{a.sub}</div></div>
            </button>
          )) : <div className="text-sm text-zinc-500 dark:text-zinc-400">All clear 🎉</div>}
        </div>
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg p-3.5">
          <h3 className="text-xs font-bold uppercase tracking-wide text-zinc-500 dark:text-zinc-400 mb-2">Upcoming</h3>
          {upcoming.length ? upcoming.map((it) => (
            <button key={it.id} onClick={() => setModalItem(it)} className="w-full flex gap-2.5 py-2 border-t border-zinc-200 dark:border-zinc-800 first:border-t-0 items-center text-left">
              <div className="w-12 text-center shrink-0"><div className="text-base font-bold leading-none tabular-nums">{format(d(it.start), "d")}</div><div className="text-[10px] uppercase text-zinc-500">{format(d(it.start), "MMM")}</div></div>
              <div className="min-w-0"><div className="text-[13px] font-medium truncate">{it.kind === "milestone" ? "◆ " : it.kind === "deadline" ? "⚑ " : ""}{it.title}</div>
                <div className="text-[11.5px] text-zinc-500 dark:text-zinc-400 truncate">{it.projectName}{it.start && !it.allDay ? " · " + format(d(it.start), "HH:mm") : ""}</div></div>
            </button>
          )) : <div className="text-sm text-zinc-500 dark:text-zinc-400">Nothing upcoming.</div>}
        </div>
      </div>

      {modalItem && <DetailModal it={modalItem} onClose={() => setModalItem(null)} navigate={navigate} onComplete={completeTask} onReschedule={rescheduleTask} onDeleteEvent={removeEvent}
        advisory={modalItem.isWeatherSensitive && modalItem.start && wxFor(parseISO(modalItem.start))?.risky ? wxFor(parseISO(modalItem.start)) : null} />}
      {showNew && <NewEventModal onClose={() => setShowNew(false)} defaultDate={selected} scope={scope} projectId={projectId} projectOptions={projectOptions}
        onCreate={(pid, event) => dispatch(createEventAsync({ getToken, projectId: pid, event })).unwrap()
          .then(() => { toast.success("Event created"); setShowNew(false); reload(); })
          .catch((e) => toast.error(e || "Could not create event"))} />}
      {showLocation && <LocationModal onClose={() => setShowLocation(false)} current={weather?.location}
        onSave={(location) => dispatch(setProjectLocationAsync({ getToken, projectId: wxProjectId, location })).unwrap()
          .then(() => { toast.success("Site location saved"); setShowLocation(false); dispatch(fetchProjectWeatherAsync({ getToken, projectId: wxProjectId, from: win.from.toISOString(), to: win.to.toISOString() })); })
          .catch((e) => toast.error(e || "Could not save location"))} />}
    </div>
  );
}

function StatusBadge({ item }) {
  const s = item.status;
  if (!s) return null;
  const tone = { TODO: "zinc", IN_PROGRESS: "blue", PENDING_APPROVAL: "purple", BLOCKED: "amber", DONE: "green", SCHEDULED: "zinc", CONFIRMED: "blue", CANCELLED: "red" }[s] || "zinc";
  const map = {
    zinc: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300",
    blue: "bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300",
    purple: "bg-purple-50 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300",
    amber: "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300",
    green: "bg-green-50 text-green-700 dark:bg-green-950/40 dark:text-green-300",
    red: "bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300",
  };
  return <span className={`px-1.5 py-0.5 rounded text-[11px] font-medium ${map[tone]}`}>{s.replace(/_/g, " ").toLowerCase()}</span>;
}

function DetailModal({ it, onClose, navigate, onComplete, onReschedule, onDeleteEvent, advisory }) {
  const dt = it.start ? parseISO(it.start) : null;
  const isTaskish = it.kind === "task" || it.kind === "milestone";
  return (
    <div className="fixed inset-0 z-50 grid place-items-center p-4 bg-black/50" onClick={onClose}>
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl w-full max-w-lg max-h-[88vh] overflow-auto shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="p-5 border-b border-zinc-200 dark:border-zinc-800 relative">
          <button onClick={onClose} className="absolute top-4 right-4 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200"><X size={20} /></button>
          <div className="flex gap-2 flex-wrap mb-1">
            <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300">
              {it.kind === "event" ? EVENT_TYPES[it.eventType] || "Event" : it.kind}
            </span>
            <StatusBadge item={it} />
            {it.isWeatherSensitive && <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">weather-sensitive</span>}
          </div>
          <h2 className="text-lg font-bold tracking-tight">{it.kind === "milestone" ? "◆ " : it.kind === "deadline" ? "⚑ " : ""}{it.title}</h2>
        </div>
        <div className="p-5 space-y-3 text-sm">
          <div className="flex items-center gap-1.5 text-xs font-semibold flex-wrap">
            <span className="px-2 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800">{it.projectName || "Project"}</span>
            <span className="text-zinc-400">▸</span>
            <span className="px-2 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 opacity-60">Phase</span>
            <span className="text-zinc-400">▸</span>
            <span className="px-2 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 capitalize">{it.kind}</span>
          </div>
          {advisory && (
            <div className="rounded-xl border border-amber-300 dark:border-amber-800 overflow-hidden text-[12.5px]">
              <div className="flex gap-2.5 items-start p-3 bg-zinc-50 dark:bg-zinc-800/50">
                <span className="text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300 shrink-0">Forecast</span>
                <div><b>{wmo(advisory.weatherCode)[1]}</b> — rain {advisory.precipProb ?? 0}%, {advisory.precipMm ?? 0}mm{advisory.windKph != null ? `, wind ${Math.round(advisory.windKph)}km/h` : ""}. <span className="text-zinc-500">Data from Open-Meteo.</span></div>
              </div>
              <div className="flex gap-2.5 items-start p-3 bg-amber-50 dark:bg-amber-950/30 border-t border-amber-300 dark:border-amber-800">
                <span className="text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded bg-amber-500 text-white shrink-0">Suggestion</span>
                <div>This activity is weather-sensitive and the day meets the rain-risk threshold. <b>Consider reviewing it</b> — advisory, not a prediction.</div>
              </div>
            </div>
          )}
          <dl className="grid grid-cols-[90px_1fr] gap-y-1 gap-x-3">
            {dt && <><dt className="text-zinc-500">Date</dt><dd className="font-medium">{format(dt, "EEE, d MMM yyyy")}{it.start && !it.allDay ? ` · ${format(dt, "HH:mm")}` : ""}</dd></>}
            {it.location && <><dt className="text-zinc-500">Location</dt><dd className="font-medium flex items-center gap-1"><MapPin size={13} /> {it.location}</dd></>}
          </dl>
          {it.participants && it.participants.length > 0 && (
            <div>
              <div className="text-xs font-semibold text-zinc-500 mb-1.5 flex items-center gap-1"><Users size={13} /> Participants</div>
              <div className="flex flex-col gap-1">{it.participants.map((p, i) => <div key={i} className="text-sm">{p.name || p.userId}</div>)}</div>
            </div>
          )}
          <div className="flex gap-2 flex-wrap pt-2 border-t border-zinc-200 dark:border-zinc-800">
            {isTaskish && <>
              <button onClick={() => navigate(`/task?id=${it.id}`)} className="h-8 px-3 rounded-lg border border-zinc-300 dark:border-zinc-700 text-sm">Open task</button>
              {it.status !== "DONE" && <button onClick={() => onComplete(it.id)} className="h-8 px-3 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm">✓ Mark complete</button>}
              {it.kind === "task" && <button onClick={() => onReschedule(it.id, addDays(dt || new Date(), 1))} className="h-8 px-3 rounded-lg border border-zinc-300 dark:border-zinc-700 text-sm">Reschedule +1 day</button>}
            </>}
            {it.kind === "event" && <>
              <button onClick={() => navigate(`/projectsDetail?id=${it.projectId}&tab=calendar`)} className="h-8 px-3 rounded-lg border border-zinc-300 dark:border-zinc-700 text-sm">Open in project</button>
              <button onClick={() => onDeleteEvent(it.eventId || it.id)} className="h-8 px-3 rounded-lg border border-red-300 text-red-600 dark:border-red-800 dark:text-red-400 text-sm">Delete</button>
            </>}
            {(it.kind === "deadline" || it.kind === "project") &&
              <button onClick={() => navigate(`/projectsDetail?id=${it.projectId}`)} className="h-8 px-3 rounded-lg border border-zinc-300 dark:border-zinc-700 text-sm">Open project</button>}
          </div>
        </div>
      </div>
    </div>
  );
}

function NewEventModal({ onClose, defaultDate, scope, projectId, projectOptions, onCreate }) {
  const [title, setTitle] = useState("");
  const [type, setType] = useState("PROJECT_MEETING");
  const [pid, setPid] = useState(scope === "project" ? projectId : (projectOptions[0]?.id || ""));
  const [date, setDate] = useState(format(defaultDate, "yyyy-MM-dd"));
  const [start, setStart] = useState("09:00");
  const [weather, setWeather] = useState(false);
  const submit = () => {
    if (!pid) { toast.error("Pick a project"); return; }
    const startAt = new Date(`${date}T${start || "09:00"}:00`).toISOString();
    onCreate(pid, { title: title.trim() || "Untitled event", type, startAt, isWeatherSensitive: weather });
  };
  return (
    <div className="fixed inset-0 z-50 grid place-items-center p-4 bg-black/50" onClick={onClose}>
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl w-full max-w-md shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="p-5 border-b border-zinc-200 dark:border-zinc-800 relative">
          <button onClick={onClose} className="absolute top-4 right-4 text-zinc-400 hover:text-zinc-700"><X size={20} /></button>
          <h2 className="text-lg font-bold tracking-tight">New event</h2>
        </div>
        <div className="p-5 space-y-3">
          <label className="block"><span className="text-xs font-semibold text-zinc-500">Title</span>
            <input value={title} onChange={(e) => setTitle(e.target.value)} autoFocus placeholder="e.g. Site inspection"
              className="mt-1 w-full h-9 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-2.5 text-sm" /></label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block"><span className="text-xs font-semibold text-zinc-500">Type</span>
              <select value={type} onChange={(e) => setType(e.target.value)} className="mt-1 w-full h-9 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-2 text-sm">
                {Object.entries(EVENT_TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select></label>
            <label className="block"><span className="text-xs font-semibold text-zinc-500">Project</span>
              <select value={pid} onChange={(e) => setPid(e.target.value)} disabled={scope === "project"} className="mt-1 w-full h-9 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-2 text-sm disabled:opacity-60">
                {scope === "project" ? <option value={projectId}>This project</option> : projectOptions.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select></label>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <label className="block"><span className="text-xs font-semibold text-zinc-500">Date</span>
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="mt-1 w-full h-9 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-2.5 text-sm" /></label>
            <label className="block"><span className="text-xs font-semibold text-zinc-500">Start</span>
              <input type="time" value={start} onChange={(e) => setStart(e.target.value)} className="mt-1 w-full h-9 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-2.5 text-sm" /></label>
          </div>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={weather} onChange={(e) => setWeather(e.target.checked)} className="w-4 h-4" /> Weather-sensitive activity</label>
          <div className="flex gap-2 pt-1">
            <button onClick={submit} className="h-9 px-4 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium">Create event</button>
            <button onClick={onClose} className="h-9 px-4 rounded-lg border border-zinc-300 dark:border-zinc-700 text-sm">Cancel</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function LocationModal({ onClose, current, onSave }) {
  const [name, setName] = useState(current?.name || "");
  const [lat, setLat] = useState(current?.latitude ?? "");
  const [lng, setLng] = useState(current?.longitude ?? "");
  const submit = () => {
    const latitude = Number(lat), longitude = Number(lng);
    if (Number.isNaN(latitude) || Number.isNaN(longitude) || lat === "" || lng === "") { toast.error("Enter valid coordinates"); return; }
    onSave({ locationName: name.trim() || null, latitude, longitude });
  };
  return (
    <div className="fixed inset-0 z-50 grid place-items-center p-4 bg-black/50" onClick={onClose}>
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl w-full max-w-md shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="p-5 border-b border-zinc-200 dark:border-zinc-800 relative">
          <button onClick={onClose} className="absolute top-4 right-4 text-zinc-400 hover:text-zinc-700"><X size={20} /></button>
          <h2 className="text-lg font-bold tracking-tight">Site location</h2>
          <p className="text-xs text-zinc-500 mt-1">Used to fetch the site's weather forecast (Open-Meteo).</p>
        </div>
        <div className="p-5 space-y-3">
          <label className="block"><span className="text-xs font-semibold text-zinc-500">Location name (optional)</span>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Gokwe site"
              className="mt-1 w-full h-9 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-2.5 text-sm" /></label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block"><span className="text-xs font-semibold text-zinc-500">Latitude</span>
              <input value={lat} onChange={(e) => setLat(e.target.value)} inputMode="decimal" placeholder="-17.83"
                className="mt-1 w-full h-9 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-2.5 text-sm" /></label>
            <label className="block"><span className="text-xs font-semibold text-zinc-500">Longitude</span>
              <input value={lng} onChange={(e) => setLng(e.target.value)} inputMode="decimal" placeholder="31.05"
                className="mt-1 w-full h-9 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-2.5 text-sm" /></label>
          </div>
          <div className="flex gap-2 pt-1">
            <button onClick={submit} className="h-9 px-4 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium">Save location</button>
            <button onClick={onClose} className="h-9 px-4 rounded-lg border border-zinc-300 dark:border-zinc-700 text-sm">Cancel</button>
          </div>
        </div>
      </div>
    </div>
  );
}

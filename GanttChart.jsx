import { useState, useRef, useEffect } from "react";

const COLORS = [
  "#FF6B6B", "#FFB347", "#4ECDC4", "#45B7D1", "#96CEB4",
  "#F7DC6F", "#BB8FCE", "#85C1E9", "#F1948A", "#82E0AA"
];

const today = new Date();
today.setHours(0, 0, 0, 0);

function addDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function diffDays(a, b) {
  return Math.round((b - a) / (1000 * 60 * 60 * 24));
}

const initialProjects = [
  {
    id: 1,
    name: "Website Redesign",
    color: COLORS[0],
    tasks: [
      { id: 101, name: "Discovery & Research", start: addDays(today, -5), end: addDays(today, 3), progress: 80, assignee: "Alice" },
      { id: 102, name: "Wireframing", start: addDays(today, 2), end: addDays(today, 10), progress: 30, assignee: "Bob" },
      { id: 103, name: "UI Design", start: addDays(today, 8), end: addDays(today, 20), progress: 0, assignee: "Alice" },
      { id: 104, name: "Development", start: addDays(today, 18), end: addDays(today, 38), progress: 0, assignee: "Carlos" },
    ]
  },
  {
    id: 2,
    name: "Mobile App v2",
    color: COLORS[2],
    tasks: [
      { id: 201, name: "Requirements", start: addDays(today, -2), end: addDays(today, 4), progress: 60, assignee: "Dana" },
      { id: 202, name: "Backend API", start: addDays(today, 3), end: addDays(today, 18), progress: 10, assignee: "Carlos" },
      { id: 203, name: "iOS Build", start: addDays(today, 15), end: addDays(today, 30), progress: 0, assignee: "Eve" },
      { id: 204, name: "QA Testing", start: addDays(today, 28), end: addDays(today, 36), progress: 0, assignee: "Dana" },
    ]
  },
  {
    id: 3,
    name: "Brand Campaign",
    color: COLORS[4],
    tasks: [
      { id: 301, name: "Strategy Planning", start: addDays(today, 0), end: addDays(today, 7), progress: 20, assignee: "Frank" },
      { id: 302, name: "Content Creation", start: addDays(today, 6), end: addDays(today, 22), progress: 0, assignee: "Grace" },
      { id: 303, name: "Launch", start: addDays(today, 21), end: addDays(today, 28), progress: 0, assignee: "Frank" },
    ]
  }
];

const SIDEBAR_W = 260;
const ROW_H = 44;
const DAY_W = 32;
const HEADER_H = 60;
const TOTAL_DAYS = 50;
const VIEW_START = addDays(today, -8);

function formatDate(d) {
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function getMonthGroups() {
  const groups = [];
  let cur = null;
  for (let i = 0; i < TOTAL_DAYS; i++) {
    const d = addDays(VIEW_START, i);
    const label = d.toLocaleDateString("en-US", { month: "short", year: "2-digit" });
    if (label !== cur) {
      groups.push({ label, start: i, count: 1 });
      cur = label;
    } else {
      groups[groups.length - 1].count++;
    }
  }
  return groups;
}

export default function GanttChart() {
  const [projects, setProjects] = useState(initialProjects);
  const [collapsed, setCollapsed] = useState({});
  const [selected, setSelected] = useState(null);
  const [dragging, setDragging] = useState(null);
  const [showAddTask, setShowAddTask] = useState(null);
  const [newTask, setNewTask] = useState({ name: "", assignee: "", days: 7 });
  const [hoveredTask, setHoveredTask] = useState(null);
  const [tooltip, setTooltip] = useState(null);
  const scrollRef = useRef(null);
  const dragStart = useRef(null);

  useEffect(() => {
    if (scrollRef.current) {
      const todayOffset = diffDays(VIEW_START, today) * DAY_W;
      scrollRef.current.scrollLeft = Math.max(0, todayOffset - 120);
    }
  }, []);

  const monthGroups = getMonthGroups();
  const totalWidth = TOTAL_DAYS * DAY_W;

  function toggleCollapse(id) {
    setCollapsed(c => ({ ...c, [id]: !c[id] }));
  }

  function handleMouseDown(e, task, project, type) {
    e.preventDefault();
    dragStart.current = { x: e.clientX, task: { ...task }, type, projectId: project.id };
    setDragging({ taskId: task.id, type });
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
  }

  function handleMouseMove(e) {
    if (!dragStart.current) return;
    const dx = e.clientX - dragStart.current.x;
    const daysDelta = Math.round(dx / DAY_W);
    const { task, type, projectId } = dragStart.current;

    setProjects(prev => prev.map(p => {
      if (p.id !== projectId) return p;
      return {
        ...p,
        tasks: p.tasks.map(t => {
          if (t.id !== task.id) return t;
          if (type === "move") {
            return { ...t, start: addDays(task.start, daysDelta), end: addDays(task.end, daysDelta) };
          } else if (type === "resize-right") {
            const newEnd = addDays(task.end, daysDelta);
            if (newEnd > task.start) return { ...t, end: newEnd };
          } else if (type === "resize-left") {
            const newStart = addDays(task.start, daysDelta);
            if (newStart < task.end) return { ...t, start: newStart };
          }
          return t;
        })
      };
    }));
  }

  function handleMouseUp() {
    dragStart.current = null;
    setDragging(null);
    window.removeEventListener("mousemove", handleMouseMove);
    window.removeEventListener("mouseup", handleMouseUp);
  }

  function updateProgress(projectId, taskId, progress) {
    setProjects(prev => prev.map(p => {
      if (p.id !== projectId) return p;
      return { ...p, tasks: p.tasks.map(t => t.id === taskId ? { ...t, progress } : t) };
    }));
  }

  function addTask(projectId) {
    const proj = projects.find(p => p.id === projectId);
    const lastTask = proj.tasks[proj.tasks.length - 1];
    const start = lastTask ? addDays(lastTask.end, 1) : today;
    const end = addDays(start, parseInt(newTask.days) || 7);
    const task = {
      id: Date.now(),
      name: newTask.name || "New Task",
      assignee: newTask.assignee || "Unassigned",
      start, end, progress: 0
    };
    setProjects(prev => prev.map(p => p.id === projectId ? { ...p, tasks: [...p.tasks, task] } : p));
    setShowAddTask(null);
    setNewTask({ name: "", assignee: "", days: 7 });
  }

  function deleteTask(projectId, taskId) {
    setProjects(prev => prev.map(p => {
      if (p.id !== projectId) return p;
      return { ...p, tasks: p.tasks.filter(t => t.id !== taskId) };
    }));
    setSelected(null);
  }

  // Build flat row list
  const rows = [];
  projects.forEach(proj => {
    rows.push({ type: "project", proj });
    if (!collapsed[proj.id]) {
      proj.tasks.forEach(task => {
        rows.push({ type: "task", task, proj });
      });
      rows.push({ type: "add", proj });
    }
  });

  const todayX = diffDays(VIEW_START, today) * DAY_W;

  return (
    <div style={{
      fontFamily: "'DM Sans', 'Segoe UI', sans-serif",
      background: "#0D0F14",
      minHeight: "100vh",
      color: "#E8EAF0",
      display: "flex",
      flexDirection: "column",
    }}>
      {/* Top Bar */}
      <div style={{
        height: 56,
        background: "linear-gradient(90deg, #13151C 0%, #161922 100%)",
        borderBottom: "1px solid #1E2130",
        display: "flex",
        alignItems: "center",
        padding: "0 24px",
        gap: 16,
        flexShrink: 0,
        zIndex: 20,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{
            width: 30, height: 30,
            background: "linear-gradient(135deg, #6C63FF, #FF6B9D)",
            borderRadius: 8,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 14, fontWeight: 700
          }}>G</div>
          <span style={{ fontWeight: 700, fontSize: 16, letterSpacing: "-0.3px" }}>Gantt</span>
          <span style={{ color: "#6C63FF", fontWeight: 700, fontSize: 16 }}>Flow</span>
        </div>

        <div style={{ flex: 1 }} />

        <div style={{
          display: "flex", gap: 8, alignItems: "center",
          background: "#1A1D26", borderRadius: 8, padding: "4px 12px",
          border: "1px solid #252836", fontSize: 13, color: "#8B8FA8"
        }}>
          📅 Today: {today.toLocaleDateString("en-US", { weekday: "short", month: "long", day: "numeric" })}
        </div>

        <button style={{
          background: "linear-gradient(135deg, #6C63FF, #8B5CF6)",
          border: "none", borderRadius: 8, padding: "8px 16px",
          color: "#fff", fontWeight: 600, fontSize: 13, cursor: "pointer",
          letterSpacing: "0.2px"
        }}>+ New Project</button>
      </div>

      {/* Main */}
      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>

        {/* Sidebar */}
        <div style={{
          width: SIDEBAR_W,
          flexShrink: 0,
          borderRight: "1px solid #1E2130",
          background: "#0D0F14",
          zIndex: 10,
          display: "flex",
          flexDirection: "column",
        }}>
          {/* Sidebar header */}
          <div style={{
            height: HEADER_H,
            display: "flex", alignItems: "flex-end",
            padding: "0 16px 10px",
            borderBottom: "1px solid #1E2130",
            fontSize: 11, fontWeight: 600, letterSpacing: "1px",
            color: "#4A4F6A", textTransform: "uppercase",
          }}>
            Task Name
          </div>

          {/* Sidebar rows */}
          <div style={{ overflowY: "auto", flex: 1 }}>
            {rows.map((row, i) => {
              if (row.type === "project") {
                return (
                  <div key={`proj-${row.proj.id}`} style={{
                    height: ROW_H,
                    display: "flex", alignItems: "center",
                    padding: "0 12px",
                    gap: 8,
                    background: "#10131A",
                    borderBottom: "1px solid #1A1D26",
                    cursor: "pointer",
                    userSelect: "none",
                  }} onClick={() => toggleCollapse(row.proj.id)}>
                    <div style={{
                      width: 10, height: 10, borderRadius: 3,
                      background: row.proj.color, flexShrink: 0
                    }} />
                    <span style={{ fontSize: 13, fontWeight: 700, color: "#C8CAD8", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {row.proj.name}
                    </span>
                    <span style={{ color: "#4A4F6A", fontSize: 11 }}>{collapsed[row.proj.id] ? "▶" : "▼"}</span>
                  </div>
                );
              }
              if (row.type === "task") {
                const isSelected = selected?.taskId === row.task.id;
                return (
                  <div key={`task-${row.task.id}`} style={{
                    height: ROW_H,
                    display: "flex", alignItems: "center",
                    padding: "0 12px 0 28px",
                    gap: 8,
                    background: isSelected ? "#171A24" : "transparent",
                    borderBottom: "1px solid #1A1D26",
                    cursor: "pointer",
                    transition: "background 0.15s",
                  }} onClick={() => setSelected(isSelected ? null : { taskId: row.task.id, projectId: row.proj.id })}>
                    <div style={{ width: 3, height: 18, borderRadius: 2, background: row.proj.color, flexShrink: 0 }} />
                    <div style={{ flex: 1, overflow: "hidden" }}>
                      <div style={{ fontSize: 12, color: isSelected ? "#E8EAF0" : "#9A9DB8", fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {row.task.name}
                      </div>
                      <div style={{ fontSize: 10, color: "#4A4F6A", marginTop: 1 }}>{row.task.assignee}</div>
                    </div>
                    <div style={{ fontSize: 10, color: row.task.progress === 100 ? "#4ECDC4" : "#6C63FF", fontWeight: 600 }}>
                      {row.task.progress}%
                    </div>
                  </div>
                );
              }
              if (row.type === "add") {
                return (
                  <div key={`add-${row.proj.id}`} style={{
                    height: 36,
                    display: "flex", alignItems: "center",
                    padding: "0 12px 0 28px",
                    borderBottom: "1px solid #1A1D26",
                    cursor: "pointer",
                  }} onClick={() => setShowAddTask(row.proj.id)}>
                    <span style={{ fontSize: 11, color: "#3A3F5A" }}>+ Add task</span>
                  </div>
                );
              }
            })}
          </div>
        </div>

        {/* Gantt Grid */}
        <div style={{ flex: 1, overflow: "hidden", position: "relative", display: "flex", flexDirection: "column" }}>
          <div ref={scrollRef} style={{ flex: 1, overflowX: "auto", overflowY: "auto" }}>
            <div style={{ width: totalWidth, position: "relative" }}>

              {/* Header */}
              <div style={{
                height: HEADER_H, position: "sticky", top: 0, zIndex: 9,
                background: "#0D0F14", borderBottom: "1px solid #1E2130",
              }}>
                {/* Month row */}
                <div style={{ height: 24, display: "flex", borderBottom: "1px solid #1A1D26" }}>
                  {monthGroups.map((g, i) => (
                    <div key={i} style={{
                      width: g.count * DAY_W,
                      flexShrink: 0,
                      display: "flex", alignItems: "center",
                      padding: "0 8px",
                      fontSize: 10, fontWeight: 700, color: "#4A4F6A",
                      letterSpacing: "0.8px", textTransform: "uppercase",
                      borderRight: "1px solid #1A1D26",
                    }}>{g.label}</div>
                  ))}
                </div>

                {/* Day row */}
                <div style={{ height: 36, display: "flex", alignItems: "center" }}>
                  {Array.from({ length: TOTAL_DAYS }).map((_, i) => {
                    const d = addDays(VIEW_START, i);
                    const isToday = diffDays(today, d) === 0;
                    const isWeekend = d.getDay() === 0 || d.getDay() === 6;
                    return (
                      <div key={i} style={{
                        width: DAY_W, flexShrink: 0, textAlign: "center",
                        fontSize: 10,
                        color: isToday ? "#6C63FF" : isWeekend ? "#2E3248" : "#4A4F6A",
                        fontWeight: isToday ? 800 : 400,
                        borderRight: "1px solid #1A1D261A",
                        padding: "2px 0",
                      }}>
                        <div>{d.toLocaleDateString("en-US", { weekday: "narrow" })}</div>
                        <div style={{
                          width: isToday ? 20 : "auto",
                          height: isToday ? 20 : "auto",
                          background: isToday ? "#6C63FF" : "transparent",
                          borderRadius: "50%",
                          display: "inline-flex",
                          alignItems: "center", justifyContent: "center",
                          marginTop: 1,
                        }}>{d.getDate()}</div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Grid body */}
              <div style={{ position: "relative" }}>
                {/* Weekend shading */}
                {Array.from({ length: TOTAL_DAYS }).map((_, i) => {
                  const d = addDays(VIEW_START, i);
                  if (d.getDay() === 0 || d.getDay() === 6) {
                    return <div key={i} style={{
                      position: "absolute", left: i * DAY_W, top: 0,
                      width: DAY_W, height: rows.length * ROW_H,
                      background: "rgba(255,255,255,0.012)", pointerEvents: "none",
                    }} />;
                  }
                })}

                {/* Today line */}
                {todayX >= 0 && todayX <= totalWidth && (
                  <div style={{
                    position: "absolute",
                    left: todayX + DAY_W / 2,
                    top: 0,
                    width: 2,
                    height: rows.length * ROW_H,
                    background: "linear-gradient(180deg, #6C63FF, #6C63FF44)",
                    zIndex: 5,
                    pointerEvents: "none",
                  }}>
                    <div style={{
                      position: "absolute", top: -4, left: -4,
                      width: 10, height: 10, borderRadius: "50%",
                      background: "#6C63FF",
                    }} />
                  </div>
                )}

                {/* Row backgrounds + bars */}
                {rows.map((row, ri) => {
                  const y = ri * ROW_H;
                  if (row.type === "project") {
                    return (
                      <div key={`g-proj-${row.proj.id}`} style={{
                        position: "absolute", left: 0, top: y,
                        width: totalWidth, height: ROW_H,
                        background: "#10131A",
                        borderBottom: "1px solid #1A1D26",
                      }} />
                    );
                  }
                  if (row.type === "add") {
                    return (
                      <div key={`g-add-${row.proj.id}`} style={{
                        position: "absolute", left: 0, top: y,
                        width: totalWidth, height: 36,
                        borderBottom: "1px solid #1A1D26",
                      }} />
                    );
                  }
                  // task bar
                  const { task, proj } = row;
                  const startOffset = diffDays(VIEW_START, task.start);
                  const duration = diffDays(task.start, task.end);
                  const barX = startOffset * DAY_W;
                  const barW = Math.max(duration * DAY_W, DAY_W);
                  const isSelected = selected?.taskId === task.id;
                  const isDragging = dragging?.taskId === task.id;

                  return (
                    <div key={`g-task-${task.id}`} style={{
                      position: "absolute", left: 0, top: y,
                      width: totalWidth, height: ROW_H,
                      borderBottom: "1px solid #1A1D26",
                      background: isSelected ? "#0E1019" : "transparent",
                    }}>
                      {/* Col lines */}
                      <div style={{
                        position: "absolute", inset: 0,
                        background: `repeating-linear-gradient(90deg, transparent, transparent ${DAY_W - 1}px, #1A1D261A ${DAY_W - 1}px, #1A1D261A ${DAY_W}px)`,
                        pointerEvents: "none",
                      }} />

                      {/* Task bar */}
                      <div
                        style={{
                          position: "absolute",
                          left: barX + 2,
                          top: 9,
                          width: barW - 4,
                          height: ROW_H - 18,
                          borderRadius: 6,
                          background: `${proj.color}22`,
                          border: `1.5px solid ${proj.color}66`,
                          cursor: isDragging ? "grabbing" : "grab",
                          boxShadow: isSelected ? `0 0 0 2px ${proj.color}88, 0 4px 16px ${proj.color}22` : "none",
                          transition: isDragging ? "none" : "box-shadow 0.2s",
                          userSelect: "none",
                          overflow: "hidden",
                          zIndex: 2,
                        }}
                        onMouseDown={e => handleMouseDown(e, task, proj, "move")}
                        onMouseEnter={e => {
                          const rect = e.target.getBoundingClientRect();
                          setHoveredTask({ task, proj });
                          setTooltip({ x: e.clientX, y: rect.top - 8 });
                        }}
                        onMouseLeave={() => { setHoveredTask(null); setTooltip(null); }}
                      >
                        {/* Progress fill */}
                        <div style={{
                          position: "absolute", left: 0, top: 0,
                          width: `${task.progress}%`, height: "100%",
                          background: `${proj.color}44`,
                          borderRadius: "4px 0 0 4px",
                          transition: "width 0.3s ease",
                        }} />

                        {/* Label */}
                        <div style={{
                          position: "absolute", inset: "0 8px",
                          display: "flex", alignItems: "center",
                          fontSize: 10.5, fontWeight: 600,
                          color: proj.color,
                          overflow: "hidden", whiteSpace: "nowrap",
                          textOverflow: "ellipsis",
                          zIndex: 1,
                          textShadow: "0 1px 4px rgba(0,0,0,0.8)",
                        }}>
                          {task.name}
                        </div>

                        {/* Resize left */}
                        <div style={{
                          position: "absolute", left: 0, top: 0,
                          width: 8, height: "100%", cursor: "ew-resize",
                          zIndex: 3,
                        }} onMouseDown={e => { e.stopPropagation(); handleMouseDown(e, task, proj, "resize-left"); }} />

                        {/* Resize right */}
                        <div style={{
                          position: "absolute", right: 0, top: 0,
                          width: 8, height: "100%", cursor: "ew-resize",
                          zIndex: 3,
                        }} onMouseDown={e => { e.stopPropagation(); handleMouseDown(e, task, proj, "resize-right"); }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Task Detail Panel */}
      {selected && (() => {
        const proj = projects.find(p => p.id === selected.projectId);
        const task = proj?.tasks.find(t => t.id === selected.taskId);
        if (!task) return null;
        return (
          <div style={{
            position: "fixed", right: 0, top: 56, bottom: 0,
            width: 280,
            background: "#10131A",
            borderLeft: "1px solid #1E2130",
            padding: 20,
            zIndex: 30,
            overflowY: "auto",
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <span style={{ fontWeight: 700, fontSize: 14, color: "#C8CAD8" }}>Task Details</span>
              <button onClick={() => setSelected(null)} style={{
                background: "none", border: "none", color: "#4A4F6A",
                cursor: "pointer", fontSize: 18, lineHeight: 1,
              }}>×</button>
            </div>

            <div style={{
              width: "100%", height: 3, borderRadius: 2,
              background: "#1E2130", marginBottom: 20, overflow: "hidden"
            }}>
              <div style={{ width: `${task.progress}%`, height: "100%", background: proj.color, borderRadius: 2, transition: "width 0.3s" }} />
            </div>

            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 10, color: "#4A4F6A", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.8px" }}>Task</div>
              <div style={{ fontSize: 14, fontWeight: 600, color: "#E8EAF0" }}>{task.name}</div>
            </div>

            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 10, color: "#4A4F6A", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.8px" }}>Project</div>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <div style={{ width: 8, height: 8, borderRadius: 2, background: proj.color }} />
                <span style={{ fontSize: 13, color: "#9A9DB8" }}>{proj.name}</span>
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}>
              <div>
                <div style={{ fontSize: 10, color: "#4A4F6A", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.8px" }}>Start</div>
                <div style={{ fontSize: 12, color: "#9A9DB8" }}>{formatDate(task.start)}</div>
              </div>
              <div>
                <div style={{ fontSize: 10, color: "#4A4F6A", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.8px" }}>End</div>
                <div style={{ fontSize: 12, color: "#9A9DB8" }}>{formatDate(task.end)}</div>
              </div>
            </div>

            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 10, color: "#4A4F6A", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.8px" }}>Assignee</div>
              <div style={{ fontSize: 13, color: "#9A9DB8" }}>{task.assignee}</div>
            </div>

            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 10, color: "#4A4F6A", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.8px" }}>
                Progress — {task.progress}%
              </div>
              <input type="range" min="0" max="100" value={task.progress}
                onChange={e => updateProgress(proj.id, task.id, parseInt(e.target.value))}
                style={{ width: "100%", accentColor: proj.color, cursor: "pointer" }}
              />
              <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4 }}>
                {[0, 25, 50, 75, 100].map(v => (
                  <button key={v} onClick={() => updateProgress(proj.id, task.id, v)} style={{
                    background: task.progress === v ? proj.color : "#1E2130",
                    border: "none", borderRadius: 4, padding: "3px 6px",
                    fontSize: 10, color: task.progress === v ? "#fff" : "#4A4F6A",
                    cursor: "pointer",
                  }}>{v}%</button>
                ))}
              </div>
            </div>

            <button onClick={() => deleteTask(proj.id, task.id)} style={{
              width: "100%", background: "transparent",
              border: "1px solid #FF6B6B44", borderRadius: 8,
              color: "#FF6B6B88", padding: "8px", fontSize: 12,
              cursor: "pointer", fontWeight: 600,
            }}>Delete Task</button>
          </div>
        );
      })()}

      {/* Add Task Modal */}
      {showAddTask && (
        <div style={{
          position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)",
          display: "flex", alignItems: "center", justifyContent: "center",
          zIndex: 50,
        }} onClick={() => setShowAddTask(null)}>
          <div style={{
            background: "#13151C", borderRadius: 16, padding: 24, width: 360,
            border: "1px solid #1E2130",
          }} onClick={e => e.stopPropagation()}>
            <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 20, color: "#E8EAF0" }}>Add New Task</div>

            {[
              { label: "Task Name", key: "name", placeholder: "e.g. Design mockup" },
              { label: "Assignee", key: "assignee", placeholder: "e.g. Alice" },
              { label: "Duration (days)", key: "days", placeholder: "7", type: "number" },
            ].map(f => (
              <div key={f.key} style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 10, color: "#4A4F6A", marginBottom: 5, textTransform: "uppercase", letterSpacing: "0.8px" }}>{f.label}</div>
                <input
                  type={f.type || "text"}
                  placeholder={f.placeholder}
                  value={newTask[f.key]}
                  onChange={e => setNewTask(n => ({ ...n, [f.key]: e.target.value }))}
                  style={{
                    width: "100%", background: "#1A1D26", border: "1px solid #252836",
                    borderRadius: 8, padding: "8px 12px", color: "#E8EAF0",
                    fontSize: 13, outline: "none", boxSizing: "border-box",
                  }}
                />
              </div>
            ))}

            <div style={{ display: "flex", gap: 8, marginTop: 20 }}>
              <button onClick={() => setShowAddTask(null)} style={{
                flex: 1, background: "#1A1D26", border: "1px solid #252836",
                borderRadius: 8, padding: "9px", color: "#6A6E88",
                cursor: "pointer", fontSize: 13, fontWeight: 600,
              }}>Cancel</button>
              <button onClick={() => addTask(showAddTask)} style={{
                flex: 1, background: "linear-gradient(135deg, #6C63FF, #8B5CF6)",
                border: "none", borderRadius: 8, padding: "9px",
                color: "#fff", cursor: "pointer", fontSize: 13, fontWeight: 600,
              }}>Add Task</button>
            </div>
          </div>
        </div>
      )}

      {/* Tooltip */}
      {tooltip && hoveredTask && (
        <div style={{
          position: "fixed",
          left: tooltip.x + 12,
          top: tooltip.y,
          background: "#1A1D26",
          border: `1px solid ${hoveredTask.proj.color}44`,
          borderRadius: 8, padding: "8px 12px",
          fontSize: 11, color: "#C8CAD8",
          pointerEvents: "none", zIndex: 100,
          boxShadow: "0 8px 24px rgba(0,0,0,0.4)",
          transform: "translateY(-100%)",
        }}>
          <div style={{ fontWeight: 700, color: hoveredTask.proj.color, marginBottom: 3 }}>{hoveredTask.task.name}</div>
          <div>{formatDate(hoveredTask.task.start)} → {formatDate(hoveredTask.task.end)}</div>
          <div style={{ color: "#6A6E88", marginTop: 2 }}>👤 {hoveredTask.task.assignee} · {hoveredTask.task.progress}%</div>
        </div>
      )}
    </div>
  );
}

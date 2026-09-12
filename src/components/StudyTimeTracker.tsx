import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Clock, Download, FileText, Plus, Target, Timer, Trash2 } from "lucide-react";
import {
  eachDayOfInterval,
  format,
  parseISO,
  startOfMonth,
  startOfWeek,
  subDays,
  subMonths,
} from "date-fns";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip as ChartTooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface SubjectOption {
  id: string;
  name: string;
  courseName: string;
}

interface StudySession {
  id: string;
  subject_id: string;
  minutes: number;
  studied_on: string;
  note: string | null;
}

const formatMinutes = (minutes: number) => {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
};

export function StudyTimeTracker({ userId }: { userId: string }) {
  const { toast } = useToast();
  const [subjects, setSubjects] = useState<SubjectOption[]>([]);
  const [sessions, setSessions] = useState<StudySession[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [subjectId, setSubjectId] = useState("");
  const [hours, setHours] = useState("");
  const [minutes, setMinutes] = useState("");
  const [studiedOn, setStudiedOn] = useState(format(new Date(), "yyyy-MM-dd"));
  const [note, setNote] = useState("");

  const [dailyGoal, setDailyGoal] = useState(60);
  const [weeklyGoal, setWeeklyGoal] = useState(420);
  const [dailyGoalInput, setDailyGoalInput] = useState("60");
  const [weeklyGoalInput, setWeeklyGoalInput] = useState("420");
  const [savingGoals, setSavingGoals] = useState(false);

  const loadData = async () => {
    const [{ data: courseData }, { data: sessionData }, { data: profileData }] = await Promise.all([
      supabase
        .from("courses")
        .select("id, name, subjects(id, name)")
        .eq("user_id", userId)
        .order("created_at", { ascending: true }),
      supabase
        .from("study_sessions")
        .select("id, subject_id, minutes, studied_on, note")
        .eq("user_id", userId)
        .order("studied_on", { ascending: false })
        .order("created_at", { ascending: false }),
      supabase
        .from("profiles")
        .select("daily_goal_minutes, weekly_goal_minutes")
        .eq("user_id", userId)
        .maybeSingle(),
    ]);

    if (profileData) {
      const d = (profileData as any).daily_goal_minutes ?? 60;
      const w = (profileData as any).weekly_goal_minutes ?? 420;
      setDailyGoal(d);
      setWeeklyGoal(w);
      setDailyGoalInput(String(d));
      setWeeklyGoalInput(String(w));
    }

    const options: SubjectOption[] = [];
    (courseData ?? []).forEach((course: any) => {
      (course.subjects ?? []).forEach((subject: any) => {
        options.push({ id: subject.id, name: subject.name, courseName: course.name });
      });
    });

    setSubjects(options);
    setSessions((sessionData ?? []) as StudySession[]);
    setLoading(false);
  };

  useEffect(() => {
    if (!userId) return;
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  const subjectMap = useMemo(() => {
    const map: Record<string, SubjectOption> = {};
    subjects.forEach((s) => (map[s.id] = s));
    return map;
  }, [subjects]);

  const totals = useMemo(() => {
    const today = format(new Date(), "yyyy-MM-dd");
    const weekStart = format(subDays(new Date(), 6), "yyyy-MM-dd");
    let todayMinutes = 0;
    let weekMinutes = 0;
    let allMinutes = 0;
    const perSubject: Record<string, number> = {};

    sessions.forEach((s) => {
      allMinutes += s.minutes;
      if (s.studied_on === today) todayMinutes += s.minutes;
      if (s.studied_on >= weekStart) weekMinutes += s.minutes;
      perSubject[s.subject_id] = (perSubject[s.subject_id] ?? 0) + s.minutes;
    });

    const bySubject = Object.entries(perSubject)
      .map(([id, mins]) => ({ id, minutes: mins, subject: subjectMap[id] }))
      .filter((entry) => entry.subject)
      .sort((a, b) => b.minutes - a.minutes);

    return { todayMinutes, weekMinutes, allMinutes, bySubject };
  }, [sessions, subjectMap]);

  const minutesByDate = useMemo(() => {
    const map: Record<string, number> = {};
    sessions.forEach((s) => {
      map[s.studied_on] = (map[s.studied_on] ?? 0) + s.minutes;
    });
    return map;
  }, [sessions]);

  const weeklyChart = useMemo(() => {
    const days = eachDayOfInterval({ start: subDays(new Date(), 6), end: new Date() });
    return days.map((day) => {
      const key = format(day, "yyyy-MM-dd");
      const mins = minutesByDate[key] ?? 0;
      return {
        label: format(day, "EEE"),
        minutes: mins,
        hours: Number((mins / 60).toFixed(2)),
        metGoal: dailyGoal > 0 && mins >= dailyGoal,
      };
    });
  }, [minutesByDate, dailyGoal]);

  const monthlyChart = useMemo(() => {
    const weeks: { label: string; minutes: number; hours: number; metGoal: boolean }[] = [];
    for (let i = 3; i >= 0; i--) {
      const start = startOfWeek(subDays(new Date(), i * 7), { weekStartsOn: 1 });
      const days = eachDayOfInterval({ start, end: subDays(start, -6) });
      const mins = days.reduce((sum, d) => sum + (minutesByDate[format(d, "yyyy-MM-dd")] ?? 0), 0);
      weeks.push({
        label: `${format(start, "dd MMM")}`,
        minutes: mins,
        hours: Number((mins / 60).toFixed(2)),
        metGoal: weeklyGoal > 0 && mins >= weeklyGoal,
      });
    }
    return weeks;
  }, [minutesByDate, weeklyGoal]);

  const monthTotals = useMemo(() => {
    const thisMonthStart = format(startOfMonth(new Date()), "yyyy-MM-dd");
    const lastMonthStart = format(startOfMonth(subMonths(new Date(), 1)), "yyyy-MM-dd");
    let thisMonth = 0;
    let lastMonth = 0;
    sessions.forEach((s) => {
      if (s.studied_on >= thisMonthStart) thisMonth += s.minutes;
      else if (s.studied_on >= lastMonthStart) lastMonth += s.minutes;
    });
    return { thisMonth, lastMonth };
  }, [sessions]);

  const dailyPct = dailyGoal > 0 ? Math.min(100, (totals.todayMinutes / dailyGoal) * 100) : 0;
  const weeklyPct = weeklyGoal > 0 ? Math.min(100, (totals.weekMinutes / weeklyGoal) * 100) : 0;

  const handleSaveGoals = async () => {
    const d = Math.max(0, parseInt(dailyGoalInput || "0", 10) || 0);
    const w = Math.max(0, parseInt(weeklyGoalInput || "0", 10) || 0);
    setSavingGoals(true);
    const { error } = await supabase
      .from("profiles")
      .update({ daily_goal_minutes: d, weekly_goal_minutes: w } as any)
      .eq("user_id", userId);
    setSavingGoals(false);
    if (error) {
      toast({ title: "Could not save goals", description: error.message, variant: "destructive" });
      return;
    }
    setDailyGoal(d);
    setWeeklyGoal(w);
    toast({ title: "Goals updated", description: `${formatMinutes(d)} a day · ${formatMinutes(w)} a week.` });
  };

  const exportCsv = () => {
    const rows = [
      ["Date", "Course", "Subject", "Minutes", "Hours", "Note"],
      ...sessions.map((s) => [
        s.studied_on,
        subjectMap[s.subject_id]?.courseName ?? "",
        subjectMap[s.subject_id]?.name ?? "",
        String(s.minutes),
        (s.minutes / 60).toFixed(2),
        (s.note ?? "").replace(/"/g, '""'),
      ]),
      [],
      ["Totals"],
      ["Today", "", "", String(totals.todayMinutes), (totals.todayMinutes / 60).toFixed(2), ""],
      ["Last 7 days", "", "", String(totals.weekMinutes), (totals.weekMinutes / 60).toFixed(2), ""],
      ["This month", "", "", String(monthTotals.thisMonth), (monthTotals.thisMonth / 60).toFixed(2), ""],
      ["All time", "", "", String(totals.allMinutes), (totals.allMinutes / 60).toFixed(2), ""],
    ];
    const csv = rows.map((r) => r.map((cell) => `"${cell ?? ""}"`).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `study-time-${format(new Date(), "yyyy-MM-dd")}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    toast({ title: "CSV downloaded", description: `${sessions.length} sessions exported.` });
  };

  const exportPdf = () => {
    const win = window.open("", "_blank");
    if (!win) {
      toast({ title: "Allow pop-ups", description: "Enable pop-ups to save the PDF.", variant: "destructive" });
      return;
    }
    const rowsHtml = sessions
      .map(
        (s) => `<tr><td>${format(parseISO(s.studied_on), "dd MMM yyyy")}</td><td>${
          subjectMap[s.subject_id]?.courseName ?? ""
        }</td><td>${subjectMap[s.subject_id]?.name ?? ""}</td><td>${formatMinutes(s.minutes)}</td><td>${
          s.note ?? ""
        }</td></tr>`
      )
      .join("");
    const subjectHtml = totals.bySubject
      .map((e) => `<tr><td>${e.subject.name}</td><td>${e.subject.courseName}</td><td>${formatMinutes(e.minutes)}</td></tr>`)
      .join("");
    win.document.write(`<!doctype html><html><head><title>Study Time Report</title>
<style>body{font-family:Georgia,serif;margin:32px;color:#1f2933}h1{font-size:24px}h2{font-size:16px;margin-top:28px}
table{width:100%;border-collapse:collapse;font-size:12px;font-family:Arial,sans-serif}
th,td{border:1px solid #d6dbe1;padding:6px 8px;text-align:left}th{background:#f2f5f7}
ul{font-size:13px;font-family:Arial,sans-serif}</style></head><body>
<h1>Study Time Report</h1>
<p>Generated ${format(new Date(), "dd MMM yyyy")}</p>
<h2>Totals</h2>
<ul>
<li>Today: ${formatMinutes(totals.todayMinutes)} (goal ${formatMinutes(dailyGoal)}, ${Math.round(dailyPct)}%)</li>
<li>Last 7 days: ${formatMinutes(totals.weekMinutes)} (goal ${formatMinutes(weeklyGoal)}, ${Math.round(weeklyPct)}%)</li>
<li>This month: ${formatMinutes(monthTotals.thisMonth)}</li>
<li>Last month: ${formatMinutes(monthTotals.lastMonth)}</li>
<li>All time: ${formatMinutes(totals.allMinutes)}</li>
</ul>
<h2>Time per subject</h2>
<table><thead><tr><th>Subject</th><th>Course</th><th>Time</th></tr></thead><tbody>${subjectHtml}</tbody></table>
<h2>All sessions</h2>
<table><thead><tr><th>Date</th><th>Course</th><th>Subject</th><th>Time</th><th>Note</th></tr></thead><tbody>${rowsHtml}</tbody></table>
</body></html>`);
    win.document.close();
    win.focus();
    win.print();
  };

  const handleAdd = async () => {
    const total = (parseInt(hours || "0", 10) || 0) * 60 + (parseInt(minutes || "0", 10) || 0);
    if (!subjectId) {
      toast({ title: "Pick a subject", description: "Choose which subject you studied.", variant: "destructive" });
      return;
    }
    if (total <= 0) {
      toast({ title: "Add some time", description: "Enter hours or minutes studied.", variant: "destructive" });
      return;
    }

    setSaving(true);
    const { error } = await supabase.from("study_sessions").insert({
      user_id: userId,
      subject_id: subjectId,
      minutes: total,
      studied_on: studiedOn,
      note: note.trim() ? note.trim() : null,
    });
    setSaving(false);

    if (error) {
      toast({ title: "Could not save", description: error.message, variant: "destructive" });
      return;
    }

    setHours("");
    setMinutes("");
    setNote("");
    toast({ title: "Time logged", description: `${formatMinutes(total)} added.` });
    loadData();
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("study_sessions").delete().eq("id", id);
    if (error) {
      toast({ title: "Could not delete", description: error.message, variant: "destructive" });
      return;
    }
    setSessions((prev) => prev.filter((s) => s.id !== id));
  };

  const maxSubjectMinutes = totals.bySubject[0]?.minutes ?? 0;

  return (
    <Card className="card-gradient border border-border/70 shadow-card">
      <CardHeader className="pb-4">
        <CardTitle className="text-lg flex items-center gap-2">
          <Timer className="h-5 w-5 text-primary" />
          Study Time Tracker
        </CardTitle>
        <CardDescription>
          {formatMinutes(totals.todayMinutes)} today · {formatMinutes(totals.weekMinutes)} last 7 days ·{" "}
          {formatMinutes(totals.allMinutes)} total
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {subjects.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Add a course with subjects first, then you can log study time here.
          </p>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
              <div className="md:col-span-2 space-y-1.5">
                <Label>Subject</Label>
                <Select value={subjectId} onValueChange={setSubjectId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select subject" />
                  </SelectTrigger>
                  <SelectContent>
                    {subjects.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.courseName} — {s.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Hours</Label>
                <Input
                  type="number"
                  min="0"
                  placeholder="0"
                  value={hours}
                  onChange={(e) => setHours(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Minutes</Label>
                <Input
                  type="number"
                  min="0"
                  max="59"
                  placeholder="30"
                  value={minutes}
                  onChange={(e) => setMinutes(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Date</Label>
                <Input type="date" value={studiedOn} onChange={(e) => setStudiedOn(e.target.value)} />
              </div>
            </div>
            <div className="flex flex-col sm:flex-row gap-3">
              <Input
                placeholder="What did you study? (optional)"
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
              <Button onClick={handleAdd} disabled={saving} className="sm:w-40">
                <Plus className="h-4 w-4 mr-2" />
                {saving ? "Saving..." : "Log time"}
              </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="rounded-lg border border-border/70 p-4 space-y-3">
                <div className="flex items-center gap-2 text-sm font-semibold">
                  <Target className="h-4 w-4 text-primary" />
                  Daily goal
                </div>
                <Progress value={dailyPct} className="h-2" />
                <p className="text-xs text-muted-foreground">
                  {formatMinutes(totals.todayMinutes)} of {formatMinutes(dailyGoal)} ({Math.round(dailyPct)}%)
                </p>
              </div>
              <div className="rounded-lg border border-border/70 p-4 space-y-3">
                <div className="flex items-center gap-2 text-sm font-semibold">
                  <Target className="h-4 w-4 text-primary" />
                  Weekly goal
                </div>
                <Progress value={weeklyPct} className="h-2" />
                <p className="text-xs text-muted-foreground">
                  {formatMinutes(totals.weekMinutes)} of {formatMinutes(weeklyGoal)} ({Math.round(weeklyPct)}%)
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
              <div className="space-y-1.5">
                <Label>Daily goal (minutes)</Label>
                <Input
                  type="number"
                  min="0"
                  value={dailyGoalInput}
                  onChange={(e) => setDailyGoalInput(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Weekly goal (minutes)</Label>
                <Input
                  type="number"
                  min="0"
                  value={weeklyGoalInput}
                  onChange={(e) => setWeeklyGoalInput(e.target.value)}
                />
              </div>
              <Button variant="secondary" onClick={handleSaveGoals} disabled={savingGoals}>
                {savingGoals ? "Saving..." : "Save goals"}
              </Button>
            </div>

            <Tabs defaultValue="weekly" className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <TabsList>
                  <TabsTrigger value="weekly">Last 7 days</TabsTrigger>
                  <TabsTrigger value="monthly">Last 4 weeks</TabsTrigger>
                </TabsList>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={exportCsv}>
                    <Download className="h-4 w-4 mr-2" />
                    CSV
                  </Button>
                  <Button variant="outline" size="sm" onClick={exportPdf}>
                    <FileText className="h-4 w-4 mr-2" />
                    PDF
                  </Button>
                </div>
              </div>
              <TabsContent value="weekly" className="mt-0">
                <div className="h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={weeklyChart}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border" vertical={false} />
                      <XAxis dataKey="label" tickLine={false} axisLine={false} fontSize={12} />
                      <YAxis tickLine={false} axisLine={false} fontSize={12} unit="h" />
                      <ChartTooltip formatter={(value: any) => [`${value} h`, "Studied"]} />
                      <Bar dataKey="hours" radius={[6, 6, 0, 0]}>
                        {weeklyChart.map((entry, index) => (
                          <Cell
                            key={index}
                            fill={entry.metGoal ? "hsl(var(--primary))" : "hsl(var(--muted-foreground))"}
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </TabsContent>
              <TabsContent value="monthly" className="mt-0">
                <div className="h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={monthlyChart}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border" vertical={false} />
                      <XAxis dataKey="label" tickLine={false} axisLine={false} fontSize={12} />
                      <YAxis tickLine={false} axisLine={false} fontSize={12} unit="h" />
                      <ChartTooltip formatter={(value: any) => [`${value} h`, "Studied"]} />
                      <Bar dataKey="hours" radius={[6, 6, 0, 0]}>
                        {monthlyChart.map((entry, index) => (
                          <Cell
                            key={index}
                            fill={entry.metGoal ? "hsl(var(--primary))" : "hsl(var(--muted-foreground))"}
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  This month {formatMinutes(monthTotals.thisMonth)} · last month {formatMinutes(monthTotals.lastMonth)}
                </p>
              </TabsContent>
            </Tabs>


            {totals.bySubject.length > 0 && (
              <div className="space-y-3">
                <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                  Time per subject
                </h4>
                {totals.bySubject.map((entry) => (
                  <div key={entry.id} className="space-y-1.5">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium">
                        {entry.subject.name}
                        <span className="text-muted-foreground font-normal"> · {entry.subject.courseName}</span>
                      </span>
                      <Badge variant="secondary">{formatMinutes(entry.minutes)}</Badge>
                    </div>
                    <Progress
                      value={maxSubjectMinutes ? (entry.minutes / maxSubjectMinutes) * 100 : 0}
                      className="h-2"
                    />
                  </div>
                ))}
              </div>
            )}

            {sessions.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                  Recent sessions
                </h4>
                <div className="divide-y divide-border/70 rounded-lg border border-border/70 overflow-hidden">
                  {sessions.slice(0, 8).map((session) => (
                    <div key={session.id} className="flex items-center gap-3 p-3">
                      <Clock className="h-4 w-4 text-primary shrink-0" />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium truncate">
                          {subjectMap[session.subject_id]?.name ?? "Subject"} · {formatMinutes(session.minutes)}
                        </p>
                        <p className="text-xs text-muted-foreground truncate">
                          {format(parseISO(session.studied_on), "dd MMM yyyy")}
                          {session.note ? ` · ${session.note}` : ""}
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDelete(session.id)}
                        aria-label="Delete session"
                      >
                        <Trash2 className="h-4 w-4 text-muted-foreground" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
        {loading && <p className="text-sm text-muted-foreground">Loading study time...</p>}
      </CardContent>
    </Card>
  );
}

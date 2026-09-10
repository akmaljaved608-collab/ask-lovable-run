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

  const loadData = async () => {
    const [{ data: courseData }, { data: sessionData }] = await Promise.all([
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
    ]);

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

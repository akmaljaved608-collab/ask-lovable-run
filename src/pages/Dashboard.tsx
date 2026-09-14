import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { format, isSameDay, startOfDay, subDays } from "date-fns";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { BookOpen, CalendarDays, CheckCircle2, ChevronRight, Flame, ListTodo, Target } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { StudyTimeTracker } from "@/components/StudyTimeTracker";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface SyllabusItem {
  id: string;
  content: string;
  completed: boolean;
  weightage: number;
  date_completed: string | null;
}

interface SubjectData {
  id: string;
  name: string;
  syllabus_items: SyllabusItem[];
}

interface CourseData {
  id: string;
  name: string;
  description: string | null;
  subjects: SubjectData[];
}

const percent = (items: SyllabusItem[]) => {
  const totalWeight = items.reduce((sum, item) => sum + (Number(item.weightage) || 0), 0);
  const doneWeight = items.filter((item) => item.completed).reduce((sum, item) => sum + (Number(item.weightage) || 0), 0);
  if (totalWeight > 0) return (doneWeight / totalWeight) * 100;
  return items.length > 0 ? (items.filter((item) => item.completed).length / items.length) * 100 : 0;
};

export default function Dashboard() {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [courses, setCourses] = useState<CourseData[]>([]);
  const [selectedCourseId, setSelectedCourseId] = useState("");
  const [selectedSubjectId, setSelectedSubjectId] = useState("");

  useEffect(() => {
    if (!user) return;
    const fetchData = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("courses")
        .select("id, name, description, subjects(id, name, syllabus_items(id, content, completed, weightage, date_completed))")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (error) {
        toast({ title: "Could not load progress", description: "Please refresh and try again.", variant: "destructive" });
      } else {
        const nextCourses = (data ?? []) as CourseData[];
        setCourses(nextCourses);
        const firstCourse = nextCourses[0];
        if (firstCourse) {
          setSelectedCourseId((current) => current || firstCourse.id);
          setSelectedSubjectId((current) => current || firstCourse.subjects[0]?.id || "");
        }
      }
      setLoading(false);
    };
    fetchData();
  }, [toast, user]);

  const selectedCourse = courses.find((course) => course.id === selectedCourseId) ?? courses[0];
  const selectedSubject = selectedCourse?.subjects.find((subject) => subject.id === selectedSubjectId) ?? selectedCourse?.subjects[0];

  useEffect(() => {
    if (selectedCourse && !selectedCourse.subjects.some((subject) => subject.id === selectedSubjectId)) {
      setSelectedSubjectId(selectedCourse.subjects[0]?.id || "");
    }
  }, [selectedCourse, selectedSubjectId]);

  const allSubjects = courses.flatMap((course) => course.subjects);
  const allItems = allSubjects.flatMap((subject) => subject.syllabus_items);
  const completedItems = allItems.filter((item) => item.completed);
  const totalWeight = allItems.reduce((sum, item) => sum + (Number(item.weightage) || 0), 0);
  const completedWeight = completedItems.reduce((sum, item) => sum + (Number(item.weightage) || 0), 0);
  const overallProgress = percent(allItems);

  const activeDates = useMemo(
    () => Array.from(new Set(completedItems.filter((item) => item.date_completed).map((item) => startOfDay(new Date(item.date_completed ?? "")).toISOString())))
      .map((date) => new Date(date)).sort((a, b) => b.getTime() - a.getTime()),
    [completedItems]
  );

  const streak = useMemo(() => {
    if (!activeDates.length) return 0;
    const today = startOfDay(new Date());
    let cursor = startOfDay(activeDates[0]);
    if (!isSameDay(cursor, today) && !isSameDay(cursor, subDays(today, 1))) return 0;
    let count = 1;
    for (let index = 1; index < activeDates.length; index += 1) {
      const next = startOfDay(activeDates[index]);
      if (!isSameDay(next, subDays(cursor, 1))) break;
      count += 1;
      cursor = next;
    }
    return count;
  }, [activeDates]);

  const tasks = useMemo(() => courses.flatMap((course) => course.subjects.flatMap((subject) =>
    subject.syllabus_items.filter((item) => !item.completed).map((item) => ({ ...item, courseName: course.name, subjectName: subject.name }))
  )).sort((a, b) => Number(b.weightage) - Number(a.weightage)).slice(0, 6), [courses]);

  const subjectItems = selectedSubject?.syllabus_items ?? [];
  const subjectProgress = percent(subjectItems);
  const subjectTotalWeight = subjectItems.reduce((sum, item) => sum + (Number(item.weightage) || 0), 0);
  const subjectDoneWeight = subjectItems.filter((item) => item.completed).reduce((sum, item) => sum + (Number(item.weightage) || 0), 0);
  const chartData = [
    { name: "Completed", value: subjectProgress },
    { name: "Remaining", value: Math.max(0, 100 - subjectProgress) },
  ];

  if (loading) {
    return <main className="flex min-h-[70vh] items-center justify-center"><p className="text-muted-foreground">Preparing your progress sheet…</p></main>;
  }

  return (
    <main className="w-full bg-background">
      <div className="mx-auto max-w-7xl space-y-8 p-4 md:p-8">
        <header className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
          <div>
            <span className="eyebrow">Today · {format(new Date(), "EEEE, MMMM d")}</span>
            <h1 className="mt-2 text-4xl md:text-5xl">Progress Sheet</h1>
            <p className="mt-2 max-w-2xl text-muted-foreground">Focus on the work that matters most and keep your learning rhythm moving.</p>
          </div>
          <Button onClick={() => navigate("/courses?tab=syllabus")} className="hero-gradient text-primary-foreground">
            Open syllabus <ChevronRight className="ml-2 size-4" />
          </Button>
        </header>

        <section className="grid gap-4 md:grid-cols-3">
          <Card className="border-border/70 shadow-card md:col-span-2">
            <CardContent className="flex h-full flex-col justify-between gap-6 p-6 md:flex-row md:items-end">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Overall completion</p>
                <p className="mt-2 text-5xl font-semibold text-foreground">{Math.round(overallProgress)}%</p>
                <p className="mt-2 text-sm text-muted-foreground">
                  {totalWeight > 0 ? `${Math.round(completedWeight * 10) / 10} of ${Math.round(totalWeight * 10) / 10}% exam weightage` : `${completedItems.length} of ${allItems.length} topics`}
                </p>
              </div>
              <div className="grid grid-cols-3 gap-6 text-center">
                <div><p className="text-2xl font-semibold">{courses.length}</p><p className="text-xs text-muted-foreground">Courses</p></div>
                <div><p className="text-2xl font-semibold">{allSubjects.length}</p><p className="text-xs text-muted-foreground">Subjects</p></div>
                <div><p className="text-2xl font-semibold">{completedItems.length}</p><p className="text-xs text-muted-foreground">Done</p></div>
              </div>
            </CardContent>
          </Card>
          <Card className="border-border/70 bg-accent/10 shadow-card">
            <CardContent className="flex h-full items-center gap-5 p-6">
              <div className="rounded-md bg-accent/15 p-3"><Flame className="size-7 text-accent" /></div>
              <div><p className="text-4xl font-semibold">{streak}</p><p className="text-sm text-muted-foreground">day learning streak</p></div>
            </CardContent>
          </Card>
        </section>

        <section className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(360px,0.8fr)]">
          <Card className="border-border/70 shadow-card">
            <CardHeader>
              <div className="flex items-center justify-between gap-3">
                <div><CardTitle className="flex items-center gap-2"><ListTodo className="size-5 text-primary" /> Tasks for today</CardTitle><CardDescription>Highest-weightage unfinished topics first</CardDescription></div>
                <Badge variant="secondary">{tasks.length} suggested</Badge>
              </div>
            </CardHeader>
            <CardContent>
              {tasks.length ? <div className="divide-y divide-border">
                {tasks.map((task, index) => <button key={task.id} onClick={() => navigate("/courses?tab=syllabus")} className="flex w-full items-center gap-4 py-4 text-left transition-colors hover:bg-muted/40">
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-muted text-sm font-semibold">{index + 1}</span>
                  <span className="min-w-0 flex-1"><span className="block truncate font-medium">{task.content}</span><span className="block truncate text-xs text-muted-foreground">{task.courseName} · {task.subjectName}</span></span>
                  <Badge variant="outline">{Number(task.weightage) || 0}%</Badge>
                </button>)}
              </div> : <div className="py-12 text-center"><CheckCircle2 className="mx-auto mb-3 size-10 text-primary" /><p className="font-medium">All topics are complete</p><p className="text-sm text-muted-foreground">Your task list is clear.</p></div>}
            </CardContent>
          </Card>

          <Card className="border-border/70 shadow-card">
            <CardHeader><CardTitle>Subject completion</CardTitle><CardDescription>Select a course and subject to inspect its weighted progress.</CardDescription></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <Select value={selectedCourse?.id ?? ""} onValueChange={setSelectedCourseId}><SelectTrigger><SelectValue placeholder="Course" /></SelectTrigger><SelectContent>{courses.map((course) => <SelectItem key={course.id} value={course.id}>{course.name}</SelectItem>)}</SelectContent></Select>
                <Select value={selectedSubject?.id ?? ""} onValueChange={setSelectedSubjectId}><SelectTrigger><SelectValue placeholder="Subject" /></SelectTrigger><SelectContent>{selectedCourse?.subjects.map((subject) => <SelectItem key={subject.id} value={subject.id}>{subject.name}</SelectItem>)}</SelectContent></Select>
              </div>
              {selectedSubject ? <>
                <div className="relative mx-auto h-64 w-full max-w-sm">
                  <ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={chartData} dataKey="value" innerRadius={72} outerRadius={98} startAngle={90} endAngle={-270} strokeWidth={0}><Cell fill="hsl(var(--primary))" /><Cell fill="hsl(var(--muted))" /></Pie><Tooltip formatter={(value: number) => `${Math.round(value)}%`} /></PieChart></ResponsiveContainer>
                  <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center"><span className="text-4xl font-semibold">{Math.round(subjectProgress)}%</span><span className="text-xs text-muted-foreground">complete</span></div>
                </div>
                <div className="grid grid-cols-2 gap-3 text-center"><div className="rounded-md bg-muted/60 p-3"><p className="font-semibold">{subjectDoneWeight}/{subjectTotalWeight || subjectItems.length}%</p><p className="text-xs text-muted-foreground">Weightage done</p></div><div className="rounded-md bg-muted/60 p-3"><p className="font-semibold">{subjectItems.filter((item) => item.completed).length}/{subjectItems.length}</p><p className="text-xs text-muted-foreground">Topics done</p></div></div>
              </> : <div className="py-16 text-center text-muted-foreground"><Target className="mx-auto mb-3 size-9 opacity-50" /><p>Add a subject to see its chart.</p></div>}
            </CardContent>
          </Card>
        </section>

        <section>
          <div className="mb-4 flex items-center gap-2"><BookOpen className="size-5 text-primary" /><h2 className="text-2xl">All courses</h2></div>
          {courses.length ? <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{courses.map((course) => {
            const items = course.subjects.flatMap((subject) => subject.syllabus_items);
            return <Card key={course.id} className="border-border/70 shadow-card"><CardHeader><div className="flex items-start justify-between gap-3"><CardTitle>{course.name}</CardTitle><Badge variant="outline">{Math.round(percent(items))}%</Badge></div><CardDescription>{course.subjects.length} subjects · {items.filter((item) => item.completed).length}/{items.length} topics</CardDescription></CardHeader></Card>;
          })}</div> : <Card><CardContent className="py-12 text-center"><BookOpen className="mx-auto mb-3 size-10 text-muted-foreground" /><p className="mb-4 text-muted-foreground">Create your first course to begin tracking progress.</p><Button onClick={() => navigate("/courses?tab=courses")}>Create a course</Button></CardContent></Card>}
        </section>

        <section><StudyTimeTracker userId={user?.id ?? ""} /></section>
      </div>
    </main>
  );
}
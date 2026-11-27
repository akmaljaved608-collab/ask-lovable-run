import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { BookOpen, CheckCircle2, ChevronRight, ListTodo, Target } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import CountdownTimers from "@/components/CountdownTimers";

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

const formatWeight = (value: number) => Number.isInteger(value) ? String(value) : value.toFixed(1);

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
      const coursesResult = await supabase
        .from("courses")
        .select("id, name, description, subjects(id, name, syllabus_items(id, content, completed, weightage, date_completed))")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (coursesResult.error) {
        toast({ title: "Could not load progress", description: "Please refresh and try again.", variant: "destructive" });
      } else {
        const nextCourses = (coursesResult.data ?? []) as CourseData[];
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
    return <main aria-label="Progress Sheet" aria-busy="true" className="flex min-h-[70vh] items-center justify-center"><p role="status" className="text-muted-foreground">Preparing your progress sheet…</p></main>;
  }

  return (
    <main id="progress-sheet-content" aria-labelledby="progress-sheet-title" className="progress-sheet w-full bg-background">
      <div className="mx-auto max-w-6xl space-y-6 p-4 sm:p-6 lg:p-8">
        <header className="progress-sheet__heading flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div className="min-w-0">
            <span className="eyebrow">Study overview · {format(new Date(), "EEEE, MMMM d")}</span>
            <h1 id="progress-sheet-title" className="mt-2 text-4xl">Progress Sheet</h1>
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground">Your learning progress, next topics and important dates.</p>
          </div>
          <Button onClick={() => navigate("/courses?tab=syllabus")} className="min-h-11 shrink-0 hero-gradient text-primary-foreground">
            Open syllabus <ChevronRight className="ml-2 size-4" />
          </Button>
        </header>

        <section aria-labelledby="overall-progress-heading">
          <Card className="progress-sheet__overview-card overflow-hidden border-border/70 shadow-card">
            <CardContent className="grid gap-5 p-5 sm:p-6 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
              <div className="min-w-0">
                <h2 id="overall-progress-heading" className="text-sm font-medium text-muted-foreground">Overall completion</h2>
                <div className="mt-1 flex flex-wrap items-baseline gap-x-2">
                  <p className="text-5xl font-semibold tabular-nums text-foreground">{Math.round(overallProgress)}%</p>
                  <span className="text-sm text-muted-foreground">complete</span>
                </div>
                <Progress value={overallProgress} aria-label="Overall completion" aria-valuetext={`${Math.round(overallProgress)} percent complete`} className="mt-3 h-2 bg-muted" />
                <p className="mt-2 text-sm text-muted-foreground">
                  {totalWeight > 0
                    ? `${formatWeight(completedWeight)} of ${formatWeight(totalWeight)} total exam weightage completed`
                    : `${completedItems.length} of ${allItems.length} topics completed`}
                </p>
              </div>
              <div className="grid grid-cols-3 divide-x divide-border border-t border-border pt-4 text-center lg:min-w-[270px] lg:border-l lg:border-t-0 lg:pl-6 lg:pt-0">
                <div className="px-2"><p className="text-2xl font-semibold tabular-nums">{courses.length}</p><p className="mt-1 text-xs text-muted-foreground">Courses</p></div>
                <div className="px-2"><p className="text-2xl font-semibold tabular-nums">{allSubjects.length}</p><p className="mt-1 text-xs text-muted-foreground">Subjects</p></div>
                <div className="px-2"><p className="text-2xl font-semibold tabular-nums">{completedItems.length}</p><p className="mt-1 text-xs text-muted-foreground">Topics done</p></div>
              </div>
            </CardContent>
          </Card>
        </section>

        <div className="progress-sheet__countdowns">
          <CountdownTimers />
        </div>

        <section aria-label="Study focus and subject progress" className="grid gap-4 xl:grid-cols-[minmax(0,1.1fr)_minmax(340px,0.9fr)]">
          <Card className="progress-sheet__section-card border-border/70 shadow-card">
            <CardHeader className="pb-3">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="flex items-center gap-2 text-2xl font-semibold leading-none tracking-tight"><ListTodo aria-hidden="true" className="size-5 shrink-0 text-primary" />Today's focus</h2>
                  <CardDescription className="mt-1">Unfinished topics with the highest exam weightage.</CardDescription>
                </div>
                {tasks.length > 0 && <Badge variant="secondary">{tasks.length} topics</Badge>}
              </div>
            </CardHeader>
            <CardContent>
              {tasks.length ? <ul aria-label="Today's unfinished topics, highest weightage first" className="divide-y divide-border">
                {tasks.map((task, index) => <li key={task.id}><Button aria-label={`View syllabus: ${task.content}, ${task.subjectName}, ${task.courseName}, ${Number(task.weightage) || 0} percent exam weightage`} variant="ghost" onClick={() => navigate("/courses?tab=syllabus")} className="h-auto min-h-11 w-full justify-start gap-3 rounded-none px-2 py-3 text-left hover:bg-muted/50">
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-muted text-sm font-semibold tabular-nums">{index + 1}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block break-words font-medium leading-snug">{task.content}</span>
                    <span className="mt-1 block break-words text-xs font-normal text-muted-foreground">{task.courseName} · {task.subjectName}</span>
                  </span>
                  <Badge className="shrink-0" variant="outline">{Number(task.weightage) || 0}%</Badge>
                </Button></li>)}
              </ul> : courses.length ? <div className="py-10 text-center">
                <CheckCircle2 className="mx-auto mb-3 size-9 text-primary" />
                <p className="font-medium">All topics are complete</p>
                <p className="mt-1 text-sm text-muted-foreground">Your study list is clear for now.</p>
              </div> : <div className="py-8 text-center">
                <BookOpen className="mx-auto mb-3 size-9 text-muted-foreground" />
                <p className="font-medium">No courses yet</p>
                <p className="mt-1 text-sm text-muted-foreground">Add a course to build your study list.</p>
                <Button className="mt-4 min-h-11" size="sm" onClick={() => navigate("/courses?tab=courses")}>Create a course</Button>
              </div>}
            </CardContent>
          </Card>

          <Card className="progress-sheet__section-card border-border/70 shadow-card">
            <CardHeader className="pb-3">
              <h2 className="text-2xl font-semibold leading-none tracking-tight">Subject progress</h2>
              <CardDescription className="mt-1">Choose a subject to see its completion.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <Select value={selectedCourse?.id ?? ""} onValueChange={setSelectedCourseId} disabled={courses.length === 0}>
                  <SelectTrigger aria-label="Choose course" className="min-h-11"><SelectValue placeholder="Choose course" /></SelectTrigger>
                  <SelectContent>{courses.map((course) => <SelectItem key={course.id} value={course.id}>{course.name}</SelectItem>)}</SelectContent>
                </Select>
                <Select value={selectedSubject?.id ?? ""} onValueChange={setSelectedSubjectId} disabled={!selectedCourse?.subjects.length}>
                  <SelectTrigger aria-label="Choose subject" className="min-h-11"><SelectValue placeholder="Choose subject" /></SelectTrigger>
                  <SelectContent>{selectedCourse?.subjects.map((subject) => <SelectItem key={subject.id} value={subject.id}>{subject.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              {selectedSubject ? <>
                <div
                  className="progress-sheet__chart relative mx-auto h-52 w-full max-w-[15rem]"
                  role="img"
                  aria-label={`${selectedSubject.name} progress chart: ${Math.round(subjectProgress)} percent complete. ${subjectItems.filter((item) => item.completed).length} of ${subjectItems.length} topics complete. ${formatWeight(subjectDoneWeight)} of ${formatWeight(subjectTotalWeight || subjectItems.length)} ${subjectTotalWeight ? "percent weightage" : "topics"} completed.`}
                >
                  <div aria-hidden="true" className="absolute inset-0">
                    <ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={chartData} dataKey="value" innerRadius={62} outerRadius={84} startAngle={90} endAngle={-270} strokeWidth={0}><Cell fill="hsl(var(--primary))" /><Cell fill="hsl(var(--muted-foreground))" /></Pie><Tooltip formatter={(value: number) => `${Math.round(value)}%`} /></PieChart></ResponsiveContainer>
                  </div>
                  <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center"><span className="text-4xl font-semibold tabular-nums">{Math.round(subjectProgress)}%</span><span className="text-xs text-muted-foreground">complete</span></div>
                </div>
                <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-xs text-muted-foreground">
                  <span className="inline-flex items-center gap-2"><span aria-hidden="true" className="size-2.5 rounded-full bg-primary" />Completed</span>
                  <span className="inline-flex items-center gap-2"><span aria-hidden="true" className="size-2.5 rounded-full bg-muted-foreground" />Remaining</span>
                </div>
                <div className="grid grid-cols-2 gap-3 border-t border-border pt-3 text-center">
                  <div><p className="font-semibold tabular-nums">{formatWeight(subjectDoneWeight)} / {formatWeight(subjectTotalWeight || subjectItems.length)}{subjectTotalWeight ? "%" : ""}</p><p className="mt-1 text-xs text-muted-foreground">Weightage done</p></div>
                  <div><p className="font-semibold tabular-nums">{subjectItems.filter((item) => item.completed).length} / {subjectItems.length}</p><p className="mt-1 text-xs text-muted-foreground">Topics done</p></div>
                </div>
              </> : <div className="py-10 text-center text-muted-foreground">
                <Target className="mx-auto mb-3 size-8 opacity-60" />
                <p className="font-medium text-foreground">No subject to show</p>
                <p className="mt-1 text-sm">Add a subject to this course to see its chart.</p>
              </div>}
            </CardContent>
          </Card>
        </section>

        <section aria-labelledby="course-summaries-heading">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2"><BookOpen aria-hidden="true" className="size-5 text-primary" /><h2 id="course-summaries-heading" className="text-2xl">Courses</h2></div>
            {courses.length > 0 && <Badge variant="outline">{courses.length}</Badge>}
          </div>
          {courses.length ? <ul aria-label="Course progress summaries" className="progress-sheet__course-list divide-y divide-border overflow-hidden rounded-lg border border-border bg-card">
            {courses.map((course) => {
              const items = course.subjects.flatMap((subject) => subject.syllabus_items);
              const courseProgress = percent(items);
              const done = items.filter((item) => item.completed).length;
              return <li key={course.id} className="grid gap-2 p-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
                <div className="min-w-0">
                  <p className="break-words font-semibold">{course.name}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{course.subjects.length} subjects · {done} of {items.length} topics complete</p>
                  <Progress value={courseProgress} aria-label={`${course.name} completion`} className="mt-2 h-1.5 bg-muted" />
                </div>
                <Badge variant="secondary" className="w-fit tabular-nums sm:min-w-14 sm:justify-center">{Math.round(courseProgress)}%</Badge>
              </li>;
            })}
          </ul> : <Card className="border-border/70 shadow-card"><CardContent className="py-8 text-center">
            <BookOpen className="mx-auto mb-3 size-9 text-muted-foreground" />
            <p className="mb-4 text-sm text-muted-foreground">Create your first course to begin tracking progress.</p>
            <Button className="min-h-11" onClick={() => navigate("/courses?tab=courses")}>Create a course</Button>
          </CardContent></Card>}
        </section>
      </div>
    </main>
  );
}
import { useState, useEffect, useMemo } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { ThemeToggle } from "@/components/ThemeToggle";
import { StreakAchievements, getAchievementsForExport } from "@/components/StreakAchievements";
import {
  LayoutDashboard,
  BookOpen,
  Target,
  Award,
  Flame,
  ClipboardCheck,
  TrendingUp,
  LogOut,
  User,
  Settings,
  FileText,
  BarChart3,
  ArrowRight,
  GraduationCap,
  CalendarDays,
  Zap,
  Trophy,
} from "lucide-react";
import { format, isSameDay, startOfDay, subDays } from "date-fns";

interface CourseSummary {
  id: string;
  name: string;
  description: string;
  subjectCount: number;
  totalItems: number;
  completedItems: number;
  totalWeightage: number;
  completedWeightage: number;
  percentage: number;
}

interface RecentActivity {
  id: string;
  date: string;
  courseName: string;
  subjectName: string;
  content: string;
}

export default function Dashboard() {
  const { user, signOut } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [userProfile, setUserProfile] = useState<any>(null);
  const [courses, setCourses] = useState<CourseSummary[]>([]);
  const [recentActivity, setRecentActivity] = useState<RecentActivity[]>([]);
  const [totalSubjects, setTotalSubjects] = useState(0);
  const [totalCompleted, setTotalCompleted] = useState(0);
  const [totalItems, setTotalItems] = useState(0);
  const [totalWeightage, setTotalWeightage] = useState(0);
  const [completedWeightage, setCompletedWeightage] = useState(0);
  const [streak, setStreak] = useState(0);
  const [activeDays, setActiveDays] = useState(0);
  const [testsPassed, setTestsPassed] = useState(0);
  const [testsTotal, setTestsTotal] = useState(0);
  const [averageScore, setAverageScore] = useState(0);

  useEffect(() => {
    if (user) {
      fetchDashboardData();
      fetchUserProfile();
    }
  }, [user]);

  const fetchUserProfile = async () => {
    try {
      const { data } = await supabase
        .from("profiles")
        .select("*")
        .eq("user_id", user?.id)
        .maybeSingle();
      if (data) setUserProfile(data);
    } catch (error) {
      console.error("Error fetching profile:", error);
    }
  };

  const fetchDashboardData = async () => {
    try {
      setLoading(true);

      const { data: coursesData, error: coursesError } = await supabase
        .from("courses")
        .select(`
          *,
          subjects (
            *,
            syllabus_items (*)
          )
        `)
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false });

      if (coursesError) throw coursesError;

      let subjectsCount = 0;
      let itemsCount = 0;
      let completedCount = 0;
      const courseSummaries: CourseSummary[] = [];
      const completedDates: string[] = [];
      const recent: RecentActivity[] = [];

      coursesData?.forEach((course: any) => {
        let courseTotal = 0;
        let courseCompleted = 0;
        const subjectList = course.subjects || [];
        subjectsCount += subjectList.length;

        subjectList.forEach((subject: any) => {
          const items = subject.syllabus_items || [];
          itemsCount += items.length;

          items.forEach((item: any) => {
            courseTotal++;
            if (item.completed) {
              courseCompleted++;
              completedCount++;
              if (item.date_completed) {
                completedDates.push(item.date_completed);
                recent.push({
                  id: item.id,
                  date: item.date_completed,
                  courseName: course.name,
                  subjectName: subject.name,
                  content: item.content,
                });
              }
            }
          });
        });

        courseSummaries.push({
          id: course.id,
          name: course.name,
          description: course.description || "",
          subjectCount: subjectList.length,
          totalItems: courseTotal,
          completedItems: courseCompleted,
          percentage: courseTotal > 0 ? (courseCompleted / courseTotal) * 100 : 0,
        });
      });

      setTotalSubjects(subjectsCount);
      setTotalItems(itemsCount);
      setTotalCompleted(completedCount);
      setCourses(courseSummaries);
      setRecentActivity(
        recent.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 10)
      );

      // Streak & active days
      const uniqueDates = Array.from(
        new Set(completedDates.map((d) => startOfDay(new Date(d)).toISOString()))
      )
        .map((d) => new Date(d))
        .sort((a, b) => b.getTime() - a.getTime());

      setActiveDays(uniqueDates.length);

      let currentStreak = 0;
      if (uniqueDates.length > 0) {
        const today = startOfDay(new Date());
        const yesterday = subDays(today, 1);
        const mostRecent = startOfDay(uniqueDates[0]);

        if (isSameDay(mostRecent, today) || isSameDay(mostRecent, yesterday)) {
          currentStreak = 1;
          let streakDate = mostRecent;

          for (let i = 1; i < uniqueDates.length; i++) {
            const expectedPrev = subDays(streakDate, 1);
            const nextDate = startOfDay(uniqueDates[i]);
            if (isSameDay(nextDate, expectedPrev)) {
              currentStreak++;
              streakDate = nextDate;
            } else {
              break;
            }
          }
        }
      }
      setStreak(currentStreak);

      // Test series stats
      const courseIds = coursesData?.map((c: any) => c.id) || [];
      let passedTests = 0;
      let totalTests = 0;
      let totalPercentage = 0;

      if (courseIds.length > 0) {
        const { data: testSeries } = await supabase
          .from("test_series")
          .select("*")
          .in("course_id", courseIds);

        const testSeriesData = testSeries || [];

        if (testSeriesData.length > 0) {
          const testIds = testSeriesData.map((t: any) => t.id);
          const { data: scores } = await supabase
            .from("test_series_scores")
            .select("*")
            .in("test_series_id", testIds);

          const scoresData = scores || [];

          testSeriesData.forEach((test: any) => {
            const testScores = scoresData.filter((s: any) => s.test_series_id === test.id);
            const hasScores = testScores.some((s: any) => s.score_obtained > 0);

            if (hasScores) {
              totalTests++;
              const totalScore = testScores.reduce((sum: number, s: any) => sum + s.score_obtained, 0);
              const aggregatePassed = totalScore >= test.aggregate_pass_mark;
              const allSubjectsPassed = testScores.every((s: any) => s.score_obtained >= s.pass_mark);
              if (aggregatePassed && allSubjectsPassed) passedTests++;
              totalPercentage += (totalScore / test.aggregate_max_marks) * 100;
            }
          });
        }
      }

      setTestsPassed(passedTests);
      setTestsTotal(totalTests);
      setAverageScore(totalTests > 0 ? Math.round(totalPercentage / totalTests) : 0);
    } catch (error: any) {
      toast({
        title: "Error loading dashboard",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut();
      toast({
        title: "Signed out successfully",
        description: "Come back soon to continue your learning journey!",
      });
    } catch (error: any) {
      toast({
        title: "Error signing out",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const overallProgress = totalItems > 0 ? (totalCompleted / totalItems) * 100 : 0;
  const achievements = useMemo(
    () => getAchievementsForExport(streak, totalCompleted, activeDays),
    [streak, totalCompleted, activeDays]
  );
  const unlockedAchievements = useMemo(
    () => achievements.filter((a) => a.unlocked),
    [achievements]
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="w-16 h-16 border-4 border-primary/30 border-t-primary rounded-full animate-spin mx-auto"></div>
          <p className="text-muted-foreground">Loading your dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto p-4 md:p-8">
        {/* Header */}
        <header className="mb-10 animate-fade-in">
          <div className="flex flex-wrap justify-between items-center gap-4 mb-8">
            <div className="inline-flex items-center gap-3">
              <div className="hero-gradient p-2.5 rounded-2xl shadow-glow">
                <LayoutDashboard className="h-6 w-6 text-primary-foreground" />
              </div>
              <div className="flex flex-col leading-none">
                <span className="eyebrow">Overview</span>
                <h1 className="text-3xl md:text-4xl text-foreground">Dashboard</h1>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate("/")}
                className="flex items-center gap-2 rounded-xl"
              >
                <BookOpen className="h-4 w-4" />
                Course Tracker
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate("/reports")}
                className="flex items-center gap-2 rounded-xl"
              >
                <FileText className="h-4 w-4" />
                Reports
              </Button>
              <ThemeToggle />
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="relative h-9 w-9 rounded-full">
                    <Avatar className="h-9 w-9">
                      <AvatarImage src={userProfile?.avatar_url} alt={userProfile?.display_name} />
                      <AvatarFallback>
                        {userProfile?.display_name?.charAt(0) || user?.email?.charAt(0) || "U"}
                      </AvatarFallback>
                    </Avatar>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-56" align="end" forceMount>
                  <div className="flex items-center justify-start gap-2 p-2">
                    <div className="flex flex-col space-y-1">
                      <p className="text-sm font-medium leading-none">
                        {userProfile?.display_name || "User"}
                      </p>
                      <p className="text-xs leading-none text-muted-foreground">{user?.email}</p>
                    </div>
                  </div>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => navigate("/dashboard")}>
                    <LayoutDashboard className="mr-2 h-4 w-4" />
                    Dashboard
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => navigate("/")}>
                    <BookOpen className="mr-2 h-4 w-4" />
                    Course Tracker
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => navigate("/reports")}>
                    <BarChart3 className="mr-2 h-4 w-4" />
                    Reports
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => navigate("/settings")}>
                    <Settings className="mr-2 h-4 w-4" />
                    Settings
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleSignOut} className="text-destructive">
                    <LogOut className="mr-2 h-4 w-4" />
                    Sign Out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
          <p className="text-lg md:text-xl text-muted-foreground max-w-2xl">
            Your learning at a glance — progress, streaks, tests, and courses all in one place.
          </p>
        </header>

        {/* Overall Progress Card */}
        <Card className="mb-8 card-gradient border border-border/70 shadow-elevated animate-scale-in">
          <CardHeader className="pb-4">
            <div className="flex items-center gap-3">
              <div className="bg-primary/10 p-2 rounded-xl">
                <TrendingUp className="h-5 w-5 text-primary" />
              </div>
              <div>
                <CardTitle className="text-2xl">Overall Progress</CardTitle>
                <CardDescription className="text-base">
                  {totalCompleted} of {totalItems} syllabus items completed across {courses.length} courses
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="relative">
              <Progress value={overallProgress} className="h-4 bg-muted/50" />
              <div
                className="absolute inset-0 h-4 bg-progress-gradient rounded-full"
                style={{ width: `${overallProgress}%` }}
              />
            </div>
            <div className="flex justify-between items-center">
              <span className="text-lg font-semibold text-primary">{Math.round(overallProgress)}% Complete</span>
              <Badge variant="secondary" className="px-3 py-1">
                <Zap className="h-4 w-4 mr-1" />
                {totalCompleted > 0 ? "Keep it up" : "Start learning"}
              </Badge>
            </div>
          </CardContent>
        </Card>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
          <StatCard
            icon={BookOpen}
            label="Courses"
            value={courses.length}
            color="text-primary"
            bg="bg-primary/10"
          />
          <StatCard
            icon={GraduationCap}
            label="Subjects"
            value={totalSubjects}
            color="text-secondary"
            bg="bg-secondary/10"
          />
          <StatCard
            icon={Target}
            label="Completed"
            value={totalCompleted}
            color="text-accent"
            bg="bg-accent/10"
          />
          <StatCard
            icon={Flame}
            label="Streak"
            value={streak}
            suffix="days"
            color="text-orange-500"
            bg="bg-orange-500/10"
          />
          <StatCard
            icon={CalendarDays}
            label="Active Days"
            value={activeDays}
            color="text-warning"
            bg="bg-warning/10"
          />
          <StatCard
            icon={ClipboardCheck}
            label="Tests Passed"
            value={`${testsPassed}/${testsTotal}`}
            subtext={`${averageScore}% avg`}
            color="text-primary"
            bg="bg-primary/10"
          />
        </div>

        {/* Achievements + Recent Activity */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          <div className="lg:col-span-2">
            <StreakAchievements
              currentStreak={streak}
              totalCompleted={totalCompleted}
              activeDays={activeDays}
            />
          </div>
          <Card className="card-gradient border border-border/70 shadow-card">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <Trophy className="h-5 w-5 text-amber-500" />
                Achievements Unlocked
              </CardTitle>
              <CardDescription>{unlockedAchievements.length} of {achievements.length}</CardDescription>
            </CardHeader>
            <CardContent>
              {unlockedAchievements.length === 0 ? (
                <div className="text-center py-6 text-muted-foreground">
                  <Award className="h-10 w-10 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">Complete items and build streaks to unlock achievements.</p>
                </div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {unlockedAchievements.slice(0, 8).map((achievement) => (
                    <Badge key={achievement.name} variant="secondary" className="px-2 py-1">
                      {achievement.name}
                    </Badge>
                  ))}
                  {unlockedAchievements.length > 8 && (
                    <Badge variant="outline">+{unlockedAchievements.length - 8} more</Badge>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Course Summaries */}
        <h2 className="text-2xl font-semibold mb-6 flex items-center gap-2">
          <BookOpen className="h-6 w-6 text-primary" />
          Course Summary
        </h2>
        {courses.length === 0 ? (
          <Card className="card-gradient border border-border/70 shadow-card">
            <CardContent className="py-12 text-center">
              <BookOpen className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">No courses yet</h3>
              <p className="text-muted-foreground mb-6">
                Create your first course in the Course Tracker to see your progress here.
              </p>
              <Button onClick={() => navigate("/")} className="hero-gradient text-primary-foreground rounded-xl">
                Go to Course Tracker
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
            {courses.map((course) => (
              <Card key={course.id} className="card-gradient border border-border/70 shadow-card hover:shadow-elevated transition-all duration-300">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-xl">{course.name}</CardTitle>
                    <Badge variant="outline">{Math.round(course.percentage)}%</Badge>
                  </div>
                  <CardDescription className="line-clamp-2">
                    {course.description || "No description available"}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="relative">
                    <Progress value={course.percentage} className="h-2 bg-muted/50" />
                    <div
                      className="absolute inset-0 h-2 bg-progress-gradient rounded-full"
                      style={{ width: `${course.percentage}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-sm text-muted-foreground">
                    <span>
                      {course.completedItems}/{course.totalItems} items
                    </span>
                    <span>{course.subjectCount} subjects</span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Recent Activity */}
        <h2 className="text-2xl font-semibold mb-6 flex items-center gap-2">
          <CalendarDays className="h-6 w-6 text-primary" />
          Recent Activity
        </h2>
        <Card className="card-gradient border border-border/70 shadow-card">
          <CardContent className="p-0">
            {recentActivity.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Target className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No completed items yet. Start checking off syllabus items to see activity here.</p>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {recentActivity.map((activity) => (
                  <div key={activity.id} className="p-4 flex items-start gap-4 hover:bg-muted/30 transition-colors">
                    <div className="bg-primary/10 p-2 rounded-lg shrink-0">
                      <Award className="h-4 w-4 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{activity.content}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {activity.courseName} • {activity.subjectName}
                      </p>
                    </div>
                    <div className="text-xs text-muted-foreground shrink-0">
                      {format(new Date(activity.date), "MMM d, yyyy")}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  suffix,
  subtext,
  color,
  bg,
}: {
  icon: React.ElementType;
  label: string;
  value: string | number;
  suffix?: string;
  subtext?: string;
  color: string;
  bg: string;
}) {
  return (
    <Card className="card-gradient border border-border/70 shadow-card">
      <CardContent className="p-5">
        <div className="flex items-center gap-3 mb-3">
          <div className={`${bg} p-2 rounded-xl`}>
            <Icon className={`h-5 w-5 ${color}`} />
          </div>
          <span className="text-sm text-muted-foreground">{label}</span>
        </div>
        <div className="flex items-baseline gap-1.5">
          <span className="text-2xl font-bold text-foreground">{value}</span>
          {suffix && <span className="text-sm text-muted-foreground">{suffix}</span>}
        </div>
        {subtext && <p className="text-xs text-muted-foreground mt-1">{subtext}</p>}
      </CardContent>
    </Card>
  );
}

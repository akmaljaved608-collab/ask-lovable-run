import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Calendar, TrendingUp, Target, Clock, Download, BarChart3, ClipboardCheck, LayoutDashboard } from "lucide-react";
import { format, startOfWeek, startOfMonth, subWeeks, subMonths, startOfDay, subDays, isSameDay } from "date-fns";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from "recharts";
import { getAchievementsForExport } from "@/components/StreakAchievements";
import { getCalendarDataForExport } from "@/components/ProgressCalendar";

interface ProgressData {
  date: string;
  completed: number;
  total: number;
  testsTaken?: number;
}

interface CourseProgress {
  course_name: string;
  total_items: number;
  completed_items: number;
  completion_rate: number;
}

interface TestSeriesStats {
  totalTests: number;
  testsPassed: number;
  testsFailed: number;
  averageScore: number;
  subjectTestDates: { date: string; courseName: string; subjectName: string; score: number; passed: boolean }[];
}

export default function Reports() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [period, setPeriod] = useState("week");
  const [progressData, setProgressData] = useState<ProgressData[]>([]);
  const [courseProgress, setCourseProgress] = useState<CourseProgress[]>([]);
  const [testStats, setTestStats] = useState<TestSeriesStats>({
    totalTests: 0,
    testsPassed: 0,
    testsFailed: 0,
    averageScore: 0,
    subjectTestDates: []
  });
  const [stats, setStats] = useState({
    totalCompleted: 0,
    averageDaily: 0,
    streak: 0,
    totalCourses: 0,
    activeDays: 0
  });
  const [calendarData, setCalendarData] = useState<{ date: string; courseName: string; subjectName: string; content: string }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetchReportData();
    }
  }, [user, period]);

  const fetchReportData = async () => {
    try {
      setLoading(true);
      
      // Get date range based on period
      const now = new Date();
      let startDate: Date;
      let endDate: Date = now;
      
      switch (period) {
        case "week":
          startDate = startOfWeek(subWeeks(now, 4));
          break;
        case "month":
          startDate = startOfMonth(subMonths(now, 6));
          break;
        case "quarter":
          startDate = subMonths(now, 12);
          break;
        default:
          startDate = startOfWeek(subWeeks(now, 4));
      }

      // Fetch completion data with time series
      const { data: completions } = await supabase
        .from("syllabus_items")
        .select(`
          completed,
          date_completed,
          subjects!inner (
            courses!inner (
              user_id
            )
          )
        `)
        .eq("subjects.courses.user_id", user?.id)
        .eq("completed", true)
        .gte("date_completed", startDate.toISOString())
        .order("date_completed");

      // Fetch course progress
      const { data: courses } = await supabase
        .from("courses")
        .select(`
          id,
          name,
          subjects (
            id,
            name,
            syllabus_items (
              completed,
              date_completed
            )
          )
        `)
        .eq("user_id", user?.id);

      // Fetch test series data for test progress
      const courseIds = courses?.map(c => c.id) || [];
      let testSeriesData: any[] = [];
      let testScoresData: any[] = [];
      
      if (courseIds.length > 0) {
        const { data: testSeries } = await supabase
          .from("test_series")
          .select("*")
          .in("course_id", courseIds);
        
        testSeriesData = testSeries || [];
        
        if (testSeriesData.length > 0) {
          const testIds = testSeriesData.map(t => t.id);
          const { data: scores } = await supabase
            .from("test_series_scores")
            .select("*")
            .in("test_series_id", testIds);
          
          testScoresData = scores || [];
        }
      }

      // Process test series stats
      const subjectTestDates: { date: string; courseName: string; subjectName: string; score: number; passed: boolean }[] = [];
      let totalTests = 0;
      let testsPassed = 0;
      let testsFailed = 0;
      let totalPercentage = 0;

      testSeriesData.forEach(test => {
        const scores = testScoresData.filter(s => s.test_series_id === test.id);
        const hasScores = scores.some(s => s.score_obtained > 0);
        
        if (hasScores) {
          totalTests++;
          const totalScore = scores.reduce((sum, s) => sum + s.score_obtained, 0);
          const aggregatePassed = totalScore >= test.aggregate_pass_mark;
          const allSubjectsPassed = scores.every(s => s.score_obtained >= s.pass_mark);
          const passed = aggregatePassed && allSubjectsPassed;
          
          if (passed) testsPassed++;
          else testsFailed++;
          
          totalPercentage += (totalScore / test.aggregate_max_marks) * 100;
          
          // Add subject test dates
          const course = courses?.find(c => c.id === test.course_id);
          scores.forEach(score => {
            if (score.date_taken) {
              const subject = course?.subjects.find((s: any) => s.id === score.subject_id);
              subjectTestDates.push({
                date: score.date_taken,
                courseName: course?.name || 'Unknown Course',
                subjectName: subject?.name || 'Unknown Subject',
                score: score.score_obtained,
                passed: score.score_obtained >= score.pass_mark
              });
            }
          });
        }
      });

      setTestStats({
        totalTests,
        testsPassed,
        testsFailed,
        averageScore: totalTests > 0 ? Math.round(totalPercentage / totalTests) : 0,
        subjectTestDates
      });

      // Process progress data for charts
      const progressMap = new Map<string, { completed: number; total: number; testsTaken: number }>();
      
      // Initialize all dates in range
      for (let d = new Date(startDate); d <= endDate; d = new Date(d.getTime() + 24 * 60 * 60 * 1000)) {
        const dateKey = format(d, "yyyy-MM-dd");
        progressMap.set(dateKey, { completed: 0, total: 0, testsTaken: 0 });
      }

      // Count completions by date
      completions?.forEach(item => {
        if (item.date_completed) {
          const dateKey = format(new Date(item.date_completed), "yyyy-MM-dd");
          const current = progressMap.get(dateKey) || { completed: 0, total: 0, testsTaken: 0 };
          progressMap.set(dateKey, { ...current, completed: current.completed + 1 });
        }
      });

      // Count test dates
      subjectTestDates.forEach(test => {
        const dateKey = format(new Date(test.date), "yyyy-MM-dd");
        const current = progressMap.get(dateKey);
        if (current) {
          progressMap.set(dateKey, { ...current, testsTaken: current.testsTaken + 1 });
        }
      });

      const chartData = Array.from(progressMap.entries())
        .map(([date, data]) => ({
          date: format(new Date(date), period === "week" ? "MMM dd" : "MMM yyyy"),
          completed: data.completed,
          total: data.total,
          testsTaken: data.testsTaken
        }))
        .slice(-20); // Show last 20 data points

      setProgressData(chartData);

      // Process course progress
      const courseProgressData = courses?.map(course => {
        const allItems = course.subjects.flatMap((s: any) => s.syllabus_items);
        const completedItems = allItems.filter((item: any) => item.completed);
        
        return {
          course_name: course.name,
          total_items: allItems.length,
          completed_items: completedItems.length,
          completion_rate: allItems.length > 0 ? (completedItems.length / allItems.length) * 100 : 0
        };
      }) || [];

      setCourseProgress(courseProgressData);

      // Build calendar data for export
      const calendarItems: { date: string; courseName: string; subjectName: string; content: string }[] = [];
      courses?.forEach(course => {
        course.subjects.forEach((subject: any) => {
          subject.syllabus_items.forEach((item: any) => {
            if (item.completed && item.date_completed) {
              calendarItems.push({
                date: item.date_completed,
                courseName: course.name,
                subjectName: subject.name || 'Unknown Subject',
                content: item.content || 'Unknown Item'
              });
            }
          });
        });
      });
      setCalendarData(calendarItems);

      // Calculate stats
      const totalCompleted = completions?.length || 0;
      const daysDiff = Math.max(1, Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)));
      const averageDaily = totalCompleted / daysDiff;

      // Calculate active days
      const activeDays = Array.from(progressMap.entries()).filter(([_, data]) => data.completed > 0).length;

      // Calculate streak
      let streak = 0;
      const sortedDates = Array.from(progressMap.entries())
        .filter(([_, data]) => data.completed > 0)
        .map(([date]) => new Date(date))
        .sort((a, b) => b.getTime() - a.getTime());

      if (sortedDates.length > 0) {
        const today = startOfDay(new Date());
        const yesterday = subDays(today, 1);
        const mostRecent = startOfDay(sortedDates[0]);
        
        if (isSameDay(mostRecent, today) || isSameDay(mostRecent, yesterday)) {
          streak = 1;
          let currentDate = mostRecent;
          
          for (let i = 1; i < sortedDates.length; i++) {
            const prevDate = subDays(currentDate, 1);
            const nextDate = startOfDay(sortedDates[i]);
            
            if (isSameDay(nextDate, prevDate)) {
              streak++;
              currentDate = nextDate;
            } else {
              break;
            }
          }
        }
      }

      setStats({
        totalCompleted,
        averageDaily: Math.round(averageDaily * 100) / 100,
        streak,
        totalCourses: courses?.length || 0,
        activeDays
      });

    } catch (error) {
      console.error("Error fetching report data:", error);
    } finally {
      setLoading(false);
    }
  };

  const generatePDFReport = () => {
    const achievements = getAchievementsForExport(stats.streak, stats.totalCompleted, stats.activeDays);
    const calendarExport = getCalendarDataForExport(calendarData);
    const unlockedAchievements = achievements.filter(a => a.unlocked);

    const reportContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Course Progress Report</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 40px; color: #333; }
          .header { text-align: center; margin-bottom: 30px; }
          .stats { display: grid; grid-template-columns: repeat(2, 1fr); gap: 20px; margin-bottom: 30px; }
          .stat-card { border: 1px solid #ddd; padding: 20px; border-radius: 8px; background: #f9f9f9; }
          .section { margin-top: 30px; }
          .section h2 { border-bottom: 2px solid #007bff; padding-bottom: 10px; }
          .course-item { margin-bottom: 15px; padding: 15px; border-left: 4px solid #007bff; background: #f5f5f5; }
          .achievement { display: inline-block; margin: 5px; padding: 8px 12px; border-radius: 20px; font-size: 12px; }
          .achievement.unlocked { background: #d4edda; color: #155724; border: 1px solid #c3e6cb; }
          .achievement.locked { background: #f8f9fa; color: #6c757d; border: 1px solid #dee2e6; }
          .calendar-day { margin-bottom: 20px; padding: 15px; border-left: 4px solid #28a745; background: #f5f5f5; }
          .calendar-day h4 { margin: 0 0 10px 0; color: #28a745; }
          .calendar-item { margin: 5px 0; padding: 8px; background: white; border-radius: 4px; }
          .calendar-item small { color: #6c757d; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>📚 Course Progress Report</h1>
          <p>Generated on ${format(new Date(), "MMMM dd, yyyy")}</p>
        </div>
        
        <div class="stats">
          <div class="stat-card">
            <h3>🎯 Total Completed</h3>
            <p style="font-size: 24px; color: #007bff;">${stats.totalCompleted}</p>
          </div>
          <div class="stat-card">
            <h3>📈 Daily Average</h3>
            <p style="font-size: 24px; color: #28a745;">${stats.averageDaily}</p>
          </div>
          <div class="stat-card">
            <h3>🔥 Current Streak</h3>
            <p style="font-size: 24px; color: #fd7e14;">${stats.streak} days</p>
          </div>
          <div class="stat-card">
            <h3>📅 Active Days</h3>
            <p style="font-size: 24px; color: #17a2b8;">${stats.activeDays}</p>
          </div>
        </div>

        <div class="section">
          <h2>🏆 Achievements (${unlockedAchievements.length}/${achievements.length})</h2>
          <div>
            ${achievements.map(a => `
              <span class="achievement ${a.unlocked ? 'unlocked' : 'locked'}">
                ${a.unlocked ? '✅' : '🔒'} ${a.name} - ${a.description}
              </span>
            `).join('')}
          </div>
        </div>

        <div class="section">
          <h2>📖 Course Progress</h2>
          ${courseProgress.map(course => `
            <div class="course-item">
              <h3>${course.course_name}</h3>
              <p>Progress: ${course.completed_items}/${course.total_items} (${Math.round(course.completion_rate)}%)</p>
              <div style="background: #e9ecef; border-radius: 4px; height: 8px; margin-top: 10px;">
                <div style="background: #007bff; border-radius: 4px; height: 8px; width: ${course.completion_rate}%;"></div>
              </div>
            </div>
          `).join('')}
        </div>

        <div class="section">
          <h2>📆 Activity Calendar</h2>
          ${calendarExport.length === 0 ? '<p>No activity recorded yet.</p>' : 
            calendarExport.slice(0, 30).map(day => `
              <div class="calendar-day">
                <h4>${day.formattedDate} - ${day.itemCount} item${day.itemCount > 1 ? 's' : ''} completed</h4>
                ${day.items.map(item => `
                  <div class="calendar-item">
                    <small>${item.courseName} • ${item.subjectName}</small><br/>
                    ${item.content}
                  </div>
                `).join('')}
              </div>
            `).join('')}
          ${calendarExport.length > 30 ? `<p><em>...and ${calendarExport.length - 30} more days</em></p>` : ''}
        </div>
      </body>
      </html>
    `;

    const blob = new Blob([reportContent], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `course-progress-report-${format(new Date(), 'yyyy-MM-dd')}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="w-16 h-16 border-4 border-primary/30 border-t-primary rounded-full animate-spin mx-auto"></div>
          <p className="text-muted-foreground">Generating reports...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Progress Reports</h1>
            <p className="text-muted-foreground">Track your learning progress over time</p>
          </div>
          <div className="flex items-center gap-4">
            <Button onClick={() => navigate('/dashboard')} variant="outline">
              <LayoutDashboard className="mr-2 h-4 w-4" />
              Dashboard
            </Button>
            <Select value={period} onValueChange={setPeriod}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="week">Last 4 Weeks</SelectItem>
                <SelectItem value="month">Last 6 Months</SelectItem>
                <SelectItem value="quarter">Last Year</SelectItem>
              </SelectContent>
            </Select>
            <Button onClick={generatePDFReport} variant="outline">
              <Download className="mr-2 h-4 w-4" />
              Export Report
            </Button>
          </div>
        </div>

        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Completed</CardTitle>
              <Target className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-primary">{stats.totalCompleted}</div>
              <p className="text-xs text-muted-foreground">syllabus items</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Daily Average</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-secondary">{stats.averageDaily}</div>
              <p className="text-xs text-muted-foreground">items per day</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Current Streak</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-warning">{stats.streak}</div>
              <p className="text-xs text-muted-foreground">days active</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Courses</CardTitle>
              <BarChart3 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-accent">{stats.totalCourses}</div>
              <p className="text-xs text-muted-foreground">active courses</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Tests Passed</CardTitle>
              <ClipboardCheck className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-primary">{testStats.testsPassed}/{testStats.totalTests}</div>
              <p className="text-xs text-muted-foreground">{testStats.averageScore}% avg score</p>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="progress" className="space-y-6">
          <TabsList>
            <TabsTrigger value="progress">Progress Trends</TabsTrigger>
            <TabsTrigger value="courses">Course Analysis</TabsTrigger>
            <TabsTrigger value="tests">Test Progress</TabsTrigger>
          </TabsList>

          <TabsContent value="progress" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Completion Trend</CardTitle>
                <CardDescription>
                  Your daily learning progress over the selected period
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={progressData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis 
                        dataKey="date" 
                        stroke="hsl(var(--muted-foreground))"
                        fontSize={12}
                      />
                      <YAxis 
                        stroke="hsl(var(--muted-foreground))"
                        fontSize={12}
                      />
                      <Tooltip 
                        contentStyle={{
                          backgroundColor: "hsl(var(--card))",
                          border: "1px solid hsl(var(--border))",
                          borderRadius: "8px"
                        }}
                      />
                      <Line 
                        type="monotone" 
                        dataKey="completed" 
                        stroke="hsl(var(--primary))" 
                        strokeWidth={2}
                        dot={{ fill: "hsl(var(--primary))", strokeWidth: 2, r: 4 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="courses" className="space-y-6">
            <div className="grid gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Course Progress Overview</CardTitle>
                  <CardDescription>
                    Completion status for each of your active courses
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-6">
                    {courseProgress.map((course, index) => (
                      <div key={index} className="space-y-2">
                        <div className="flex items-center justify-between">
                          <h4 className="font-medium">{course.course_name}</h4>
                          <Badge variant="outline">
                            {course.completed_items}/{course.total_items}
                          </Badge>
                        </div>
                        <Progress value={course.completion_rate} className="h-2" />
                        <p className="text-sm text-muted-foreground">
                          {Math.round(course.completion_rate)}% complete
                        </p>
                      </div>
                    ))}
                    {courseProgress.length === 0 && (
                      <p className="text-center text-muted-foreground py-8">
                        No courses found. Start adding courses to see progress reports.
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Course Completion Comparison</CardTitle>
                  <CardDescription>
                    Compare progress across all your courses
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="h-96">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={courseProgress} layout="vertical">
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                        <XAxis 
                          type="number" 
                          domain={[0, 100]}
                          stroke="hsl(var(--muted-foreground))"
                          fontSize={12}
                        />
                        <YAxis 
                          type="category"
                          dataKey="course_name" 
                          stroke="hsl(var(--muted-foreground))"
                          fontSize={12}
                          width={150}
                        />
                        <Tooltip 
                          contentStyle={{
                            backgroundColor: "hsl(var(--card))",
                            border: "1px solid hsl(var(--border))",
                            borderRadius: "8px"
                          }}
                          formatter={(value: number) => `${Math.round(value)}%`}
                        />
                        <Bar 
                          dataKey="completion_rate" 
                          fill="hsl(var(--primary))"
                          radius={[0, 4, 4, 0]}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="tests" className="space-y-6">
            <div className="grid gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Test Series Performance</CardTitle>
                  <CardDescription>
                    Summary of your test performance across all courses
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="p-4 bg-muted/30 rounded-xl text-center">
                      <p className="text-2xl font-bold text-primary">{testStats.totalTests}</p>
                      <p className="text-sm text-muted-foreground">Tests Taken</p>
                    </div>
                    <div className="p-4 bg-muted/30 rounded-xl text-center">
                      <p className="text-2xl font-bold text-primary">{testStats.testsPassed}</p>
                      <p className="text-sm text-muted-foreground">Tests Passed</p>
                    </div>
                    <div className="p-4 bg-muted/30 rounded-xl text-center">
                      <p className="text-2xl font-bold text-destructive">{testStats.testsFailed}</p>
                      <p className="text-sm text-muted-foreground">Tests Failed</p>
                    </div>
                    <div className="p-4 bg-muted/30 rounded-xl text-center">
                      <p className="text-2xl font-bold text-primary">{testStats.averageScore}%</p>
                      <p className="text-sm text-muted-foreground">Average Score</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Recent Test Activity</CardTitle>
                  <CardDescription>
                    Subject tests taken with their dates and scores
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {testStats.subjectTestDates.length === 0 ? (
                    <p className="text-center text-muted-foreground py-8">
                      No test data recorded yet. Complete tests and enter scores to see progress.
                    </p>
                  ) : (
                    <div className="space-y-3">
                      {testStats.subjectTestDates
                        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                        .slice(0, 20)
                        .map((test, index) => (
                          <div key={index} className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                            <div className="flex items-center gap-3">
                              {test.passed ? (
                                <div className="h-2 w-2 rounded-full bg-primary" />
                              ) : (
                                <div className="h-2 w-2 rounded-full bg-destructive" />
                              )}
                              <div>
                                <p className="font-medium text-sm">{test.subjectName}</p>
                                <p className="text-xs text-muted-foreground">{test.courseName}</p>
                              </div>
                            </div>
                            <div className="text-right">
                              <p className={`font-medium text-sm ${test.passed ? 'text-primary' : 'text-destructive'}`}>
                                Score: {test.score}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {format(new Date(test.date), 'MMM d, yyyy')}
                              </p>
                            </div>
                          </div>
                        ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
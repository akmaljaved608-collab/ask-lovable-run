import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Calendar, TrendingUp, Target, Clock, Download, BarChart3 } from "lucide-react";
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, subDays, subWeeks, subMonths } from "date-fns";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from "recharts";

interface ProgressData {
  date: string;
  completed: number;
  total: number;
}

interface CourseProgress {
  course_name: string;
  total_items: number;
  completed_items: number;
  completion_rate: number;
}

export default function Reports() {
  const { user } = useAuth();
  const [period, setPeriod] = useState("week");
  const [progressData, setProgressData] = useState<ProgressData[]>([]);
  const [courseProgress, setCourseProgress] = useState<CourseProgress[]>([]);
  const [stats, setStats] = useState({
    totalCompleted: 0,
    averageDaily: 0,
    streak: 0,
    totalCourses: 0
  });
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
          name,
          subjects (
            syllabus_items (
              completed,
              date_completed
            )
          )
        `)
        .eq("user_id", user?.id);

      // Process progress data for charts
      const progressMap = new Map<string, { completed: number; total: number }>();
      
      // Initialize all dates in range
      for (let d = new Date(startDate); d <= endDate; d = new Date(d.getTime() + 24 * 60 * 60 * 1000)) {
        const dateKey = format(d, "yyyy-MM-dd");
        progressMap.set(dateKey, { completed: 0, total: 0 });
      }

      // Count completions by date
      completions?.forEach(item => {
        if (item.date_completed) {
          const dateKey = format(new Date(item.date_completed), "yyyy-MM-dd");
          const current = progressMap.get(dateKey) || { completed: 0, total: 0 };
          progressMap.set(dateKey, { ...current, completed: current.completed + 1 });
        }
      });

      const chartData = Array.from(progressMap.entries())
        .map(([date, data]) => ({
          date: format(new Date(date), period === "week" ? "MMM dd" : "MMM yyyy"),
          completed: data.completed,
          total: data.total
        }))
        .slice(-20); // Show last 20 data points

      setProgressData(chartData);

      // Process course progress
      const courseProgressData = courses?.map(course => {
        const allItems = course.subjects.flatMap(s => s.syllabus_items);
        const completedItems = allItems.filter(item => item.completed);
        
        return {
          course_name: course.name,
          total_items: allItems.length,
          completed_items: completedItems.length,
          completion_rate: allItems.length > 0 ? (completedItems.length / allItems.length) * 100 : 0
        };
      }) || [];

      setCourseProgress(courseProgressData);

      // Calculate stats
      const totalCompleted = completions?.length || 0;
      const daysDiff = Math.max(1, Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)));
      const averageDaily = totalCompleted / daysDiff;

      // Calculate streak (simplified)
      let streak = 0;
      const recentData = Array.from(progressMap.entries()).slice(-30);
      for (let i = recentData.length - 1; i >= 0; i--) {
        if (recentData[i][1].completed > 0) {
          streak++;
        } else {
          break;
        }
      }

      setStats({
        totalCompleted,
        averageDaily: Math.round(averageDaily * 100) / 100,
        streak,
        totalCourses: courses?.length || 0
      });

    } catch (error) {
      console.error("Error fetching report data:", error);
    } finally {
      setLoading(false);
    }
  };

  const generatePDFReport = () => {
    // Create a simple HTML report for printing/PDF
    const reportContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Course Progress Report</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 40px; }
          .header { text-align: center; margin-bottom: 30px; }
          .stats { display: grid; grid-template-columns: repeat(2, 1fr); gap: 20px; margin-bottom: 30px; }
          .stat-card { border: 1px solid #ddd; padding: 20px; border-radius: 8px; }
          .courses { margin-top: 30px; }
          .course-item { margin-bottom: 15px; padding: 15px; border-left: 4px solid #007bff; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>Course Progress Report</h1>
          <p>Generated on ${format(new Date(), "MMMM dd, yyyy")}</p>
        </div>
        
        <div class="stats">
          <div class="stat-card">
            <h3>Total Completed</h3>
            <p style="font-size: 24px; color: #007bff;">${stats.totalCompleted}</p>
          </div>
          <div class="stat-card">
            <h3>Daily Average</h3>
            <p style="font-size: 24px; color: #28a745;">${stats.averageDaily}</p>
          </div>
          <div class="stat-card">
            <h3>Current Streak</h3>
            <p style="font-size: 24px; color: #fd7e14;">${stats.streak} days</p>
          </div>
          <div class="stat-card">
            <h3>Total Courses</h3>
            <p style="font-size: 24px; color: #6f42c1;">${stats.totalCourses}</p>
          </div>
        </div>

        <div class="courses">
          <h2>Course Progress</h2>
          ${courseProgress.map(course => `
            <div class="course-item">
              <h3>${course.course_name}</h3>
              <p>Progress: ${course.completed_items}/${course.total_items} (${Math.round(course.completion_rate)}%)</p>
            </div>
          `).join('')}
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
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
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
        </div>

        <Tabs defaultValue="progress" className="space-y-6">
          <TabsList>
            <TabsTrigger value="progress">Progress Trends</TabsTrigger>
            <TabsTrigger value="courses">Course Analysis</TabsTrigger>
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
                  <div className="h-80">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={courseProgress.slice(0, 10)}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                        <XAxis 
                          dataKey="course_name" 
                          stroke="hsl(var(--muted-foreground))"
                          fontSize={12}
                          angle={-45}
                          textAnchor="end"
                          height={60}
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
                        <Bar 
                          dataKey="completion_rate" 
                          fill="hsl(var(--primary))"
                          radius={[4, 4, 0, 0]}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
import React, { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { BookOpen, GraduationCap, Target, TrendingUp, Clock, Award, Plus, ChevronRight, LogOut, User, Settings, FileText, BarChart3, Edit, Copy, ClipboardList, LayoutDashboard } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { ThemeToggle } from "@/components/ThemeToggle";
import { AdBanner } from "@/components/AdBanner";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useNavigate } from "react-router-dom";
import { EditCourseDialog } from "@/components/EditCourseDialog";
import { OnboardingTutorial } from "@/components/OnboardingTutorial";
import { ProgressCalendar } from "@/components/ProgressCalendar";
import { TestSeriesSection } from "@/components/TestSeriesSection";

interface Subject {
  id: string;
  name: string;
  description: string;
  syllabusChecklist: ChecklistItem[];
}

interface ChecklistItem {
  id: string;
  content: string;
  completed: boolean;
  weightage: number;
  dateCompleted?: string;
}

interface Course {
  id: string;
  name: string;
  description: string;
  subjects: Subject[];
  createdAt: string;
}

const CourseTracker: React.FC = () => {
  const [courses, setCourses] = useState<Course[]>([]);
  const [newCourse, setNewCourse] = useState({ name: '', description: '' });
  const [newSubject, setNewSubject] = useState({ name: '', description: '' });
  const [selectedCourse, setSelectedCourse] = useState<string | null>(null);
  const [selectedSubject, setSelectedSubject] = useState<string | null>(null);
  const [syllabusText, setSyllabusText] = useState('');
  const [pendingItems, setPendingItems] = useState<{ content: string; weightage: string }[]>([]);
  const [activeTab, setActiveTab] = useState('courses');
  const [viewMode, setViewMode] = useState<'overview' | 'course-detail'>('overview');
  const [selectedCourseForDetail, setSelectedCourseForDetail] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [userProfile, setUserProfile] = useState<any>(null);
  const [editingCourse, setEditingCourse] = useState<Course | null>(null);
  const [showTutorial, setShowTutorial] = useState(false);

  const { user, signOut } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    if (user) {
      loadCourses();
      fetchUserProfile();
      
      // Set up realtime subscription for immediate updates
      const channel = supabase
        .channel('course-changes')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'courses'
          },
          () => loadCourses()
        )
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'subjects'
          },
          () => loadCourses()
        )
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'syllabus_items'
          },
          () => loadCourses()
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [user]);

  const fetchUserProfile = async () => {
    try {
      const { data } = await supabase
        .from("profiles")
        .select("*")
        .eq("user_id", user?.id)
        .maybeSingle();
      
      if (data) {
        setUserProfile(data);
        // Show tutorial if user hasn't completed it
        if (!data.tutorial_completed) {
          setShowTutorial(true);
        }
      }
    } catch (error) {
      console.error("Error fetching user profile:", error);
    }
  };

  const loadCourses = async () => {
    try {
      setLoading(true);
      // Add cache-busting timestamp to force fresh data
      const { data: coursesData, error: coursesError } = await supabase
        .from('courses')
        .select(`
          *,
          subjects (
            *,
            syllabus_items (*)
          )
        `)
        .order('created_at', { ascending: false });

      if (coursesError) throw coursesError;

      const transformedCourses: Course[] = coursesData?.map(course => ({
        id: course.id,
        name: course.name,
        description: course.description || '',
        createdAt: course.created_at,
        subjects: course.subjects?.map((subject: any) => ({
          id: subject.id,
          name: subject.name,
          description: subject.description || '',
          syllabusChecklist: subject.syllabus_items?.map((item: any) => ({
            id: item.id,
            content: item.content,
            completed: item.completed,
            weightage: Number(item.weightage) || 0,
            dateCompleted: item.date_completed
          })) || []
        })) || []
      })) || [];

      setCourses(transformedCourses);
    } catch (error: any) {
      toast({
        title: "Error loading courses",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const createCourse = async () => {
    if (!newCourse.name.trim() || !user) return;

    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('courses')
        .insert([{
          name: newCourse.name,
          description: newCourse.description,
          user_id: user.id
        }])
        .select()
        .single();

      if (error) throw error;

      await loadCourses();
      setNewCourse({ name: '', description: '' });
      toast({
        title: "Course created successfully!",
        description: `${newCourse.name} has been added to your courses.`,
      });
    } catch (error: any) {
      toast({
        title: "Error creating course",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const createSubject = async () => {
    if (!newSubject.name.trim() || !selectedCourse || !user) return;

    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('subjects')
        .insert([{
          name: newSubject.name,
          description: newSubject.description,
          course_id: selectedCourse
        }])
        .select()
        .single();

      if (error) throw error;

      await loadCourses();
      setNewSubject({ name: '', description: '' });
      toast({
        title: "Subject created successfully!",
        description: `${newSubject.name} has been added to your course.`,
      });
    } catch (error: any) {
      toast({
        title: "Error creating subject",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const processSyllabus = async () => {
    if (!syllabusText.trim() || !selectedCourse || !selectedSubject || !user) return;

    try {
      setLoading(true);
      const lines = syllabusText.split('\n').filter(line => line.trim());
      const syllabusItems = lines.map(line => ({
        content: line.trim(),
        completed: false,
        subject_id: selectedSubject
      }));

      const { error } = await supabase
        .from('syllabus_items')
        .insert(syllabusItems);

      if (error) throw error;

      await loadCourses();
      setSyllabusText('');
      toast({
        title: "Syllabus processed successfully!",
        description: `${lines.length} items added to your syllabus.`,
      });
    } catch (error: any) {
      toast({
        title: "Error processing syllabus",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const toggleChecklistItem = async (courseId: string, subjectId: string, itemId: string) => {
    try {
      const course = courses.find(c => c.id === courseId);
      const subject = course?.subjects.find(s => s.id === subjectId);
      const item = subject?.syllabusChecklist.find(i => i.id === itemId);
      
      if (!item) return;

      const newCompleted = !item.completed;
      const { error } = await supabase
        .from('syllabus_items')
        .update({
          completed: newCompleted,
          date_completed: newCompleted ? new Date().toISOString() : null
        })
        .eq('id', itemId);

      if (error) throw error;

      await loadCourses();
      
      if (newCompleted) {
        toast({
          title: "Great progress!",
          description: "Item marked as completed.",
        });
      }
    } catch (error: any) {
      toast({
        title: "Error updating item",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const getDailyProgress = () => {
    const today = new Date().toISOString().split('T')[0];
    let completedToday = 0;
    let totalCompleted = 0;
    let totalItems = 0;

    courses.forEach(course => {
      course.subjects.forEach(subject => {
        subject.syllabusChecklist.forEach(item => {
          totalItems++;
          if (item.completed) {
            totalCompleted++;
            if (item.dateCompleted && item.dateCompleted.split('T')[0] === today) {
              completedToday++;
            }
          }
        });
      });
    });

    return { completedToday, totalCompleted, totalItems };
  };

  const getCourseProgress = (courseId: string) => {
    const course = courses.find(c => c.id === courseId);
    if (!course) return { completed: 0, total: 0, percentage: 0 };

    let completed = 0;
    let total = 0;

    course.subjects.forEach(subject => {
      subject.syllabusChecklist.forEach(item => {
        total++;
        if (item.completed) completed++;
      });
    });

    return { 
      completed, 
      total, 
      percentage: total > 0 ? (completed / total) * 100 : 0 
    };
  };

  const getCourseChartData = () => {
    return courses.map(course => {
      const progress = getCourseProgress(course.id);
      return {
        name: course.name,
        completed: progress.completed,
        remaining: progress.total - progress.completed,
        percentage: progress.percentage
      };
    });
  };

  const getSubjectProgressData = (courseId: string) => {
    const course = courses.find(c => c.id === courseId);
    if (!course) return [];

    return course.subjects.map(subject => {
      let completed = 0;
      let total = subject.syllabusChecklist.length;
      
      subject.syllabusChecklist.forEach(item => {
        if (item.completed) completed++;
      });

      return {
        name: subject.name,
        value: total > 0 ? (completed / total) * 100 : 0,
        completed,
        total
      };
    });
  };

  const getCompletedItemsForCalendar = () => {
    const items: { date: string; courseName: string; subjectName: string; content: string }[] = [];
    
    courses.forEach(course => {
      course.subjects.forEach(subject => {
        subject.syllabusChecklist.forEach(item => {
          if (item.dateCompleted) {
            items.push({
              date: item.dateCompleted,
              courseName: course.name,
              subjectName: subject.name,
              content: item.content
            });
          }
        });
      });
    });

    return items;
  };

  const handleDuplicateCourse = async (courseId: string) => {
    if (!user) return;

    try {
      setLoading(true);
      
      // Get the original course with all its data
      const originalCourse = courses.find(c => c.id === courseId);
      if (!originalCourse) return;

      // Create duplicate course
      const { data: newCourse, error: courseError } = await supabase
        .from('courses')
        .insert([{
          name: `${originalCourse.name} (Copy)`,
          description: originalCourse.description,
          user_id: user.id
        }])
        .select()
        .single();

      if (courseError) throw courseError;

      // Duplicate all subjects
      for (const subject of originalCourse.subjects) {
        const { data: newSubject, error: subjectError } = await supabase
          .from('subjects')
          .insert([{
            name: subject.name,
            description: subject.description,
            course_id: newCourse.id
          }])
          .select()
          .single();

        if (subjectError) throw subjectError;

        // Duplicate all syllabus items for this subject
        if (subject.syllabusChecklist.length > 0) {
          const syllabusItems = subject.syllabusChecklist.map(item => ({
            content: item.content,
            completed: false,
            subject_id: newSubject.id
          }));

          const { error: syllabusError } = await supabase
            .from('syllabus_items')
            .insert(syllabusItems);

          if (syllabusError) throw syllabusError;
        }
      }

      await loadCourses();
      toast({
        title: "Course duplicated successfully!",
        description: `Created a copy of "${originalCourse.name}"`,
      });
    } catch (error: any) {
      toast({
        title: "Error duplicating course",
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

  const { completedToday, totalCompleted, totalItems } = getDailyProgress();
  const overallProgress = totalItems > 0 ? (totalCompleted / totalItems) * 100 : 0;
  const courseChartData = getCourseChartData();
  const completedItemsForCalendar = getCompletedItemsForCalendar();

  // Chart palette — cool, light, in line with the design system
  const COLORS = ['#1a6b7a', '#2f9c8b', '#7c6ede', '#4aa8c0', '#a7a0ea', '#3f8f76', '#6fc2cf', '#c2a83e'];

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto p-4 md:p-8">
        {/* Header with User Info */}
        <header className="mb-10 animate-fade-in">
          <div className="flex flex-wrap justify-between items-center gap-4 mb-8">
            <div className="inline-flex items-center gap-3">
              <div className="hero-gradient p-2.5 rounded-2xl shadow-glow">
                <GraduationCap className="h-6 w-6 text-primary-foreground" />
              </div>
              <div className="flex flex-col leading-none">
                <span className="eyebrow">Study journal</span>
                <h1 className="text-3xl md:text-4xl text-foreground">
                  Course Tracker
                </h1>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => navigate('/dashboard')}
                className="flex items-center gap-2"
              >
                <LayoutDashboard className="h-4 w-4" />
                Dashboard
              </Button>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => navigate('/reports')}
                className="flex items-center gap-2"
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
                      <p className="text-xs leading-none text-muted-foreground">
                        {user?.email}
                      </p>
                    </div>
                  </div>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => navigate('/settings')}>
                    <Settings className="mr-2 h-4 w-4" />
                    Settings
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => navigate('/dashboard')}>
                    <LayoutDashboard className="mr-2 h-4 w-4" />
                    Dashboard
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => navigate('/reports')}>
                    <BarChart3 className="mr-2 h-4 w-4" />
                    Reports
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
            A quiet, considered record of everything you are learning — syllabus, streaks, tests and results in one place.
          </p>
        </header>

        {/* Progress Overview */}
        <Card className="mb-8 card-gradient border border-border/70 shadow-elevated animate-scale-in">
          <CardHeader className="pb-4">
            <div className="flex items-center gap-3">
              <div className="bg-secondary/10 p-2 rounded-xl">
                <Target className="h-5 w-5 text-secondary" />
              </div>
              <div>
                <CardTitle className="text-2xl">Today's Learning Progress</CardTitle>
                <CardDescription className="text-base">
                  {completedToday} items completed today • {totalCompleted}/{totalItems} total completed
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="relative">
              <Progress value={overallProgress} className="h-4 bg-muted/50" />
              <div className="absolute inset-0 h-4 bg-progress-gradient rounded-full" 
                   style={{ width: `${overallProgress}%` }} />
            </div>
            <div className="flex justify-between items-center">
              <span className="text-lg font-semibold text-primary">
                {Math.round(overallProgress)}% Complete
              </span>
              <Badge variant="secondary" className="px-3 py-1">
                <TrendingUp className="h-4 w-4 mr-1" />
                {completedToday > 0 ? 'Active' : 'Start Learning'}
              </Badge>
            </div>
          </CardContent>
        </Card>

        {/* Navigation Tabs */}
        <div className="flex flex-wrap gap-3 mb-8 p-1 bg-muted/50 rounded-2xl">
          {[
            { key: 'courses', icon: BookOpen, label: 'Courses' },
            { key: 'subjects', icon: Target, label: 'Subjects' },
            { key: 'syllabus', icon: Clock, label: 'Syllabus' },
            { key: 'tests', icon: ClipboardList, label: 'Tests' },
            { key: 'progress', icon: TrendingUp, label: 'Analytics' }
          ].map(({ key, icon: Icon, label }) => (
            <Button
              key={key}
              variant={activeTab === key ? 'default' : 'ghost'}
              onClick={() => {
                setActiveTab(key);
                setViewMode('overview');
                setSelectedCourseForDetail(null);
              }}
              className={`flex-1 min-w-fit gap-2 h-12 rounded-xl transition-all duration-300 ${
                activeTab === key 
                  ? 'hero-gradient text-primary-foreground shadow-glow' 
                  : 'hover:bg-background/80'
              }`}
            >
              <Icon className="h-4 w-4" />
              {label}
            </Button>
          ))}
        </div>

        {/* Courses Tab */}
        {activeTab === 'courses' && (
          <div className="space-y-8 animate-fade-in">
            <Card className="card-gradient border border-border/70 shadow-elevated">
              <CardHeader className="pb-4">
                <div className="flex items-center gap-3">
                  <div className="bg-primary/10 p-2 rounded-xl">
                    <Plus className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <CardTitle className="text-xl">Create New Course</CardTitle>
                    <CardDescription>Start your learning journey with a new course</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-3">
                    <Label htmlFor="course-name" className="text-sm font-medium">Course Name</Label>
                    <Input
                      id="course-name"
                      value={newCourse.name}
                      onChange={(e) => setNewCourse({...newCourse, name: e.target.value})}
                      placeholder="e.g., Advanced Mathematics"
                      className="h-12 rounded-xl border-2 transition-colors duration-300 focus:border-primary"
                    />
                  </div>
                  <div className="space-y-3">
                    <Label htmlFor="course-desc" className="text-sm font-medium">Description</Label>
                    <Textarea
                      id="course-desc"
                      value={newCourse.description}
                      onChange={(e) => setNewCourse({...newCourse, description: e.target.value})}
                      placeholder="Brief description of the course content and objectives"
                      rows={3}
                      className="rounded-xl border-2 transition-colors duration-300 focus:border-primary resize-none"
                    />
                  </div>
                </div>
                <Button 
                  onClick={createCourse} 
                  disabled={!newCourse.name.trim() || loading}
                  className="w-full md:w-auto hero-gradient text-primary-foreground h-12 px-8 rounded-xl hover:scale-105 transition-all duration-300 disabled:opacity-50 disabled:hover:scale-100"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  {loading ? 'Creating...' : 'Create Course'}
                </Button>
              </CardContent>
            </Card>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {courses.map((course, index) => {
                const progress = getCourseProgress(course.id);
                return (
                  <Card 
                    key={course.id} 
                    className={`group card-gradient border border-border/70 shadow-card hover:shadow-elevated transition-all duration-300 hover:scale-105 ${
                      selectedCourse === course.id ? 'ring-2 ring-primary shadow-glow' : ''
                    }`}
                    style={{ animationDelay: `${index * 100}ms` }}
                  >
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between gap-2">
                        <div 
                          className="flex-1 cursor-pointer"
                          onClick={() => setSelectedCourse(course.id)}
                        >
                          <CardTitle className="text-xl mb-2 group-hover:text-primary transition-colors">
                            {course.name}
                          </CardTitle>
                          <CardDescription className="text-sm line-clamp-2">
                            {course.description || "No description available"}
                          </CardDescription>
                        </div>
                        <div className="flex gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDuplicateCourse(course.id);
                            }}
                            className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                            title="Duplicate course"
                          >
                            <Copy className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditingCourse(course);
                            }}
                            className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                            title="Edit course"
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Progress</span>
                        <span className="font-semibold text-primary">{Math.round(progress.percentage)}%</span>
                      </div>
                      <div className="relative">
                        <Progress value={progress.percentage} className="h-2 bg-muted/50" />
                        <div className="absolute inset-0 h-2 bg-progress-gradient rounded-full" 
                             style={{ width: `${progress.percentage}%` }} />
                      </div>
                      <div className="flex items-center justify-between text-sm text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <BookOpen className="h-4 w-4" />
                          {course.subjects.length} subjects
                        </div>
                        <div className="flex items-center gap-1">
                          <Award className="h-4 w-4" />
                          {progress.completed}/{progress.total} items
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
              {courses.length === 0 && (
                <div className="col-span-full text-center py-12">
                  <div className="bg-muted/50 rounded-2xl p-8 max-w-md mx-auto">
                    <BookOpen className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <h3 className="text-lg font-semibold mb-2">No courses yet</h3>
                    <p className="text-muted-foreground">Create your first course to get started on your learning journey!</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Subjects Tab */}
        {activeTab === 'subjects' && (
          <div className="space-y-6 animate-fade-in">
            <Card className="card-gradient border border-border/70 shadow-elevated">
              <CardHeader>
                <CardTitle>Create New Subject</CardTitle>
                <CardDescription>
                  {selectedCourse 
                    ? `Adding to: ${courses.find(c => c.id === selectedCourse)?.name}`
                    : 'Select a course first'}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="subject-name">Subject Name</Label>
                  <Input
                    id="subject-name"
                    value={newSubject.name}
                    onChange={(e) => setNewSubject({...newSubject, name: e.target.value})}
                    placeholder="e.g., Calculus"
                    disabled={!selectedCourse}
                    className="h-12 rounded-xl"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="subject-desc">Description</Label>
                  <Textarea
                    id="subject-desc"
                    value={newSubject.description}
                    onChange={(e) => setNewSubject({...newSubject, description: e.target.value})}
                    placeholder="Brief description of the subject"
                    rows={3}
                    disabled={!selectedCourse}
                    className="rounded-xl"
                  />
                </div>
                <Button 
                  onClick={createSubject} 
                  disabled={!newSubject.name.trim() || !selectedCourse || loading}
                  className="hero-gradient text-primary-foreground h-12 px-8 rounded-xl"
                >
                  {loading ? 'Creating...' : 'Create Subject'}
                </Button>
              </CardContent>
            </Card>

            {selectedCourse && (
              <div>
                <h3 className="text-xl font-semibold mb-4">Subjects in {courses.find(c => c.id === selectedCourse)?.name}</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {courses.find(c => c.id === selectedCourse)?.subjects.map(subject => (
                    <Card 
                      key={subject.id}
                      className={`cursor-pointer card-gradient hover:shadow-elevated transition-all duration-300 hover:scale-105 ${
                        selectedSubject === subject.id ? 'ring-2 ring-primary' : ''
                      }`}
                      onClick={() => setSelectedSubject(subject.id)}
                    >
                      <CardHeader>
                        <CardTitle className="text-lg">{subject.name}</CardTitle>
                        <CardDescription>{subject.description}</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="text-sm text-muted-foreground">
                          {subject.syllabusChecklist.length} syllabus items
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Syllabus Tab */}
        {activeTab === 'syllabus' && (
          <div className="space-y-6 animate-fade-in">
            <Card className="card-gradient border border-border/70 shadow-elevated">
              <CardHeader>
                <CardTitle>Upload Syllabus</CardTitle>
                <CardDescription>
                  Paste syllabus content to convert into checklist items
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {selectedCourse && (
                  <div className="space-y-2">
                    <Label>Select Subject</Label>
                    <select
                      value={selectedSubject || ''}
                      onChange={(e) => setSelectedSubject(e.target.value)}
                      className="w-full p-3 border border-border rounded-xl bg-background h-12"
                    >
                      <option value="">Select a subject</option>
                      {courses.find(c => c.id === selectedCourse)?.subjects.map(subject => (
                        <option key={subject.id} value={subject.id}>
                          {subject.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
                <div className="space-y-2">
                  <Label htmlFor="syllabus-text">Syllabus Content</Label>
                  <Textarea
                    id="syllabus-text"
                    value={syllabusText}
                    onChange={(e) => setSyllabusText(e.target.value)}
                    placeholder="Paste your syllabus content here (one topic per line)"
                    rows={6}
                    disabled={!selectedCourse || !selectedSubject}
                    className="rounded-xl"
                  />
                </div>
                <Button 
                  onClick={processSyllabus} 
                  disabled={!syllabusText.trim() || !selectedCourse || !selectedSubject || loading}
                  className="hero-gradient text-primary-foreground h-12 px-8 rounded-xl"
                >
                  {loading ? 'Processing...' : 'Convert to Checklist'}
                </Button>
              </CardContent>
            </Card>

            {selectedCourse && courses.find(c => c.id === selectedCourse)?.subjects.map(subject => (
              subject.syllabusChecklist.length > 0 && (
                <Card key={subject.id} className="mt-6 card-gradient border border-border/70 shadow-elevated">
                  <CardHeader>
                    <CardTitle>{subject.name} - Syllabus Checklist</CardTitle>
                    <CardDescription>
                      {subject.syllabusChecklist.filter(item => item.completed).length}/
                      {subject.syllabusChecklist.length} completed
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {subject.syllabusChecklist.map(item => (
                        <div key={item.id} className="flex items-center space-x-3 p-3 rounded-lg border border-border hover:bg-accent/5 transition-colors">
                          <input
                            type="checkbox"
                            checked={item.completed}
                            onChange={() => toggleChecklistItem(selectedCourse, subject.id, item.id)}
                            className="h-5 w-5 rounded border-border text-primary focus:ring-primary"
                          />
                          <span className={`flex-1 ${item.completed ? 'line-through text-muted-foreground' : 'text-foreground'}`}>
                            {item.content}
                          </span>
                          {item.dateCompleted && (
                            <span className="text-xs text-muted-foreground">
                              {new Date(item.dateCompleted).toLocaleDateString()}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )
            ))}
          </div>
        )}

        {/* Tests Tab */}
        {activeTab === 'tests' && (
          <div className="space-y-6 animate-fade-in">
            {selectedCourse ? (
              <TestSeriesSection 
                courseId={selectedCourse}
                courseName={courses.find(c => c.id === selectedCourse)?.name || ''}
                subjects={courses.find(c => c.id === selectedCourse)?.subjects.map(s => ({
                  id: s.id,
                  name: s.name
                })) || []}
              />
            ) : (
              <Card className="card-gradient border border-border/70 shadow-elevated">
                <CardContent className="py-12 text-center">
                  <ClipboardList className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-semibold mb-2">Select a Course</h3>
                  <p className="text-muted-foreground mb-6">Choose a course from below to manage its test series</p>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-w-4xl mx-auto">
                    {courses.map(course => (
                      <Card 
                        key={course.id}
                        className="cursor-pointer hover:shadow-lg transition-all duration-300 hover:scale-105"
                        onClick={() => setSelectedCourse(course.id)}
                      >
                        <CardHeader className="pb-2">
                          <CardTitle className="text-base">{course.name}</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <p className="text-sm text-muted-foreground">{course.subjects.length} subjects</p>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {/* Progress Tab */}
        {activeTab === 'progress' && (
          <div className="space-y-6 animate-fade-in">
            {viewMode === 'overview' ? (
              <>
                <Card className="card-gradient border border-border/70 shadow-elevated">
                  <CardHeader>
                    <CardTitle>Study Analytics Overview</CardTitle>
                    <CardDescription>Track your learning progress across all courses</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                      <div className="stats-card bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20">
                        <div className="flex items-center gap-3">
                          <div className="bg-primary/20 p-2 rounded-xl">
                            <Target className="h-5 w-5 text-primary" />
                          </div>
                          <div>
                            <div className="text-2xl font-bold text-primary">{completedToday}</div>
                            <div className="text-sm text-primary/80">Completed Today</div>
                          </div>
                        </div>
                      </div>
                      <div className="stats-card bg-gradient-to-br from-secondary/10 to-secondary/5 border-secondary/20">
                        <div className="flex items-center gap-3">
                          <div className="bg-secondary/20 p-2 rounded-xl">
                            <Award className="h-5 w-5 text-secondary" />
                          </div>
                          <div>
                            <div className="text-2xl font-bold text-secondary">{totalCompleted}</div>
                            <div className="text-sm text-secondary/80">Total Completed</div>
                          </div>
                        </div>
                      </div>
                      <div className="stats-card bg-gradient-to-br from-accent/10 to-accent/5 border-accent/20">
                        <div className="flex items-center gap-3">
                          <div className="bg-accent/20 p-2 rounded-xl">
                            <BookOpen className="h-5 w-5 text-accent" />
                          </div>
                          <div>
                            <div className="text-2xl font-bold text-accent">{totalItems}</div>
                            <div className="text-sm text-accent/80">Total Items</div>
                          </div>
                        </div>
                      </div>
                      <div className="stats-card bg-gradient-to-br from-warning/10 to-warning/5 border-warning/20">
                        <div className="flex items-center gap-3">
                          <div className="bg-warning/20 p-2 rounded-xl">
                            <GraduationCap className="h-5 w-5 text-warning" />
                          </div>
                          <div>
                            <div className="text-2xl font-bold text-warning">{courses.length}</div>
                            <div className="text-sm text-warning/80">Active Courses</div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Course Progress Bar Chart */}
                    {courseChartData.length > 0 && (
                      <div className="mb-8">
                        <h3 className="font-semibold mb-4">Course Progress Overview</h3>
                        <div className="h-64">
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={courseChartData} layout="vertical">
                              <CartesianGrid strokeDasharray="3 3" />
                              <XAxis type="number" />
                              <YAxis type="category" dataKey="name" width={100} />
                              <Tooltip 
                                formatter={(value: number, name: string) => {
                                  if (name === 'completed') return [value, 'Completed Items'];
                                  if (name === 'remaining') return [value, 'Remaining Items'];
                                  return [value, name];
                                }}
                              />
                              <Bar dataKey="completed" stackId="a" fill="#10B981" name="Completed" />
                              <Bar dataKey="remaining" stackId="a" fill="#E5E7EB" name="Remaining" />
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                      </div>
                    )}

                    {/* Individual Course Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                      {courses.map((course, index) => {
                        const progress = getCourseProgress(course.id);
                        return (
                          <Card 
                            key={course.id} 
                            className="cursor-pointer card-gradient border border-border/70 shadow-card hover:shadow-elevated transition-all duration-300 hover:scale-105"
                            onClick={() => {
                              setSelectedCourseForDetail(course.id);
                              setViewMode('course-detail');
                            }}
                          >
                            <CardHeader>
                              <CardTitle className="text-lg flex justify-between items-center">
                                {course.name}
                                <span className="text-sm font-normal text-muted-foreground">
                                  {Math.round(progress.percentage)}%
                                </span>
                              </CardTitle>
                              <CardDescription>{course.description}</CardDescription>
                            </CardHeader>
                            <CardContent>
                              <div className="relative mb-2">
                                <Progress value={progress.percentage} className="h-2 bg-muted/50" />
                                <div className="absolute inset-0 h-2 bg-progress-gradient rounded-full" 
                                     style={{ width: `${progress.percentage}%` }} />
                              </div>
                              <div className="text-sm text-muted-foreground flex justify-between">
                                <span>{progress.completed}/{progress.total} completed</span>
                                <span>{course.subjects.length} subjects</span>
                              </div>
                            </CardContent>
                          </Card>
                        );
                      })}
                    </div>

                    {/* Progress Calendar */}
                    <ProgressCalendar completedItems={completedItemsForCalendar} />
                  </CardContent>
                </Card>
              </>
            ) : (
              /* Course Detail View */
              selectedCourseForDetail && (
                <Card className="card-gradient border border-border/70 shadow-elevated">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle>
                          {courses.find(c => c.id === selectedCourseForDetail)?.name} - Detailed Progress
                        </CardTitle>
                        <CardDescription>
                          Subject-wise breakdown and progress analytics
                        </CardDescription>
                      </div>
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => setViewMode('overview')}
                        className="rounded-xl"
                      >
                        Back to Overview
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {/* Subject Progress Pie Chart */}
                    {getSubjectProgressData(selectedCourseForDetail).length > 0 && (
                      <div className="mb-8">
                        <h3 className="font-semibold mb-4">Subject Progress Distribution</h3>
                        <div className="h-64">
                          <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                              <Pie
                                data={getSubjectProgressData(selectedCourseForDetail)}
                                cx="50%"
                                cy="50%"
                                outerRadius={80}
                                fill="#8884d8"
                                dataKey="value"
                                label={({ name, value }) => `${name}: ${Math.round(value)}%`}
                              >
                                {getSubjectProgressData(selectedCourseForDetail).map((entry, index) => (
                                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                ))}
                              </Pie>
                              <Tooltip formatter={(value: number) => [`${Math.round(value)}%`, 'Completion']} />
                            </PieChart>
                          </ResponsiveContainer>
                        </div>
                      </div>
                    )}

                    {/* Subject Details */}
                    <div className="space-y-4">
                      <h3 className="font-semibold">Subject Details</h3>
                      {courses.find(c => c.id === selectedCourseForDetail)?.subjects.map((subject, index) => {
                        const progress = getSubjectProgressData(selectedCourseForDetail).find(s => s.name === subject.name);
                        return (
                          <Card key={subject.id} className="card-gradient border border-border/70 shadow-card">
                            <CardHeader>
                              <CardTitle className="text-lg flex justify-between items-center">
                                {subject.name}
                                <span className="text-sm font-normal text-muted-foreground">
                                  {progress ? Math.round(progress.value) : 0}%
                                </span>
                              </CardTitle>
                              <CardDescription>{subject.description}</CardDescription>
                            </CardHeader>
                            <CardContent>
                              <div className="relative mb-2">
                                <Progress value={progress ? progress.value : 0} className="h-2 bg-muted/50" />
                                <div 
                                  className="absolute inset-0 h-2 rounded-full" 
                                  style={{ 
                                    width: `${progress ? progress.value : 0}%`,
                                    background: COLORS[index % COLORS.length]
                                  }} 
                                />
                              </div>
                              <div className="text-sm text-muted-foreground">
                                {progress?.completed}/{progress?.total} items completed
                              </div>
                            </CardContent>
                          </Card>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              )
            )}
          </div>
        )}
      </div>

      {/* Edit Course Dialog */}
      <EditCourseDialog
        course={editingCourse}
        open={!!editingCourse}
        onOpenChange={(open) => !open && setEditingCourse(null)}
        onUpdate={loadCourses}
      />

      {/* Onboarding Tutorial */}
      {showTutorial && (
        <OnboardingTutorial onComplete={() => setShowTutorial(false)} />
      )}

      {/* AdMob Banner */}
      <AdBanner />
    </div>
  );
};

export default CourseTracker;
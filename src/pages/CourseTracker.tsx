import React, { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { BookOpen, GraduationCap, Target, TrendingUp, Clock, Award, Plus, ChevronRight } from "lucide-react";

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
  const [activeTab, setActiveTab] = useState('courses');
  const [viewMode, setViewMode] = useState<'overview' | 'course-detail'>('overview');
  const [selectedCourseForDetail, setSelectedCourseForDetail] = useState<string | null>(null);

  useEffect(() => {
    const savedCourses = localStorage.getItem('courseTrackerData');
    if (savedCourses) {
      setCourses(JSON.parse(savedCourses));
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('courseTrackerData', JSON.stringify(courses));
  }, [courses]);

  const createCourse = () => {
    if (newCourse.name.trim()) {
      const course: Course = {
        id: Date.now().toString(),
        name: newCourse.name,
        description: newCourse.description,
        subjects: [],
        createdAt: new Date().toISOString()
      };
      setCourses([...courses, course]);
      setNewCourse({ name: '', description: '' });
    }
  };

  const createSubject = () => {
    if (newSubject.name.trim() && selectedCourse) {
      const subject: Subject = {
        id: Date.now().toString(),
        name: newSubject.name,
        description: newSubject.description,
        syllabusChecklist: []
      };
      
      setCourses(courses.map(course => 
        course.id === selectedCourse 
          ? { ...course, subjects: [...course.subjects, subject] }
          : course
      ));
      setNewSubject({ name: '', description: '' });
    }
  };

  const processSyllabus = () => {
    if (!syllabusText.trim() || !selectedCourse || !selectedSubject) return;

    const lines = syllabusText.split('\n').filter(line => line.trim());
    const checklistItems: ChecklistItem[] = lines.map((line, index) => ({
      id: Date.now().toString() + index,
      content: line.trim(),
      completed: false
    }));

    setCourses(courses.map(course => 
      course.id === selectedCourse
        ? {
            ...course,
            subjects: course.subjects.map(subject => 
              subject.id === selectedSubject 
                ? { ...subject, syllabusChecklist: [...subject.syllabusChecklist, ...checklistItems] }
                : subject
            )
          }
        : course
    ));
    
    setSyllabusText('');
  };

  const toggleChecklistItem = (courseId: string, subjectId: string, itemId: string) => {
    setCourses(courses.map(course => 
      course.id === courseId
        ? {
            ...course,
            subjects: course.subjects.map(subject => 
              subject.id === subjectId
                ? {
                    ...subject,
                    syllabusChecklist: subject.syllabusChecklist.map(item => 
                      item.id === itemId 
                        ? { 
                            ...item, 
                            completed: !item.completed,
                            dateCompleted: !item.completed ? new Date().toISOString() : undefined
                          }
                        : item
                    )
                  }
                : subject
            )
          }
        : course
    ));
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

  const getTimelineData = () => {
    const timeline: { date: string; count: number; items: string[] }[] = [];
    
    courses.forEach(course => {
      course.subjects.forEach(subject => {
        subject.syllabusChecklist.forEach(item => {
          if (item.dateCompleted) {
            const date = item.dateCompleted.split('T')[0];
            const existing = timeline.find(t => t.date === date);
            if (existing) {
              existing.count++;
              existing.items.push(`${course.name} - ${subject.name}: ${item.content}`);
            } else {
              timeline.push({
                date,
                count: 1,
                items: [`${course.name} - ${subject.name}: ${item.content}`]
              });
            }
          }
        });
      });
    });

    return timeline.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  };

  const { completedToday, totalCompleted, totalItems } = getDailyProgress();
  const overallProgress = totalItems > 0 ? (totalCompleted / totalItems) * 100 : 0;
  const courseChartData = getCourseChartData();
  const timelineData = getTimelineData();

  // Modern color palette
  const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#06B6D4', '#F97316'];

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto p-4 md:p-8">
        <header className="text-center mb-12 animate-fade-in">
          <div className="inline-flex items-center gap-3 mb-4">
            <div className="hero-gradient p-3 rounded-2xl shadow-glow">
              <GraduationCap className="h-8 w-8 text-white" />
            </div>
            <h1 className="text-5xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
              Course Tracker
            </h1>
          </div>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Transform your learning journey with intelligent progress tracking and comprehensive syllabus management
          </p>
        </header>

        {/* Progress Overview */}
        <Card className="mb-8 card-gradient border-0 shadow-elevated animate-scale-in">
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
                  ? 'hero-gradient text-white shadow-glow scale-105' 
                  : 'hover:bg-accent/10 hover:scale-105'
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
            <Card className="card-gradient border-0 shadow-elevated">
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
                  disabled={!newCourse.name.trim()}
                  className="w-full md:w-auto hero-gradient text-white h-12 px-8 rounded-xl hover:scale-105 transition-all duration-300 disabled:opacity-50 disabled:hover:scale-100"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Create Course
                </Button>
              </CardContent>
            </Card>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {courses.map((course, index) => {
                const progress = getCourseProgress(course.id);
                return (
                  <Card 
                    key={course.id} 
                    className={`group cursor-pointer card-gradient border-0 shadow-card hover:shadow-elevated transition-all duration-300 hover:scale-105 ${
                      selectedCourse === course.id ? 'ring-2 ring-primary shadow-glow' : ''
                    }`}
                    onClick={() => setSelectedCourse(course.id)}
                    style={{ animationDelay: `${index * 100}ms` }}
                  >
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <CardTitle className="text-xl mb-2 group-hover:text-primary transition-colors">
                            {course.name}
                          </CardTitle>
                          <CardDescription className="text-sm line-clamp-2">
                            {course.description || "No description available"}
                          </CardDescription>
                        </div>
                        <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
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
          <div className="space-y-6">
            <Card>
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
                  />
                </div>
                <Button 
                  onClick={createSubject} 
                  disabled={!newSubject.name.trim() || !selectedCourse}
                >
                  Create Subject
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
                      className={`cursor-pointer hover:bg-accent/10 transition-colors ${
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
          <div className="space-y-6">
            <Card>
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
                      className="w-full p-2 border border-border rounded-md bg-background"
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
                  />
                </div>
                <Button 
                  onClick={processSyllabus} 
                  disabled={!syllabusText.trim() || !selectedCourse || !selectedSubject}
                >
                  Convert to Checklist
                </Button>
              </CardContent>
            </Card>

            {selectedCourse && courses.find(c => c.id === selectedCourse)?.subjects.map(subject => (
              subject.syllabusChecklist.length > 0 && (
                <Card key={subject.id} className="mt-6">
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
                        <div key={item.id} className="flex items-center space-x-3 p-3 rounded-lg border border-border">
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

        {/* Progress Tab */}
        {activeTab === 'progress' && (
          <div className="space-y-6">
            {viewMode === 'overview' ? (
              <>
                <Card>
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

                    {/* Individual Course Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                      {courses.map((course, index) => {
                        const progress = getCourseProgress(course.id);
                        return (
                          <Card 
                            key={course.id} 
                            className="cursor-pointer hover:shadow-md transition-shadow"
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
                              <Progress value={progress.percentage} className="h-2 mb-2" />
                              <div className="text-sm text-muted-foreground flex justify-between">
                                <span>{progress.completed}/{progress.total} completed</span>
                                <span>{course.subjects.length} subjects</span>
                              </div>
                            </CardContent>
                          </Card>
                        );
                      })}
                    </div>

                    {/* Timeline View */}
                    {timelineData.length > 0 && (
                      <div>
                        <h3 className="font-semibold mb-4">Study Timeline</h3>
                        <div className="space-y-3">
                          {timelineData.slice(-10).map((day, index) => (
                            <div key={index} className="p-3 border border-border rounded-lg bg-muted/50">
                              <div className="font-medium text-primary">
                                {new Date(day.date).toLocaleDateString()} - {day.count} items completed
                              </div>
                              <div className="text-sm text-muted-foreground mt-1">
                                {day.items.slice(0, 3).map((item, i) => (
                                  <div key={i}>• {item}</div>
                                ))}
                                {day.items.length > 3 && (
                                  <div className="text-xs">+{day.items.length - 3} more items</div>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </>
            ) : (
              /* Course Detail View */
              selectedCourseForDetail && (
                <Card>
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
                      >
                        Back to Overview
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {/* Subject Progress Pie Chart */}
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

                    {/* Subject Details */}
                    <div className="space-y-4">
                      <h3 className="font-semibold">Subject Details</h3>
                      {courses.find(c => c.id === selectedCourseForDetail)?.subjects.map((subject, index) => {
                        const progress = getSubjectProgressData(selectedCourseForDetail).find(s => s.name === subject.name);
                        return (
                          <Card key={subject.id}>
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
                              <Progress 
                                value={progress ? progress.value : 0} 
                                className="h-2 mb-2" 
                                style={{ 
                                  ['--progress-primary' as any]: COLORS[index % COLORS.length] 
                                }}
                              />
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
    </div>
  );
};

export default CourseTracker;

import React, { useState, useEffect } from "react";
import { format } from "date-fns";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { Plus, Trophy, XCircle, CheckCircle, TrendingUp, BarChart3, Trash2, CalendarIcon, Edit2, FileText, LineChart as LineChartIcon, Download } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, Legend } from 'recharts';

interface Subject {
  id: string;
  name: string;
}

interface TestSeriesScore {
  id: string;
  subject_id: string;
  subject_name: string;
  pass_mark: number;
  max_marks: number;
  score_obtained: number;
  date_taken: string | null;
}

interface TestSeries {
  id: string;
  name: string;
  start_date: string | null;
  end_date: string | null;
  aggregate_pass_mark: number;
  aggregate_max_marks: number;
  scores: TestSeriesScore[];
  created_at: string;
}

interface TestSeriesSectionProps {
  courseId: string;
  courseName: string;
  subjects: Subject[];
}

interface SubjectScoreInput {
  subject_id: string;
  subject_name: string;
  pass_mark: string;
  max_marks: string;
  score_obtained: string;
  date_taken: Date | undefined;
}

export const TestSeriesSection: React.FC<TestSeriesSectionProps> = ({ courseId, courseName, subjects }) => {
  const [testSeriesList, setTestSeriesList] = useState<TestSeries[]>([]);
  const [loading, setLoading] = useState(false);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [scoresDialogOpen, setScoresDialogOpen] = useState(false);
  const [selectedTest, setSelectedTest] = useState<TestSeries | null>(null);
  const [activeView, setActiveView] = useState<'tests' | 'reports' | 'analysis'>('tests');
  const [editingScoresTest, setEditingScoresTest] = useState<TestSeries | null>(null);
  
  // Create form state
  const [testName, setTestName] = useState("");
  const [startDate, setStartDate] = useState<Date>();
  const [endDate, setEndDate] = useState<Date>();
  const [aggregatePassMark, setAggregatePassMark] = useState("");
  const [aggregateMaxMarks, setAggregateMaxMarks] = useState("");
  const [subjectPassMarks, setSubjectPassMarks] = useState<SubjectScoreInput[]>([]);
  const [selectedSubjectIds, setSelectedSubjectIds] = useState<Set<string>>(new Set());
  
  // Score entry state
  const [subjectScores, setSubjectScores] = useState<SubjectScoreInput[]>([]);

  const { toast } = useToast();

  useEffect(() => {
    loadTestSeries();
  }, [courseId]);

  useEffect(() => {
    if (createDialogOpen && subjects.length > 0) {
      const allIds = new Set(subjects.map(s => s.id));
      setSelectedSubjectIds(allIds);
      setSubjectPassMarks(subjects.map(s => ({
        subject_id: s.id,
        subject_name: s.name,
        pass_mark: "",
        max_marks: "",
        score_obtained: "0",
        date_taken: undefined
      })));
    }
  }, [createDialogOpen, subjects]);

  useEffect(() => {
    if (editingScoresTest && scoresDialogOpen) {
      // Initialize with existing scores or empty
      const existingScores = editingScoresTest.scores;
      setSubjectScores(subjects.map(s => {
        const existing = existingScores.find(sc => sc.subject_id === s.id);
        return {
          subject_id: s.id,
          subject_name: s.name,
          pass_mark: existing?.pass_mark?.toString() || "",
          max_marks: existing?.max_marks?.toString() || "",
          score_obtained: existing?.score_obtained?.toString() || "",
          date_taken: existing?.date_taken ? new Date(existing.date_taken) : undefined
        };
      }));
    }
  }, [editingScoresTest, scoresDialogOpen, subjects]);

  const loadTestSeries = async () => {
    try {
      setLoading(true);
      
      const { data: testSeriesData, error: testError } = await supabase
        .from('test_series')
        .select('*')
        .eq('course_id', courseId)
        .order('created_at', { ascending: false });

      if (testError) throw testError;

      if (!testSeriesData || testSeriesData.length === 0) {
        setTestSeriesList([]);
        return;
      }

      const testSeriesIds = testSeriesData.map(t => t.id);
      const { data: scoresData, error: scoresError } = await supabase
        .from('test_series_scores')
        .select('*')
        .in('test_series_id', testSeriesIds);

      if (scoresError) throw scoresError;

      const transformedData: TestSeries[] = testSeriesData.map(test => {
        const testScores = (scoresData || [])
          .filter(s => s.test_series_id === test.id)
          .map(score => {
            const subject = subjects.find(sub => sub.id === score.subject_id);
            return {
              id: score.id,
              subject_id: score.subject_id,
              subject_name: subject?.name || 'Unknown Subject',
              pass_mark: score.pass_mark,
              max_marks: score.max_marks,
              score_obtained: score.score_obtained,
              date_taken: (score as any).date_taken || null
            };
          });

        return {
          id: test.id,
          name: test.name,
          start_date: test.start_date,
          end_date: test.end_date,
          aggregate_pass_mark: test.aggregate_pass_mark,
          aggregate_max_marks: test.aggregate_max_marks,
          scores: testScores,
          created_at: test.created_at
        };
      });

      setTestSeriesList(transformedData);
    } catch (error: any) {
      toast({
        title: "Error loading test series",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const createTestSeries = async () => {
    if (!testName.trim()) {
      toast({
        title: "Validation error",
        description: "Please enter a test name",
        variant: "destructive",
      });
      return;
    }

    // Validate pass marks and max marks for all subjects
    for (const score of subjectPassMarks) {
      if (!score.pass_mark || !score.max_marks) {
        toast({
          title: "Validation error",
          description: `Please fill pass mark and max marks for ${score.subject_name}`,
          variant: "destructive",
        });
        return;
      }
    }

    if (!aggregatePassMark || !aggregateMaxMarks) {
      toast({
        title: "Validation error",
        description: "Please fill aggregate pass mark and max marks",
        variant: "destructive",
      });
      return;
    }

    try {
      setLoading(true);

      const { data: testData, error: testError } = await supabase
        .from('test_series')
        .insert([{
          course_id: courseId,
          name: testName,
          start_date: startDate ? format(startDate, 'yyyy-MM-dd') : null,
          end_date: endDate ? format(endDate, 'yyyy-MM-dd') : null,
          aggregate_pass_mark: parseInt(aggregatePassMark),
          aggregate_max_marks: parseInt(aggregateMaxMarks)
        }])
        .select()
        .single();

      if (testError) throw testError;

      // Create score entries with 0 scores initially (pass/max marks set)
      const scoresInsert = subjectPassMarks.map(score => ({
        test_series_id: testData.id,
        subject_id: score.subject_id,
        pass_mark: parseInt(score.pass_mark),
        max_marks: parseInt(score.max_marks),
        score_obtained: 0
      }));

      const { error: scoresError } = await supabase
        .from('test_series_scores')
        .insert(scoresInsert);

      if (scoresError) throw scoresError;

      await loadTestSeries();
      resetCreateForm();
      setCreateDialogOpen(false);
      
      toast({
        title: "Test series created!",
        description: `${testName} has been added. You can now enter scores.`,
      });
    } catch (error: any) {
      toast({
        title: "Error creating test series",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const saveScores = async () => {
    if (!editingScoresTest) return;

    for (const score of subjectScores) {
      if (score.score_obtained === "" || isNaN(parseInt(score.score_obtained))) {
        toast({
          title: "Validation error",
          description: `Please enter a valid score for ${score.subject_name}`,
          variant: "destructive",
        });
        return;
      }
      if (!score.date_taken) {
        toast({
          title: "Validation error",
          description: `Please select a date for ${score.subject_name}`,
          variant: "destructive",
        });
        return;
      }
    }

    try {
      setLoading(true);

      // Update each score
      for (const score of subjectScores) {
        const existingScore = editingScoresTest.scores.find(s => s.subject_id === score.subject_id);
        
        if (existingScore) {
          const { error } = await supabase
            .from('test_series_scores')
            .update({ 
              score_obtained: parseInt(score.score_obtained),
              date_taken: score.date_taken ? format(score.date_taken, 'yyyy-MM-dd') : null
            })
            .eq('id', existingScore.id);
          
          if (error) throw error;
        }
      }

      await loadTestSeries();
      setScoresDialogOpen(false);
      setEditingScoresTest(null);
      
      toast({
        title: "Scores saved!",
        description: "Your test scores have been updated.",
      });
    } catch (error: any) {
      toast({
        title: "Error saving scores",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const deleteTestSeries = async (testId: string) => {
    try {
      setLoading(true);
      
      const { error } = await supabase
        .from('test_series')
        .delete()
        .eq('id', testId);

      if (error) throw error;

      await loadTestSeries();
      setSelectedTest(null);
      
      toast({
        title: "Test series deleted",
        description: "The test has been removed successfully.",
      });
    } catch (error: any) {
      toast({
        title: "Error deleting test series",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const resetCreateForm = () => {
    setTestName("");
    setStartDate(undefined);
    setEndDate(undefined);
    setAggregatePassMark("");
    setAggregateMaxMarks("");
    setSubjectPassMarks([]);
  };

  const updateSubjectPassMark = (subjectId: string, field: 'pass_mark' | 'max_marks', value: string) => {
    setSubjectPassMarks(prev => prev.map(s => 
      s.subject_id === subjectId ? { ...s, [field]: value } : s
    ));
  };

  const updateSubjectScore = (subjectId: string, value: string) => {
    setSubjectScores(prev => prev.map(s => 
      s.subject_id === subjectId ? { ...s, score_obtained: value } : s
    ));
  };

  const updateSubjectDate = (subjectId: string, date: Date | undefined) => {
    setSubjectScores(prev => prev.map(s => 
      s.subject_id === subjectId ? { ...s, date_taken: date } : s
    ));
  };

  const openScoreEntry = (test: TestSeries) => {
    setEditingScoresTest(test);
    setScoresDialogOpen(true);
  };

  const calculateTestResult = (test: TestSeries) => {
    const hasScores = test.scores.some(s => s.score_obtained > 0);
    const totalScore = test.scores.reduce((sum, s) => sum + s.score_obtained, 0);
    const aggregatePassed = totalScore >= test.aggregate_pass_mark;
    const allSubjectsPassed = test.scores.every(s => s.score_obtained >= s.pass_mark);
    const passed = aggregatePassed && allSubjectsPassed;

    return {
      hasScores,
      totalScore,
      aggregateMaxMarks: test.aggregate_max_marks,
      aggregatePassed,
      allSubjectsPassed,
      passed,
      failedSubjects: test.scores.filter(s => s.score_obtained < s.pass_mark)
    };
  };

  const getComparisonData = () => {
    return testSeriesList
      .filter(test => calculateTestResult(test).hasScores)
      .map(test => {
        const result = calculateTestResult(test);
        return {
          name: test.name,
          score: result.totalScore,
          passmark: test.aggregate_pass_mark,
          percentage: (result.totalScore / test.aggregate_max_marks) * 100
        };
      }).reverse();
  };

  const getSubjectWiseComparison = () => {
    if (subjects.length === 0 || testSeriesList.length === 0) return [];
    
    const testsWithScores = testSeriesList.filter(t => calculateTestResult(t).hasScores);
    
    return subjects.map(subject => {
      const data: Record<string, string | number> = { name: subject.name };
      testsWithScores.forEach(test => {
        const score = test.scores.find(s => s.subject_id === subject.id);
        if (score && score.max_marks > 0) {
          data[test.name] = ((score.score_obtained / score.max_marks) * 100).toFixed(1);
        }
      });
      return data;
    });
  };

  const formatDateRange = (start: string | null, end: string | null) => {
    if (!start && !end) return 'No dates set';
    if (start && end) {
      return `${format(new Date(start), 'MMM d')} - ${format(new Date(end), 'MMM d, yyyy')}`;
    }
    if (start) return `From ${format(new Date(start), 'MMM d, yyyy')}`;
    return `Until ${format(new Date(end!), 'MMM d, yyyy')}`;
  };

  const generateTestReportPDF = (test: TestSeries) => {
    const result = calculateTestResult(test);
    
    const reportContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Test Report - ${test.name}</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 40px; color: #333; }
          .header { text-align: center; margin-bottom: 30px; }
          .result-badge { display: inline-block; padding: 10px 20px; border-radius: 8px; font-size: 18px; font-weight: bold; }
          .passed { background: #d4edda; color: #155724; }
          .failed { background: #f8d7da; color: #721c24; }
          .pending { background: #fff3cd; color: #856404; }
          .stats { display: grid; grid-template-columns: repeat(2, 1fr); gap: 15px; margin: 20px 0; }
          .stat-card { border: 1px solid #ddd; padding: 15px; border-radius: 8px; text-align: center; }
          .section { margin-top: 25px; }
          .section h3 { border-bottom: 2px solid #007bff; padding-bottom: 8px; }
          .subject-row { display: flex; justify-content: space-between; padding: 12px; margin: 8px 0; border-radius: 6px; }
          .subject-pass { background: #d4edda; }
          .subject-fail { background: #f8d7da; }
          .subject-pending { background: #f8f9fa; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>📝 Test Report: ${test.name}</h1>
          <p>Course: ${courseName}</p>
          <p>Date Range: ${formatDateRange(test.start_date, test.end_date)}</p>
          <p>Generated on ${format(new Date(), "MMMM dd, yyyy")}</p>
        </div>

        <div style="text-align: center; margin: 30px 0;">
          ${result.hasScores 
            ? `<span class="result-badge ${result.passed ? 'passed' : 'failed'}">
                ${result.passed ? '✅ PASSED' : '❌ FAILED'}
              </span>`
            : '<span class="result-badge pending">⏳ PENDING</span>'
          }
        </div>

        <div class="stats">
          <div class="stat-card">
            <h4>Total Score</h4>
            <p style="font-size: 24px; color: ${result.passed ? '#28a745' : '#dc3545'};">
              ${result.totalScore}/${test.aggregate_max_marks}
            </p>
          </div>
          <div class="stat-card">
            <h4>Pass Mark</h4>
            <p style="font-size: 24px; color: #007bff;">${test.aggregate_pass_mark}</p>
          </div>
        </div>

        <div class="section">
          <h3>📊 Subject-wise Performance</h3>
          ${test.scores.map(score => {
            const passed = score.score_obtained >= score.pass_mark;
            const percentage = score.max_marks > 0 ? ((score.score_obtained / score.max_marks) * 100).toFixed(1) : 0;
            return `
              <div class="subject-row ${score.score_obtained > 0 ? (passed ? 'subject-pass' : 'subject-fail') : 'subject-pending'}">
                <div>
                  <strong>${score.subject_name}</strong>
                  ${score.date_taken ? `<br/><small>Date: ${format(new Date(score.date_taken), 'MMM d, yyyy')}</small>` : ''}
                </div>
                <div style="text-align: right;">
                  <strong>${score.score_obtained}/${score.max_marks}</strong> (${percentage}%)
                  <br/><small>Pass: ${score.pass_mark}</small>
                </div>
              </div>
            `;
          }).join('')}
        </div>

        ${!result.passed && result.hasScores ? `
          <div class="section">
            <h3>⚠️ Areas for Improvement</h3>
            ${!result.aggregatePassed ? '<p>• Aggregate score is below the pass mark.</p>' : ''}
            ${!result.allSubjectsPassed ? `<p>• The following subjects are below their individual pass marks:</p>
              <ul>
                ${result.failedSubjects.map(s => `<li>${s.subject_name} (${s.score_obtained}/${s.max_marks}, needed ${s.pass_mark})</li>`).join('')}
              </ul>
            ` : ''}
          </div>
        ` : ''}
      </body>
      </html>
    `;

    const blob = new Blob([reportContent], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `test-report-${test.name.replace(/\s+/g, '-')}-${format(new Date(), 'yyyy-MM-dd')}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const generateCombinedReportPDF = () => {
    const testsWithScores = testSeriesList.filter(t => calculateTestResult(t).hasScores);
    const passedTests = testsWithScores.filter(t => calculateTestResult(t).passed);
    const passRate = testsWithScores.length > 0 ? Math.round((passedTests.length / testsWithScores.length) * 100) : 0;

    const reportContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Combined Test Report - ${courseName}</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 40px; color: #333; }
          .header { text-align: center; margin-bottom: 30px; }
          .stats { display: grid; grid-template-columns: repeat(4, 1fr); gap: 15px; margin: 20px 0; }
          .stat-card { border: 1px solid #ddd; padding: 15px; border-radius: 8px; text-align: center; }
          .section { margin-top: 25px; page-break-inside: avoid; }
          .section h3 { border-bottom: 2px solid #007bff; padding-bottom: 8px; }
          .test-card { border: 1px solid #ddd; padding: 15px; margin: 15px 0; border-radius: 8px; page-break-inside: avoid; }
          .test-card.passed { border-left: 4px solid #28a745; }
          .test-card.failed { border-left: 4px solid #dc3545; }
          .subject-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #eee; }
          .subject-row:last-child { border-bottom: none; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>📚 Combined Test Report</h1>
          <p>Course: ${courseName}</p>
          <p>Generated on ${format(new Date(), "MMMM dd, yyyy")}</p>
        </div>

        <div class="stats">
          <div class="stat-card">
            <h4>Total Tests</h4>
            <p style="font-size: 24px; color: #007bff;">${testsWithScores.length}</p>
          </div>
          <div class="stat-card">
            <h4>Passed</h4>
            <p style="font-size: 24px; color: #28a745;">${passedTests.length}</p>
          </div>
          <div class="stat-card">
            <h4>Failed</h4>
            <p style="font-size: 24px; color: #dc3545;">${testsWithScores.length - passedTests.length}</p>
          </div>
          <div class="stat-card">
            <h4>Pass Rate</h4>
            <p style="font-size: 24px; color: #007bff;">${passRate}%</p>
          </div>
        </div>

        <div class="section">
          <h3>📝 Test Details</h3>
          ${testSeriesList.map(test => {
            const result = calculateTestResult(test);
            return `
              <div class="test-card ${result.hasScores ? (result.passed ? 'passed' : 'failed') : ''}">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                  <div>
                    <h4 style="margin: 0;">${test.name}</h4>
                    <small>${formatDateRange(test.start_date, test.end_date)}</small>
                  </div>
                  <div style="text-align: right;">
                    <strong style="color: ${result.passed ? '#28a745' : '#dc3545'};">
                      ${result.hasScores ? `${result.totalScore}/${test.aggregate_max_marks}` : 'Pending'}
                    </strong>
                    <br/>
                    <span style="color: ${result.passed ? '#28a745' : '#dc3545'};">
                      ${result.hasScores ? (result.passed ? '✅ Passed' : '❌ Failed') : '⏳ Pending'}
                    </span>
                  </div>
                </div>
                ${test.scores.map(score => `
                  <div class="subject-row">
                    <span>${score.subject_name} ${score.date_taken ? `(${format(new Date(score.date_taken), 'MMM d')})` : ''}</span>
                    <span>${score.score_obtained}/${score.max_marks}</span>
                  </div>
                `).join('')}
              </div>
            `;
          }).join('')}
        </div>
      </body>
      </html>
    `;

    const blob = new Blob([reportContent], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `combined-test-report-${courseName.replace(/\s+/g, '-')}-${format(new Date(), 'yyyy-MM-dd')}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const COLORS = ['hsl(var(--primary))', 'hsl(var(--secondary))', 'hsl(var(--accent))', 'hsl(var(--destructive))', '#8B5CF6', '#EC4899'];

  if (subjects.length === 0) {
    return (
      <Card className="card-gradient border-0 shadow-elevated">
        <CardContent className="py-12 text-center">
          <BarChart3 className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">No subjects available</h3>
          <p className="text-muted-foreground">Add subjects to this course first before creating test series.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with Create Button */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Test Series</h2>
          <p className="text-muted-foreground">Track your test scores and analyze progress for {courseName}</p>
        </div>
        
        {/* Create Dialog */}
        <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button className="hero-gradient text-white rounded-xl">
              <Plus className="h-4 w-4 mr-2" />
              Add Test Series
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh]">
            <DialogHeader>
              <DialogTitle>Create New Test Series</DialogTitle>
              <DialogDescription>
                Set up the test details and passing criteria. You can enter scores after creation.
              </DialogDescription>
            </DialogHeader>
            <ScrollArea className="max-h-[60vh] pr-4">
              <div className="space-y-6">
                {/* Test Name */}
                <div className="space-y-2">
                  <Label htmlFor="test-name">Test Name *</Label>
                  <Input
                    id="test-name"
                    value={testName}
                    onChange={(e) => setTestName(e.target.value)}
                    placeholder="e.g., Mock Test 1"
                    className="rounded-xl"
                  />
                </div>

                {/* Date Range */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Start Date</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className={cn(
                            "w-full justify-start text-left font-normal rounded-xl",
                            !startDate && "text-muted-foreground"
                          )}
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {startDate ? format(startDate, "PPP") : "Pick start date"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={startDate}
                          onSelect={setStartDate}
                          initialFocus
                          className={cn("p-3 pointer-events-auto")}
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                  <div className="space-y-2">
                    <Label>End Date</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className={cn(
                            "w-full justify-start text-left font-normal rounded-xl",
                            !endDate && "text-muted-foreground"
                          )}
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {endDate ? format(endDate, "PPP") : "Pick end date"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={endDate}
                          onSelect={setEndDate}
                          initialFocus
                          className={cn("p-3 pointer-events-auto")}
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                </div>

                {/* Aggregate Marks */}
                <Card className="bg-muted/50">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium">Aggregate Passing Criteria</CardTitle>
                  </CardHeader>
                  <CardContent className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="agg-pass">Pass Mark *</Label>
                      <Input
                        id="agg-pass"
                        type="number"
                        value={aggregatePassMark}
                        onChange={(e) => setAggregatePassMark(e.target.value)}
                        placeholder="e.g., 180"
                        className="rounded-xl"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="agg-max">Total Max Marks *</Label>
                      <Input
                        id="agg-max"
                        type="number"
                        value={aggregateMaxMarks}
                        onChange={(e) => setAggregateMaxMarks(e.target.value)}
                        placeholder="e.g., 300"
                        className="rounded-xl"
                      />
                    </div>
                  </CardContent>
                </Card>

                {/* Subject-wise Pass Marks */}
                <div className="space-y-4">
                  <Label className="text-base font-semibold">Subject-wise Passing Criteria</Label>
                  {subjectPassMarks.map((score) => (
                    <Card key={score.subject_id} className="bg-muted/30">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm">{score.subject_name}</CardTitle>
                      </CardHeader>
                      <CardContent className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground">Pass Mark *</Label>
                          <Input
                            type="number"
                            value={score.pass_mark}
                            onChange={(e) => updateSubjectPassMark(score.subject_id, 'pass_mark', e.target.value)}
                            placeholder="40"
                            className="h-9 rounded-lg"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground">Max Marks *</Label>
                          <Input
                            type="number"
                            value={score.max_marks}
                            onChange={(e) => updateSubjectPassMark(score.subject_id, 'max_marks', e.target.value)}
                            placeholder="100"
                            className="h-9 rounded-lg"
                          />
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            </ScrollArea>
            <DialogFooter>
              <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
                Cancel
              </Button>
              <Button 
                onClick={createTestSeries} 
                disabled={loading}
                className="hero-gradient text-white"
              >
                {loading ? 'Creating...' : 'Create Test Series'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Enter Scores Dialog */}
      <Dialog open={scoresDialogOpen} onOpenChange={setScoresDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Enter Scores - {editingScoresTest?.name}</DialogTitle>
            <DialogDescription>
              Enter the marks obtained and date for each subject
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="max-h-[60vh] pr-4">
            <div className="space-y-4">
              {subjectScores.map((score) => (
                <Card key={score.subject_id} className="bg-muted/30">
                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium">{score.subject_name}</p>
                        <p className="text-xs text-muted-foreground">
                          Max: {score.max_marks} | Pass: {score.pass_mark}
                        </p>
                      </div>
                      <Input
                        type="number"
                        value={score.score_obtained}
                        onChange={(e) => updateSubjectScore(score.subject_id, e.target.value)}
                        placeholder="Score"
                        className="w-24 h-9 rounded-lg text-center"
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <Label className="text-xs text-muted-foreground">Date Taken:</Label>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            size="sm"
                            className={cn(
                              "justify-start text-left font-normal rounded-lg flex-1",
                              !score.date_taken && "text-muted-foreground"
                            )}
                          >
                            <CalendarIcon className="mr-2 h-3 w-3" />
                            {score.date_taken ? format(score.date_taken, "PPP") : "Select date"}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={score.date_taken}
                            onSelect={(date) => updateSubjectDate(score.subject_id, date)}
                            initialFocus
                            className={cn("p-3 pointer-events-auto")}
                          />
                        </PopoverContent>
                      </Popover>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </ScrollArea>
          <DialogFooter>
            <Button variant="outline" onClick={() => setScoresDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={saveScores} 
              disabled={loading}
              className="hero-gradient text-white"
            >
              {loading ? 'Saving...' : 'Save Scores'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Sub-navigation tabs */}
      {testSeriesList.length > 0 && (
        <div className="flex gap-2 p-1 bg-muted/50 rounded-xl w-fit">
          <Button
            variant={activeView === 'tests' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setActiveView('tests')}
            className={`gap-2 rounded-lg ${activeView === 'tests' ? 'hero-gradient text-white' : ''}`}
          >
            <Trophy className="h-4 w-4" />
            Tests
          </Button>
          <Button
            variant={activeView === 'reports' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setActiveView('reports')}
            className={`gap-2 rounded-lg ${activeView === 'reports' ? 'hero-gradient text-white' : ''}`}
          >
            <FileText className="h-4 w-4" />
            Reports
          </Button>
          <Button
            variant={activeView === 'analysis' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setActiveView('analysis')}
            className={`gap-2 rounded-lg ${activeView === 'analysis' ? 'hero-gradient text-white' : ''}`}
          >
            <LineChartIcon className="h-4 w-4" />
            Analysis
          </Button>
        </div>
      )}

      {/* Test Series List */}
      {testSeriesList.length === 0 ? (
        <Card className="card-gradient border-0 shadow-elevated">
          <CardContent className="py-12 text-center">
            <Trophy className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">No test series yet</h3>
            <p className="text-muted-foreground">Create your first test series to start tracking your performance.</p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Tests View - Test Cards Grid */}
          {activeView === 'tests' && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {testSeriesList.map((test) => {
                const result = calculateTestResult(test);
                return (
                  <Card 
                    key={test.id}
                    className={`cursor-pointer card-gradient border-0 shadow-card hover:shadow-elevated transition-all duration-300 hover:scale-105 ${
                      selectedTest?.id === test.id ? 'ring-2 ring-primary' : ''
                    }`}
                    onClick={() => {
                      setSelectedTest(test);
                      setActiveView('reports');
                    }}
                  >
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between">
                        <div>
                          <CardTitle className="text-lg">{test.name}</CardTitle>
                          <CardDescription>
                            {formatDateRange(test.start_date, test.end_date)}
                          </CardDescription>
                        </div>
                        {result.hasScores ? (
                          <Badge 
                            variant={result.passed ? "default" : "destructive"}
                            className={result.passed ? "bg-green-500" : ""}
                          >
                            {result.passed ? (
                              <><CheckCircle className="h-3 w-3 mr-1" /> Pass</>
                            ) : (
                              <><XCircle className="h-3 w-3 mr-1" /> Fail</>
                            )}
                          </Badge>
                        ) : (
                          <Badge variant="outline">Pending</Badge>
                        )}
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {result.hasScores ? (
                        <>
                          <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">Score</span>
                            <span className="font-semibold">{result.totalScore}/{test.aggregate_max_marks}</span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">Pass Mark</span>
                            <span className={result.aggregatePassed ? "text-green-500" : "text-destructive"}>
                              {test.aggregate_pass_mark}
                            </span>
                          </div>
                          {!result.allSubjectsPassed && (
                            <p className="text-xs text-destructive">
                              {result.failedSubjects.length} subject(s) below pass mark
                            </p>
                          )}
                        </>
                      ) : (
                        <Button 
                          size="sm" 
                          variant="outline" 
                          className="w-full"
                          onClick={(e) => {
                            e.stopPropagation();
                            openScoreEntry(test);
                          }}
                        >
                          <Edit2 className="h-3 w-3 mr-1" />
                          Enter Scores
                        </Button>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}

          {/* Reports View - Individual Test Details */}
          {activeView === 'reports' && (
            <div className="space-y-6">
              {/* Test Selector */}
              <Card className="card-gradient border-0 shadow-elevated">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-lg">Select Test Report</CardTitle>
                      <CardDescription>Choose a test to view its detailed report</CardDescription>
                    </div>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={generateCombinedReportPDF}
                      disabled={testSeriesList.length === 0}
                    >
                      <Download className="h-4 w-4 mr-1" />
                      Export All
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2">
                    {testSeriesList.map((test) => {
                      const result = calculateTestResult(test);
                      return (
                        <Button
                          key={test.id}
                          variant={selectedTest?.id === test.id ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => setSelectedTest(test)}
                          className={`gap-2 ${selectedTest?.id === test.id ? 'hero-gradient text-white' : ''}`}
                        >
                          {test.name}
                          {result.hasScores && (
                            result.passed ? (
                              <CheckCircle className="h-3 w-3 text-green-400" />
                            ) : (
                              <XCircle className="h-3 w-3" />
                            )
                          )}
                        </Button>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>

              {/* Selected Test Report */}
              {selectedTest ? (
                <Card className="card-gradient border-0 shadow-elevated">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="text-xl flex items-center gap-3">
                          <FileText className="h-5 w-5 text-primary" />
                          {selectedTest.name} - Test Report
                        </CardTitle>
                        <CardDescription>
                          {formatDateRange(selectedTest.start_date, selectedTest.end_date)}
                        </CardDescription>
                      </div>
                      <div className="flex gap-2 flex-wrap">
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => generateTestReportPDF(selectedTest)}
                        >
                          <Download className="h-4 w-4 mr-1" />
                          Export PDF
                        </Button>
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => openScoreEntry(selectedTest)}
                        >
                          <Edit2 className="h-4 w-4 mr-1" />
                          Edit Scores
                        </Button>
                        <Button 
                          variant="destructive" 
                          size="sm"
                          onClick={() => deleteTestSeries(selectedTest.id)}
                        >
                          <Trash2 className="h-4 w-4 mr-1" />
                          Delete
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    {/* Overall Result Badge */}
                    <div className="flex items-center justify-center p-4 bg-muted/30 rounded-xl">
                      {calculateTestResult(selectedTest).hasScores ? (
                        <div className="text-center">
                          <Badge 
                            variant={calculateTestResult(selectedTest).passed ? "default" : "destructive"}
                            className={`text-lg px-4 py-2 ${calculateTestResult(selectedTest).passed ? "bg-green-500" : ""}`}
                          >
                            {calculateTestResult(selectedTest).passed ? (
                              <><CheckCircle className="h-5 w-5 mr-2" /> PASSED</>
                            ) : (
                              <><XCircle className="h-5 w-5 mr-2" /> FAILED</>
                            )}
                          </Badge>
                          {!calculateTestResult(selectedTest).passed && (
                            <p className="text-sm text-muted-foreground mt-2">
                              {!calculateTestResult(selectedTest).aggregatePassed && "Aggregate score below pass mark. "}
                              {!calculateTestResult(selectedTest).allSubjectsPassed && `${calculateTestResult(selectedTest).failedSubjects.length} subject(s) below individual pass mark.`}
                            </p>
                          )}
                        </div>
                      ) : (
                        <div className="text-center">
                          <Badge variant="outline" className="text-lg px-4 py-2">
                            Scores Pending
                          </Badge>
                          <p className="text-sm text-muted-foreground mt-2">
                            Enter scores to see the result
                          </p>
                        </div>
                      )}
                    </div>

                    {/* Subject-wise Breakdown */}
                    <div>
                      <h4 className="font-semibold mb-4">Subject-wise Performance</h4>
                      <div className="space-y-3">
                        {selectedTest.scores.map(score => {
                          const passed = score.score_obtained >= score.pass_mark;
                          const percentage = score.max_marks > 0 ? (score.score_obtained / score.max_marks) * 100 : 0;
                          return (
                            <div key={score.id} className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                              <div className="flex items-center gap-3">
                                {score.score_obtained > 0 ? (
                                  passed ? (
                                    <CheckCircle className="h-5 w-5 text-green-500" />
                                  ) : (
                                    <XCircle className="h-5 w-5 text-destructive" />
                                  )
                                ) : (
                                  <div className="h-5 w-5 rounded-full border-2 border-muted-foreground/30" />
                                )}
                                <span className="font-medium">{score.subject_name}</span>
                              </div>
                              <div className="flex items-center gap-4 text-sm">
                                <span className="text-muted-foreground">
                                  Pass: {score.pass_mark} / Max: {score.max_marks}
                                </span>
                                <span className={`font-semibold ${score.score_obtained > 0 ? (passed ? 'text-green-500' : 'text-destructive') : 'text-muted-foreground'}`}>
                                  {score.score_obtained}/{score.max_marks} ({percentage.toFixed(1)}%)
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Aggregate Summary */}
                    <div className="p-4 bg-muted/50 rounded-xl">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold">Aggregate Score</span>
                        <div className="text-right">
                          <p className={`text-xl font-bold ${calculateTestResult(selectedTest).hasScores ? (calculateTestResult(selectedTest).passed ? 'text-green-500' : 'text-destructive') : 'text-muted-foreground'}`}>
                            {calculateTestResult(selectedTest).totalScore}/{selectedTest.aggregate_max_marks}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            Pass Mark: {selectedTest.aggregate_pass_mark}
                          </p>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <Card className="card-gradient border-0 shadow-elevated">
                  <CardContent className="py-12 text-center">
                    <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <h3 className="text-lg font-semibold mb-2">Select a Test</h3>
                    <p className="text-muted-foreground">Choose a test from above to view its detailed report</p>
                  </CardContent>
                </Card>
              )}
            </div>
          )}

          {/* Analysis View - Comparison Charts */}
          {activeView === 'analysis' && (
            <div className="space-y-6">
              {getComparisonData().length > 1 ? (
                <>
                  {/* Overall Score Comparison */}
                  <Card className="card-gradient border-0 shadow-elevated">
                    <CardHeader>
                      <div className="flex items-center gap-3">
                        <TrendingUp className="h-5 w-5 text-primary" />
                        <div>
                          <CardTitle>Score Comparison</CardTitle>
                          <CardDescription>Compare your performance across all tests</CardDescription>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="h-72">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={getComparisonData()}>
                            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                            <XAxis dataKey="name" className="text-xs" />
                            <YAxis className="text-xs" />
                            <Tooltip 
                              contentStyle={{ 
                                backgroundColor: 'hsl(var(--background))', 
                                border: '1px solid hsl(var(--border))',
                                borderRadius: '8px'
                              }}
                            />
                            <Legend />
                            <Bar dataKey="score" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} name="Your Score" />
                            <Bar dataKey="passmark" fill="hsl(var(--destructive))" radius={[4, 4, 0, 0]} name="Pass Mark" />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Subject-wise Trend */}
                  {getSubjectWiseComparison().length > 0 && (
                    <Card className="card-gradient border-0 shadow-elevated">
                      <CardHeader>
                        <div className="flex items-center gap-3">
                          <LineChartIcon className="h-5 w-5 text-primary" />
                          <div>
                            <CardTitle>Subject-wise Progress</CardTitle>
                            <CardDescription>Track improvement in each subject over time</CardDescription>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="h-72">
                          <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={getSubjectWiseComparison()}>
                              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                              <XAxis dataKey="name" className="text-xs" />
                              <YAxis domain={[0, 100]} className="text-xs" unit="%" />
                              <Tooltip 
                                contentStyle={{ 
                                  backgroundColor: 'hsl(var(--background))', 
                                  border: '1px solid hsl(var(--border))',
                                  borderRadius: '8px'
                                }}
                                formatter={(value: any) => [`${value}%`, '']}
                              />
                              <Legend />
                              {testSeriesList
                                .filter(t => calculateTestResult(t).hasScores)
                                .slice(0, 5)
                                .map((test, index) => (
                                  <Line 
                                    key={test.id}
                                    type="monotone"
                                    dataKey={test.name}
                                    stroke={COLORS[index % COLORS.length]}
                                    strokeWidth={2}
                                    dot={{ r: 4 }}
                                  />
                                ))}
                            </LineChart>
                          </ResponsiveContainer>
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {/* Summary Stats */}
                  <Card className="card-gradient border-0 shadow-elevated">
                    <CardHeader>
                      <CardTitle>Performance Summary</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="p-4 bg-muted/30 rounded-xl text-center">
                          <p className="text-2xl font-bold text-primary">
                            {testSeriesList.filter(t => calculateTestResult(t).hasScores).length}
                          </p>
                          <p className="text-sm text-muted-foreground">Tests Completed</p>
                        </div>
                        <div className="p-4 bg-muted/30 rounded-xl text-center">
                          <p className="text-2xl font-bold text-green-500">
                            {testSeriesList.filter(t => calculateTestResult(t).passed).length}
                          </p>
                          <p className="text-sm text-muted-foreground">Tests Passed</p>
                        </div>
                        <div className="p-4 bg-muted/30 rounded-xl text-center">
                          <p className="text-2xl font-bold text-destructive">
                            {testSeriesList.filter(t => calculateTestResult(t).hasScores && !calculateTestResult(t).passed).length}
                          </p>
                          <p className="text-sm text-muted-foreground">Tests Failed</p>
                        </div>
                        <div className="p-4 bg-muted/30 rounded-xl text-center">
                          <p className="text-2xl font-bold text-primary">
                            {testSeriesList.filter(t => calculateTestResult(t).hasScores).length > 0 
                              ? Math.round(
                                  (testSeriesList.filter(t => calculateTestResult(t).passed).length / 
                                   testSeriesList.filter(t => calculateTestResult(t).hasScores).length) * 100
                                )
                              : 0}%
                          </p>
                          <p className="text-sm text-muted-foreground">Pass Rate</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </>
              ) : (
                <Card className="card-gradient border-0 shadow-elevated">
                  <CardContent className="py-12 text-center">
                    <LineChartIcon className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <h3 className="text-lg font-semibold mb-2">Not enough data</h3>
                    <p className="text-muted-foreground">Complete at least 2 tests with scores to see analysis and trends</p>
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
};

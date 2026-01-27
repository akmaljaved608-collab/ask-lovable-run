import React, { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trophy, XCircle, CheckCircle, TrendingUp, BarChart3, Trash2 } from "lucide-react";
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
}

interface TestSeries {
  id: string;
  name: string;
  test_date: string | null;
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
}

export const TestSeriesSection: React.FC<TestSeriesSectionProps> = ({ courseId, courseName, subjects }) => {
  const [testSeriesList, setTestSeriesList] = useState<TestSeries[]>([]);
  const [loading, setLoading] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedTest, setSelectedTest] = useState<TestSeries | null>(null);
  
  // Form state
  const [testName, setTestName] = useState("");
  const [testDate, setTestDate] = useState("");
  const [aggregatePassMark, setAggregatePassMark] = useState("");
  const [aggregateMaxMarks, setAggregateMaxMarks] = useState("");
  const [subjectScores, setSubjectScores] = useState<SubjectScoreInput[]>([]);

  const { toast } = useToast();

  useEffect(() => {
    loadTestSeries();
  }, [courseId]);

  useEffect(() => {
    if (dialogOpen && subjects.length > 0) {
      setSubjectScores(subjects.map(s => ({
        subject_id: s.id,
        subject_name: s.name,
        pass_mark: "",
        max_marks: "",
        score_obtained: ""
      })));
    }
  }, [dialogOpen, subjects]);

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

      // Fetch scores for all test series
      const testSeriesIds = testSeriesData.map(t => t.id);
      const { data: scoresData, error: scoresError } = await supabase
        .from('test_series_scores')
        .select('*')
        .in('test_series_id', testSeriesIds);

      if (scoresError) throw scoresError;

      // Map scores to test series
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
              score_obtained: score.score_obtained
            };
          });

        return {
          id: test.id,
          name: test.name,
          test_date: test.test_date,
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

    // Validate all subject scores are filled
    for (const score of subjectScores) {
      if (!score.pass_mark || !score.max_marks || !score.score_obtained) {
        toast({
          title: "Validation error",
          description: `Please fill all fields for ${score.subject_name}`,
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

      // Create test series
      const { data: testData, error: testError } = await supabase
        .from('test_series')
        .insert([{
          course_id: courseId,
          name: testName,
          test_date: testDate || null,
          aggregate_pass_mark: parseInt(aggregatePassMark),
          aggregate_max_marks: parseInt(aggregateMaxMarks)
        }])
        .select()
        .single();

      if (testError) throw testError;

      // Create scores for each subject
      const scoresInsert = subjectScores.map(score => ({
        test_series_id: testData.id,
        subject_id: score.subject_id,
        pass_mark: parseInt(score.pass_mark),
        max_marks: parseInt(score.max_marks),
        score_obtained: parseInt(score.score_obtained)
      }));

      const { error: scoresError } = await supabase
        .from('test_series_scores')
        .insert(scoresInsert);

      if (scoresError) throw scoresError;

      await loadTestSeries();
      resetForm();
      setDialogOpen(false);
      
      toast({
        title: "Test series created!",
        description: `${testName} has been added successfully.`,
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

  const resetForm = () => {
    setTestName("");
    setTestDate("");
    setAggregatePassMark("");
    setAggregateMaxMarks("");
    setSubjectScores([]);
  };

  const updateSubjectScore = (subjectId: string, field: keyof SubjectScoreInput, value: string) => {
    setSubjectScores(prev => prev.map(s => 
      s.subject_id === subjectId ? { ...s, [field]: value } : s
    ));
  };

  const calculateTestResult = (test: TestSeries) => {
    // Calculate aggregate score
    const totalScore = test.scores.reduce((sum, s) => sum + s.score_obtained, 0);
    
    // Check if aggregate passes
    const aggregatePassed = totalScore >= test.aggregate_pass_mark;
    
    // Check if all subjects pass
    const allSubjectsPassed = test.scores.every(s => s.score_obtained >= s.pass_mark);
    
    // Both conditions must be true to pass
    const passed = aggregatePassed && allSubjectsPassed;

    return {
      totalScore,
      aggregateMaxMarks: test.aggregate_max_marks,
      aggregatePassed,
      allSubjectsPassed,
      passed,
      failedSubjects: test.scores.filter(s => s.score_obtained < s.pass_mark)
    };
  };

  const getComparisonData = () => {
    return testSeriesList.map(test => {
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
    
    return subjects.map(subject => {
      const data: any = { name: subject.name };
      testSeriesList.forEach(test => {
        const score = test.scores.find(s => s.subject_id === subject.id);
        if (score) {
          data[test.name] = ((score.score_obtained / score.max_marks) * 100).toFixed(1);
        }
      });
      return data;
    });
  };

  const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899'];

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
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
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
                Enter marks for each subject and aggregate passing criteria
              </DialogDescription>
            </DialogHeader>
            <ScrollArea className="max-h-[60vh] pr-4">
              <div className="space-y-6">
                {/* Basic Info */}
                <div className="grid grid-cols-2 gap-4">
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
                  <div className="space-y-2">
                    <Label htmlFor="test-date">Test Date</Label>
                    <Input
                      id="test-date"
                      type="date"
                      value={testDate}
                      onChange={(e) => setTestDate(e.target.value)}
                      className="rounded-xl"
                    />
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

                {/* Subject-wise Marks */}
                <div className="space-y-4">
                  <Label className="text-base font-semibold">Subject-wise Marks</Label>
                  {subjectScores.map((score) => (
                    <Card key={score.subject_id} className="bg-muted/30">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm">{score.subject_name}</CardTitle>
                      </CardHeader>
                      <CardContent className="grid grid-cols-3 gap-3">
                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground">Pass Mark</Label>
                          <Input
                            type="number"
                            value={score.pass_mark}
                            onChange={(e) => updateSubjectScore(score.subject_id, 'pass_mark', e.target.value)}
                            placeholder="40"
                            className="h-9 rounded-lg"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground">Max Marks</Label>
                          <Input
                            type="number"
                            value={score.max_marks}
                            onChange={(e) => updateSubjectScore(score.subject_id, 'max_marks', e.target.value)}
                            placeholder="100"
                            className="h-9 rounded-lg"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground">Score</Label>
                          <Input
                            type="number"
                            value={score.score_obtained}
                            onChange={(e) => updateSubjectScore(score.subject_id, 'score_obtained', e.target.value)}
                            placeholder="75"
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
              <Button variant="outline" onClick={() => setDialogOpen(false)}>
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
          {/* Test Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {testSeriesList.map((test) => {
              const result = calculateTestResult(test);
              return (
                <Card 
                  key={test.id}
                  className={`cursor-pointer card-gradient border-0 shadow-card hover:shadow-elevated transition-all duration-300 hover:scale-105 ${
                    selectedTest?.id === test.id ? 'ring-2 ring-primary' : ''
                  }`}
                  onClick={() => setSelectedTest(test)}
                >
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle className="text-lg">{test.name}</CardTitle>
                        <CardDescription>
                          {test.test_date ? new Date(test.test_date).toLocaleDateString() : 'No date set'}
                        </CardDescription>
                      </div>
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
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Score</span>
                      <span className="font-semibold">{result.totalScore}/{test.aggregate_max_marks}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Pass Mark</span>
                      <span className={result.aggregatePassed ? "text-green-500" : "text-red-500"}>
                        {test.aggregate_pass_mark}
                      </span>
                    </div>
                    {!result.allSubjectsPassed && (
                      <p className="text-xs text-destructive">
                        {result.failedSubjects.length} subject(s) below pass mark
                      </p>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* Detailed View for Selected Test */}
          {selectedTest && (
            <Card className="card-gradient border-0 shadow-elevated">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-xl">{selectedTest.name} - Detailed Analysis</CardTitle>
                    <CardDescription>
                      {selectedTest.test_date ? new Date(selectedTest.test_date).toLocaleDateString() : 'No date set'}
                    </CardDescription>
                  </div>
                  <Button 
                    variant="destructive" 
                    size="sm"
                    onClick={() => deleteTestSeries(selectedTest.id)}
                  >
                    <Trash2 className="h-4 w-4 mr-1" />
                    Delete
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Subject-wise Breakdown */}
                <div>
                  <h4 className="font-semibold mb-4">Subject-wise Performance</h4>
                  <div className="space-y-3">
                    {selectedTest.scores.map(score => {
                      const passed = score.score_obtained >= score.pass_mark;
                      const percentage = (score.score_obtained / score.max_marks) * 100;
                      return (
                        <div key={score.id} className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                          <div className="flex items-center gap-3">
                            {passed ? (
                              <CheckCircle className="h-5 w-5 text-green-500" />
                            ) : (
                              <XCircle className="h-5 w-5 text-red-500" />
                            )}
                            <span className="font-medium">{score.subject_name}</span>
                          </div>
                          <div className="flex items-center gap-4 text-sm">
                            <span className="text-muted-foreground">
                              Pass: {score.pass_mark}
                            </span>
                            <span className={`font-semibold ${passed ? 'text-green-500' : 'text-red-500'}`}>
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
                      <p className={`text-xl font-bold ${calculateTestResult(selectedTest).passed ? 'text-green-500' : 'text-red-500'}`}>
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
          )}

          {/* Comparison Analysis */}
          {testSeriesList.length > 1 && (
            <Card className="card-gradient border-0 shadow-elevated">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <TrendingUp className="h-5 w-5 text-primary" />
                  <CardTitle>Performance Trend</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Overall Score Trend */}
                <div>
                  <h4 className="font-semibold mb-4">Overall Score Comparison</h4>
                  <div className="h-64">
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
                        <Bar dataKey="score" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="passmark" fill="hsl(var(--destructive))" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Subject-wise Trend */}
                <div>
                  <h4 className="font-semibold mb-4">Subject-wise Trend (%)</h4>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={getSubjectWiseComparison()}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                        <XAxis dataKey="name" className="text-xs" />
                        <YAxis domain={[0, 100]} className="text-xs" />
                        <Tooltip 
                          contentStyle={{ 
                            backgroundColor: 'hsl(var(--background))', 
                            border: '1px solid hsl(var(--border))',
                            borderRadius: '8px'
                          }}
                        />
                        <Legend />
                        {testSeriesList.slice(0, 5).map((test, index) => (
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
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
};

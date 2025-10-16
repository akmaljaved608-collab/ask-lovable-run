import React, { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { BookOpen, Target, Clock, TrendingUp, ChevronRight, ChevronLeft, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

interface OnboardingTutorialProps {
  onComplete: () => void;
}

const tutorialSteps = [
  {
    title: "Welcome to Course Tracker! 🎓",
    description: "Let's take a quick tour to help you get started with managing your learning journey.",
    icon: BookOpen,
    content: "Course Tracker helps you organize courses, track subjects, manage syllabus items, and monitor your progress with beautiful analytics.",
  },
  {
    title: "Create Your First Course 📚",
    description: "Start by creating a course - this could be any subject you're studying.",
    icon: BookOpen,
    content: "Click on the 'Courses' tab, fill in the course name and description, then click 'Create Course'. You can edit, duplicate, or delete courses anytime by hovering over them. Ads help keep this app free - thank you for your support!",
  },
  {
    title: "Add Subjects to Your Course 🎯",
    description: "Break down your course into subjects or modules.",
    icon: Target,
    content: "Go to the 'Subjects' tab, select your course, and add subjects. For example, if you're learning Programming, you might add subjects like 'Variables', 'Functions', etc.",
  },
  {
    title: "Upload Your Syllabus 📝",
    description: "Convert your syllabus into an interactive checklist.",
    icon: Clock,
    content: "In the 'Syllabus' tab, paste your syllabus content (one topic per line) and we'll convert it into a checklist that you can track and complete.",
  },
  {
    title: "Track Your Progress 📊",
    description: "Monitor your learning journey with beautiful analytics.",
    icon: TrendingUp,
    content: "Check the 'Analytics' tab to see your progress across all courses, completion trends, and study patterns. You can also generate detailed reports from the Reports page.",
  },
];

export const OnboardingTutorial: React.FC<OnboardingTutorialProps> = ({ onComplete }) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [isOpen, setIsOpen] = useState(true);
  const { user } = useAuth();

  const handleNext = () => {
    if (currentStep < tutorialSteps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      handleComplete();
    }
  };

  const handlePrevious = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleComplete = async () => {
    setIsOpen(false);
    
    // Mark tutorial as completed in user profile
    if (user) {
      try {
        await supabase
          .from("profiles")
          .update({ tutorial_completed: true })
          .eq("user_id", user.id);
      } catch (error) {
        console.error("Error updating tutorial status:", error);
      }
    }
    
    onComplete();
  };

  const handleSkip = () => {
    handleComplete();
  };

  const step = tutorialSteps[currentStep];
  const Icon = step.icon;

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <div className="flex items-center justify-between mb-2">
            <DialogTitle className="text-2xl flex items-center gap-3">
              <div className="hero-gradient p-2 rounded-xl">
                <Icon className="h-6 w-6 text-white" />
              </div>
              {step.title}
            </DialogTitle>
            <Button variant="ghost" size="icon" onClick={handleSkip}>
              <X className="h-4 w-4" />
            </Button>
          </div>
          <DialogDescription className="text-base">
            {step.description}
          </DialogDescription>
        </DialogHeader>
        
        <div className="py-6">
          <Card className="card-gradient border-0">
            <CardContent className="pt-6">
              <p className="text-base leading-relaxed text-muted-foreground">
                {step.content}
              </p>
            </CardContent>
          </Card>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex gap-1">
            {tutorialSteps.map((_, index) => (
              <div
                key={index}
                className={`h-2 rounded-full transition-all duration-300 ${
                  index === currentStep
                    ? "w-8 bg-primary"
                    : index < currentStep
                    ? "w-2 bg-primary/50"
                    : "w-2 bg-muted"
                }`}
              />
            ))}
          </div>

          <div className="flex gap-2">
            {currentStep > 0 && (
              <Button variant="outline" onClick={handlePrevious}>
                <ChevronLeft className="h-4 w-4 mr-1" />
                Previous
              </Button>
            )}
            <Button onClick={handleNext} className="hero-gradient text-white">
              {currentStep === tutorialSteps.length - 1 ? "Get Started" : "Next"}
              {currentStep < tutorialSteps.length - 1 && (
                <ChevronRight className="h-4 w-4 ml-1" />
              )}
            </Button>
          </div>
        </div>

        <div className="text-center">
          <Button variant="ghost" size="sm" onClick={handleSkip} className="text-muted-foreground">
            Skip Tutorial
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

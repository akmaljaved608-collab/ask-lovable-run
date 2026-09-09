import React, { useState, useMemo } from "react";
import { Calendar } from "@/components/ui/calendar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Flame, CalendarDays } from "lucide-react";
import { format, isSameDay, startOfDay, subDays, isAfter } from "date-fns";
import { StreakAchievements } from "./StreakAchievements";

interface CompletedItem {
  date: string;
  courseName: string;
  subjectName: string;
  content: string;
}

interface ProgressCalendarProps {
  completedItems: CompletedItem[];
}

export const ProgressCalendar: React.FC<ProgressCalendarProps> = ({ completedItems }) => {
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);

  // Group completed items by date
  const itemsByDate = useMemo(() => {
    const grouped: Record<string, CompletedItem[]> = {};
    completedItems.forEach(item => {
      const dateKey = item.date.split('T')[0];
      if (!grouped[dateKey]) {
        grouped[dateKey] = [];
      }
      grouped[dateKey].push(item);
    });
    return grouped;
  }, [completedItems]);

  // Get dates that have progress
  const progressDates = useMemo(() => {
    return Object.keys(itemsByDate).map(dateStr => new Date(dateStr));
  }, [itemsByDate]);

  // Calculate current streak
  const currentStreak = useMemo(() => {
    const sortedDates = Object.keys(itemsByDate)
      .map(d => new Date(d))
      .sort((a, b) => b.getTime() - a.getTime());
    
    if (sortedDates.length === 0) return 0;

    const today = startOfDay(new Date());
    const yesterday = subDays(today, 1);
    
    // Check if most recent activity was today or yesterday
    const mostRecent = startOfDay(sortedDates[0]);
    if (!isSameDay(mostRecent, today) && !isSameDay(mostRecent, yesterday)) {
      return 0;
    }

    let streak = 1;
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

    return streak;
  }, [itemsByDate]);

  // Get items for selected date
  const selectedDateItems = useMemo(() => {
    if (!selectedDate) return [];
    const dateKey = format(selectedDate, 'yyyy-MM-dd');
    return itemsByDate[dateKey] || [];
  }, [selectedDate, itemsByDate]);

  // Custom day content with indicators
  const modifiers = useMemo(() => ({
    hasProgress: progressDates,
  }), [progressDates]);

  const modifiersStyles = {
    hasProgress: {
      backgroundColor: 'hsl(var(--primary) / 0.2)',
      color: 'hsl(var(--primary))',
      fontWeight: '600',
    },
  };

  return (
    <div className="space-y-4">
      {/* Streak Display */}
      <div className="flex items-center gap-4 mb-4 flex-wrap">
        <div className="flex items-center gap-2 bg-gradient-to-r from-orange-500/20 to-red-500/20 px-4 py-2 rounded-xl border border-orange-500/30">
          <Flame className="h-5 w-5 text-orange-500" />
          <span className="font-bold text-orange-500">{currentStreak}</span>
          <span className="text-sm text-muted-foreground">day streak</span>
        </div>
        <div className="flex items-center gap-2 bg-primary/10 px-4 py-2 rounded-xl border border-primary/30">
          <CalendarDays className="h-5 w-5 text-primary" />
          <span className="font-bold text-primary">{progressDates.length}</span>
          <span className="text-sm text-muted-foreground">active days</span>
        </div>
      </div>

      {/* Achievements */}
      <StreakAchievements 
        currentStreak={currentStreak}
        totalCompleted={completedItems.length}
        activeDays={progressDates.length}
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Calendar */}
        <Card className="card-gradient border border-border/70 shadow-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <CalendarDays className="h-5 w-5 text-primary" />
              Progress Calendar
            </CardTitle>
          </CardHeader>
          <CardContent className="flex justify-center">
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={setSelectedDate}
              modifiers={modifiers}
              modifiersStyles={modifiersStyles}
              className="rounded-md pointer-events-auto"
              disabled={(date) => isAfter(date, new Date())}
            />
          </CardContent>
        </Card>

        {/* Selected Date Details */}
        <Card className="card-gradient border border-border/70 shadow-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">
              {selectedDate 
                ? format(selectedDate, 'MMMM d, yyyy')
                : 'Select a date'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {!selectedDate ? (
              <p className="text-muted-foreground text-sm">
                Click on a date to see completed items
              </p>
            ) : selectedDateItems.length === 0 ? (
              <div className="text-center py-6">
                <p className="text-muted-foreground">No items completed on this day</p>
              </div>
            ) : (
              <div className="space-y-3 max-h-[300px] overflow-y-auto">
                <Badge variant="secondary" className="mb-2">
                  {selectedDateItems.length} item{selectedDateItems.length > 1 ? 's' : ''} completed
                </Badge>
                {selectedDateItems.map((item, index) => (
                  <div 
                    key={index} 
                    className="p-3 rounded-lg bg-muted/50 border border-border hover:bg-muted/70 transition-colors"
                  >
                    <div className="flex flex-col gap-1">
                      <span className="text-xs text-primary font-medium">
                        {item.courseName} • {item.subjectName}
                      </span>
                      <span className="text-sm text-foreground">
                        {item.content}
                      </span>
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
};

// Export function for getting calendar data
export const getCalendarDataForExport = (completedItems: { date: string; courseName: string; subjectName: string; content: string }[]) => {
  const grouped: Record<string, { courseName: string; subjectName: string; content: string }[]> = {};
  
  completedItems.forEach(item => {
    const dateKey = item.date.split('T')[0];
    if (!grouped[dateKey]) {
      grouped[dateKey] = [];
    }
    grouped[dateKey].push({
      courseName: item.courseName,
      subjectName: item.subjectName,
      content: item.content
    });
  });

  return Object.entries(grouped)
    .sort(([a], [b]) => new Date(b).getTime() - new Date(a).getTime())
    .map(([date, items]) => ({
      date,
      formattedDate: format(new Date(date), 'MMMM d, yyyy'),
      itemCount: items.length,
      items
    }));
};

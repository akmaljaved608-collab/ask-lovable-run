import React, { useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  Flame, 
  Trophy, 
  Star, 
  Zap, 
  Crown, 
  Medal, 
  Award,
  Target,
  Rocket
} from "lucide-react";
import { cn } from "@/lib/utils";

interface Achievement {
  id: string;
  name: string;
  description: string;
  icon: React.ReactNode;
  requirement: number;
  type: 'streak' | 'total' | 'activeDays';
  color: string;
  bgGradient: string;
}

interface StreakAchievementsProps {
  currentStreak: number;
  totalCompleted: number;
  activeDays: number;
}

const achievements: Achievement[] = [
  // Streak achievements
  {
    id: 'streak-3',
    name: 'Getting Started',
    description: '3 day streak',
    icon: <Flame className="h-5 w-5" />,
    requirement: 3,
    type: 'streak',
    color: 'text-orange-500',
    bgGradient: 'from-orange-500/20 to-amber-500/20'
  },
  {
    id: 'streak-7',
    name: 'Week Warrior',
    description: '7 day streak',
    icon: <Zap className="h-5 w-5" />,
    requirement: 7,
    type: 'streak',
    color: 'text-yellow-500',
    bgGradient: 'from-yellow-500/20 to-orange-500/20'
  },
  {
    id: 'streak-14',
    name: 'Fortnight Fighter',
    description: '14 day streak',
    icon: <Star className="h-5 w-5" />,
    requirement: 14,
    type: 'streak',
    color: 'text-emerald-500',
    bgGradient: 'from-emerald-500/20 to-teal-500/20'
  },
  {
    id: 'streak-30',
    name: 'Monthly Master',
    description: '30 day streak',
    icon: <Trophy className="h-5 w-5" />,
    requirement: 30,
    type: 'streak',
    color: 'text-blue-500',
    bgGradient: 'from-blue-500/20 to-cyan-500/20'
  },
  {
    id: 'streak-60',
    name: 'Dedicated Scholar',
    description: '60 day streak',
    icon: <Medal className="h-5 w-5" />,
    requirement: 60,
    type: 'streak',
    color: 'text-purple-500',
    bgGradient: 'from-purple-500/20 to-pink-500/20'
  },
  {
    id: 'streak-100',
    name: 'Century Champion',
    description: '100 day streak',
    icon: <Crown className="h-5 w-5" />,
    requirement: 100,
    type: 'streak',
    color: 'text-amber-500',
    bgGradient: 'from-amber-500/20 to-yellow-500/20'
  },
  // Total completed achievements
  {
    id: 'total-10',
    name: 'First Steps',
    description: '10 items completed',
    icon: <Target className="h-5 w-5" />,
    requirement: 10,
    type: 'total',
    color: 'text-green-500',
    bgGradient: 'from-green-500/20 to-emerald-500/20'
  },
  {
    id: 'total-50',
    name: 'Progressing',
    description: '50 items completed',
    icon: <Award className="h-5 w-5" />,
    requirement: 50,
    type: 'total',
    color: 'text-blue-500',
    bgGradient: 'from-blue-500/20 to-indigo-500/20'
  },
  {
    id: 'total-100',
    name: 'Centurion',
    description: '100 items completed',
    icon: <Rocket className="h-5 w-5" />,
    requirement: 100,
    type: 'total',
    color: 'text-violet-500',
    bgGradient: 'from-violet-500/20 to-purple-500/20'
  },
  {
    id: 'total-250',
    name: 'Knowledge Seeker',
    description: '250 items completed',
    icon: <Star className="h-5 w-5" />,
    requirement: 250,
    type: 'total',
    color: 'text-pink-500',
    bgGradient: 'from-pink-500/20 to-rose-500/20'
  },
  // Active days achievements
  {
    id: 'active-7',
    name: 'Week Active',
    description: '7 active days',
    icon: <Flame className="h-5 w-5" />,
    requirement: 7,
    type: 'activeDays',
    color: 'text-rose-500',
    bgGradient: 'from-rose-500/20 to-pink-500/20'
  },
  {
    id: 'active-30',
    name: 'Month Active',
    description: '30 active days',
    icon: <Trophy className="h-5 w-5" />,
    requirement: 30,
    type: 'activeDays',
    color: 'text-cyan-500',
    bgGradient: 'from-cyan-500/20 to-blue-500/20'
  },
];

export const StreakAchievements: React.FC<StreakAchievementsProps> = ({
  currentStreak,
  totalCompleted,
  activeDays
}) => {
  const { unlockedAchievements, lockedAchievements, nextAchievement } = useMemo(() => {
    const unlocked: (Achievement & { progress: number })[] = [];
    const locked: (Achievement & { progress: number })[] = [];
    let next: (Achievement & { progress: number }) | null = null;

    achievements.forEach(achievement => {
      let currentValue = 0;
      switch (achievement.type) {
        case 'streak':
          currentValue = currentStreak;
          break;
        case 'total':
          currentValue = totalCompleted;
          break;
        case 'activeDays':
          currentValue = activeDays;
          break;
      }

      const progress = Math.min(100, (currentValue / achievement.requirement) * 100);
      const achievementWithProgress = { ...achievement, progress };

      if (currentValue >= achievement.requirement) {
        unlocked.push(achievementWithProgress);
      } else {
        locked.push(achievementWithProgress);
        if (!next || achievement.requirement - currentValue < (next.requirement - getValueForType(next.type))) {
          next = achievementWithProgress;
        }
      }
    });

    function getValueForType(type: string) {
      switch (type) {
        case 'streak': return currentStreak;
        case 'total': return totalCompleted;
        case 'activeDays': return activeDays;
        default: return 0;
      }
    }

    return { 
      unlockedAchievements: unlocked, 
      lockedAchievements: locked.sort((a, b) => b.progress - a.progress),
      nextAchievement: next
    };
  }, [currentStreak, totalCompleted, activeDays]);

  return (
    <Card className="card-gradient border border-border/70 shadow-card">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <Trophy className="h-5 w-5 text-amber-500" />
          Achievements
          <Badge variant="secondary" className="ml-auto">
            {unlockedAchievements.length}/{achievements.length}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Unlocked Achievements */}
        {unlockedAchievements.length > 0 && (
          <div className="space-y-2">
            <p className="text-sm font-medium text-muted-foreground">Unlocked</p>
            <div className="flex flex-wrap gap-2">
              {unlockedAchievements.map(achievement => (
                <div
                  key={achievement.id}
                  className={cn(
                    "flex items-center gap-2 px-3 py-2 rounded-xl bg-gradient-to-r border border-border/50",
                    achievement.bgGradient
                  )}
                  title={achievement.description}
                >
                  <span className={achievement.color}>{achievement.icon}</span>
                  <span className="text-sm font-medium">{achievement.name}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Next Achievement */}
        {nextAchievement && (
          <div className="space-y-2">
            <p className="text-sm font-medium text-muted-foreground">Next Up</p>
            <div className="p-3 rounded-xl bg-muted/50 border border-border/50">
              <div className="flex items-center gap-3">
                <div className={cn("p-2 rounded-lg bg-background", nextAchievement.color)}>
                  {nextAchievement.icon}
                </div>
                <div className="flex-1">
                  <p className="font-medium text-sm">{nextAchievement.name}</p>
                  <p className="text-xs text-muted-foreground">{nextAchievement.description}</p>
                </div>
                <Badge variant="outline">{Math.round(nextAchievement.progress)}%</Badge>
              </div>
              <div className="mt-2 h-1.5 bg-muted rounded-full overflow-hidden">
                <div 
                  className={cn("h-full rounded-full bg-gradient-to-r", nextAchievement.bgGradient.replace('/20', ''))}
                  style={{ width: `${nextAchievement.progress}%` }}
                />
              </div>
            </div>
          </div>
        )}

        {/* Locked Achievements Preview */}
        {lockedAchievements.length > 0 && (
          <div className="space-y-2">
            <p className="text-sm font-medium text-muted-foreground">
              Locked ({lockedAchievements.length} remaining)
            </p>
            <div className="flex flex-wrap gap-2">
              {lockedAchievements.slice(0, 6).map(achievement => (
                <div
                  key={achievement.id}
                  className="flex items-center gap-2 px-3 py-2 rounded-xl bg-muted/30 border border-border/30 opacity-50"
                  title={`${achievement.description} - ${Math.round(achievement.progress)}% complete`}
                >
                  <span className="text-muted-foreground">{achievement.icon}</span>
                  <span className="text-sm text-muted-foreground">{achievement.name}</span>
                </div>
              ))}
              {lockedAchievements.length > 6 && (
                <div className="flex items-center px-3 py-2 text-sm text-muted-foreground">
                  +{lockedAchievements.length - 6} more
                </div>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export const getAchievementsForExport = (currentStreak: number, totalCompleted: number, activeDays: number) => {
  return achievements.map(achievement => {
    let currentValue = 0;
    switch (achievement.type) {
      case 'streak':
        currentValue = currentStreak;
        break;
      case 'total':
        currentValue = totalCompleted;
        break;
      case 'activeDays':
        currentValue = activeDays;
        break;
    }
    
    return {
      name: achievement.name,
      description: achievement.description,
      unlocked: currentValue >= achievement.requirement,
      progress: Math.min(100, (currentValue / achievement.requirement) * 100)
    };
  });
};

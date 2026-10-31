import React from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { PartyPopper, Sparkles, Trophy } from "lucide-react";

export type CelebrationLevel = "topic" | "subject" | "course";

interface CelebrationData {
  level: CelebrationLevel;
  name: string;
}

interface CelebrationDialogProps {
  celebration: CelebrationData | null;
  onClose: () => void;
}

const CONFETTI_COLORS = ["--primary", "--emerald", "--lilac", "--teal"];

export const CelebrationDialog: React.FC<CelebrationDialogProps> = ({ celebration, onClose }) => {
  if (!celebration) return null;

  const isCourse = celebration.level === "course";
  const isSubject = celebration.level === "subject";
  const Icon = isCourse ? Trophy : isSubject ? PartyPopper : Sparkles;
  const title = isCourse ? "Course complete!" : isSubject ? "Subject complete!" : "Topic complete!";
  const message = isCourse
    ? `You finished every topic of “${celebration.name}”. Time to celebrate — on to the next one!`
    : isSubject
    ? `Every topic of “${celebration.name}” is done. Beautiful progress!`
    : `“${celebration.name}” is done. Keep the momentum going!`;

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-xs rounded-2xl border-border/70 p-6 text-center shadow-card sm:max-w-xs">
        <div className="pointer-events-none absolute inset-x-0 top-6 h-24 overflow-hidden" aria-hidden>
          {Array.from({ length: 12 }).map((_, i) => (
            <span
              key={i}
              className="celebration-confetti"
              style={{
                left: `${(i / 12) * 100}%`,
                background: `hsl(var(${CONFETTI_COLORS[i % CONFETTI_COLORS.length]}) / 0.9)`,
                animationDelay: `${(i % 6) * 0.12}s`,
                width: i % 3 === 0 ? "6px" : "4px",
                height: i % 2 === 0 ? "10px" : "6px",
                borderRadius: i % 2 === 0 ? "2px" : "9999px",
              }}
            />
          ))}
        </div>
        <div className="mx-auto mb-3 flex size-14 items-center justify-center rounded-full bg-primary/10">
          <Icon className="size-7 text-primary celebration-pop" />
        </div>
        <DialogTitle className="font-display text-2xl">{title}</DialogTitle>
        <p className="mt-1 text-sm text-muted-foreground">{message}</p>
        <Button onClick={onClose} className="mt-4 w-full">
          Keep going
        </Button>
      </DialogContent>
    </Dialog>
  );
};

import { useEffect, useState } from "react";
import { differenceInCalendarDays, format, parseISO } from "date-fns";
import { CalendarClock, Plus, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

type Countdown = { id: string; title: string; target_date: string; note: string | null };

export default function CountdownTimers() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [items, setItems] = useState<Countdown[]>([]);
  const [title, setTitle] = useState("");
  const [date, setDate] = useState("");
  const [note, setNote] = useState("");
  const [open, setOpen] = useState(false);

  const load = async () => {
    const { data } = await (supabase as any).from("countdowns").select("id,title,target_date,note").order("target_date");
    setItems(data ?? []);
  };
  useEffect(() => { if (user) load(); }, [user]);

  const add = async () => {
    if (!user || !title.trim() || !date) {
      toast({ title: "Add a name and a date", variant: "destructive" });
      return;
    }
    const { error } = await (supabase as any).from("countdowns").insert({
      user_id: user.id, title: title.trim().slice(0, 100), target_date: date, note: note.trim().slice(0, 300) || null,
    });
    if (error) return toast({ title: "Could not save countdown", variant: "destructive" });
    setTitle(""); setDate(""); setNote(""); setOpen(false); load();
  };

  const remove = async (id: string) => {
    await (supabase as any).from("countdowns").delete().eq("id", id);
    setItems((p) => p.filter((i) => i.id !== id));
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-2 space-y-0">
        <div>
          <CardTitle className="flex items-center gap-2"><CalendarClock className="h-5 w-5 text-primary" />Countdowns</CardTitle>
          <CardDescription>Exams or any date that matters to you</CardDescription>
        </div>
        <Button size="sm" variant="outline" onClick={() => setOpen((o) => !o)}><Plus className="h-4 w-4" />Add</Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {open && (
          <div className="grid gap-2 rounded-md border p-3 sm:grid-cols-[1fr_auto]">
            <Input placeholder="What is it? (e.g. Final exam)" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={100} />
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            <Input className="sm:col-span-2" placeholder="Why this date? (optional)" value={note} onChange={(e) => setNote(e.target.value)} maxLength={300} />
            <Button className="sm:col-span-2" onClick={add}>Save countdown</Button>
          </div>
        )}
        {items.length === 0 && !open && <p className="text-sm text-muted-foreground">No countdowns yet. Add one to start counting down.</p>}
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {items.map((c) => {
            const days = differenceInCalendarDays(parseISO(c.target_date), new Date());
            return (
              <div key={c.id} className="group relative rounded-lg bg-muted/60 p-4">
                <button aria-label="Delete countdown" onClick={() => remove(c.id)} className="absolute right-2 top-2 text-muted-foreground opacity-60 hover:opacity-100"><Trash2 className="h-4 w-4" /></button>
                <p className="font-display text-4xl text-primary">{days > 0 ? days : days === 0 ? "Today" : "Done"}</p>
                {days > 0 && <p className="text-xs text-muted-foreground">day{days === 1 ? "" : "s"} to go</p>}
                <p className="mt-2 font-semibold">{c.title}</p>
                <p className="text-xs text-muted-foreground">{format(parseISO(c.target_date), "d MMM yyyy")}</p>
                {c.note && <p className="mt-1 text-sm text-muted-foreground">{c.note}</p>}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

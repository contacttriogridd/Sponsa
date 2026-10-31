'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Bell, Gift, HandHeart, Users, CalendarDays, ArrowRight, Phone, MessageCircle, CheckCircle2, TrendingUp } from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { StatCard } from '@/components/shared/StatCard';
import { LoadingSkeleton } from '@/components/shared/LoadingSkeleton';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/lib/supabase/client';
import type { Donation, Sponsor, SpecialOccasion, SponsorshipRequest, Task } from '@/lib/types';
import { formatCurrency, formatDateShort, OCCASION_ICONS, normalizeDonationType } from '@/lib/constants';
import { occasionHeadline, occasionRelation } from '@/lib/occasion-text';
import { StarDaysThisWeekCard } from '@/components/monthly/StarDaysThisWeekCard';
import { openSponsorDrawer } from '@/lib/drawer-store';
import { TodayReminders } from '@/components/dashboard/TodayReminders';
import { UpcomingPastCards } from '@/components/dashboard/UpcomingPastCards';
import { loadReminderData, useLiveRefresh, type ReminderData } from '@/lib/today-reminders-store';

const todayLabel = () => new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Kolkata' });

export default function DashboardPage() {
  const [sponsors, setSponsors] = useState<Sponsor[]>([]); const [occasions, setOccasions] = useState<SpecialOccasion[]>([]); const [donations, setDonations] = useState<Donation[]>([]); const [requests, setRequests] = useState<SponsorshipRequest[]>([]); const [tasks, setTasks] = useState<Task[]>([]); const [loading, setLoading] = useState(true);
  const [reminders, setReminders] = useState<ReminderData | null>(null);
  const load = useCallback(async()=>{ const [s,o,d,r,t]=await Promise.all([supabase.from('sponsors').select('*').eq('status','active'),supabase.from('special_occasions').select('*').eq('active',true),supabase.from('donations').select('*').order('donation_date',{ascending:false}).limit(5),supabase.from('sponsorship_requests').select('*').in('status',['pending','contacted','interested']),supabase.from('tasks').select('*').neq('status','Completed').order('due_date')]); setSponsors((s.data||[]) as Sponsor[]);setOccasions((o.data||[]) as SpecialOccasion[]);setDonations((d.data||[]) as Donation[]);setRequests((r.data||[]) as SponsorshipRequest[]);setTasks((t.data||[]) as Task[]);setLoading(false); setReminders(await loadReminderData(true)); },[]);
  useEffect(() => { load(); }, [load]);
  useLiveRefresh(load);
  const sponsorById = useMemo(()=>new Map(sponsors.map(x=>[x.id,x])),[sponsors]);
  const thisWeekCount = useMemo(()=>new Set((reminders?.items||[]).filter(i=>i.group==='today'||(i.group==='upcoming'&&i.days<=7)).map(i=>i.key.replace('#next',''))).size,[reminders]); const totalDonations=donations.reduce((a,d)=>a+Number(d.amount||0),0); const people=donations.reduce((a,d)=>a+Number(d.people_helped||0),0);
  if (loading) return <AppLayout><LoadingSkeleton variant="grid" className="mb-6" /><LoadingSkeleton /></AppLayout>;
  return <AppLayout><div className="space-y-6"><div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3"><div><p className="text-sm text-muted-foreground">{todayLabel()}</p><h1 className="text-2xl lg:text-3xl font-semibold mt-1">Good morning<span className="text-primary">.</span></h1><p className="text-muted-foreground mt-1">Here is what needs your attention today.</p></div><Link href="/sponsors/new"><Button><Users className="h-4 w-4 mr-2" />Add Sponsor</Button></Link></div>
  <TodayReminders data={reminders} onChanged={load} />
  <div className="grid grid-cols-2 xl:grid-cols-5 gap-3 lg:gap-4"><StatCard label="Total Sponsors" value={sponsors.length} icon={Users} iconColor="text-primary" /><StatCard label="Special Days This Week" value={thisWeekCount} icon={CalendarDays} iconColor="text-warning" /><StatCard label="Pending Follow-ups" value={tasks.length} icon={Bell} iconColor="text-destructive" /><StatCard label="Monthly Donations" value={formatCurrency(totalDonations)} icon={Gift} iconColor="text-success" /><StatCard label="People Helped" value={people} icon={HandHeart} iconColor="text-primary" /></div>
  <div className="grid xl:grid-cols-[1.35fr_1fr] gap-6"><UpcomingPastCards items={reminders?.items||[]} />
  <div className="space-y-6"><Card className="p-5"><div className="flex items-center justify-between mb-4"><h2 className="font-semibold">Follow-ups</h2><Link href="/sponsorships" className="text-sm text-primary">View all</Link></div><div className="space-y-3">{tasks.slice(0,3).map(task=><div key={task.id} className="flex items-start gap-3"><div className="mt-1 h-2 w-2 rounded-full bg-warning" /><div className="flex-1"><div className="text-sm font-medium">{task.title}</div><div className="text-xs text-muted-foreground">Due {task.due_date?formatDateShort(task.due_date):'soon'}{sponsorById.get(task.sponsor_id)&&<> · <button type="button" className="text-primary hover:underline" onClick={()=>openSponsorDrawer(task.sponsor_id)}>{sponsorById.get(task.sponsor_id)!.full_name}</button></>}</div></div><Badge variant="outline" className="text-xs">{task.status}</Badge></div>)}{tasks.length===0&&<p className="text-sm text-muted-foreground">No pending follow-ups.</p>}</div></Card><Card className="p-5"><div className="flex items-center justify-between mb-4"><h2 className="font-semibold">Recent donations</h2><Link href="/donations" className="text-sm text-primary">View all</Link></div><div className="space-y-3">{donations.slice(0,3).map(d=><div key={d.id} className="flex items-center gap-3"><div className="h-8 w-8 rounded-lg bg-success/10 flex items-center justify-center"><TrendingUp className="h-4 w-4 text-success" /></div><div className="flex-1"><div className="text-sm font-medium">{d.occasion_name||`${normalizeDonationType(d.type)} donation`}</div><div className="text-xs text-muted-foreground">{formatDateShort(d.donation_date)}{sponsorById.get(d.sponsor_id)&&<> · <button type="button" className="text-primary hover:underline" onClick={()=>openSponsorDrawer(d.sponsor_id)}>{sponsorById.get(d.sponsor_id)!.full_name}</button></>}</div></div><div className="font-semibold text-sm">{formatCurrency(Number(d.amount))}</div></div>)}</div></Card></div></div><StarDaysThisWeekCard /></div></AppLayout>;
}

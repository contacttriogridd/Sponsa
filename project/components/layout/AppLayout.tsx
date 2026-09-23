'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  LayoutDashboard, Users, Calendar, Bell, HandHeart, Gift,
  BarChart3, Settings, Menu, Search, Plus, LogOut, ChevronLeft,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/lib/auth-context';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import {
  Sheet, SheetContent, SheetTrigger, SheetTitle, SheetHeader,
} from '@/components/ui/sheet';
import { NotificationBell } from '@/components/shared/NotificationBell';
import { runReminderEngineOncePerDay } from '@/lib/reminder-engine';

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  LayoutDashboard, Users, Calendar, Bell, HandHeart, Gift, BarChart3, Settings,
};

const NAV_ITEMS = [
  { label: 'Dashboard', href: '/dashboard', icon: 'LayoutDashboard' },
  { label: 'Sponsors', href: '/sponsors', icon: 'Users' },
  { label: 'Calendar', href: '/calendar', icon: 'Calendar' },
  { label: 'Reminders', href: '/reminders', icon: 'Bell' },
  { label: 'Sponsorships', href: '/sponsorships', icon: 'HandHeart' },
  { label: 'Donations', href: '/donations', icon: 'Gift' },
  { label: 'Reports', href: '/reports', icon: 'BarChart3' },
  { label: 'Notifications', href: '/notifications', icon: 'Bell' },
  { label: 'Settings', href: '/settings', icon: 'Settings' },
];

const MOBILE_NAV = [
  { label: 'Home', href: '/dashboard', icon: LayoutDashboard },
  { label: 'Sponsors', href: '/sponsors', icon: Users },
  { label: 'Calendar', href: '/calendar', icon: Calendar },
  { label: 'Reminders', href: '/reminders', icon: Bell },
  { label: 'More', href: '/settings', icon: Menu },
];

export function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { appUser, signOut, loading } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    if (!loading && !appUser) {
      router.replace('/login');
    }
  }, [loading, appUser, router]);

  useEffect(() => {
    if (appUser) runReminderEngineOncePerDay(appUser.id);
  }, [appUser]);

  if (loading || !appUser) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  const initials = (appUser.full_name || appUser.email || '?')
    .split(' ')
    .map((s) => s[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  const SidebarContent = (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 px-6 py-5 border-b border-border">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground font-bold text-lg">
          S
        </div>
        <div>
          <div className="font-semibold text-sm">VP Trust</div>
          <div className="text-xs text-muted-foreground">Sponsor Management</div>
        </div>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto scrollbar-thin">
        {NAV_ITEMS.map((item) => {
          const Icon = ICON_MAP[item.icon] || LayoutDashboard;
          const active = pathname === item.href || pathname.startsWith(item.href + '/');
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setMobileOpen(false)}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                active
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground'
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-border p-4">
        <div className="flex items-center gap-3 mb-3">
          <Avatar className="h-9 w-9">
            <AvatarFallback className="bg-primary/10 text-primary text-sm font-medium">
              {initials}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium truncate">{appUser.full_name || appUser.email}</div>
            <div className="text-xs text-muted-foreground capitalize">{appUser.role}</div>
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start text-muted-foreground"
          onClick={() => signOut()}
        >
          <LogOut className="h-4 w-4 mr-2" />
          Sign Out
        </Button>
      </div>
    </div>
  );

  return (
    <div className="flex h-screen bg-background">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex w-64 shrink-0 bg-card border-r border-border">
        {SidebarContent}
      </aside>

      {/* Mobile Sidebar */}
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className="w-72 p-0">
          <SheetHeader className="sr-only">
            <SheetTitle>Navigation Menu</SheetTitle>
          </SheetHeader>
          {SidebarContent}
        </SheetContent>
      </Sheet>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Topbar */}
        <header className="h-16 border-b border-border bg-card/80 backdrop-blur-sm flex items-center justify-between px-4 lg:px-6 shrink-0">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden"
              onClick={() => setMobileOpen(true)}
            >
              <Menu className="h-5 w-5" />
            </Button>
            <Link href="/sponsors/new" className="hidden sm:block">
              <Button size="sm">
                <Plus className="h-4 w-4 mr-1.5" />
                Add Sponsor
              </Button>
            </Link>
          </div>

          <div className="flex items-center gap-2">
            <div className="relative hidden md:block">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search sponsors..."
                className="pl-9 w-64"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    const value = (e.target as HTMLInputElement).value;
                    router.push(`/sponsors?q=${encodeURIComponent(value)}`);
                  }
                }}
              />
            </div>
            <NotificationBell />
            <Link href="/sponsors/new" className="sm:hidden">
              <Button size="icon" variant="ghost">
                <Plus className="h-5 w-5" />
              </Button>
            </Link>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto scrollbar-thin pb-20 lg:pb-0">
          <div className="p-4 lg:p-6 max-w-7xl mx-auto animate-fade-in">
            {children}
          </div>
        </main>

        {/* Mobile Bottom Nav */}
        <nav className="lg:hidden fixed bottom-0 left-0 right-0 h-16 bg-card border-t border-border flex items-center justify-around px-2 z-50">
          {MOBILE_NAV.map((item) => {
            const active = pathname === item.href || pathname.startsWith(item.href + '/');
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex flex-col items-center justify-center gap-0.5 px-3 py-1.5 rounded-lg transition-colors',
                  active ? 'text-primary' : 'text-muted-foreground'
                )}
              >
                <item.icon className="h-5 w-5" />
                <span className="text-xs font-medium">{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
}

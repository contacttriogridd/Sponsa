'use client';

import { useEffect, useState } from 'react';
import { ArrowLeft, Plus, Edit, Save, X, UserRound } from 'lucide-react';
import Link from 'next/link';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/lib/auth-context';
import type { AppUser, UserRole } from '@/lib/types';

const ROLES: UserRole[] = ['admin', 'collector', 'staff', 'viewer'];

export default function UsersPage() {
  const { appUser } = useAuth();
  const [users, setUsers] = useState<AppUser[]>([]);
  const [editing, setEditing] = useState<AppUser | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ full_name: '', email: '', role: 'collector' as UserRole, active: true, phone: '' });
  const [busy, setBusy] = useState(false);

  const load = async () => {
    const { data } = await supabase.from('app_users').select('*').order('full_name');
    setUsers((data || []) as AppUser[]);
  };

  useEffect(() => { load(); }, []);

  function openEdit(u: AppUser) {
    setEditing(u);
    setForm({ full_name: u.full_name || '', email: u.email, role: u.role, active: u.active, phone: u.phone || '' });
    setShowForm(true);
  }

  async function save() {
    if (!editing) return;
    setBusy(true);
    await supabase.from('app_users').update({
      full_name: form.full_name || null,
      role: form.role,
      active: form.active,
      phone: form.phone || null,
    }).eq('id', editing.id);
    setBusy(false);
    setShowForm(false);
    load();
  }

  const set = (key: string, value: string | boolean) => setForm((f) => ({ ...f, [key]: value }));

  const roleColor: Record<string, string> = {
    admin: 'bg-primary/10 text-primary',
    collector: 'bg-success/10 text-success',
    staff: 'bg-warning/10 text-warning',
    viewer: 'bg-muted text-muted-foreground',
  };

  return (
    <AppLayout>
      <div className="max-w-2xl space-y-5">
        <Link href="/settings" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Settings
        </Link>

        <div>
          <p className="text-sm text-muted-foreground">Settings</p>
          <h1 className="text-2xl font-semibold mt-1">User Management</h1>
          <p className="text-sm text-muted-foreground mt-1">Manage team members and their access levels.</p>
        </div>

        <Card className="p-4 bg-muted/50">
          <p className="text-sm text-muted-foreground">
            New users are created when they sign up. Use this page to update roles and deactivate accounts.
          </p>
        </Card>

        <div className="grid gap-3">
          {users.map((u) => (
            <Card key={u.id} className="p-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold text-sm">
                  {(u.full_name || u.email || '?').split(' ').map((x) => x[0]).slice(0, 2).join('').toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium">{u.full_name || u.email}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize ${roleColor[u.role] || roleColor.viewer}`}>
                      {u.role}
                    </span>
                    {!u.active && <Badge variant="secondary" className="text-xs">Inactive</Badge>}
                    {u.id === appUser?.id && <Badge variant="outline" className="text-xs">You</Badge>}
                  </div>
                  <div className="text-sm text-muted-foreground">{u.email}</div>
                </div>
                {appUser?.role === 'admin' && u.id !== appUser?.id && (
                  <Button variant="ghost" size="icon" onClick={() => openEdit(u)}>
                    <Edit className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </Card>
          ))}
          {users.length === 0 && (
            <Card className="py-10 text-center">
              <UserRound className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">No users found.</p>
            </Card>
          )}
        </div>

        <Dialog open={showForm} onOpenChange={(o) => !o && setShowForm(false)}>
          <DialogContent>
            <DialogHeader><DialogTitle>Edit User</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label>Full Name</Label>
                <Input value={form.full_name} onChange={(e) => set('full_name', e.target.value)} placeholder="Full name" />
              </div>
              <div className="space-y-1.5">
                <Label>Email</Label>
                <Input value={form.email} disabled className="bg-muted" />
              </div>
              <div className="space-y-1.5">
                <Label>Phone</Label>
                <Input value={form.phone} onChange={(e) => set('phone', e.target.value)} placeholder="+91 98765 43210" />
              </div>
              <div className="space-y-1.5">
                <Label>Role</Label>
                <Select value={form.role} onValueChange={(v) => set('role', v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {ROLES.map((r) => <SelectItem key={r} value={r} className="capitalize">{r}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-2">
                <Switch id="active" checked={form.active} onCheckedChange={(v) => set('active', v)} />
                <Label htmlFor="active" className="cursor-pointer">Account active</Label>
              </div>
              <div className="flex gap-3">
                <Button onClick={save} disabled={busy}>
                  <Save className="h-4 w-4 mr-2" />{busy ? 'Saving...' : 'Save Changes'}
                </Button>
                <Button variant="outline" onClick={() => setShowForm(false)}><X className="h-4 w-4 mr-2" />Cancel</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}

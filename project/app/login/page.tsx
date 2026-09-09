'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Heart, Mail, Lock, User, ArrowRight } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';

export default function LoginPage() {
  const router = useRouter();
  const { user, signIn, signUp, loading } = useAuth();
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => { if (!loading && user) router.replace('/dashboard'); }, [loading, user, router]);

  async function submit(event: FormEvent) {
    event.preventDefault(); setError(''); setBusy(true);
    const result = mode === 'login' ? await signIn(email, password) : await signUp(email, password, name);
    if (result.error) { setBusy(false); setError(result.error); return; }
    if (mode === 'signup') { setBusy(false); setMode('login'); return; }
    // Login succeeded: stay in the "please wait" state and let the effect above
    // redirect once appUser has actually loaded, so /dashboard never has to
    // render its own loading screen (avoids a flash between the two screens).
  }

  return (
    <main className="min-h-screen bg-[#f8f7f4] flex items-center justify-center p-4">
      <div className="w-full max-w-5xl grid lg:grid-cols-2 bg-white rounded-3xl shadow-xl overflow-hidden border border-border">
        <div className="hidden lg:flex bg-[#25263a] text-white p-12 flex-col justify-between min-h-[640px]">
          <div><div className="flex items-center gap-3"><div className="h-11 w-11 rounded-xl bg-primary flex items-center justify-center font-bold text-xl">S</div><span className="font-semibold text-lg">Sponsa</span></div>
          <div className="mt-24"><p className="text-primary-foreground/60 text-sm mb-4">Every occasion can create an impact.</p><h1 className="text-4xl font-semibold leading-tight">Make every<br /><span className="text-primary">kindness count.</span></h1><p className="mt-6 text-white/60 leading-relaxed max-w-sm">A calmer way to nurture sponsor relationships, remember important moments, and turn celebrations into nourishment.</p></div></div>
          <p className="text-white/40 text-sm">Built for people who care deeply.</p>
        </div>
        <div className="p-8 sm:p-12 flex items-center"><div className="w-full max-w-md mx-auto">
          <div className="lg:hidden flex items-center gap-3 mb-10"><div className="h-10 w-10 rounded-xl bg-primary text-white flex items-center justify-center font-bold">S</div><span className="font-semibold text-lg">Sponsa</span></div>
          <div className="mb-8"><div className="h-12 w-12 rounded-2xl bg-primary/10 flex items-center justify-center mb-5"><Heart className="h-6 w-6 text-primary" /></div><h2 className="text-2xl font-semibold">{mode === 'login' ? 'Welcome back' : 'Create your account'}</h2><p className="text-muted-foreground mt-2">{mode === 'login' ? 'Sign in to continue your work.' : 'Start managing meaningful connections.'}</p></div>
          <form onSubmit={submit} className="space-y-5">
            {mode === 'signup' && <div><Label>Full name</Label><div className="relative mt-2"><User className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" /><Input required value={name} onChange={e=>setName(e.target.value)} className="pl-9" placeholder="Your name" /></div></div>}
            <div><Label>Email</Label><div className="relative mt-2"><Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" /><Input required type="email" value={email} onChange={e=>setEmail(e.target.value)} className="pl-9" placeholder="you@example.com" /></div></div>
            <div><Label>Password</Label><div className="relative mt-2"><Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" /><Input required minLength={6} type="password" value={password} onChange={e=>setPassword(e.target.value)} className="pl-9" placeholder="••••••••" /></div></div>
            {error && <p className="text-sm text-destructive bg-destructive/10 rounded-lg px-3 py-2">{error}</p>}
            <Button disabled={busy} className="w-full h-11">{busy ? 'Please wait...' : mode === 'login' ? 'Sign in' : 'Create account'} {!busy && <ArrowRight className="h-4 w-4 ml-2" />}</Button>
          </form>
          <button onClick={()=>{setMode(mode==='login'?'signup':'login');setError('')}} className="mt-6 text-sm text-muted-foreground hover:text-primary w-full text-center">{mode==='login' ? 'New to Sponsa? Create an account' : 'Already have an account? Sign in'}</button>
        </div></div>
      </div>
    </main>
  );
}

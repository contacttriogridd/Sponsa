'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
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
    <main className="relative min-h-screen flex overflow-x-hidden overflow-y-auto p-4 py-10 sm:p-8">
      {/* Full-bleed background photo */}
      <div className="fixed inset-0 -z-10">
        <Image
          src="https://images.unsplash.com/photo-1710092784814-4a6f158913b8?w=1920&q=80&auto=format&fit=crop&crop=faces"
          alt="A woman smiling as she receives a plate of food from a volunteer's outstretched hand"
          fill
          priority
          sizes="100vw"
          className="object-cover"
        />
        {/* Deep, neutral tint so the photo's colors don't bleed into the glass card, while the scene underneath still reads clearly */}
        <div className="absolute inset-0 bg-[#0d0e1a]/70" />
        {/* Extra depth toward the edges so the centered card always has contrast behind it */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_0%,rgba(13,14,26,0.6)_100%)]" />
      </div>

      {/* Brand mark: fixed top-left on large screens, where the layout never scrolls.
          Below that, it's rendered in normal flow (inside the centered column further down)
          so it scrolls with the page instead of sitting fixed on top of content that scrolls under it. */}
      <div className="hidden lg:flex fixed top-8 left-8 z-10 items-center gap-3 text-white">
        <div className="h-10 w-10 rounded-xl bg-primary flex items-center justify-center font-bold text-lg shadow-lg shadow-black/30">S</div>
        <span className="font-semibold text-lg tracking-tight drop-shadow-sm">Sponsa</span>
      </div>

      {/* Centered content: stacks (brand, story, card) on mobile, sits side-by-side on large screens.
          Uses margin-auto rather than justify-center so tall content on short viewports can still
          scroll to its full top/bottom, avoiding the flexbox centered-overflow clipping bug. */}
      <div className="relative z-10 m-auto w-full max-w-5xl flex flex-col lg:flex-row lg:items-center justify-center gap-8 sm:gap-10 lg:gap-16">
        {/* Story copy: same content everywhere, just scaled and re-aligned per breakpoint */}
        <div className="w-full lg:max-w-sm text-center lg:text-left text-white">
          <div className="flex lg:hidden items-center justify-center gap-3 text-white mb-5">
            <div className="h-9 w-9 rounded-xl bg-primary flex items-center justify-center font-bold text-base shadow-lg shadow-black/30">S</div>
            <span className="font-semibold text-base tracking-tight drop-shadow-sm">Sponsa</span>
          </div>
          <span className="inline-block text-[10px] sm:text-xs font-medium tracking-wide uppercase text-white/80 bg-white/10 backdrop-blur-md border border-white/15 rounded-full px-2.5 py-1 sm:px-3 mb-3 sm:mb-4">Every occasion can create an impact</span>
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-semibold leading-tight drop-shadow-sm">Make every <span className="text-primary">kindness count.</span></h1>
          <p className="mt-3 text-white/70 leading-relaxed text-sm sm:text-base max-w-sm mx-auto lg:mx-0">A calmer way to nurture sponsor relationships, remember important moments, and turn celebrations into nourishment.</p>
          <p className="mt-4 lg:mt-6 text-white/40 text-xs">Built for people who care deeply.</p>
        </div>

        {/* Premium glass card */}
        <div className="w-full max-w-md shrink-0">
          <div className="rounded-3xl border border-white/15 bg-black/30 backdrop-blur-2xl shadow-2xl shadow-black/50 p-6 sm:p-8 lg:p-10">
            <div className="mb-6 sm:mb-8">
              <div className="h-10 w-10 sm:h-12 sm:w-12 rounded-2xl bg-white/10 border border-white/15 flex items-center justify-center mb-4 sm:mb-5"><Heart className="h-5 w-5 sm:h-6 sm:w-6 text-primary" /></div>
              <h2 className="text-xl sm:text-2xl font-semibold text-white">{mode === 'login' ? 'Welcome back' : 'Create your account'}</h2>
              <p className="text-white/60 mt-2 text-sm sm:text-base">{mode === 'login' ? 'Sign in to continue your work.' : 'Start managing meaningful connections.'}</p>
            </div>
            <form onSubmit={submit} className="space-y-4 sm:space-y-5">
              {mode === 'signup' && <div><Label className="text-white/80">Full name</Label><div className="relative mt-2"><User className="absolute left-3 top-3 h-4 w-4 text-white/50" /><Input required value={name} onChange={e=>setName(e.target.value)} className="pl-9 bg-white/10 border-white/20 text-white placeholder:text-white/40 ring-offset-transparent focus-visible:ring-white/40 focus-visible:border-white/40" placeholder="Your name" /></div></div>}
              <div><Label className="text-white/80">Email</Label><div className="relative mt-2"><Mail className="absolute left-3 top-3 h-4 w-4 text-white/50" /><Input required type="email" value={email} onChange={e=>setEmail(e.target.value)} className="pl-9 bg-white/10 border-white/20 text-white placeholder:text-white/40 ring-offset-transparent focus-visible:ring-white/40 focus-visible:border-white/40" placeholder="you@example.com" /></div></div>
              <div><Label className="text-white/80">Password</Label><div className="relative mt-2"><Lock className="absolute left-3 top-3 h-4 w-4 text-white/50" /><Input required minLength={6} type="password" value={password} onChange={e=>setPassword(e.target.value)} className="pl-9 bg-white/10 border-white/20 text-white placeholder:text-white/40 ring-offset-transparent focus-visible:ring-white/40 focus-visible:border-white/40" placeholder="••••••••" /></div></div>
              {error && <p className="text-sm text-red-200 bg-red-500/15 border border-red-400/20 rounded-lg px-3 py-2">{error}</p>}
              <Button disabled={busy} className="w-full h-11 shadow-lg shadow-primary/30">{busy ? 'Please wait...' : mode === 'login' ? 'Sign in' : 'Create account'} {!busy && <ArrowRight className="h-4 w-4 ml-2" />}</Button>
            </form>
            <button onClick={()=>{setMode(mode==='login'?'signup':'login');setError('')}} className="mt-6 text-sm text-white/60 hover:text-white w-full text-center transition-colors">{mode==='login' ? 'New to Sponsa? Create an account' : 'Already have an account? Sign in'}</button>
          </div>
        </div>
      </div>
    </main>
  );
}

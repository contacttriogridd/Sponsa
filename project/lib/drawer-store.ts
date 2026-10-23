'use client';

import { useEffect, useSyncExternalStore } from 'react';

/**
 * Which detail drawer is open. Kept outside React so any page or component
 * can open a drawer (pages render <AppLayout>, which hosts the drawers, as
 * their child). Mirrored in the URL as ?sponsor=<id>[&occasion=<id>] or
 * ?monthly=<id>, so a notification or shared link can open it directly.
 */
export type DrawerState =
  | { kind: 'sponsor'; id: string; occasionId?: string }
  | { kind: 'monthly'; id: string }
  | null;

let state: DrawerState = null;
const listeners = new Set<() => void>();
const changeListeners = new Set<() => void>();

const PARAMS = ['sponsor', 'occasion', 'monthly'];

function writeUrl(next: DrawerState) {
  const url = new URL(window.location.href);
  PARAMS.forEach((p) => url.searchParams.delete(p));
  if (next?.kind === 'sponsor') {
    url.searchParams.set('sponsor', next.id);
    if (next.occasionId) url.searchParams.set('occasion', next.occasionId);
  } else if (next?.kind === 'monthly') {
    url.searchParams.set('monthly', next.id);
  }
  // Keep Next.js's history state so back/forward still work.
  window.history.replaceState(window.history.state, '', url);
}

function set(next: DrawerState, syncUrl = true) {
  state = next;
  if (syncUrl && typeof window !== 'undefined') writeUrl(next);
  listeners.forEach((l) => l());
}

export function openSponsorDrawer(id: string, options?: { occasionId?: string }) {
  set({ kind: 'sponsor', id, occasionId: options?.occasionId });
}

export function openMonthlySponsorDrawer(id: string) {
  set({ kind: 'monthly', id });
}

export function closeDrawer() {
  set(null);
}

/** Matches the drawer to the current URL (deep links, and closing it after navigating away). */
export function syncDrawerFromUrl() {
  const params = new URLSearchParams(window.location.search);
  const sponsor = params.get('sponsor');
  const monthly = params.get('monthly');
  if (sponsor) set({ kind: 'sponsor', id: sponsor, occasionId: params.get('occasion') || undefined }, false);
  else if (monthly) set({ kind: 'monthly', id: monthly }, false);
  else if (state) set(null, false);
}

export function useDrawerState(): DrawerState {
  return useSyncExternalStore(
    (l) => { listeners.add(l); return () => listeners.delete(l); },
    () => state,
    () => null,
  );
}

/** Drawers call this after saving, so the page behind can reload its data. */
export function notifyDrawerDataChanged() {
  changeListeners.forEach((l) => l());
}

export function useDrawerDataChanged(callback: () => void) {
  useEffect(() => {
    changeListeners.add(callback);
    return () => { changeListeners.delete(callback); };
  }, [callback]);
}

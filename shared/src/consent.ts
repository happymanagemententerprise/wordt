/**
 * Default-deny consent gate for third-party scripts.
 *
 * Nothing is loaded from a third party until the player explicitly accepts.
 * Register anything optional (analytics, tracking pixels, embeds) with
 * {@link loadConsentedScript}: it injects immediately for players who already
 * accepted, and otherwise queues until they do. Players who decline never have
 * it loaded. The banner shown by each client only appears while a decision is
 * pending *and* at least one script is waiting, so it is invisible until a
 * consent-needing script is actually registered.
 *
 * This module is framework-agnostic and safe to import on the server (all DOM
 * access is guarded), so it can live in `@wordt/shared`.
 */

export const CONSENT_STORAGE_KEY = 'wordt.consent';

export type ConsentDecision = 'granted' | 'denied';

export interface ConsentedScript {
  /** Stable id so the same script is never queued twice. */
  id: string;
  src: string;
  /** Extra attributes for the injected <script> (nonce, data-*, …). */
  attributes?: Record<string, string>;
  onload?: () => void;
  onerror?: () => void;
}

type Listener = () => void;
type Loader = () => void;

const loaders = new Map<string, Loader>();
const listeners = new Set<Listener>();

function storage(): Storage | null {
  try {
    return typeof window !== 'undefined' && window.localStorage ? window.localStorage : null;
  } catch {
    // Private mode can throw on access.
    return null;
  }
}

function readDecision(): ConsentDecision | null {
  const store = storage();
  if (!store) return null;
  try {
    const raw = store.getItem(CONSENT_STORAGE_KEY);
    return raw === 'granted' || raw === 'denied' ? raw : null;
  } catch {
    return null;
  }
}

let decision: ConsentDecision | null = readDecision();

function notify(): void {
  for (const listener of listeners) listener();
}

function flush(): void {
  for (const loader of loaders.values()) loader();
  loaders.clear();
}

/** The stored decision, or `null` while the player has not chosen yet. */
export function getConsent(): ConsentDecision | null {
  return decision;
}

export function hasConsent(): boolean {
  return decision === 'granted';
}

/** Record the player's choice and act on it: accept loads the queued scripts. */
export function setConsent(next: ConsentDecision): void {
  decision = next;
  const store = storage();
  if (store) {
    try {
      store.setItem(CONSENT_STORAGE_KEY, next);
    } catch {
      // Not persisting is acceptable; the choice still holds for this session.
    }
  }
  if (next === 'granted') flush();
  else loaders.clear();
  notify();
}

/** Forget the decision (used by "change my choice" affordances and tests). */
export function resetConsent(): void {
  decision = null;
  const store = storage();
  if (store) {
    try {
      store.removeItem(CONSENT_STORAGE_KEY);
    } catch {
      /* ignore */
    }
  }
  notify();
}

/** Subscribe to register/decision changes. Returns an unsubscribe function. */
export function subscribeConsent(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Whether the banner should be visible: undecided and something is waiting. */
export function isConsentPending(): boolean {
  return decision === null && loaders.size > 0;
}

/** How many scripts are waiting on the player's decision. */
export function pendingConsentCount(): number {
  return decision === null ? loaders.size : 0;
}

/**
 * Register a third-party script under the consent gate. Safe to call for every
 * player: it only ever loads after an explicit accept.
 */
export function loadConsentedScript(options: ConsentedScript): void {
  if (typeof document === 'undefined') return;
  if (decision === 'denied') return;
  if (decision === 'granted') {
    inject(options);
    return;
  }
  if (loaders.has(options.id)) return;
  loaders.set(options.id, () => inject(options));
  notify();
}

function injected(src: string): boolean {
  return typeof document !== 'undefined' && !!document.querySelector(`script[data-consent-src="${escapeAttribute(src)}"]`);
}

function inject(options: ConsentedScript): void {
  if (typeof document === 'undefined' || injected(options.src)) return;
  const element = document.createElement('script');
  element.src = options.src;
  element.async = true;
  element.dataset.consentSrc = options.src;
  if (options.attributes) {
    for (const [name, value] of Object.entries(options.attributes)) element.setAttribute(name, value);
  }
  if (options.onload) element.addEventListener('load', options.onload);
  if (options.onerror) element.addEventListener('error', options.onerror);
  document.head.appendChild(element);
}

function escapeAttribute(value: string): string {
  return value.replace(/["\\]/g, '\\$&');
}

import { afterEach, describe, expect, it, vi } from 'vitest';

interface ScriptElement {
  src: string;
  async: boolean;
  dataset: Record<string, string>;
  addEventListener: (type: string, listener: () => void) => void;
  setAttribute: (name: string, value: string) => void;
}

interface FakeDom {
  appended: ScriptElement[];
  store: Map<string, string>;
}

function installDom(): FakeDom {
  const store = new Map<string, string>();
  const appended: ScriptElement[] = [];

  const document = {
    head: {
      appendChild: (element: ScriptElement) => {
        appended.push(element);
        return element;
      },
    },
    createElement: (): ScriptElement => ({
      src: '',
      async: false,
      dataset: {},
      addEventListener: () => {},
      setAttribute: () => {},
    }),
    querySelector: () => null,
  };

  const window = {
    localStorage: {
      getItem: (key: string) => (store.has(key) ? (store.get(key) as string) : null),
      setItem: (key: string, value: string) => {
        store.set(key, value);
      },
      removeItem: (key: string) => {
        store.delete(key);
      },
    },
  };

  vi.stubGlobal('document', document);
  vi.stubGlobal('window', window);
  return { appended, store };
}

async function load(): Promise<typeof import('../src/consent')> {
  vi.resetModules();
  return import('../src/consent');
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('consent gate', () => {
  it('starts undecided and loads nothing until accepted', async () => {
    const { appended } = installDom();
    const consent = await load();

    expect(consent.getConsent()).toBeNull();
    expect(consent.hasConsent()).toBe(false);
    expect(consent.isConsentPending()).toBe(false);

    consent.loadConsentedScript({ id: 'ga', src: 'https://example.com/ga.js' });

    expect(appended).toHaveLength(0);
    expect(consent.isConsentPending()).toBe(true);
    expect(consent.pendingConsentCount()).toBe(1);
  });

  it('queues a script only once and loads it after accepting', async () => {
    const { appended, store } = installDom();
    const consent = await load();

    consent.loadConsentedScript({ id: 'ga', src: 'https://example.com/ga.js' });
    consent.loadConsentedScript({ id: 'ga', src: 'https://example.com/ga.js' });
    expect(appended).toHaveLength(0);

    consent.setConsent('granted');

    expect(appended).toHaveLength(1);
    expect(appended[0]?.src).toBe('https://example.com/ga.js');
    expect(consent.hasConsent()).toBe(true);
    expect(consent.isConsentPending()).toBe(false);
    expect(store.get('wordt.consent')).toBe('granted');
  });

  it('never loads anything when the player declines', async () => {
    const { appended } = installDom();
    const consent = await load();

    consent.loadConsentedScript({ id: 'ga', src: 'https://example.com/ga.js' });
    consent.setConsent('denied');

    expect(appended).toHaveLength(0);
    expect(consent.hasConsent()).toBe(false);
    expect(consent.isConsentPending()).toBe(false);
    expect(consent.pendingConsentCount()).toBe(0);

    consent.loadConsentedScript({ id: 'hotjar', src: 'https://example.com/hotjar.js' });
    expect(appended).toHaveLength(0);
  });

  it('loads immediately once consent is already granted', async () => {
    const { appended } = installDom();
    const consent = await load();

    consent.setConsent('granted');
    consent.loadConsentedScript({ id: 'ga', src: 'https://example.com/ga.js' });

    expect(appended).toHaveLength(1);
  });

  it('remembers a decision across reloads', async () => {
    installDom();
    const first = await load();
    first.setConsent('granted');

    const second = await load();
    expect(second.hasConsent()).toBe(true);
    expect(second.isConsentPending()).toBe(false);
  });

  it('notifies subscribers when a script registers and when a decision lands', async () => {
    installDom();
    const consent = await load();
    const listener = vi.fn();
    const unsubscribe = consent.subscribeConsent(listener);

    consent.loadConsentedScript({ id: 'ga', src: 'https://example.com/ga.js' });
    expect(listener).toHaveBeenCalledTimes(1);

    consent.setConsent('granted');
    expect(listener).toHaveBeenCalledTimes(2);

    unsubscribe();
    consent.setConsent('denied');
    expect(listener).toHaveBeenCalledTimes(2);
  });

  it('forgets the decision on reset', async () => {
    const { store } = installDom();
    const consent = await load();

    consent.setConsent('granted');
    consent.resetConsent();

    expect(consent.getConsent()).toBeNull();
    expect(store.has('wordt.consent')).toBe(false);
  });
});

/**
 * Drives the phone and TV clients through a complete round in a real browser.
 *
 * Prerequisites (all must already be running):
 *   npm run dev:server                       # http://localhost:3000
 *   npm run dev:play                         # http://localhost:5173
 *   npm run dev:tv                           # http://localhost:5174
 *
 *   npm run e2e --workspace @wordt/client-play
 *
 * The server's WORDT_*_SECONDS timers only need to be long enough to act
 * against — the waits below adapt to whatever they are set to.
 */
import { chromium, type Browser, type BrowserContext, type Page } from 'playwright-core';

const SERVER = 'http://localhost:3000/socket.io/?EIO=4&transport=polling';
const CLIENT = 'http://localhost:5173/';
const TV = 'http://localhost:5174/';
const PICK = ['E', 'T', 'A', 'O', 'I', 'N', 'S', 'H', 'R', 'D', 'L', 'C', 'U', 'M', 'W'];

const pageErrors: string[] = [];

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

async function assertRunning(url: string, label: string): Promise<void> {
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
  } catch {
    throw new Error(`${label} is not reachable at ${url}. Start it before running the e2e test.`);
  }
}

function watch(page: Page, label: string): void {
  page.on('pageerror', (error) => pageErrors.push(`${label}: ${error.message}`));
  page.on('response', (response) => {
    if (response.status() < 400) return;
    pageErrors.push(`${label}: HTTP ${response.status()} ${response.url()}`);
  });
  page.on('console', (message) => {
    if (message.type() !== 'error') return;
    const text = message.text();
    if (text.includes('favicon') || text.includes('Failed to load resource')) return;
    // Vite's HMR websocket auto-reconnects; a refused connection during a cold
    // start is expected and not a product error.
    if (/WebSocket connection to 'ws:\/\/localhost:(5173|5174)\//.test(text)) return;
    pageErrors.push(`${label} console: ${text}`);
  });
}

async function loadUntil(page: Page, url: string, ready: string, log: string): Promise<void> {
  await page.goto(url);
  const anchor = page.locator(ready);
  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      await anchor.waitFor({ state: 'visible', timeout: 10000 });
      return;
    } catch (error) {
      if (attempt === 4) throw error;
      if (log) console.log(`reloading ${log} to get past the cold vite start`);
      await page.waitForTimeout(750);
      await page.reload({ waitUntil: 'load' });
    }
  }
}

async function newPlayer(browser: Browser, name: string): Promise<{ context: BrowserContext; page: Page }> {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  watch(page, name);
  await loadUntil(page, CLIENT, 'input[placeholder="e.g. Sam"]', name);
  await page.locator('input[placeholder="e.g. Sam"]').fill(name);
  return { context, page };
}

async function pickLetters(page: Page): Promise<void> {
  for (const letter of PICK) {
    await page.getByRole('button', { name: letter, exact: true }).click();
  }
}

async function main(): Promise<void> {
  await assertRunning(SERVER, 'The game server');
  await assertRunning(CLIENT, 'The phone client');
  await assertRunning(TV, 'The TV client');

  let browser: Browser | null = null;
  try {
    browser = await chromium.launch({ channel: 'chrome', headless: true });

    const ann = await newPlayer(browser, 'Ann');
    await ann.page.getByRole('button', { name: 'Create a room' }).click();
    await ann.page.locator('.room-code').waitFor({ state: 'visible' });
    const code = (await ann.page.locator('.room-code').innerText()).replace(/\s+/g, '');
    assert(code.length === 5, `expected a five letter room code, got "${code}"`);
    console.log(`Ann created room ${code}`);

    const bob = await newPlayer(browser, 'Bob');
    await bob.page.locator('input[placeholder="ABCDE"]').fill(code);
    await bob.page.getByRole('button', { name: 'Join room' }).click();

    await ann.page.locator('.standing').nth(1).waitFor({ state: 'visible' });
    await bob.page.locator('.standing').nth(1).waitFor({ state: 'visible' });
    console.log('both players are in the lobby');

    const tvContext = await browser.newContext({ viewport: { width: 1600, height: 900 } });
    const tv = await tvContext.newPage();
    watch(tv, 'TV');
    await loadUntil(tv, `${TV}?room=${code}`, '.tv-code', 'the TV');
    const tvLobbyPlayers = await tv.locator('.tv-namelist li').count();
    assert(tvLobbyPlayers === 2, `expected the TV lobby to list 2 players, saw ${tvLobbyPlayers}`);
    console.log(`the TV is watching room ${code}`);

    await ann.page.getByRole('button', { name: '1m', exact: true }).click();
    await ann.page.getByRole('button', { name: 'Start game' }).click();

    await ann.page.locator('.keyboard').waitFor({ state: 'visible' });
    await bob.page.locator('.keyboard').waitFor({ state: 'visible' });
    await tv.locator('.tv-pick').nth(1).waitFor({ state: 'visible' });
    const tvPicks = await tv.locator('.tv-pick').count();
    assert(tvPicks === 2, `expected the TV to track 2 pickers, saw ${tvPicks}`);
    await pickLetters(ann.page);
    await pickLetters(bob.page);
    console.log('both players picked fifteen letters');

    await ann.page.getByRole('button', { name: 'Lock in my letters' }).click();
    await bob.page.getByRole('button', { name: 'Lock in my letters' }).click();

    await ann.page.locator('.value-table').waitFor({ state: 'visible' });
    const valueRows = await ann.page.locator('.value-row').count();
    assert(valueRows === 15, `expected 15 usable letters, saw ${valueRows}`);
    console.log(`letter value table shows ${valueRows} usable letters`);

    await ann.page.locator('.input--word').waitFor({ state: 'visible', timeout: 20000 });
    await bob.page.locator('.input--word').waitFor({ state: 'visible', timeout: 20000 });
    await tv.locator('.tv-writer').nth(1).waitFor({ state: 'visible', timeout: 15000 });
    const tvValues = await tv.locator('.tv-value').count();
    const tvWriters = await tv.locator('.tv-writer').count();
    assert(tvValues === 15, `expected the TV to show 15 letter values, saw ${tvValues}`);
    assert(tvWriters === 2, `expected the TV to track 2 writers, saw ${tvWriters}`);

    await ann.page.locator('.input--word').fill('ZZZZ');
    await ann.page.getByRole('button', { name: 'Add', exact: true }).click();
    await ann.page.locator('.feedback--bad').waitFor({ state: 'visible' });

    await ann.page.locator('.input--word').fill('STORE');
    await ann.page.getByRole('button', { name: 'Add', exact: true }).click();
    await ann.page.locator('.feedback--ok').waitFor({ state: 'visible' });

    await bob.page.locator('.input--word').fill('STONE');
    await bob.page.getByRole('button', { name: 'Add', exact: true }).click();
    await bob.page.locator('.feedback--ok').waitFor({ state: 'visible' });

    await ann.page.locator('.wordlist li').waitFor({ state: 'visible' });
    const words = await ann.page.locator('.wordlist li').count();
    assert(words === 1, `expected Ann to have one accepted word, saw ${words}`);
    console.log('both players submitted a word');

    await ann.page.locator('.reveal').waitFor({ state: 'visible', timeout: 60000 });
    await tv.locator('.tv-reveal').waitFor({ state: 'visible', timeout: 15000 });
    console.log('the TV is revealing the review');
    const resultsHeading = ann.page.getByRole('heading', { name: 'Round 1 results' });
    for (let step = 0; step < 25; step += 1) {
      if (await resultsHeading.isVisible()) break;
      const next = ann.page.getByRole('button', { name: 'Next', exact: true });
      if (await next.isVisible()) await next.click();
      await ann.page.waitForTimeout(250);
    }
    await resultsHeading.waitFor({ state: 'visible', timeout: 15000 });
    await tv.getByRole('heading', { name: 'Round 1 results' }).waitFor({ state: 'visible', timeout: 15000 });
    const tvStandings = await tv.locator('.tv-standing').count();
    assert(tvStandings === 2, `expected the TV to show 2 standings, saw ${tvStandings}`);
    console.log('walked the review through to the round results on both screens');

    await ann.page.locator('.standing--you').waitFor({ state: 'visible' });
    const roundScore = await ann.page.locator('.myround strong').innerText();
    assert(Number(roundScore) > 0, `expected Ann to score points, got ${roundScore}`);

    await ann.page.getByRole('button', { name: 'Next round' }).click();
    await ann.page.locator('.keyboard').waitFor({ state: 'visible', timeout: 15000 });
    const roundPill = await ann.page.locator('.pill').first().innerText();
    assert(/Round 2\//.test(roundPill), `expected the round two pill, saw "${roundPill}"`);
    console.log(`round 2 started (${roundPill})`);

    if (pageErrors.length > 0) {
      throw new Error(`browser reported errors:\n  ${pageErrors.join('\n  ')}`);
    }
    console.log('\nE2E TEST PASSED');
  } finally {
    await browser?.close();
  }
}

main()
  .then(() => process.exit(0))
  .catch((error: unknown) => {
    console.error(`\nE2E TEST FAILED: ${error instanceof Error ? error.message : error}`);
    if (pageErrors.length > 0) console.error(`browser errors:\n  ${pageErrors.join('\n  ')}`);
    process.exit(1);
  });

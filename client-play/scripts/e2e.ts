/**
 * Drives the phone client through a complete round in a real browser.
 *
 * Prerequisites (both must already be running):
 *   npm run dev:server                       # http://localhost:3000
 *   npm run dev:play                         # http://localhost:5173
 *
 *   npm run e2e --workspace @wordt/client-play
 *
 * Short server timers make this fast:
 *   WORDT_VALUE_REVEAL_SECONDS=3 WORDT_WORD_SECONDS=30 WORDT_REVIEW_STEP_SECONDS=1
 */
import { chromium, type Browser, type BrowserContext, type Page } from 'playwright-core';

const SERVER = 'http://localhost:3000/socket.io/?EIO=4&transport=polling';
const CLIENT = 'http://localhost:5173/';
const PICK = ['S', 'T', 'A', 'R', 'E', 'O', 'N', 'I', 'L', 'D'];

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
    pageErrors.push(`${label} console: ${text}`);
  });
}

async function newPlayer(browser: Browser, name: string): Promise<{ context: BrowserContext; page: Page }> {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  watch(page, name);
  await page.goto(CLIENT);
  const nameInput = page.locator('input[placeholder="e.g. Sam"]');
  try {
    await nameInput.fill(name);
  } catch (error) {
    console.error(`--- ${name} root:`, await page.locator('#root').innerHTML());
    throw error;
  }
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

    await ann.page.getByRole('button', { name: 'Start game' }).click();

    await ann.page.locator('.keyboard').waitFor({ state: 'visible' });
    await bob.page.locator('.keyboard').waitFor({ state: 'visible' });
    await pickLetters(ann.page);
    await pickLetters(bob.page);
    console.log('both players picked ten letters');

    await ann.page.getByRole('button', { name: 'Lock in my letters' }).click();
    await bob.page.getByRole('button', { name: 'Lock in my letters' }).click();

    await ann.page.locator('.value-table').waitFor({ state: 'visible' });
    const valueRows = await ann.page.locator('.value-row').count();
    assert(valueRows === 10, `expected 10 usable letters, saw ${valueRows}`);
    console.log(`letter value table shows ${valueRows} usable letters`);

    await ann.page.locator('.input--word').waitFor({ state: 'visible', timeout: 20000 });
    await bob.page.locator('.input--word').waitFor({ state: 'visible', timeout: 20000 });

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
    const resultsHeading = ann.page.getByRole('heading', { name: 'Round 1 results' });
    for (let step = 0; step < 25; step += 1) {
      if (await resultsHeading.isVisible()) break;
      const next = ann.page.getByRole('button', { name: 'Next', exact: true });
      if (await next.isVisible()) await next.click();
      await ann.page.waitForTimeout(250);
    }
    await resultsHeading.waitFor({ state: 'visible', timeout: 15000 });
    console.log('walked the review through to the round results');

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

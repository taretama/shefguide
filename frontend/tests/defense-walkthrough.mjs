/**
 * ShefGuide — final-year project defence walkthrough.
 *
 * Drives the real application through the flows that carry the project's
 * argument, records the browser at 1920x1080, and writes a timing manifest so
 * the caption overlay lands on real timestamps rather than estimates.
 *
 * Every step is guarded: a step that fails is logged and skipped rather than
 * ending the recording, so one slow provider call cannot cost the whole take.
 */
import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = process.env.DEMO_OUT_DIR || path.join(HERE, 'demo-output');
const BRIEF = process.env.DEMO_BRIEF || path.join(OUT, 'INF6027-Assignment-Brief.pdf');
const BASE = process.env.DEMO_BASE_URL || 'http://localhost:3000';

// A throwaway account is registered per run rather than shipping credentials.
const EMAIL = `demo.${Date.now()}@sheffield.ac.uk`;
const PASSWORD = process.env.DEMO_PASSWORD || `Demo-${Math.random().toString(36).slice(2, 10)}!aA1`;

fs.mkdirSync(path.join(OUT, 'video'), { recursive: true });

const browser = await chromium.launch({ args: ['--force-device-scale-factor=1'] });
const ctx = await browser.newContext({
  viewport: { width: 1920, height: 1080 },
  recordVideo: { dir: path.join(OUT, 'video'), size: { width: 1920, height: 1080 } },
  deviceScaleFactor: 1,
});
const page = await ctx.newPage();

const t0 = Date.now();
const marks = [];
const now = () => (Date.now() - t0) / 1000;

/** Open a captioned section; the caption shows for its whole duration. */
function mark(title, caption) {
  marks.push({ title, caption, start: now() });
  console.log(`[${now().toFixed(1)}s] ${title}`);
}

async function step(name, fn) {
  try { await fn(); }
  catch (e) { console.log(`  !! ${name}: ${String(e).split('\n')[0].slice(0, 110)}`); }
}

const pause = ms => page.waitForTimeout(ms);

/** Type at human speed so the viewer can follow what is being asked. */
async function human(locator, text, delay = 34) {
  await locator.click();
  await locator.type(text, { delay });
}

/** Wait until the assistant's reply has actually finished streaming in. */
async function waitForAnswer(timeout = 75000) {
  const start = Date.now();
  let stableFor = 0, last = '';
  while (Date.now() - start < timeout) {
    const txt = await page.evaluate(() => document.body.innerText.length).catch(() => 0);
    if (txt === last) { stableFor += 500; if (stableFor >= 2500) return true; }
    else { stableFor = 0; last = txt; }
    await pause(500);
  }
  return false;
}

/** The disclosure gate can appear before the first message is accepted. */
async function acceptDisclosureIfShown() {
  const accept = page.getByRole('button', { name: /accept|agree|continue|i understand/i }).first();
  if (await accept.isVisible().catch(() => false)) {
    await pause(2200);
    await accept.click();
    await pause(1200);
  }
}

// ── 1 · Landing page ───────────────────────────────────────────────────────
mark('Landing page',
  'The public landing page introduces ShefGuide and lets a student ask a question immediately.');
await page.goto(BASE, { waitUntil: 'networkidle' });
await pause(2600);
await step('scroll home', async () => {
  for (const y of [400, 900, 1500, 2100, 2700]) {
    await page.evaluate(v => window.scrollTo({ top: v, behavior: 'smooth' }), y);
    await pause(1150);
  }
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'smooth' }));
  await pause(1400);
});

// ── 2 · Registration ───────────────────────────────────────────────────────
mark('Creating an account',
  'A student registers with their university, home country and programme, which personalises the guidance.');
await step('register', async () => {
  await page.goto(BASE + '/sign-up', { waitUntil: 'networkidle' });
  await pause(1800);
  await human(page.getByPlaceholder('you@example.com'), EMAIL, 22);
  await pause(400);
  await human(page.getByPlaceholder('At least 8 characters'), PASSWORD, 22);
  await pause(400);
  await human(page.getByPlaceholder('e.g. University of Sheffield'), 'University of Sheffield', 22);
  await pause(300);
  await human(page.getByPlaceholder('e.g. Nigeria'), 'Nigeria', 30);
  await pause(300);
  await human(page.getByPlaceholder('e.g. MSc Computer Science'), 'MSc Data Science', 24);
  await pause(1300);
  await page.getByRole('button', { name: /create my account/i }).click();
  await page.waitForURL(/\/chat/, { timeout: 25000 }).catch(() => {});
  await pause(2600);
});

// ── 3 · Data-protection disclosure ─────────────────────────────────────────
mark('Cloud-processing disclosure',
  'Before any question leaves the application, the student is told it is sent to a third-party AI provider, and must accept.');
await step('disclosure', async () => {
  await acceptDisclosureIfShown();
  await pause(1500);
});

// ── 4 · Grounded academic answer ───────────────────────────────────────────
mark('Grounded academic support',
  'The assistant answers from a curated, source-referenced knowledge base rather than from the model\u2019s memory alone.');
await step('academic question', async () => {
  const box = page.getByPlaceholder(/Ask about your course/i);
  await human(box, 'What does \u2018critically evaluate\u2019 mean in a UK assignment?');
  await pause(900);
  await box.press('Enter');
  await acceptDisclosureIfShown();
  await waitForAnswer();
  await pause(3200);
  await page.evaluate(() => window.scrollTo({ top: 400, behavior: 'smooth' }));
  await pause(2600);
});

// ── 5 · Document grounding ─────────────────────────────────────────────────
mark('Answering from the student\u2019s own document',
  'A student attaches their assignment brief. Its text is split, embedded, and searched alongside the knowledge base.');
await step('upload document', async () => {
  const input = page.locator('input[type="file"]').first();
  await input.setInputFiles(BRIEF);
  await pause(6500);
});
await step('ask about document', async () => {
  const box = page.getByPlaceholder(/Ask about your course/i);
  await human(box, 'According to my brief, when is the deadline and how is it marked?');
  await pause(900);
  await box.press('Enter');
  await waitForAnswer();
  await pause(3600);
});

// ── 6 · The scope boundary ─────────────────────────────────────────────────
mark('Where the system deliberately stops',
  'Pastoral, medical, legal, financial and immigration questions are redirected to qualified human services by name.');
await step('out of scope', async () => {
  const box = page.getByPlaceholder(/Ask about your course/i);
  await human(box, 'My visa expires next month, can you advise me?');
  await pause(900);
  await box.press('Enter');
  await waitForAnswer();
  await pause(4000);
});

// ── 7 · Dual-LLM comparison ────────────────────────────────────────────────
mark('Comparing two language models',
  'The same question can be put to GPT-4o-mini or Gemini 3.5 Flash under identical conditions \u2014 the basis of the evaluation.');
await step('switch model', async () => {
  const gemini = page.getByRole('button', { name: /Gemini/i }).first();
  await gemini.click();
  await pause(2600);
});

// ── 8 · Personalised checklist ─────────────────────────────────────────────
mark('Personalised arrival checklist',
  'A checklist is generated from the student\u2019s country, programme and university, staged across their first weeks.');
await step('checklist', async () => {
  await page.getByRole('link', { name: /your checklist/i }).first().click()
    .catch(async () => { await page.goto(BASE + '/checklist', { waitUntil: 'networkidle' }); });
  await pause(2600);
  const gen = page.getByRole('button', { name: /generate|create|build/i }).first();
  if (await gen.isVisible().catch(() => false)) {
    await gen.click();
    await waitForAnswer(60000);
  }
  await pause(2600);
  await page.evaluate(() => window.scrollTo({ top: 500, behavior: 'smooth' }));
  await pause(2400);
});

// ── 9 · Community board ────────────────────────────────────────────────────
mark('Community question board',
  'Questions are answered once by the assistant, cached, and shown alongside replies from other students.');
await step('community', async () => {
  await page.goto(BASE + '/community', { waitUntil: 'networkidle' });
  await pause(3000);
  await page.evaluate(() => window.scrollTo({ top: 450, behavior: 'smooth' }));
  await pause(2600);
});

// ── 10 · History ───────────────────────────────────────────────────────────
mark('Saved conversation history',
  'Every conversation is stored against the account, with the model that answered it, and can be reopened.');
await step('history', async () => {
  await page.goto(BASE + '/history', { waitUntil: 'networkidle' });
  await pause(3400);
});

marks.push({ title: '__end__', caption: '', start: now() });

await ctx.close();          // finalises the video file
await browser.close();

const file = fs.readdirSync(path.join(OUT, 'video')).filter(f => f.endsWith('.webm')).pop();
fs.writeFileSync(path.join(OUT, 'marks.json'),
  JSON.stringify({ video: path.join(OUT, 'video', file), marks }, null, 1));
console.log('\nvideo   :', file);
console.log('duration:', now().toFixed(1), 's');
console.log('sections:', marks.length - 1);

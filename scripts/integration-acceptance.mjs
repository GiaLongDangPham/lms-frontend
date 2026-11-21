// Real UI/API acceptance on a disposable local database; no route mocks.
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { once } from 'node:events';
import { mkdir, writeFile } from 'node:fs/promises';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const backend = path.resolve(process.env.ACCEPTANCE_BACKEND_DIR || path.join(root, '../lms-backend'));
const { Pool } = createRequire(path.join(backend, 'package.json'))('pg');
const { chromium } = await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE_PATH || createRequire(import.meta.url).resolve('playwright')));
const { createApp } = await import(pathToFileURL(path.join(backend, 'dist/app.js')));
const { NotificationRepository } = await import(pathToFileURL(path.join(backend, 'dist/modules/notifications/notification.repository.js')));
const { NotificationService } = await import(pathToFileURL(path.join(backend, 'dist/modules/notifications/notification.service.js')));
const { createServer } = await import(pathToFileURL(path.join(root, 'node_modules/vite/dist/node/index.js')));
const adminUrl = new URL(process.env.ACCEPTANCE_DATABASE_URL || '');
if (!['localhost', '127.0.0.1', '[::1]'].includes(adminUrl.hostname) || process.env.NODE_ENV === 'production') throw new Error('Local DB host required.');
const name = `lms_acceptance_${randomBytes(8).toString('hex')}`;
const target = new URL(adminUrl); target.pathname = `/${name}`;
const password = randomBytes(20).toString('hex');
const admin = new Pool({ connectionString: adminUrl.toString() });
const output = path.resolve(process.env.ACCEPTANCE_OUTPUT_DIR || path.join(root, '.acceptance'));
const fePort = Number(process.env.ACCEPTANCE_FE_PORT || 15173), apiPort = Number(process.env.ACCEPTANCE_API_PORT || 13000);
const origin = `http://localhost:${fePort}`, base = `http://localhost:${apiPort}/api`;
let pool, server, vite, browser, created = false;
const evidence = { mode: process.argv[2] || 'I2a', startedAt: new Date().toISOString(), checks: [] };
const errors = [];
async function check(label, action) { await action(); evidence.checks.push(label); console.log(`PASS ${label}`); }
try {
  await mkdir(output, { recursive: true }); await admin.query(`CREATE DATABASE "${name}"`); created = true;
  for (const script of ['migrate.ts', 'seed.ts']) {
    const run = spawnSync(process.execPath, ['node_modules/tsx/dist/cli.mjs', `scripts/${script}`], { cwd: backend,
      env: { ...process.env, DATABASE_URL: target.toString(), DATABASE_SSL: 'false', SEED_PASSWORD: password }, encoding: 'utf8' });
    assert.equal(run.status, 0, `${script} failed`);
  }
  pool = new Pool({ connectionString: target.toString() });
  const notifications = new NotificationService(new NotificationRepository(pool));
  server = createApp({ corsOrigins: [origin], checkDatabase: async () => { await pool.query('SELECT 1'); }, business: {
    pool, notificationService: notifications, auth: { secret: randomBytes(32).toString('hex'), issuer: 'acceptance',
      audience: 'acceptance', origins: [origin], cookieSecure: false, cookieSameSite: 'lax' },
  } }).listen(apiPort); await once(server, 'listening');
  process.env.VITE_API_BASE_URL = base;
  vite = await createServer({ root, server: { host: 'localhost', port: fePort, strictPort: true } }); await vite.listen();
  browser = await chromium.launch({ headless: true, ...(process.env.ACCEPTANCE_CHROMIUM_PATH ? { executablePath: process.env.ACCEPTANCE_CHROMIUM_PATH } : {}) });
  const context = await browser.newContext({ viewport: { width: 1365, height: 950 } });
  const page = await context.newPage(); page.on('pageerror', e => errors.push(e.message));
  async function api(route, token, method = 'GET', body) {
    const response = await fetch(base + route, { method, headers: { Origin: origin,
      ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(body ? { 'Content-Type': 'application/json' } : {}) },
      ...(body ? { body: JSON.stringify(body) } : {}) });
    return { status: response.status, data: await response.json() };
  }
  async function token(code) {
    const result = await api('/auth/login', null, 'POST', { schoolCode: code, password });
    assert.equal(result.status, 200); return result.data.accessToken;
  }
  async function login(code) {
    await page.goto(origin + '/login'); await page.locator('#login-school-code').fill(code);
    await page.locator('#login-school-password').fill(password); await page.locator('#login-submit-btn').click();
    await page.waitForURL(new RegExp(code.startsWith('GV') ? '/teacher' : '/student'));
  }
  const teacher = await token('GV001'), student = await token('SV001'), peer = await token('SV002'), outside = await token('SV003');
  const classId = '20000000-0000-4000-8000-000000000001';
  const assignment = await api(`/classes/${classId}/assignments`, teacher, 'POST', {
    title: 'Nghiệm thu tích hợp', deadlineAt: new Date(Date.now() + 3_600_000).toISOString(), maxScore: 10 });
  assert.equal(assignment.status, 201); const assignmentId = assignment.data.id;
  await check('I2a assignment event includes class, assignment and VN deadline', async () => {
    const inbox = await api('/notifications', student);
    const event = inbox.data.items.find(x => x.assignmentId === assignmentId && x.kind === 'ASSIGNMENT_CREATED');
    assert.ok(event?.body.includes('Nghiệm thu tích hợp')); assert.ok(event.body.includes('Lớp Demo A')); assert.ok(event.body.includes('(giờ Việt Nam)'));
  });
  await check('I2a reminder deduplication and recipient isolation', async () => {
    await notifications.dispatchDeadlineReminders(); await notifications.dispatchDeadlineReminders();
    const rows = await pool.query('SELECT recipient_id,count(*)::int n FROM notifications WHERE assignment_id=$1 AND kind=$2 GROUP BY recipient_id', [assignmentId, 'DEADLINE_REMINDER']);
    assert.equal(rows.rows.length, 2); assert.ok(rows.rows.every(x => x.n === 1));
    assert.ok((await api('/notifications', outside)).data.items.every(x => x.assignmentId !== assignmentId));
  });
  await check('I2a publication notification names its assignment/class', async () => {
    assert.equal((await api(`/assignments/${assignmentId}/grades/publish`, teacher, 'POST')).status, 200);
    const event = (await api('/notifications', student)).data.items.find(x => x.assignmentId === assignmentId && x.kind === 'GRADE_PUBLISHED');
    assert.ok(event?.body.includes('Nghiệm thu tích hợp')); assert.ok(event.body.includes('Lớp Demo A'));
  });
  await login('SV001');
  await check('I2a sidebar unread badge, read and reload persistence', async () => {
    const badge = page.locator('nav a[href="/student/notifications"] [aria-label$="thông báo chưa đọc"]');
    await badge.waitFor({ timeout: 5000 }); assert.ok(Number(await badge.innerText()) >= 3);
    await page.goto(origin + '/student/notifications'); await page.getByRole('button', { name: 'Đánh dấu tất cả đã đọc' }).click();
    await page.getByRole('button', { name: 'Chưa đọc (0)', exact: true }).waitFor();
    await page.locator('nav a[href="/student/notifications"] [aria-label="0 thông báo chưa đọc"]').waitFor();
    await page.reload(); await page.getByRole('button', { name: 'Chưa đọc (0)', exact: true }).waitFor();
    await page.screenshot({ path: path.join(output, `${evidence.mode}-notifications.png`), fullPage: true });
  });
  if (evidence.mode !== 'I2a') await check('I2b common discussion via browser, persistence and class isolation', async () => {
    await page.goto(origin + `/student/assignments/${assignmentId}`);
    await page.getByRole('textbox', { name: 'Viết bình luận' }).fill('Câu hỏi nghiệm thu <b>văn bản</b>');
    await page.getByRole('button', { name: 'Gửi bình luận', exact: true }).click();
    await page.getByText('Câu hỏi nghiệm thu <b>văn bản</b>', { exact: true }).waitFor();
    await page.reload(); await page.getByText('Câu hỏi nghiệm thu <b>văn bản</b>', { exact: true }).waitFor();
    assert.ok((await api(`/assignments/${assignmentId}/comments`, peer)).data.items.some(x => x.body.includes('<b>văn bản</b>')));
    assert.equal((await api(`/assignments/${assignmentId}/comments`, outside)).status, 404);
    await page.screenshot({ path: path.join(output, `${evidence.mode}-comments.png`), fullPage: true });
    await page.locator('#student-logout-btn').click(); await login('GV001');
    await page.goto(origin + `/teacher/assignments/${assignmentId}/submissions`);
    await page.getByText('Câu hỏi nghiệm thu <b>văn bản</b>', { exact: true }).waitFor();
  });
  assert.deepEqual(errors, []); evidence.finishedAt = new Date().toISOString();
  await writeFile(path.join(output, `${evidence.mode}-evidence.json`), JSON.stringify(evidence, null, 2));
} finally {
  await browser?.close(); await vite?.close();
  if (server) await new Promise(resolve => server.close(resolve));
  await pool?.end(); if (created && /^lms_acceptance_[a-f0-9]{16}$/.test(name)) await admin.query(`DROP DATABASE "${name}"`);
  await admin.end();
}

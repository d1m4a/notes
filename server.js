import cors from 'cors';
import express from 'express';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import crypto from 'node:crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();
const port = process.env.PORT || 3001;
const dataDir = path.join(__dirname, 'data');
const dataFile = path.join(dataDir, 'notes.json');
const authPassword = process.env.NOTES_PASSWORD || 'notes';
const sessionSecret = process.env.SESSION_SECRET || 'local-notes-session-secret';
const sessionMaxAgeMs = 1000 * 60 * 60 * 24 * 30;

app.use(cors());
app.use(express.json({ limit: '1mb' }));

async function ensureStore() {
  await fs.mkdir(dataDir, { recursive: true });

  try {
    await fs.access(dataFile);
  } catch {
    await fs.writeFile(dataFile, '[]\n', 'utf8');
  }
}

async function readNotes() {
  await ensureStore();
  const raw = await fs.readFile(dataFile, 'utf8');
  const parsed = JSON.parse(raw || '[]');
  return Array.isArray(parsed) ? parsed : [];
}

async function writeNotes(notes) {
  await ensureStore();
  await fs.writeFile(dataFile, `${JSON.stringify(notes, null, 2)}\n`, 'utf8');
}

function cleanNotePayload(body) {
  const type = body?.type;
  const content = String(body?.content ?? '').trim();

  if (!['link', 'text'].includes(type)) {
    return { error: 'Тип записи должен быть link или text.' };
  }

  if (!content) {
    return { error: 'Содержимое не может быть пустым.' };
  }

  return { type, content };
}

function parseCookies(header = '') {
  return header.split(';').reduce((cookies, part) => {
    const [name, ...valueParts] = part.trim().split('=');

    if (!name) {
      return cookies;
    }

    cookies[name] = decodeURIComponent(valueParts.join('='));
    return cookies;
  }, {});
}

function sign(value) {
  return crypto.createHmac('sha256', sessionSecret).update(value).digest('base64url');
}

function createSessionToken() {
  const payload = JSON.stringify({
    exp: Date.now() + sessionMaxAgeMs,
    nonce: crypto.randomUUID()
  });
  const encodedPayload = Buffer.from(payload).toString('base64url');
  return `${encodedPayload}.${sign(encodedPayload)}`;
}

function isValidSessionToken(token) {
  if (!token || !token.includes('.')) {
    return false;
  }

  const [encodedPayload, signature] = token.split('.');
  const expectedSignature = sign(encodedPayload);
  const signatureBuffer = Buffer.from(signature);
  const expectedSignatureBuffer = Buffer.from(expectedSignature);

  if (signatureBuffer.length !== expectedSignatureBuffer.length) {
    return false;
  }

  if (!crypto.timingSafeEqual(signatureBuffer, expectedSignatureBuffer)) {
    return false;
  }

  try {
    const payload = JSON.parse(Buffer.from(encodedPayload, 'base64url').toString('utf8'));
    return Number(payload.exp) > Date.now();
  } catch {
    return false;
  }
}

function isPasswordMatch(candidate) {
  const password = Buffer.from(authPassword);
  const input = Buffer.from(String(candidate ?? ''));

  if (password.length !== input.length) {
    return false;
  }

  return crypto.timingSafeEqual(password, input);
}

function sessionCookie(value, maxAge) {
  const parts = [
    `notes_session=${encodeURIComponent(value)}`,
    'HttpOnly',
    'SameSite=Lax',
    'Path=/',
    `Max-Age=${maxAge}`
  ];

  if (process.env.COOKIE_SECURE === 'true') {
    parts.push('Secure');
  }

  return parts.join('; ');
}

function requireAuth(req, res, next) {
  const cookies = parseCookies(req.headers.cookie);

  if (!isValidSessionToken(cookies.notes_session)) {
    res.status(401).json({ error: 'Требуется вход.' });
    return;
  }

  next();
}

if (!process.env.NOTES_PASSWORD) {
  console.warn('NOTES_PASSWORD is not set. Temporary local password is "notes".');
}

app.get('/api/session', (req, res) => {
  const cookies = parseCookies(req.headers.cookie);
  res.json({ authenticated: isValidSessionToken(cookies.notes_session) });
});

app.post('/api/login', (req, res) => {
  if (!isPasswordMatch(req.body?.password)) {
    res.status(401).json({ error: 'Неверный пароль.' });
    return;
  }

  res.setHeader('Set-Cookie', sessionCookie(createSessionToken(), sessionMaxAgeMs / 1000));
  res.json({ authenticated: true });
});

app.post('/api/logout', (_req, res) => {
  res.setHeader('Set-Cookie', sessionCookie('', 0));
  res.status(204).send();
});

app.use('/api/notes', requireAuth);

app.get('/api/notes', async (_req, res) => {
  try {
    const notes = await readNotes();
    res.json(notes.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)));
  } catch (error) {
    res.status(500).json({ error: 'Не удалось прочитать заметки.' });
  }
});

app.post('/api/notes', async (req, res) => {
  const payload = cleanNotePayload(req.body);

  if (payload.error) {
    res.status(400).json({ error: payload.error });
    return;
  }

  try {
    const notes = await readNotes();
    const now = new Date().toISOString();
    const note = {
      id: crypto.randomUUID(),
      type: payload.type,
      content: payload.content,
      createdAt: now,
      updatedAt: now
    };

    notes.push(note);
    await writeNotes(notes);
    res.status(201).json(note);
  } catch (error) {
    res.status(500).json({ error: 'Не удалось сохранить запись.' });
  }
});

app.put('/api/notes/:id', async (req, res) => {
  const payload = cleanNotePayload(req.body);

  if (payload.error) {
    res.status(400).json({ error: payload.error });
    return;
  }

  try {
    const notes = await readNotes();
    const index = notes.findIndex((note) => note.id === req.params.id);

    if (index === -1) {
      res.status(404).json({ error: 'Запись не найдена.' });
      return;
    }

    notes[index] = {
      ...notes[index],
      type: payload.type,
      content: payload.content,
      updatedAt: new Date().toISOString()
    };

    await writeNotes(notes);
    res.json(notes[index]);
  } catch (error) {
    res.status(500).json({ error: 'Не удалось обновить запись.' });
  }
});

app.delete('/api/notes/:id', async (req, res) => {
  try {
    const notes = await readNotes();
    const nextNotes = notes.filter((note) => note.id !== req.params.id);

    if (nextNotes.length === notes.length) {
      res.status(404).json({ error: 'Запись не найдена.' });
      return;
    }

    await writeNotes(nextNotes);
    res.status(204).send();
  } catch (error) {
    res.status(500).json({ error: 'Не удалось удалить запись.' });
  }
});

app.use(express.static(path.join(__dirname, 'dist')));

app.get('/{*splat}', (_req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.listen(port, () => {
  console.log(`Notes API is running on http://127.0.0.1:${port}`);
});

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

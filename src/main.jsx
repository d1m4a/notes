import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  Check,
  Trash2,
  Edit3,
  ExternalLink,
  Eye,
  Link as LinkIcon,
  NotebookPen,
  Plus,
  RotateCcw,
  Type
} from 'lucide-react';
import './styles.css';

const API_URL = '/api/notes';

function normalizeUrl(value) {
  if (/^https?:\/\//i.test(value)) {
    return value;
  }

  return `https://${value}`;
}

function formatDate(value) {
  return new Intl.DateTimeFormat('ru-RU', {
    dateStyle: 'medium',
    timeStyle: 'short'
  }).format(new Date(value));
}

function App() {
  const [mode, setMode] = useState('add');
  const [notes, setNotes] = useState([]);
  const [type, setType] = useState('link');
  const [content, setContent] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [status, setStatus] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const editingNote = useMemo(
    () => notes.find((note) => note.id === editingId),
    [editingId, notes]
  );

  async function loadNotes() {
    setIsLoading(true);
    setStatus('');

    try {
      const response = await fetch(API_URL);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Не удалось загрузить записи.');
      }

      setNotes(data);
    } catch (error) {
      setStatus(error.message);
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    loadNotes();
  }, []);

  function resetForm() {
    setType('link');
    setContent('');
    setEditingId(null);
    setStatus('');
  }

  function startEdit(note) {
    setType(note.type);
    setContent(note.content);
    setEditingId(note.id);
    setMode('add');
    setStatus('');
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setStatus('');

    const trimmed = content.trim();

    if (!trimmed) {
      setStatus('Заполни поле перед сохранением.');
      return;
    }

    const method = editingId ? 'PUT' : 'POST';
    const url = editingId ? `${API_URL}/${editingId}` : API_URL;

    try {
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, content: trimmed })
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Не удалось сохранить запись.');
      }

      await loadNotes();
      resetForm();
      setMode('view');
      setStatus(editingId ? 'Запись обновлена.' : 'Запись сохранена.');
    } catch (error) {
      setStatus(error.message);
    }
  }

  async function handleDelete(noteId) {
    if (!noteId) {
      return;
    }

    const confirmed = window.confirm('Удалить эту запись? Отменить действие нельзя.');

    if (!confirmed) {
      return;
    }

    setStatus('');

    try {
      const response = await fetch(`${API_URL}/${noteId}`, {
        method: 'DELETE'
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Не удалось удалить запись.');
      }

      await loadNotes();
      setMode('view');
      setStatus('Запись удалена.');
    } catch (error) {
      setStatus(error.message);
    }
  }

  return (
    <main className="app-shell">
      <section className="workspace">
        <header className="topbar">
          <div>
            <p className="eyebrow">JSON заметки</p>
            <h1>Ссылки и тексты</h1>
          </div>

          <div className="mode-switch" aria-label="Режим приложения">
            <button
              className={mode === 'add' ? 'active' : ''}
              type="button"
              onClick={() => setMode('add')}
            >
              <Plus size={18} />
              Добавить
            </button>
            <button
              className={mode === 'view' ? 'active' : ''}
              type="button"
              onClick={() => {
                setMode('view');
                loadNotes();
              }}
            >
              <Eye size={18} />
              Просмотр
            </button>
          </div>
        </header>

        {mode === 'add' ? (
          <form className="editor" onSubmit={handleSubmit}>
            <div className="panel-heading">
              <NotebookPen size={22} />
              <div>
                <h2>{editingId ? 'Редактирование' : 'Новая запись'}</h2>
                {editingNote ? <p>Создано: {formatDate(editingNote.createdAt)}</p> : null}
              </div>
            </div>

            <div className="type-row">
              <label className={type === 'link' ? 'type-option checked' : 'type-option'}>
                <input
                  checked={type === 'link'}
                  name="entryType"
                  onChange={() => setType('link')}
                  type="checkbox"
                />
                <span className="fake-box">
                  {type === 'link' ? <Check size={14} /> : null}
                </span>
                <LinkIcon size={18} />
                Ссылка
              </label>

              <label className={type === 'text' ? 'type-option checked' : 'type-option'}>
                <input
                  checked={type === 'text'}
                  name="entryType"
                  onChange={() => setType('text')}
                  type="checkbox"
                />
                <span className="fake-box">
                  {type === 'text' ? <Check size={14} /> : null}
                </span>
                <Type size={18} />
                Текст
              </label>
            </div>

            <label className="field">
              <span>{type === 'link' ? 'Адрес ссылки' : 'Текст заметки'}</span>
              {type === 'link' ? (
                <input
                  autoFocus
                  onChange={(event) => setContent(event.target.value)}
                  placeholder="example.com/article"
                  type="text"
                  value={content}
                />
              ) : (
                <textarea
                  autoFocus
                  onChange={(event) => setContent(event.target.value)}
                  placeholder="Пиши текст с переносами строк..."
                  rows={9}
                  value={content}
                />
              )}
            </label>

            <div className="actions">
              <button className="primary" type="submit">
                <Check size={18} />
                {editingId ? 'Сохранить правку' : 'Сохранить'}
              </button>
              <button className="ghost" onClick={resetForm} type="button">
                <RotateCcw size={18} />
                Очистить
              </button>
            </div>

            {status ? <p className="status">{status}</p> : null}
          </form>
        ) : (
          <section className="viewer">
            <div className="panel-heading">
              <Eye size={22} />
              <div>
                <h2>Сохраненные записи</h2>
                <p>{notes.length ? `Всего: ${notes.length}` : 'Пока пусто'}</p>
              </div>
            </div>

            {isLoading ? <p className="muted">Загрузка...</p> : null}
            {status ? <p className="status">{status}</p> : null}

            <div className="notes-list">
              {notes.map((note) => (
                <article className="note-card" key={note.id}>
                  <div className="note-meta">
                    <span className={note.type === 'link' ? 'badge link' : 'badge text'}>
                      {note.type === 'link' ? <LinkIcon size={15} /> : <Type size={15} />}
                      {note.type === 'link' ? 'Ссылка' : 'Текст'}
                    </span>
                    <time>{formatDate(note.createdAt)}</time>
                  </div>

                  {note.type === 'link' ? (
                    <a
                      className="saved-link"
                      href={normalizeUrl(note.content)}
                      rel="noreferrer"
                      target="_blank"
                    >
                      {note.content}
                      <ExternalLink size={16} />
                    </a>
                  ) : (
                    <p className="saved-text">{note.content}</p>
                  )}

                  <div className="note-actions">
                    <button className="edit-button" onClick={() => startEdit(note)} type="button">
                      <Edit3 size={17} />
                      Редактировать
                    </button>
                    <button className="danger" onClick={() => handleDelete(note.id)} type="button">
                      <Trash2 size={17} />
                      Удалить
                    </button>
                  </div>
                </article>
              ))}
            </div>
          </section>
        )}
      </section>
    </main>
  );
}

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

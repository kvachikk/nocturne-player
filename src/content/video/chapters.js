import { pageWindow, read } from './pageapi.js';

// YouTube ships the chapter list inside the blob of data it renders the page
// from. The shape of that blob differs between the phone and desktop sites and
// changes without notice, so rather than following one path down it we look for
// the renderer by name — bounded, so a page that turns out to be a maze of
// objects cannot cost more than a moment.
const MAX_NODES = 20000;
const MS_PER_SECOND = 1000;

const readChapter = (node) => {
  const renderer = read(node, 'chapterRenderer');
  if (renderer === null) return null;

  const title = read(read(renderer, 'title'), 'simpleText');
  const startMs = read(renderer, 'timeRangeStartMillis');
  const start = Number(startMs);
  if (typeof title !== 'string' || title === '') return null;
  if (!Number.isFinite(start)) return null;

  return { title, start: start / MS_PER_SECOND };
};

const collect = (root) => {
  const found = [];
  const stack = [root];
  let budget = MAX_NODES;

  while (stack.length > 0 && budget > 0) {
    const node = stack.pop();
    budget -= 1;
    if (node === null || typeof node !== 'object') continue;

    const chapter = readChapter(node);
    if (chapter !== null) {
      found.push(chapter);
      continue;
    }

    let keys = [];
    try {
      keys = Object.keys(node);
    } catch {
      continue;
    }
    for (const key of keys) stack.push(read(node, key));
  }

  return found;
};

// One chapter is not a chapter list, it is the whole film with a label on it.
const MIN_CHAPTERS = 2;

export const readSiteChapters = () => {
  const data = read(pageWindow(), 'ytInitialData');
  if (data === null) return [];

  const byStart = new Map();
  for (const chapter of collect(data)) {
    if (!byStart.has(chapter.start)) byStart.set(chapter.start, chapter);
  }

  const chapters = Array.from(byStart.values()).sort(
    (first, second) => first.start - second.start,
  );
  return chapters.length >= MIN_CHAPTERS ? chapters : [];
};

export const chapterAt = (chapters, time) => {
  let current = null;
  for (const chapter of chapters) {
    if (chapter.start > time) break;
    current = chapter;
  }
  return current;
};

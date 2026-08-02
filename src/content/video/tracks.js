import { findCueText, parseSubtitles } from '../../lib/subtitles.js';

const CUE_LOAD_RETRY_MS = 300;
const CUE_LOAD_ATTEMPTS = 10;
const ADOPT_RETRY_MS = 600;

const describe = (track, index) =>
  track.label || track.language || `Track ${index + 1}`;

const readCues = (track) => {
  const cues = [];
  if (!track.cues) return cues;
  for (const cue of track.cues) {
    cues.push({ start: cue.startTime, end: cue.endTime, text: cue.text });
  }
  return cues;
};

// Cues from a <track src> arrive asynchronously, so the list is re-read until
// it fills or we give up.
const loadTrackCues = (track, onReady) => {
  let attempts = 0;
  const poll = () => {
    const cues = readCues(track);
    if (cues.length > 0 || attempts >= CUE_LOAD_ATTEMPTS) {
      onReady(cues);
      return;
    }
    attempts += 1;
    setTimeout(poll, CUE_LOAD_RETRY_MS);
  };
  poll();
};

export const createTrackManager = (video, onCue, onSelection) => {
  const loaded = [];

  let cues = [];
  let selected = -1;
  let offset = 0;
  let lastText = '';
  let isNative = false;

  const nativeTracks = () => Array.from(video.textTracks);

  const silenceAll = () => {
    for (const track of nativeTracks()) track.mode = 'disabled';
  };

  const emit = (text) => {
    if (text === lastText) return;
    lastText = text;
    onCue(text);
  };

  const update = () => {
    if (selected === -1 || isNative) return;
    emit(findCueText(cues, video.currentTime + offset));
  };

  const list = () => {
    const items = nativeTracks().map((track, index) => ({
      id: index,
      label: describe(track, index),
    }));
    for (const entry of loaded) {
      items.push({ id: entry.id, label: entry.label });
    }
    return items;
  };

  const select = (id) => {
    selected = id;
    cues = [];
    emit('');
    onSelection(id);

    if (id === -1) {
      silenceAll();
      return;
    }

    const custom = loaded.find((entry) => entry.id === id);
    if (custom) {
      silenceAll();
      cues = custom.cues;
      update();
      return;
    }

    const tracks = nativeTracks();
    for (let index = 0; index < tracks.length; index++) {
      // 'hidden' keeps cues available while Gecko paints nothing, so the
      // custom renderer owns the look; 'showing' hands it back.
      if (index !== id) tracks[index].mode = 'disabled';
      else tracks[index].mode = isNative ? 'showing' : 'hidden';
    }
    if (isNative) return;
    loadTrackCues(tracks[id], (list) => {
      cues = list;
      update();
    });
  };

  const addCues = (label, text) => {
    const parsed = parseSubtitles(text);
    if (parsed.length === 0) return null;
    const id = 1000 + loaded.length;
    loaded.push({ id, label, cues: parsed });
    return id;
  };

  // A site that ships <track default> already has Gecko painting cues. Adopt
  // that track so it renders through our own layer instead of underneath the
  // controls, and so the menu tells the truth about what is on.
  const adoptShowingTrack = () => {
    if (selected !== -1) return true;
    const tracks = nativeTracks();
    for (let index = 0; index < tracks.length; index++) {
      if (tracks[index].mode !== 'showing') continue;
      select(index);
      return true;
    }
    return false;
  };

  video.addEventListener('timeupdate', update);
  video.addEventListener('seeked', update);

  if (!adoptShowingTrack()) setTimeout(adoptShowingTrack, ADOPT_RETRY_MS);

  return {
    list,
    select,
    addCues,
    getSelected: () => selected,
    getOffset: () => offset,
    setOffset: (value) => {
      offset = value;
      update();
    },
    setNative: (value) => {
      isNative = value;
      emit('');
      if (selected !== -1) select(selected);
    },
    isNative: () => isNative,
    destroy: () => {
      video.removeEventListener('timeupdate', update);
      video.removeEventListener('seeked', update);
      silenceAll();
    },
  };
};

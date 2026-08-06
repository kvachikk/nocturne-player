import { ADAPTERS, AUTO_ID } from './qualityadapters.js';

export { AUTO_ID };

// A streaming player builds its quality ladder after the first segments land,
// so the ladder is looked up again every time the sheet is opened rather than
// once when the session starts.
export const createQuality = (video) => {
  let adapter = null;
  let options = [];

  const detect = () => {
    for (const create of ADAPTERS) {
      try {
        const candidate = create(video);
        if (candidate !== null) return candidate;
      } catch (error) {
        console.warn('Nocturne: a quality adapter threw while probing', error);
      }
    }
    return null;
  };

  const refresh = () => {
    adapter = detect();
    if (adapter === null) {
      options = [];
      return options;
    }
    const listed = adapter.list();
    const auto = adapter.hasAuto ? [{ id: AUTO_ID, label: 'Auto' }] : [];
    options = listed.length > 0 ? auto.concat(listed) : [];
    return options;
  };

  const describe = () => {
    if (video.videoWidth === 0) return 'Set by the site';
    return `${video.videoWidth}×${video.videoHeight} · set by the site`;
  };

  return {
    refresh,
    describe,
    getOptions: () => options,
    getEngine: () => (adapter === null ? null : adapter.name),
    isSwitchable: () => options.length > 1,
    getCurrent: () => (adapter === null ? null : adapter.current()),
    select: (id) => {
      if (adapter === null) return false;
      return adapter.select(String(id)) === true;
    },
  };
};

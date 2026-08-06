import { ADAPTERS, AUTO_ID } from './qualityadapters.js';

export { AUTO_ID };

// A streaming player builds its quality ladder after the first segments land,
// so the ladder is looked up again every time the sheet is opened rather than
// once when the session starts.
export const createQuality = (video, host = null) => {
  let adapter = null;
  let options = [];

  const detect = () => {
    for (const create of ADAPTERS) {
      try {
        const candidate = create(video, host);
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

  // Says which of the two things went wrong, because "no quality here" and
  // "found the player, it is offering nothing yet" want different answers from
  // whoever is looking at it.
  const describe = () => {
    const size =
      video.videoWidth === 0
        ? ''
        : `${video.videoWidth}×${video.videoHeight} · `;
    if (adapter !== null) return `${size}${adapter.name}: no levels yet`;
    return `${size}set by the site`;
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

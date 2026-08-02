const labelFor = (source, index) => {
  const explicit = source.dataset.label || source.getAttribute('title');
  if (explicit) return explicit;
  const match = /(\d{3,4})[pP]/.exec(source.src);
  return match ? `${match[1]}p` : `Source ${index + 1}`;
};

// Only what can honestly be offered: a site streaming HLS or DASH picks the
// quality in its own JavaScript, out of reach from here.
export const createQuality = (video) => {
  const sources = Array.from(video.querySelectorAll('source'));

  const options = sources.map((source, index) => ({
    id: index,
    label: labelFor(source, index),
    src: source.src,
  }));

  const describe = () => {
    if (video.videoWidth === 0) return 'Set by the site';
    return `${video.videoWidth}×${video.videoHeight} · set by the site`;
  };

  const select = (id) => {
    const option = options[id];
    if (!option || video.currentSrc === option.src) return;

    const resumeAt = video.currentTime;
    const wasPlaying = !video.paused;

    const restore = () => {
      video.removeEventListener('loadedmetadata', restore);
      video.currentTime = resumeAt;
      if (wasPlaying) video.play().catch(() => {});
    };

    video.addEventListener('loadedmetadata', restore);
    video.src = option.src;
    video.load();
  };

  return {
    options,
    describe,
    select,
    isSwitchable: () => options.length > 1,
    getCurrent: () =>
      options.findIndex((option) => option.src === video.currentSrc),
  };
};

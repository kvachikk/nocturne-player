import {
  isHostEnabled,
  onSettingsChanged,
  readSettings,
} from '../lib/settings.js';
import { createBadge } from './controls/badge.js';
import { createVideoWatcher } from './detect.js';
import { createSession } from './session.js';

// A player embedded in an iframe should honour the decision the user made about
// the page they can actually see, so the embedding host counts too.
const resolveHosts = () => {
  const hosts = [location.host];
  if (window.top === window) return hosts;

  try {
    hosts.push(window.top.location.host);
  } catch {
    if (document.referrer !== '') {
      try {
        hosts.push(new URL(document.referrer).host);
      } catch (error) {
        console.error('Nocturne: unreadable referrer', error);
      }
    }
  }
  return hosts;
};

const isDocumentSupported = () =>
  document.contentType === 'text/html' &&
  location.protocol !== 'about:' &&
  location.protocol !== 'moz-extension:';

const start = async () => {
  if (!isDocumentSupported()) return;

  const hosts = resolveHosts();
  let session = null;

  const badge = createBadge();

  badge.onActivate = async (video) => {
    if (session) return;
    badge.hide();
    session = createSession(video, {
      onExit: () => {
        session = null;
        badge.show(video);
      },
    });
    await session.enter();
  };

  const watcher = createVideoWatcher((primary) => {
    if (session) return;
    if (primary) badge.show(primary);
    else badge.hide();
  });

  const apply = (settings) => {
    const isEnabled = hosts.every((host) => isHostEnabled(settings, host));
    if (isEnabled) {
      watcher.start();
    } else {
      watcher.stop();
      badge.hide();
    }
  };

  apply(await readSettings());
  onSettingsChanged(apply);

  browser.runtime.onMessage.addListener((message) => {
    if (message?.type !== 'query-state') return false;
    return Promise.resolve({ videoCount: watcher.getCount() });
  });
};

start().catch((error) => {
  console.error('Nocturne: failed to start', error);
});

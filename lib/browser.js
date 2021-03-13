import MurdockCore from './index';
import each from './utils/each';
import extend from './utils/extend';
import { listenerCore } from './utils/listener';
import {
  recordEvent,
  recordEvents
} from './record-events-browser';

import {
  deferEvent,
  deferEvents,
  queueCapacity,
  queueInterval,
  recordDeferredEvents
} from './defer-events';

import { extendEvent, extendEvents } from './extend-events';
import { initAutoTrackingCore } from './browser-auto-tracking';
import { getBrowserProfile } from './helpers/getBrowserProfile';
import { getDatetimeIndex } from './helpers/getDatetimeIndex';
import { getDomainName } from './helpers/getDomainName';
import { getDomNodePath } from './helpers/getDomNodePath';
import { getDomNodeProfile } from './helpers/getDomNodeProfile';
import { getScreenProfile } from './helpers/getScreenProfile';
import { getScrollState } from './helpers/getScrollState';
import { getUniqueId } from './helpers/getUniqueId';
import { getWindowProfile } from './helpers/getWindowProfile';
import { cookie } from './utils/cookie';
import { timer } from './utils/timer';
import { isLocalStorageAvailable } from './utils/localStorage';

// ------------------------
// Methods
// ------------------------
extend(MurdockCore.prototype, {
  recordEvent,
  recordEvents
});

extend(MurdockCore.prototype, {
  deferEvent,
  deferEvents,
  queueCapacity,
  queueInterval,
  recordDeferredEvents
});
extend(MurdockCore.prototype, {
  extendEvent,
  extendEvents
});
// ------------------------
// Auto-Tracking
// ------------------------
const initAutoTracking = initAutoTrackingCore(MurdockCore);
extend(MurdockCore.prototype, {
  initAutoTracking
});

// ------------------------
// Helpers
// ------------------------
extend(MurdockCore.helpers, {
  getBrowserProfile,
  getDatetimeIndex,
  getDomainName,
  getDomNodePath,
  getDomNodeProfile,
  getScreenProfile,
  getScrollState,
  getUniqueId,
  getWindowProfile
});

// ------------------------
// Utils
// ------------------------
const listener = listenerCore(MurdockCore);
extend(MurdockCore.utils, {
  cookie,
  listener,
  timer
});

MurdockCore.listenTo = (listenerHash) => {
  each(listenerHash, (callback, key) => {
    let split = key.split(' ');
    let eventType = split[0],
    selector = split.slice(1, split.length).join(' ');
    // Create an unassigned listener
    return listener(selector).on(eventType, callback);
  });
};

export let MurdockGlobals = undefined;
if (typeof webpackMurdockGlobals !== 'undefined') {
  MurdockGlobals = webpackMurdockGlobals;
}

if (isLocalStorageAvailable && localStorage.getItem('optout')) {
  MurdockCore.optedOut = true;
}

if (getBrowserProfile().doNotTrack === '1'
  || getBrowserProfile().doNotTrack === 'yes') {
  MurdockCore.doNotTrack = true;
}

export const Murdock = MurdockCore.extendLibrary(MurdockCore); // deprecated, left for backward compatibility
export const MurdockTracking = Murdock;
export default Murdock;

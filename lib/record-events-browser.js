import 'promise-polyfill/src/polyfill';
import 'whatwg-fetch';

import base64 from './utils/base64';
import each from './utils/each';
import extend from './utils/extend';

import DistributionAdops from './index';

import { getExtendedEventBody } from './extend-events';
import fetchRetry from './utils/fetchRetry';
import isUnique from './utils/unique';

// ------------------------------
// .recordEvent
// ------------------------------

export function recordEvent(eventCollectionOrConfigObject, eventBody, callback){
  let eventCollection = eventCollectionOrConfigObject;
  let useBeaconApi = false;
  let unique;
  let configObject;
  let clientConfig = this.config;

  if (typeof eventCollectionOrConfigObject === 'object'
    && eventCollectionOrConfigObject) {
    // slowly but surely we migrate to one object with all args
    configObject = eventCollectionOrConfigObject;
    eventCollection = eventCollectionOrConfigObject.collection
      || eventCollectionOrConfigObject.event_collection;
    eventBody = eventCollectionOrConfigObject.event;
    callback = eventCollectionOrConfigObject.callback;
    unique = eventCollectionOrConfigObject.unique;
  }


  const url = this.url('events', encodeURIComponent(eventCollection));
  let data = {event:eventCollectionOrConfigObject.collection};


  if (!eventCollection || typeof eventCollection !== 'string') {
    handleValidationError.call(this, 'Collection name must be a string.', callback);
    return;
  }

  extend(data, eventBody);

  // ------------------------------
  // Run extendEvent(s) transforms
  // ------------------------------
  const extendedEventsHash = {};
  getExtendedEventBody(extendedEventsHash, this.extensions.events);
  getExtendedEventBody(extendedEventsHash, this.extensions.collections[eventCollection]);
  getExtendedEventBody(extendedEventsHash, [data]);

  if (unique) {
    return isUnique(configObject, extendedEventsHash).then(isUniqueResult => {
      if (!isUniqueResult) {
        return Promise.resolve({
          created: false,
          message: '[NOT_UNIQUE] This event has already been recorded'
        });
      }
      return recordEvent.call(this, { ...eventCollectionOrConfigObject, unique: undefined });
    });
  }

  this.emit('recordEvent', eventCollection, extendedEventsHash);

  if (!DistributionAdops.enabled) {
    handleValidationError.call(this, 'DistributionAdops.enabled is set to false.', callback);
    return false;
  }

  if (DistributionAdops.optedOut) {
    return Promise.resolve({
      created: false,
      message: 'DistributionAdops.optedOut is set to true.'
    })
  }

  if (DistributionAdops.doNotTrack) {
    return Promise.resolve({
      created: false,
      message: 'DistributionAdops.doNotTrack is set to true.'
    })
  }

  return send.call(this, { url, extendedEventsHash, callback, configObject, eventCollection });
}

// ------------------------------
// .recordEvents
// ------------------------------

export function recordEvents(eventsHash, callback){
  const self = this;
  const url = this.url('events');


  if ('object' !== typeof eventsHash || eventsHash instanceof Array) {
    handleValidationError.call(this, 'First argument must be an object', callback );
    return;
  }

  if (arguments.length > 2) {
    handleValidationError.call(this, 'Incorrect arguments provided to #recordEvents method', callback);
    return;
  }

  // ------------------------------
  // Run extendEvent(s) transforms
  // ------------------------------
  const extendedEventsHash = {};
  each(eventsHash, function(eventList, eventCollection){
    // Find or create collection on new hash
    extendedEventsHash[eventCollection] = extendedEventsHash[eventCollection] || [];
    // Loop over each eventBody in the existing hash
    each(eventList, function(eventBody, index){
      // Create a new data object
      let extendedEventBody = {};
      // Process "events" transform pipeline
      getExtendedEventBody(extendedEventBody, self.extensions.events);
      // Process "collection" transform pipeline
      getExtendedEventBody(extendedEventBody, self.extensions.collections[eventCollection]);
      // Blend existing eventBody data into the result
      getExtendedEventBody(extendedEventBody, [eventBody]);
      // Push extendedEventBody into new hash
      extendedEventsHash[eventCollection].push(extendedEventBody);
    });
  });

  this.emit('recordEvents', extendedEventsHash);

  if (!DistributionAdops.enabled) {
    handleValidationError.call(this, 'DistributionAdops.enabled is set to false.', callback);
    return false;
  }

  if (DistributionAdops.optedOut) {
    return Promise.resolve({
      created: false,
      message: 'DistributionAdops.optedOut is set to true.'
    })
  }



  return send.call(this, { url, extendedEventsHash, callback });
}

function send({ url, extendedEventsHash, callback, configObject = {}, eventCollection}){
  const clientConfig = this.config;
  const requestType = configObject.requestType // specific method for one request
    || this.config.requestType; // global request type of client

  if (
    navigator && navigator.sendBeacon &&
    requestType === 'beaconAPI'
      // so you can send specific recordEvent() using beaconAPI
      // even if your global client's config prefers Fetch
  ) {
    var blob= new Blob([JSON.stringify({data:base64.encode(JSON.stringify(extendedEventsHash))})], {type : 'application/json; charset=UTF-8'}); // the blob
    navigator.sendBeacon(
      `${url}?`,
      blob
    );
    if (callback) {
      // Beacon API is not handling responses nor errors
      callback();
    }
    return this;
  }

  // this is IMAGE beacon, not the Beacon API. deprecated
    const getRequestUrl = this.url('events', encodeURIComponent(eventCollection), {
      data     : encodeURIComponent( base64.encode( JSON.stringify(extendedEventsHash) ) ),
      modified : new Date().getTime()
    });
    const getRequestUrlOkLength = getRequestUrl.length < getUrlMaxLength();

    if (getRequestUrlOkLength) {
      sendBeacon.call(this, getRequestUrl, callback);
    }
    else {
      if (callback) {
        callback('Beacon URL length exceeds current browser limit, and XHR is not supported.', null);
      }
    }


  return this;
}

function sendFetch(method, url, data, callback = undefined){
  const self = this;

  return fetchRetry(url, {
      method,
      body: data ? JSON.stringify(data) : '',
      mode: 'cors',
      redirect: 'follow',
      referrerPolicy: self.referrerPolicy() || 'unsafe-url',
      headers: {
        'Content-Type': 'application/json'
      },
      // keepalive: true, not supported for CORS yet
      retry: self.config.retry
    })
    .catch(connectionError => {
      if (typeof callback !== 'undefined') {
        callback.call(self, connectionError, null);
      }
      self.emit('error', connectionError);
      return Promise.reject(connectionError);
    })
    .then(response => {
      if (response.ok) {
        return response.json();
      }

      return response.json().then(responseJSON => {
        return Promise.reject({
          error_code: responseJSON.error_code,
          body: responseJSON.message,
          status: response.status,
          ok: false,
          statusText: response.statusText
        });
      });
    }).then(responseJSON => {
      const eventsSavedSuccessfuly = checkEventsSavedSuccessfuly(responseJSON);
      if (eventsSavedSuccessfuly) {
        if (typeof callback !== 'undefined') {
          callback.call(self, null, responseJSON);
        }
        return Promise.resolve(responseJSON);
      } else {
        if (typeof callback !== 'undefined') {
          callback.call(self, responseJSON, null);
        }
        self.emit('error', responseJSON);
        return Promise.reject(responseJSON);
      }
    });
}

function checkEventsSavedSuccessfuly(response){
  // single event
  if (typeof response.created !== 'undefined') {
    if (response.created) {
      return true;
    }
    return false;
  }
  // multiple events
  const responseKeys = Object.keys(response);
  const notSavedEvents = responseKeys
    .map(collection => {
      return response[collection].filter(event => !event.success);
    })
    .filter(collection => collection.length > 0);

  if (notSavedEvents.length === 0) {
    return true;
  }

  return false;
}



function handleValidationError(message, callback){
  const err = `Event(s) not recorded: ${message}`;
  this.emit('error', err);
  if (callback) {
    callback.call(this, err, null);
  }
}

function getUrlMaxLength(){
  if ('undefined' !== typeof window && navigator) {
    if (navigator.userAgent.indexOf('MSIE') !== -1 || navigator.appVersion.indexOf('Trident/') > 0) {
      return 1900;
    }
  }
  return 16000;
}

/*
  DEPRECATED METHODS
*/

// Image Beacon Requests
// DEPRECATED
function sendBeacon(url, callback){
  var self = this,
      img = document.createElement('img'),
      loaded = false;

  img.onload = function() {
    loaded = true;
    if ('naturalHeight' in this) {
      if (this.naturalHeight + this.naturalWidth === 0) {
        this.onerror();
        return;
      }
    } else if (this.width + this.height === 0) {
      this.onerror();
      return;
    }
    if (callback) {
      callback.call(self);
    }
  };
  img.onerror = function() {
    loaded = true;
    if (callback) {
      callback.call(self, 'An error occurred!', null);
    }
  };
  img.src = url + '&c=clv1';
}

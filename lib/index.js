import MurdockCore from './api-client';
import { setOptOut } from './utils/optOut';
import { queue } from './utils/queue';

MurdockCore.helpers = MurdockCore.helpers || {};
MurdockCore.prototype.observers = MurdockCore.observers || {};
// Install internal queue
MurdockCore.on('client', function(client){
  client.extensions = {
    events: [],
    collections: {}
  };
  
  if (!client.config.respectDoNotTrack) {
    this.doNotTrack = false;
  }

  if (typeof client.config.optOut !== 'undefined') {
    setOptOut(client.config.optOut);
    this.optedOut = client.config.optOut;
  }

  client.queue = queue(client.config.queue);
  client.queue.on('flush', function(){
    client.recordDeferredEvents();
  });
});


MurdockCore.prototype.referrerPolicy = function(str){
  if (!arguments.length) return this.config.referrerPolicy;
  this.config.referrerPolicy = (str ? String(str) : null);
  return this;
};

export default MurdockCore;

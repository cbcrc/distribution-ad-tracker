# Murdock

Automatically record pageviews, clicks, adviews  with a robust data model.

### Installation

Install this package from NPM 

```ssh
npm install ssh://bitbucket.org/cbcrc/distribution-ad-tracker.git --save
```

Or load it from  CDN

```html
<script crossorigin src="https://static.murdock.camr.io/lib.js"></script>
<script>
var MURDOCK_PROJECT="MY_PROJECT";
Murdock.ready(function(){
  const client = new Murdock();
  client.initAutoTracking();
});
</script>
```

### Configuration options

The following configuration options are available to let you specify which types of events to track (defaults shown):

```javascript
var MURDOCK_PROJECT="MY_PROJECT";
const client = new Murdock();
client.initAutoTracking({options});
```

Options:

|   Option  | Default   |  Description   |
| ------------ | ------------ | ------------ |
|   recordScrollState   |  true  |  see how far people scrolled |
|   recordPerformance|  true| collect performance data using the performance API https://developer.mozilla.org/en-US/docs/Web/API/Performance |
|   recordErrors|  true| record javascript errors |
|   recordPlayVideos|  true| record videos informations |
|   recordPaidVideos|  true| record videos ads|
|   recordAds|  true| record display ads using dfp library |
|   recordFacebookAds|  false| for Facebook instant articles|
|   checkAdBlock|  true| check if adblock is active |
|   recordPageViews|  true| collect a pageview event for every page visit |
|   shareUuidAcrossDomains|  false| share UUID cookies across subdomains|
|   collectUuid|  true| identify user, GDPR related option |
|   collectGeo|  true| identify geos infos from ip adress |



### Request types

We make requests using the [BeaconAPI](https://developer.mozilla.org/en-US/docs/Web/API/Beacon_API).
It's the fastest non-invasive way to track user behaviour.
Due its nature, BeaconAPI runs requests in the background, with no possibility  
to handle errors. If you want to handle errors, you need to use the [Fetch API](https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API).

```javascript
const client = new Murdock({
  requestType: 'beaconAPI' // beaconAPI, fetch
});
```

### Error Handling

```javascript
var MURDOCK_PROJECT="MY_PROJECT";
const client = new Murdock({
  requestType: 'fetch'
});

function myCustomErrorHandler(someError){
  console.error('Error reported:', someError);
}

client.initAutoTracking({
  recordPageViews: true,
  catchError: myCustomErrorHandler
});
```


### Customization

Add additional properties to any or all events with `extendEvent` or `extendEvents` methods:

```javascript
var MURDOCK_PROJECT="MY_PROJECT";
const client = new Murdock();

client.extendEvents(function(){
  return {
    app: {
      version: '4.1.5'
    },
    user: {
      display_name: 'Johnny 5',
      email_address: 'example@domain.com'
    }
    /* Custom properties for all events */
  };
});

client.extendEvent('pageviews', function(){
  return {
    page: {
      author_id: 'f123109vb1231200312bb',
      author_name: 'John Doe',
      last_updated: '2017-09-13T12:00:00-07:00'
    }
    /* Custom properties for pageviews event */
  };
});

client.initAutoTracking();
```
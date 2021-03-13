export const configDefault = {

  queue: {
    capacity: 5,
    interval: 5,
  },
  api_config:{
    host         : process.env.API_HOST,
    basePath     : 'v1/log',
    protocol     : 'https',
    requestType  : 'beaconAPI'
  },

  // connection problems - retry request
  retry: {
    limit: 3,
    initialDelay: 200,
    retryOnResponseStatuses: [
      408,
      500,
      502,
      503,
      504
    ]
  },

  unique: false, // record only unique events?
  // if so - store unique events hashes to compare
  cache: {
    /*
      storage: 'indexeddb', // uncomment for persistence
    */
    dbName: 'DistributionAds', // indexedDB name
    dbCollectionName: 'events',
    dbCollectionKey: 'hash',

    /*
      hashingMethod: 'md5', // if undefined - store as stringified JSON
    */
    maxAge: 60 * 1000, // store for 1 minute
  }
};

export default configDefault;

import pkg from '../package.json';

export function initAutoTrackingCore(lib) {
    return function (obj) {
        const client = this;
        const helpers = lib.helpers;
        const utils = lib.utils;

        const options = utils.extend({
            ignoreDisabledFormFields: true,
            ignoreFormFieldTypes: ['password'],
            recordAjaxCalls: false,
            recordPerformance: false,
            recordErrors: true,
            recordPlayVideos: true,
            recordDOM: false,
            recordPaidVideos: true,
            recordAds: true,
            recordFacebookAds: false,
            checkAdBlock: true,
            recordClicks: false,
            recordClicksPositionPointer: false,
            recordFormSubmits: false,
            recordPageViews: true,
            recordPageViewsOnExit: true,
            recordScrollState: true,
            shareUuidAcrossDomains: false,
            collectUuid: true,
            collectGeo: true,
            catchError: undefined // optional, function(someError) - error handler
        }, obj);

        if (client.config.requestType === 'beaconAPI' && options.catchError) {
            throw `You cannot use the BeaconAPI and catchError function in the same time, because BeaconAPI ignores errors. For requests with error handling - use requestType: 'fetch'`;
            return;
        }

        if (
            client.config.requestType === 'jsonp' // jsonp is deprecated, it's the default value from old keen's client
        ) {
            if (options.catchError) {
                client.config.requestType = 'fetch';
            } else {
                client.config.requestType = 'beaconAPI';
            }
        }

        let now = new Date();
        let allTimeOnSiteS = 0;
        let allTimeOnSiteMS = 0;
        if (typeof document !== 'undefined') {
            let hidden;
            let visibilityChange;
            if (typeof document.hidden !== "undefined") {
                hidden = "hidden";
                visibilityChange = "visibilitychange";
            } else if (typeof document.msHidden !== "undefined") {
                hidden = "msHidden";
                visibilityChange = "msvisibilitychange";
            } else if (typeof document.webkitHidden !== "undefined") {
                hidden = "webkitHidden";
                visibilityChange = "webkitvisibilitychange";
            }

            const handleVisibilityChange = () => {
                if (document[hidden]) {
                    allTimeOnSiteS += getSecondsSinceDate(now);
                    allTimeOnSiteMS += getMiliSecondsSinceDate(now);
                    return;
                }
                now = new Date();
            }
            if (typeof document.addEventListener !== "undefined" ||
                hidden !== undefined) {
                document.addEventListener(visibilityChange, handleVisibilityChange, false);
            }
        }

        const cookie = new utils.cookie('distribution-adops');

        const domainName = helpers.getDomainName(window.location.hostname);
        const cookieDomain = domainName && options.shareUuidAcrossDomains ? {
            domain: '.' + domainName
        } : {};

        let uuid;
        if (options.collectUuid) {
            uuid = cookie.get('uuid');
            if (!uuid) {
                uuid = helpers.getUniqueId();
                cookie.set('uuid', uuid, cookieDomain);
            }
        }

        let page_id;
        if (!page_id) {
            page_id = helpers.getUniqueId();
        }

        let geo = {};
        if (options.collectGeo === true) {

            if (typeof geoip_city === "function")
                geo.city = geoip_city();

            if (typeof geoip_region === "function")
                geo.region = geoip_region();

            if (typeof geoip_country_name === "function")
                geo.country = geoip_country_name();

            if (typeof geoip_latitude === "function" && typeof geoip_longitude === "function")
                geo.location = {"lat": geoip_latitude(), "lon": geoip_longitude()};
        }
        let is_adblock_active = false;
        if (options.checkAdBlock === true) {
            let ad = document.createElement('div');

            ad.id = 'adcontent';

            document.body.appendChild(ad);

            is_adblock_active = (ad.offsetLeft === 0 && ad.offsetTop === 0);
        }

        let initialReferrer = cookie.get('initialReferrer');
        if (!initialReferrer) {
            initialReferrer = document && document.referrer || undefined;
            cookie.set('initialReferrer', initialReferrer, cookieDomain);
        }

        let scrollState = {};
        if (options.recordScrollState) {
            scrollState = helpers.getScrollState();
            utils.listener('window').on('scroll', () => {
                scrollState = helpers.getScrollState(scrollState);
            });
        }

        const addons = [];

        client.extendEvents(function () {
            const browserProfile = helpers.getBrowserProfile();
            return {
                tracked_by: pkg.name + '-' + pkg.version,
                local_time_full: new Date().toISOString(),
                page_id: page_id,
                user: {
                    uuid
                },
                geo: geo,
                page: {
                    title: document ? document.title : null,
                    description: browserProfile.description,
                    scroll_state: scrollState,
                    time_on_page: allTimeOnSiteS > 0 ? allTimeOnSiteS : getSecondsSinceDate(now),
                    time_on_page_ms: allTimeOnSiteMS > 0 ? allTimeOnSiteMS : getMiliSecondsSinceDate(now)
                },
                project: window.MURDOCK_PROJECT !== 'undefined' ? window.MURDOCK_PROJECT : null,
                user_agent: navigator.userAgent,
                tech: {
                    profile: browserProfile,
                    is_adblock_active: is_adblock_active
                },
                url: {
                    full: window ? window.location.href : '',
                },

                referrer: {
                    initial: initialReferrer,
                    full: document ? document.referrer : '',
                },

                time: {
                    timestamp: new Date().toISOString(),
                    time_zone: Intl.DateTimeFormat().resolvedOptions().timeZone
                },

                dist: {
                    timestamp: new Date().toISOString(),
                    addons,
                }
            };
        });

        if (options.recordClicks === true) {
            utils.listener('a, a *').on('click', function (e) {
                const el = e.target;
                let event = {
                    element: helpers.getDomNodeProfile(el),
                    local_time_full: new Date().toISOString(),
                };

                // pointer position tracking
                if (options.recordClicksPositionPointer === true) {
                    const pointer = {
                        x_position: e.pageX,
                        y_position: e.pageY,
                    }
                    event = {...event, pointer};
                }

                if (options.catchError) {
                    return client
                        .deferEvent('clicks', event
                        ).catch(err => {
                            options.catchError(err);
                        });
                }

                return client
                    .deferEvent('clicks', event);
            });
        }


        if (options.recordPageViews === true) {
            if (options.catchError) {
                client
                    .deferEvent('pageviews')
                    .catch(err => {
                        options.catchError(err);
                    });
            } else {
                client
                    .deferEvent('pageviews');
            }
        }

        if (options.recordPageViewsOnExit && typeof window !== 'undefined') {
            window.addEventListener('beforeunload', () => {
                //client.config.requestType = 'beaconAPI'; // you can run beforeunload only with beaconAPI
                client.deferEvent(
                    'pageview_exit'
                );
                client.recordDeferredEvents()
            });
        }


        if (options.recordFacebookAds === true) {
            client.deferEvent('fb_ads');

        }
        if (options.recordPlayVideos === true) {

            const record_video_event = function (type, video) {
                is_play_recorded = true;
                let event_data = {
                    event_data: {
                        "event": type,
                        "url": video.src,
                        "duration": parseInt(video.duration),
                        "current_time": parseInt(video.currentTime),
                    }
                };
                client.deferEvent(
                    'videos',
                    event_data
                );
            };

            let is_play_recorded = false;
            const send_play_record_event = function (video) {
                if (is_play_recorded === true)
                    return;
                is_play_recorded = true;
                record_video_event("play", video);
            };
            const locateVideoElement = function _self(DOM) {
                if (!DOM)
                    return;
                let video = DOM.querySelector("video");
                if (video) return video;
                let iframes = DOM.querySelectorAll("iframe");
                for (let iframe of iframes) {
                    try {
                        video = _self(iframe.contentDocument.body);
                    } catch (e) {
                    }
                    if (video) return video
                }
                return null
            };
            let observers = [];
            let observe = function _self(DOM = document.body, _window = window, debug = false) {
                const gotVideo = function (video) {
                    const isVideoPlaying = !!(video.currentTime > 0 && !video.paused && !video.ended && video.readyState > 2);
                    //if(isVideoPlaying)
                    //send_play_record_event(video);

                    video.addEventListener('play', function () {
                        send_play_record_event(this);
                    });
                    /*
                    video.addEventListener('timeupdate', function() {
                      let percentage_progress = this.currentTime * 100 / this.duration;
                      if(percentage_progress===25){
                        record_video_event("first_quartile",this);
                      }
                      else if(percentage_progress===50){
                        record_video_event("mid_point",this);
                      }
                      else if(percentage_progress===75){
                        record_video_event("third_quartile",this);
                      }
                    });

                     */
                    video.addEventListener('seeking', function () {
                        record_video_event("seeking", this);
                    });
                    video.addEventListener('end', function () {
                        record_video_event("end", this);
                    });

                    observers.forEach(obs => {
                        obs.disconnect()
                    })
                };

                {
                    // Existing video
                    let video = locateVideoElement(DOM);
                    if (video) gotVideo(video)
                }
                {
                    // Existing iframe
                    DOM.querySelectorAll("iframe").forEach(iframe => {
                        try {
                            iframe.contentWindow.onload = function () {
                                _self(iframe.contentDocument.body, iframe.contentWindow)
                            }
                        } catch (e) {

                        }

                    })
                }
                let callback = function (mutationList) {
                    mutationList.forEach((mutation) => {
                        mutation.addedNodes.forEach((node) => {
                            const search = function (node, tag) {
                                if (node.tagName && node.tagName.toUpperCase() === tag.toUpperCase()) {
                                    return node
                                }
                                return node.querySelector && node.querySelector(tag)
                            };

                            {
                                // Dynamically added video
                                let video = search(node, "video");
                                if (video) gotVideo(video)
                            }

                            {
                                // Dynamically added iframe
                                let iframe = search(node, "iframe");
                                if (iframe) {
                                    try {
                                        iframe.contentWindow.setTimeout(function () {

                                            _self(iframe.contentDocument.body, iframe.contentWindow)

                                        }, 1000);
                                    } catch (e) {

                                    }
                                }
                            }

                        })
                    })
                };
                let observer = new _window.MutationObserver(callback);
                observer.observe(DOM, {
                    childList: true,
                    attributes: false,
                    subtree: true
                });
                observers.push(observer);
                window.observers = observers;
            };
            observe(document.body);
        }

        if (options.recordDOM === true) {
            client.deferEvent({
                collection: 'DOM',
                event: {
                    "dom": {
                        "head": document.head.innerHTML,
                        "body": document.body.innerHTML,
                    }
                }
            });
        }


        if (options.recordPaidVideos === true) {
            let adId, creativeId;
            window.addEventListener("message", event => {
                if (/^ima:\/\//.test(event.data)) {
                    let json_data = JSON.parse(event.data.substr(6));
                    if (json_data && json_data.name === "adsManager" && ["remainingTime", "adProgress"].indexOf(json_data.type) === -1) {

                        if ("adData" in json_data.data) {
                            creativeId = json_data.data["adData"]["creativeId"];
                            adId = json_data.data["adData"]["adId"];

                        }
                        let ad_data = JSON.parse(JSON.stringify(json_data.data));
                        ad_data.creativeId = creativeId;
                        ad_data.adId = adId;
                        let event_data = {ad_event: json_data.type, ad_data: ad_data};
                        client.deferEvent('event_data', event_data);

                    }
                } else if ("type" in event && event.type === "AdError") {
                    let event_data = {
                        ad_event: "vast_error", ad_data: {
                            "vast_message": event.message, "creativeId": creativeId, "adId": adId
                        }
                    };
                    client.deferEvent('event_data', event_data);
                }
            });

        }

        if (options.recordErrors === true) {

            window.onerror = function (message, file, line, column, errorObj) {
                let error_data = {msg: message, file: file, line: line, column: column};
                if (errorObj) {
                    error_data.trace = errorObj.stack
                }

                client.deferEvent('errors', {event_data: error_data});
                return false;
            };
        }
        if (options.recordAds === true) {

            if (window.googletag && window.googletag.apiReady) {
                window.googletag.pubads().addEventListener('slotRenderEnded', function (event) {
                    let resp = {
                        event_data: {
                            advertiserId: event.advertiserId,
                            size: event.size,
                            campaignId: event.campaignId,
                            creativeId: event.creativeId,
                            companyIds: event.companyIds,
                            sourceAgnosticLineItemId: event.sourceAgnosticLineItemId,
                            sourceAgnosticCreativeId: event.sourceAgnosticCreativeId,
                            lineItemId: event.lineItemId,
                            isEmpty: event.isEmpty,
                            labelIds: event.labelIds,
                            isBackfill: event.isBackfill,
                            dfpPath: event.slot.getSlotId().toString()
                        }

                    };
                    client.deferEvent('adview', resp);
                });

            }

        }

        if (options.recordPerformance === true) {
            const record_performance = function (entry) {
                try {
                    let event = {
                        event_data: {
                            "name": entry.name,
                            "type": entry.initiatorType,
                            "duration": entry.duration,
                            "transfer_size": entry.transferSize,
                        }
                    };
                    client.deferEvent('performance', event);
                } catch (e) {

                }
            };
            if ("performance" in window) {
                // OK, yes. Check PerformanceObserver support
                if ("PerformanceObserver" in window) {
                    var observer = new PerformanceObserver(list => {
                        list.getEntries().forEach(entry => {
                            if (["iframe", "navigation", "xmlhttprequest", "fetch"].indexOf(entry.initiatorType) >= 0) {
                                record_performance(entry)
                            }

                        })
                    });
                    observer.observe({entryTypes: ['resource', 'navigation']});
                }
                var pageNav = performance.getEntriesByType("navigation")[0];
                record_performance(pageNav)
            }


        }
        if (options.recordAjaxCalls === true) {
            XMLHttpRequest.prototype._send = XMLHttpRequest.prototype.send;

            XMLHttpRequest.prototype.send = function (data) {
                const startTime = new Date();

                this.addEventListener('load', () => {
                    const endTime = new Date();
                    const costTime = endTime - startTime;


                    let event = {
                        event_data: {
                            cost_time: costTime,
                            url: this.responseURL,
                            status: this.status
                        }
                    };
                    client.deferEvent('ajax', event);

                });

                this._send(data);
            };

        }
        return client;
    };
}

function getSecondsSinceDate(date) {
    return Math.round(getMiliSecondsSinceDate(date) / 1000);
}

function getMiliSecondsSinceDate(date) {
    return new Date().getTime() - date.getTime();
}

/*!
 * Connect - Cloudant
 * Copyright(c) 2016 IXONOS <dastagiri.komali@ixonos.com>
 *
 * MIT Licensed
 *
 * This is an adaption from connect-couchbase, see:
 * https://github.com/visionmedia/connect-couchbase
 */

'use strict'

var _ = require("underscore");
var util = require("util");
var Promise = require('promise');
/**                                                                                    ƒ
 * Module dependencies.
 */

var debug = require('debug')('connect:cloudant');

/**
 * One day in seconds.
 */

var oneDay = 86400;

/**
 * No op
 */
var noop = function () {
};

/**
 * Return the `CloudantStore` extending `express`'s session Store.
 *
 * @param {object} express session
 * @return {Function}
 * @api public
 */

module.exports = function (session) {

    var self;
    var cloudantDB;


    /**
     * Express's session Store.
     */

    var Store = session.Store;

    /**
     * Initialize CloudantStore with the given `options`.
     *
     * @param {Object} options
     *      {
     *          url: cloudant url ,https://@UserName:@Password@UserName.cloudant.com
     *          databaseName: 'sessions' (default sessions)
     *          ttl: 86400,
     *          prefix: 'sess',
     *          operationTimeout:2000,
     *          connectionTimeout:2000,
     *      }
     * @api public
     */

    function CloudantStore(options) {
        self = this;
        options = options || {};
        Store.call(this, options);
        this.prefix = null == options.prefix
            ? 'sess:'
            : options.prefix;

        var connectOptions = {};
        if (options.hasOwnProperty("url")) {
            connectOptions.url = options.url;
        }


        if (options.hasOwnProperty("databaseName")) {
            connectOptions.databaseName = options.databaseName;
        }


        if (options.hasOwnProperty("connectionTimeout")) {
            connectOptions.connectionTimeout = options.connectionTimeout;
        }

        if (options.hasOwnProperty("operationTimeout")) {
            connectOptions.operationTimeout = options.operationTimeout;
        }

        var Cloudant = require('cloudant');

        Cloudant(options.url, function (err, cloudant) {
            if (err) {
                debug("ERROR: Could not connect to cloudant with database: " + options.databaseName);
                self.emit('disconnect');
            } else {
                self.cloudantDB = cloudant.db.use(options.databaseName);
                self.cloudantDB.connectionTimeout = connectOptions.connectionTimeout || 10000;
                self.cloudantDB.operationTimeout = connectOptions.operationTimeout || 10000;
                self.emit('connect');
            }
        });


        this.ttl = options.tll || null;
    }


    /**
     * Promisify wrapper for Cloudant Get
     *
     * @param sid  session id
     * @param rejectIfError  , true promise will resolve is rejected
     * @returns {Promise}
     */
    var promisifyGet = function (sid, rejectIfError) {
        return new Promise(function (fulfill, reject) {
            self.cloudantDB.get(sid, function (err, data) {
                if( rejectIfError && err )
                    reject(err);

                fulfill(data);
            });
        });
    };
    /**
     * Promisify wrapper for Cloudant Set,
     * @param sessionDoc  sessionDocument json
     * @param _id     updated session id
     * @param _rev    updated session rev
     * @returns {Promise}
     */
    var promisifySet = function (sessionDoc) {
        return new Promise(function (fulfill, reject) {
            self.cloudantDB.insert(sessionDoc, sessionDoc.sid, function (err, data) {
                if (err)reject(err);
                fulfill(data);
            });
        });
    }
    /**
     * Promisify wrapper for destroy
     *
     * @param sid  session id , to be
     * @param _rev
     * @returns {Promise}
     */
    var promisifyDestroy = function (sid, _rev) {
        return new Promise(function (fulfill, reject) {
            self.cloudantDB.destroy(sid, _rev, function (err, data) {
                if (err)reject(err);
                fulfill(data);
            });
        });
    }


    /**
     * Inherit from `Store`.
     */

    CloudantStore.prototype.__proto__ = Store.prototype;

    /**
     * Attempt to fetch session by the given `sid`.
     *
     * @param {String} sid
     * @param {Function} fn
     * @api public
     */

    CloudantStore.prototype.get = function (sid, fn) {
        if ('function' !== typeof fn) {
            fn = noop;
        }
        sid = this.prefix + sid;
        debug('GET "%s"', sid);

        promisifyGet(sid, true).then(function (fetchSessionData) {
            debug("GET data %s", util.inspect(fetchSessionData));
            return fn(null, fetchSessionData);
        }, function (fetchSessionError) {
            //Handle Key Not Found error
            debug("GET err %s", util.inspect(fetchSessionError));
            if (fetchSessionError && fetchSessionError.code == 13) {
                return fn();
            }
            if (fetchSessionError) return fn(fetchSessionError);
        });
    };

    /**
     * Commit the given `sess` object associated with the given `sid`.
     *
     * @param {String} sid
     * @param {Session} sess
     * @param {Function} fn
     * @api public
     */

    CloudantStore.prototype.set = function (sid, sess, fn) {
        if ('function' !== typeof fn) {
            fn = noop;
        }
        sid = this.prefix + sid;
        try {
            var maxAge = sess.cookie.maxAge
                , ttl = this.ttl
                , sess = JSON.stringify(sess);

            ttl = ttl || ('number' == typeof maxAge
                ? maxAge / 1000 | 0
                : oneDay);

            var sessionDoc = asJson(sid, sess, ttl);
            debug('SETEX document  "%s" ', JSON.stringify(sessionDoc));
            promisifyGet(sid, false).then(function (fetchedSessionData) {
                if (fetchedSessionData && fetchedSessionData._rev) {
                    sessionDoc._rev = fetchedSessionData._rev;
                }
                promisifySet(sessionDoc).then(function (updSessionData) {
                    debug('Session Update complete');
                    fn && fn.apply(this, arguments);
                }, function (sessionUpdateError) {
                    fn && fn.apply(this, arguments);
                })
            });
        } catch (err) {
            debug("Error# cloudant error", err);
            fn && fn(err);
        }
    };

    var asJson = function (sid, sess, ttl) {
        debug("INFO, As json sid , session , ttl [", sid, ",", sess, ",", ttl, "]");
        if (!sess)  sess = { };
        var params = { "sid": sid, "ttl": ttl};
        return JSON.parse(_.extend(sess, params));
    }

    /**
     * Destroy the session associated with the given `sid`.
     *
     * @param {String} sid
     * @api public
     */

    CloudantStore.prototype.destroy = function (sid, fn) {
        if ('function' !== typeof fn) {
            fn = noop;
        }
        sid = this.prefix + sid;

        promisifyGet(sid).then(function (fetchedSessionData) {
            promisifyDestroy(sid, fetchedSessionData._rev).then(function (data) {
                fn && fn.apply(this, arguments);
            }, function (err) {
                err || debug('Session destroy complete');
                fn && fn.apply(this, arguments);
            });
        }, function (err) {
            if (err && err.code == 13) {
                return fn();
            }
            return fn(err);
        })
    };


    /**
     * Refresh the time-to-live for the session with the given `sid`.
     *
     * @param {String} sid
     * @param {Session} sess
     * @param {Function} fn
     * @api public
     */

    CloudantStore.prototype.touch = function (sid, sess, fn) {
        if ('function' !== typeof fn) {
            fn = noop;
        }

        var maxAge = sess.cookie.maxAge
            , ttl = this.ttl
            , sess = JSON.stringify(sess);

        ttl = ttl || ('number' == typeof maxAge
            ? maxAge / 1000 | 0
            : oneDay);


        debug('EXPIRE "%s" ttl:%s', sid, ttl);
        self.cloudantDB.touch(this.prefix + sid, ttl, fn);

    };

    return CloudantStore;
};
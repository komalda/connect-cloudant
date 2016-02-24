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
/**
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
 * Return the `CouchbaseStore` extending `express`'s session Store.
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
                console.log("Could not connect to cloudant with database: " + options.databaseName);
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
        self.cloudantDB.get(sid, function (err, data) {
            //Handle Key Not Found error
            debug("GET data %s", util.inspect(data));
            if (err && err.code == 13) {
                return fn();
            }
            if (err) return fn(err);
            // debug('GOT %s', data);
            return fn(null, data);
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

            var jsonDoc = asJson(sid,sess, ttl);
            debug('SETEX document  "%s" ', JSON.stringify(jsonDoc));

            self.cloudantDB.insert(jsonDoc, sid, function (err) {
                err || debug('Session Set complete');
                fn && fn.apply(this, arguments);
            });

        } catch (err) {
             debug("Error", err);
             fn && fn(err);
        }
    };

    function asJson(sid, sess, ttl){
         debug("INFO, As json sid , session , ttl [", sid,",", sess,",",ttl, "]");
         if(!sess)  sess = { };
         var params = { "sid":sid, "ttl":ttl};
        return JSON.parse(_.extend(sess,params));
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
        self.cloudantDB.get(sid, function(err, doc) {
            //err || debug('Session fetch for remove');
            if (err) {
                debug("Session fetch error");
            } else {
                self.cloudantDB.destroy(sid, doc._rev, fn);
            }
        });

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
/**
 * Module dependencies.
 */

var assert = require('assert')
    , session = require('express-session')
    , CloudantStore = require('./')(session)
    , util = require("util")
    , debug = require("debug");

//change the url
var store = new CloudantStore({url: "https://@Username:@Password@Username-bluemix.cloudant.com",
  databaseName:"sessions"});

store.on('connect', function(){
    console.log("Connected to cloudant sessions ");

    var testJson = { cookie: { maxAge: 2000 }, name: 'cm' };
    // #set()
    store.set('123', testJson, function(err, ok){
        assert.ok(!err, '#set() got an error');
        assert.ok(ok, '#set() is not ok');

        testJson._id=ok.id;
        testJson._rev=ok.rev;

        // #get()
        store.get('123', function(err, data){
            console.log("RETRIEVED: " + data.name);
            assert.ok(!err, '#get() got an error');
            assert.deepEqual(testJson, data);
            // #set null
            store.set('123', testJson, function(err){
                if (err) {
                    console.log("AN ERROR OCCURRED SETTING SESSION: " + err);
                }

                store.destroy('123', function(err){
                    if (err) {
                        console.log("AN ERROR OCCURRED DESTROYING SESSION: " + err);
                    }

                    console.log('done');
                    process.exit(0);
                });
            });
            throw new Error('Error in fn');
        });
    });
});

process.once('uncaughtException', function (err) {
    if (err) console.log ("ERRR: wrong err [",err,"]");
    assert.ok(err.message === 'Error in fn', '#get() catch wrong error, err ');
});
/**
 * Module dependencies.
 */

var assert = require('assert')
    , session = require('express-session')
    , CloudantStore = require('./')(session)
    , util = require("util")
    , debug = require("debug")("cloudant:test");

//change the url
//var store = new CloudantStore({url: "https://@Username:@Password@Username-bluemix.cloudant.com",
//  databaseName:"sessions"});

var store = new CloudantStore({url: "https://6970644b-4d87-43e2-9c77-4aaf9692fd13-bluemix:eb106779abcd3083bcc6bc234ba6183aff37eecae6a207c9e867ac9bcb79c0a4@6970644b-4d87-43e2-9c77-4aaf9692fd13-bluemix.cloudant.com",
  databaseName:"sessions"});



store.on('connect', function(){
    console.log("Connected to cloudant sessions ");

    var testJson = { cookie: { maxAge: 2000 }, name: 'cm' };
    // #set()
    store.set('1234', testJson, function(err, ok){
        assert.ok(!err, '#set() got an error');
        assert.ok(ok, '#set() is not ok');

        testJson._id=ok.id;
        testJson._rev=ok.rev;

        // #get()
        store.get('1234', function(err, data){
            console.log("RETRIEVED: " + data.name);
            assert.ok(!err, '#get() got an error');
            assert.deepEqual(testJson, data);
            // #set null
            store.set('1234', testJson, function(err){
                if (err) {
                    debug("##AN ERROR OCCURRED SETTING SESSION: " + err);
                }else{
                    debug("Updated session OK")
                }
                assert.ok(!err, "#set() got an err");
                store.touch('1234',testJson, function(err,touchData){
                     assert.ok(!err,"#touch() got an err");
                    store.destroy('1234', function(err){
                        if (err) {
                            debug("AN ERROR OCCURRED DESTROYING SESSION: " + err);
                        }
                        assert.ok(!err, "#destroy() got an err");
                        debug('### done');
                        process.exit(0);
                    });
                })

            });

        });
    });
});

process.once('uncaughtException', function (err) {
    if (err) console.log ("ERRR: wrong err [",err,"]");
    assert.ok(err.message === 'Error in fn', '#get() catch wrong error, err ');
});
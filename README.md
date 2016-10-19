# Connect-CloudantDb
=======


# NodeJS Session Store for Cloudant backed applications.

`npm install connect-cloudantdb`

This is based on `connect-couchbase`, found at https://github.com/christophermina/connect-couchbase. This project is a fork of connect-cloudant with bugs fixed. The maintainer of the original connect-cloudant project could not be reached in order to accept the pull-requests.

You can use like below, when setting up your Express 4.x app:
-----

```
var session = require('express-session');
var CloudantStore = require('connect-cloudant')(session);
var cloudantStore = new CloudantStore({
     url: cloudant database url [ https://@UserName:@Password@UserName.cloudant.com ] //required
     databaseName: 'sessions' (default sessions)  //optional
     ttl: 86400,                 //optional
     prefix: 'sess',             //optional
     operationTimeout:2000,      //optional
     connectionTimeout:2000,      //optional
});



cloudantStore.on('connect', function() {
    debug("Cloudant Session store is ready for use");
});

cloudantStore.on('disconnect', function() {
    debug("An error occurred connecting to Cloudant Session Storage");
});

var app = express();
app.use(session({
    store: cloudantStore,
    secret: 'your secret',
    cookie: {maxAge:24*60*60*1000} //stay open for 1 day of inactivity
}));

```
Please file any bugs at https://github.com/stanix/connect-cloudant/issues

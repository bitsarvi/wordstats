/**
 * Copyright 2016, Google, Inc.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *    http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

// [START app]
'use strict';

// [START setup]
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');
const express = require('express');
const morgan = require('morgan');
const nconf = require('nconf');
const path = require('path');
const randomstring = require('randomstring');
const redis = require('redis');

const app = express();
// [END setup]

// [START client]

// read in keys and secrets. You can store these in a variety of ways.
// I like to use a keys.json file that is in the .gitignore file,
// but you can also store them in environment variables
nconf.argv().env().file('keys.json');

const client = redis.createClient(
  nconf.get('redisPort') || '6379',
  nconf.get('redisHost') || 'redis-master',
  {
    'auth_pass': nconf.get('redisKey'),
    'return_buffers': true
  }
).on('ready', (err) => console.log("Connected to redis"))
.on('error', (err) => console.error('ERR:REDIS:', err));
// [END client]

var template_vars = {
    name: '',
    chunk_size: 200
};

function InsertCookie(res) {
    var userid = randomstring.generate();
    res.cookie('MySessionID', userid, { httpOnly: true });
    template_vars.name = '';
    res.render('index', template_vars);
}

function CheckUserID(cookie, res) {
    client.hget("active", cookie, function (err, value) {
        if (value == null) {
            InsertCookie(res);
        } else {
            CheckUserName(value, res);
        }
    });
}
function CheckUserName(userid, res) {
    var userkey = GetUserKey(userid);
    client.hget(userkey, "name", function (err, value) {
        var name = '';
        if (value != null) {
            name = value;
        }
        template_vars.name = name;
        res.render('index', template_vars );
    });
}

function RegisterUser(name, cookie, res) {
    client.incr("next_user_id", function(err, value) {
        var userkey = GetUserKey(value);
        client.multi()
            .hset("active", cookie, value)
            .hset(userkey, "name", name)
            .exec(function(err, replies) {
                res.json({ 'name': name });
            });
    });
}

function GetUserKey(userid) {
    return 'user:' + userid;
}

function GetUniqKey(userid) {
    return 'uniq:' + userid;
}
// view engine setup
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(cookieParser());
app.use('/css', express.static(path.join(__dirname, 'public')));

app.post('/register', function (req, res) {
    console.log("Registering %s" , req.body.name);
    var cookie = req.cookies.MySessionID;
    // console.log("Password %s" , cookie);
    RegisterUser(req.body.name, cookie, res);
});

app.get('/', function (req, res) {
    var cookie = req.cookies.MySessionID;
    if (cookie == undefined) {
        InsertCookie(res);
    } else {
        CheckUserID(cookie, res);
    }
});

app.use(function(req, res) {
    console.log("Could not find %s" , req.url);
    res.status(404).send('Page not found');
});


var server = app.listen(process.env.PORT || 8080, function () {
       var host = server.address().address
       var port = server.address().port
       
       console.log("wordstats-ui app listening at http://%s:%s", host, port)
});

console.log('started web process');

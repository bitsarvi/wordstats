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


function UpdateStats(userid, total, res) {
    client.hincrby(GetUserKey(userid), 'total_words', total, function(err, new_total) {
        client.hincrby(GetUserKey('all'), 'total_words', total, function(err, alltotal) {
            client.zadd('global_counts', new_total, userid, function(err, value) {
            });
        });
    });

}

function GetUserKey(userid) {
    return 'user:' + userid;
}

function GetUniqKey(userid) {
    return 'uniq:' + userid;
}

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(cookieParser());


app.post('/upload/text', function (req, res) {
    var cookie = req.cookies.MySessionID;
    client.hget("active", cookie, function (err, userid) {
        if (userid != null) {
            var key = GetUniqKey(userid);
            var chunks = JSON.parse(req.body.chunks);
            var i;
            var total = 0;
            for (i = 0; i < chunks.length; i++) {
                total += chunks[i].length;
                var cmds = chunks[i].map(function(el) {
                    return [ 'ZINCRBY', key, '1', el ];
                });
                var cmds2 = chunks[i].map(function(el) {
                    return [ 'ZINCRBY', GetUniqKey('all'), '1', el ];
                });

                client.batch(cmds.concat(cmds2))
                      .exec(function(err, replies) {
                            if (i == chunks.length) {
                                UpdateStats(userid, total, res);
                            }
                        });
            }
        }
    });
});


app.use(function(req, res) {
    console.log("Could not find %s" , req.url);
    res.status(404).send('Page not found');
});


var server = app.listen(process.env.PORT || 8080, function () {
       var host = server.address().address
       var port = server.address().port
       
       console.log("wordstats-processor app listening at http://%s:%s", host, port)
});

console.log('started web process');

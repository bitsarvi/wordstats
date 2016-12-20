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
  nconf.get('redisHost') || 'redis-slave',
  {
    'auth_pass': nconf.get('redisKey'),
    'return_buffers': true
  }
).on('ready', (err) => console.log("Connected to redis"))
.on('error', (err) => console.error('ERR:REDIS:', err));
// [END client]


function GetUserKey(userid) {
    return 'user:' + userid;
}

function GetUniqKey(userid) {
    return 'uniq:' + userid;
}

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(cookieParser());


app.get('/stats/self', function (req, res) {
    var cookie = req.cookies.MySessionID;
    client.hget("active", cookie, function (err, userid) {
        var data = { 'userid': '', 'username': '', 'total_words': '0',
                     'uniq_words': '0', 'frequent_words': '', 'rank': '' };
        if (userid != null) {
            data['userid'] = userid.toString();
            client.hmget(GetUserKey(userid), 'name', 'total_words', function(err, values) {
                if (values[0] != null) {
                    data['username'] = values[0].toString();
                }
                if (values[1] != null) {
                    data['total_words'] = values[1].toString();
                }
                client.zcard(GetUniqKey(userid), function(err, value) {
                    data['uniq_words'] = value.toString();
                    client.zrevrange(GetUniqKey(userid), 0, 2, 'withscores', function(err, words) {
                        var i;
                        var wordlist = '';
                        for (i = 0; i < words.length; i++) {
                            wordlist = wordlist + words[i].toString();
                            i++;
                            wordlist = wordlist + '(' + words[i].toString() + ') '; 
                        }
                        data['frequent_words'] = wordlist;
                        client.zrevrank('global_counts', userid.toString(), function(err, rank) {
                            if (rank != null) {
                                var r = parseInt(rank.toString()) + 1;
                                data['rank'] = r;
                            }
                            res.json(data);
                        });
                    });
                });
            });
        } else {
            res.json(data);
        }
    });
});

app.get('/stats/all', function (req, res) {
    // console.log('/stats/all');
    var data = { 'total_users': '0', 'total_words': '0', 'uniq_words': '0',
                 'frequent_words': '' };
    client.hget(GetUserKey('all'), 'total_words', function(err, total) {
        if (total != null) {
            data['total_words'] = total.toString();
        }
        client.hlen('active', function(err, active_len) {
            if (active_len != null) {
                data['total_users'] = active_len.toString();
            }
            client.zcard(GetUniqKey('all'), function(err, uniq) {
                data['uniq_words'] = uniq.toString();
                client.zrevrange(GetUniqKey('all'), 0, 2, 'withscores', function(err, words) {
                    var i;
                    var wordlist = '';
                    for (i = 0; i < words.length; i++) {
                        wordlist = wordlist + words[i].toString();
                        i++;
                        wordlist = wordlist + '(' + words[i].toString() + ') '; 
                    }
                    data['frequent_words'] = wordlist;
                    res.json(data);
                });
            });
        });
    });
});

app.get('/', function (req, res) {
    res.status(200).send('OK');
});

app.use(function(req, res) {
    console.log("Could not find %s" , req.url);
    res.status(404).send('Page not found');
});


var server = app.listen(process.env.PORT || 8080, function () {
       var host = server.address().address
       var port = server.address().port
       
       console.log("wordstats-metrics app listening at http://%s:%s", host, port)
});

console.log('started web process');

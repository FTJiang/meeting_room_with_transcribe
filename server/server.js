'use strict';
var fs = require('fs');
const WebSocketServer = require("ws").Server;
const ws = new WebSocketServer({ port: 2223});
const Promise = require('promise');


var sockets = [];	//key is id, value is socket
var languages = [];  //elements are id need this language
var peer_ids = [];

//obtain bing translate api access token
var caller = function (callback){
 var https = require('https');

 var options = {
   host: 'api.cognitive.microsoft.com',
   path: '/sts/v1.0/issueToken',
   port: 443,
   method: 'POST',
   headers:{
          'Accept': '*/*',
          'Content-Length': 0,
          'Ocp-Apim-Subscription-Key':'5a092865462f403d8c637f7b8884b495',
          'Content-Type': 'application/x-www-form-urlencoded'
  }
 };
 var req = https.request(options, function(res) {
     res.on('data', function(d) {
	 callback(d.toString('utf8'));
     });
 });
 req.end();
}

ws.on('connection', function(w){
	var id = w.upgradeReq.headers['sec-websocket-key'];
	console.log('New Connection id :: ', id);
	let myPromise = new Promise(function (resolve, reject){
		w.on('message', function(msg){
    		var id = w.upgradeReq.headers['sec-websocket-key'];
   	 	var message = JSON.parse(msg);
		console.log(message);
    		//sockets[message.to].send(message.message);
		if(message.cmd){
		switch(message.cmd){
			case "sendId":
				{
					console.log("receive peer id: ",message.id);
					peer_ids.push(message.id);
					console.log("peer_ids: ",peer_ids);
				}
				break;
			case "fetchIds":
				{
					console.log("receive fetch ids request");
					sockets[id].send(JSON.stringify({ids:peer_ids}));
				}
				break;
			case "peerClose":
				{
					peer_ids.splice(peer_ids.indexOf(message.id),1);
					console.log("peer ",message.id,"closed");	
					resolve(message.id);
				}
				break;
			default:
				{
    					console.log('Message on :: ', id);
   					console.log('On message :: ', message.language);
					caller(function(result){
						var data = {token:result};
						sockets[id].send(JSON.stringify(data));	
					});
				}
		}
		}
 //		var data = {token:getAccessToken()};
//		newsocket.send(JSON.stringify(data));
//		var interval = setInterval(function(str1, str2) {
 //			var data = {token:getAccessToken()};
//			newsocket.send(JSON.stringify(data));
//		}, 540000);

 	 	});	
	});

	w.on('close', function() {
    		var id = w.upgradeReq.headers['sec-websocket-key'];
    		console.log('Closing :: ', id);
		//remove from sockets list
		myPromise.then(function(){
			sockets.splice(sockets.indexOf(id),1);
			console.log(sockets.length);
		}).catch(
		(reason) => {
  		  console.log('Handle rejected promise ('+reason+') here.');
		});
  	});
	//add client to socket list
	sockets[id] = w;
});

//w.send('message to client');

var binaryServer = require('binaryjs').BinaryServer;

//var server = binaryServer({port: 2222});
var server = binaryServer({port:2222});
server.on('connection', function(client) {
	console.log("new connection");
	client.on('stream', function(stream, meta) {
		stream.pipe(recognize(meta.language,meta.NickName));
		client.on('close', function() {
			stream.destroy();
			console.log("connection finished");
		});
	});
		
});

//return recognizestream which will broadcast result to all users
function recognize(src_language,NickName){
  const Speech = require('@google-cloud/speech');
  // Instantiates a client
  const speech = Speech();
  // The encoding of the audio file, e.g. 'LINEAR16'
   const encoding = 'LINEAR16';
//	const encoding = 'FLAC';
  // The sample rate of the audio file in hertz, e.g. 16000
   const sampleRateHertz = 16000;
  // The BCP-47 language code to use, e.g. 'en-US'
   const languageCode = src_language;

  const request = {
    config: {
      encoding: encoding,
      sampleRateHertz: sampleRateHertz,
      languageCode: languageCode
    }
  };

  // Create a recognize stream
  const recognizeStream = speech.createRecognizeStream(request)
    .on('error', console.error)
    .on('data', (data) => {
	 process.stdout.write(data.results);
	//broadcast result to all clients
	var message = {data:data.results, nickname:NickName,src_lang:src_language};
	sendToAll(message);
    });
  return recognizeStream;
}
function sendToAll(message){
	for (var client in sockets){
		try{
			console.log("send to one client");
			sockets[client].send(JSON.stringify(message));
		}catch(err){
			console.log(err);
		}
	}
}



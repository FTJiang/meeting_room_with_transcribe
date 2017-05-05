'use strict';
var binaryServer = require('binaryjs').BinaryServer;
var requests = require('request');
var uuid = require('node-uuid');

var app = require('express')();
var http = require('http').Server(app);
var bodyParser = require('body-parser')
app.use( bodyParser.json() );       // to support JSON-encoded bodies
app.use(bodyParser.urlencoded({     // to support URL-encoded bodies
  extended: false
}));
app.set('trust proxy', true);
app.set('view engine', 'pug');
//http.on('request', app);

//deal with request for external IP
app.get('/', (req, res) => {
  getExternalIp((externalIp) => {
	try{
		res.setHeader('Access-Control-Allow-Origin', '*');
		res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, PATCH, DELETE'); // If needed
		res.setHeader('Access-Control-Allow-Headers', 'X-Requested-With,contenttype'); // If needed
		res.setHeader('Access-Control-Allow-Credentials', true); // If needed
		res.send({externalIp: externalIp});
	}catch(error){
	  console.log("error: ",error);
	}
  });
});

http.listen(65080);  //handle audio streaming
app.listen(8080); //handle IP request

//binaryjs server used for audio streaming handling
var server = binaryServer({server:http});
server.on('connection', function(client) {
	client.on('stream', function(stream, meta) {
		console.log("new connection", meta.NickName);
		try{
			stream.pipe(recognize(stream,meta.language,meta.NickName,meta.room));
		}catch(error){
			console.log("try error: ",error);
			stream.pipe(recognize(stream,meta.language,meta.NickName,meta.room));
		}
		client.on('close', function() {
			stream.destroy();
			console.log("connection finished");
		});
	});	
});

//return recognizestream which will broadcast result to all users
function recognize(stream,src_language,NickName,roomId){
  const Speech = require('@google-cloud/speech');
  // Instantiates a client
  const speech = Speech();
  // The encoding of the audio stream, e.g. 'LINEAR16'
   const encoding = 'LINEAR16';
  // The sample rate of the audio file in hertz, e.g. 16000
   const sampleRateHertz = 16000;
  // The BCP-47 language code to use, e.g. 'en-US'
   const languageCode = src_language;
   const request = {
		config: {
		  encoding: encoding,
		  sampleRateHertz: sampleRateHertz,
		  languageCode: languageCode,
		},
		singleUtterance: false,
		interimResults: false,
	  };

  // Create a recognize stream
  const recognizeStream = speech.createRecognizeStream(request)
    .on('error', (error)=>{
		//restart streaming if error occur
		console.error;
		stream.pipe(recognize(stream,src_language,NickName,roomId));
		console.log("restart streaming");
	})
    .on('data', (data) => {
		 process.stdout.write(data.results);
		//post to room server for broadcast
		var message = {data:data.results, nickname:NickName,src_lang:src_language,room:roomId};
		requests.post('http://52.33.199.111:2224',{form:message},function (error, response, body) {
		  console.log('error:', error); // Print the error if one occurred
		  console.log('statusCode:', response && response.statusCode); // Print the response status code if a response was received
		  console.log('body:', body); // Print the HTML for the Google homepage.
		});
    });
  return recognizeStream;
}

//functions for getting external IP
const METADATA_NETWORK_INTERFACE_URL = 'http://metadata/computeMetadata/v1/' +
    '/instance/network-interfaces/0/access-configs/0/external-ip';

function getExternalIp (cb) {
  const options = {
    url: METADATA_NETWORK_INTERFACE_URL,
    headers: {
      'Metadata-Flavor': 'Google'
    }
  };

  requests(options, (err, resp, body) => {
    if (err || resp.statusCode !== 200) {
      console.log('Error while talking to metadata server, assuming localhost');
      cb('localhost');
      return;
    }
    cb(body);
  });
}
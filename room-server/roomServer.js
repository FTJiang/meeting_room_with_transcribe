'use strict';

//datastore object
const Datastore = require('@google-cloud/datastore');
const datastore = Datastore();

//websocket server 
var uuid = require('uuid');
var fs = require('fs');
const WebSocketServer = require("ws").Server;
const ws = new WebSocketServer({ port: 7012});
const Promise = require('promise');
var app = require('express')();
var bodyParser = require('body-parser')

app.use( bodyParser.json() );       // to support JSON-encoded bodies
app.use(bodyParser.urlencoded({     // to support URL-encoded bodies
  extended: false
}));
app.set('trust proxy', true);
app.set('view engine', 'pug');

//handle enter room request
app.get('/enterRoom', (req, res) => {
	//handle Cross origin policy
		res.setHeader('Access-Control-Allow-Origin', '*');
		res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, PATCH, DELETE'); // If needed
		res.setHeader('Access-Control-Allow-Headers', 'X-Requested-With,contenttype'); // If needed
		res.setHeader('Access-Control-Allow-Credentials', true); // If needed
//	console.log("req.roomID",req.query.roomID);
	checkRoom(req.query.roomID,res);
});

//handle create room request
app.get('/getRoomID', (req, res) => {
	//handle Cross origin policy
		res.setHeader('Access-Control-Allow-Origin', '*');
		res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, PATCH, DELETE'); // If needed
		res.setHeader('Access-Control-Allow-Headers', 'X-Requested-With,contenttype'); // If needed
		res.setHeader('Access-Control-Allow-Credentials', true); // If needed
	//generate unique random id
	res.send(JSON.stringify({result:uuid.v4()}));
});

//receive transcribe from binaryjs server for broadcast
app.post('/', function(req, res) {
        var data = req.body.data,
        nickname = req.body.nickname,
        src_lang = req.body.src_lang,
        room = req.body.room;
        if(data){
                console.log("req",req.body);
                console.log("receive data: ",data, nickname, src_lang,room);
                var message = {data:data,nickname:nickname,src_lang:src_lang};
                sendToAll(message,room);
                res.send("received");
        }
});

app.listen(2224);
var rooms = [];	//key is id, value is socket

//handle new websocket connection
ws.on('connection', function(w){
	var id = w.upgradeReq.headers['sec-websocket-key'];
	console.log('New Connection id :: ', id);
	let myPromise = new Promise(function (resolve, reject){
		w.on('message', function(msg){
    	var id = w.upgradeReq.headers['sec-websocket-key'];
   	 	var message = JSON.parse(msg);
		console.log(message);
    		//sockets[message.to].send(message.message);
		//parse the cmd of client
		if(message.cmd){
		switch(message.cmd){
			case "sendId":  //add user to corresponding list of target room
				{	
					addTask(message.room,message.id,w);
					if(!rooms[message.room])
					{
						console.log("create new room");
						rooms[message.room]={};
					}
					rooms[message.room][message.id]=w;
					console.log("receive peer id: ",message.id);
					//console.log("have clients: ",Object.keys(rooms[message.room]).length);
			//		console.log("users in room: ",message.room," are ",room[message.room]);
					//peer_ids.push(message.id);
					//console.log("peer_ids: ",peer_ids);
				}
				break;
			case "fetchIds":  //send user peer id of all participants in given room
				{
					console.log("receive fetch ids request");
					//sockets[id].send(JSON.stringify({ids:peer_ids}));
					sendPeerIds(w,message.room);
				}
				break;
			case "peerClose":  //user leave, delete from list
				{
					//peer_ids.splice(peer_ids.indexOf(message.id),1);
					try{
					deleteClient(message.room,message.taskId);
//					room[message.room].splice(room[message.room].indexOf(message.id),1);
					delete rooms[message.room][message.id];
					}catch(error){
						console.log(error);
					}
					console.log("clients left: ",Object.keys(rooms[message.room]).length);
				}
				break;
			case "fetchToken":  //send user bing token for text translation
				{
					console.log("get fetchToken request");
					caller(function(result){
						var data = {token:result};
						w.send(JSON.stringify(data));
					});
				}
				break;
			default:
				{
					;
				}
		}
		}

 	 	});	
	});

	w.on('close', function() {
    		var id = w.upgradeReq.headers['sec-websocket-key'];
    		console.log('Closing :: ', id);
  	});
	//add client to socket list
	//sockets[id] = w;
});

//function for obtaining bing translate api access token
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
          'Ocp-Apim-Subscription-Key':'ab9033a4cb4945f1b5fa2302101533f8',
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


//functions for datastore manipulate
//add user to peer id list of given room
function addTask (room,peer_id,socket) {
  const taskKey = datastore.key(room);
  const entity = {
    key: taskKey,
    data: [
      {
        name: 'peer_id',
        value: peer_id
	},
  ]};

  datastore.save(entity)
    .then(() => {
      //console.log(`Task ${taskKey.id} created successfully.`);
	  socket.send(JSON.stringify({taskId:taskKey.id}));
    })
    .catch((err) => {
      console.error('addTask ERROR:', err);
    });
}

//fetch all the peer id of participants in given room and send back to user
function sendPeerIds (socket,room) {
  var peer_ids = [];
  const query = datastore.createQuery(room);//.filter('name','=','peer_ids');

  datastore.runQuery(query)
    .then((results) => {
      const tasks = results[0];

      console.log('Tasks:');
      tasks.forEach((task) => {
      //  const taskKey = task[datastore.KEY];
        peer_ids.push(task.peer_id);
      });
	//console.log(peer_ids);
	socket.send(JSON.stringify({ids:peer_ids})); 
	})
    .catch((err) => {
      console.error('sendPeerIds ERROR:', err);
    });
}

//delete user from peer id list of given room
function deleteClient (room,taskId) {
  const taskKey = datastore.key([
    room,
    Number(taskId)  //must be integer
  ]);

  datastore.delete(taskKey)
    .then(() => {
      console.log(`Task ${taskId} deleted successfully.`);
    })
    .catch((err) => {
      console.error('deleteClient ERROR:', err);
    });
}

//check whether given roomId exist
function checkRoom(room,res){
	console.log("checking room: ",room);
  const query = datastore.createQuery(room);//.filter('name','=','peer_ids');
  datastore.runQuery(query)
    .then((results) => {
 //               console.log("checkRoom result: ",results[0]);

                if(results[0].length>0){
			console.log("room exist");
                        res.send(JSON.stringify({result:"true"}));}
//                      console.log("true");
                else{
			console.log("room doesn't exist");
                        res.send(JSON.stringify({result:"false"}));}
//                      console.log("false");

        })
    .catch((err) => {
      console.error('ERROR:', err);
    });
}

//broadcast message to all participants in given room
function sendToAll(message,roomId){
//	console.log("length of room: ",room);
        var sockets = rooms[roomId];
        for (var client in sockets){
                try{
                        //console.log("client",sockets[client]);
                        sockets[client].send(JSON.stringify(message));
                }catch(err){
                        console.log(err);
                }
        }
}
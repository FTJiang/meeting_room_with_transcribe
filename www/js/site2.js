/**
 * Created by noamc on 8/31/14.
 */

$(function () {

	function getURLParameter(name) {
  		return decodeURIComponent((new RegExp('[?|&]' + name + '=' + '([^&;]+?)(&|#|;|$)').exec(location.search) || [null, ''])[1].replace(/\+/g, '%20')) || null;
	}

    var client,		//audio stream websocket
		connection,  //text transition websocket
		accessToken,  //token for Bing translate api
		language=getURLParameter("lang"), //language user speak and want to see
		googleLangCode = {English:"en-US", Chinese:"cmn-Hans-CN", Korean:"ko-KR", Turkish:"tr-TR"},
		BingLangCode = {English:"en", Chinese:"zh-CHS", Korean:"ko", Turkish:"tr"},
		NickName = getURLParameter("myid"),
        recorder,
		roomId = getURLParameter("myRoom"),
        context,
		my_id,
		taskId,
		peer,
		serverIP,
		peerIds,
        bStream,
		conns = [],  //peers' connection
        contextSampleRate = (new AudioContext()).sampleRate,
        resampleRate = 16000,
        worker = new Worker('js/worker/resampler-worker.js');

		alert("Your name is: " + NickName);
		alert("Your room ID is: " + roomId);
	
	getServerIP();
	//init config resampler
    worker.postMessage({cmd:"init",from:contextSampleRate,to:resampleRate});
	//when worker receive message, send to server
    worker.addEventListener('message', function (e) {
        if (bStream && bStream.writable)
            bStream.write(convertFloat32ToInt16(e.data.buffer));
    }, false);
	$('#userNickName').text(NickName);
    $("#start-rec-btn").click(function () {
        close();
		//commentshttp://meeting-web.appspot.com/http://meeting-web.appspot.com/http://meeting-web.appspot.com/
		//http://meeting-web.appspot.com/http://meeting-web.appspot.com/http://meeting-web.appspot.com/
        client = new BinaryClient('ws://'+serverIP+':65080');
        client.on('open', function () {
            bStream = client.createStream({sampleRate: resampleRate,NickName : NickName,language:googleLangCode[language],room:roomId});
        });

        if (context) {
            recorder.connect(context.destination);
            return;
        }
		
		peer = new Peer({
		//host: '52.33.199.111',
		//port: 9000,
		//path: '/peer/',
		key: 'ykpbnynwa33gcik9',
		config: {'iceServers': [
		{ url: 'stun:stun1.l.google.com:19302' },
		{ url: 'turn:numb.viagenie.ca',
		  credential: 'muazkh', username: 'webrtc@live.com' }
		]}
	  });

	  	navigator.getUserMedia = navigator.getUserMedia || navigator.webkitGetUserMedia || navigator.mozGetUserMedia;
		function getVideo(callback){
		  navigator.getUserMedia(
			{audio: true, video: true},
			callback,
			function(error){
			  console.log(error);
			  alert('An error occurred. Please try again');
			}
		  );
		}
		
		
		//handle peer events
		//when receive call, add video tag
		  peer.on('call', function(call){
			console.log("receive call");
			onReceiveCall(call);
			call.on('close',function(){
				onRemoveStream('peer-camera',call.peer);
			});
		  });
		  
		  peer.on('disconnected',function(){
			  peer.destroy();
		  });
		  peer.on('connection', function(connection){
			connection.on('open',function(){
				console.log("push a new connection");
				conns.push(connection);
				connection.on('data', handleMessage);
			});
		  });
		  peer.on('error', function(err){
		    console.log(err.message);
		  });
		  
		/*
		var session = {
            audio: true,
            video: false
        };
        navigator.getUserMedia(session, function (stream) {
            context = new AudioContext();
            var audioInput = context.createMediaStreamSource(stream);
            var bufferSize = 1024; // let implementation decide

            recorder = context.createScriptProcessor(bufferSize, 1, 1);

            recorder.onaudioprocess = onAudio;

            audioInput.connect(recorder);

            recorder.connect(context.destination);

        }, function (e) {

        });
		*/
		
		//async get my_id connection.open and localstream, after these we can call peer
		let myPromise = new Promise((resolve, reject) =>{
		  peer.on('open', function(){
			  console.log(peer.id);
			  my_id = peer.id;
			getVideo(function(stream){
			  window.localStream = stream;
			  onReceiveStream(stream, 'my-camera',my_id);
				context = new AudioContext();
				var audioInput = context.createMediaStreamSource(stream);
				var bufferSize = 2048; // let implementation decide

				recorder = context.createScriptProcessor(bufferSize, 1, 1);

				recorder.onaudioprocess = onAudio;

				audioInput.connect(recorder);

				recorder.connect(context.destination);
				resolve(my_id);
			});
			  
		  });
			
		});
		//websocket for transcribe transition
		connection = new WebSocket('ws://52.33.199.111:7012');
		var data = {
			language: BingLangCode[language],  //language of this user
			NickName: NickName,
		};
		connection.onopen = function () {
			connection.send(JSON.stringify(data));
			myPromise.then(function(){
				var myPeerIdMsg = {cmd:"sendId",id:my_id,room:roomId};
				connection.send(JSON.stringify(myPeerIdMsg));  
				var fetchPeerIdMsg = {cmd:"fetchIds",room:roomId};
				connection.send(JSON.stringify(fetchPeerIdMsg));  
				
			}).catch(
				(reason) => {
					console.log('Handle rejected promise ('+reason+') here.');
				});
		};

		// Log errors
		connection.onerror = function (error) {
		  console.error('WebSocket Error ' + error);
		};

		// Log messages from the server
		connection.onmessage = function (e) {
			var message = JSON.parse(e.data);
			console.log("receive message: ",message);
			if(message.token)
			{
				accessToken = "Bearer+"+message.token;
				console.log('token: ', message.token);
			}
			else if(message.nickname)//&&(message.nickname!==NickName))
			{
				var chatZone = document.getElementById("chatZone");
				//translate to target language text
				console.log('data: ', message.data,message.nickname,message.src_lang);
				if(message.src_lang !== googleLangCode[language])
				{
					var bing;
					if(message.src_lang === "en-US") bing = "en";
					else if(message.src_lang === "cmn-Hans-CN") bing = "zh-CHS";
					else if(message.src_lang === "ko-KR") bing = "ko";
					else bing = "tr";
					console.log(bing);
					//var afterTrans = 
					translateText(message.data,BingLangCode[language],bing,accessToken,message.nickname);
					//chatZone.innerHTML += '<div class="chatmsg"><b>' + message.nickname + '</b>: ' + afterTrans + '<br/></div>';
				}
				else
					chatZone.innerHTML += '<div class="chatmsg"><b>' + message.nickname + '</b>: ' + message.data + '<br/></div>';
			}
			else if(message.ids)
			{
				//call all peers after promise
				console.log("receive ids: ",message.ids);
				peerIds = message.ids;
				myPromise.then(function(){
					callPeers(peerIds);
					console.log("before connect peers");
					connectPeers(peerIds);
					console.log("after connect peers");
				}).catch(
					(reason) => {
						console.log('Handle rejected promise ('+reason+') here.');
					});
				
			}
			else if(message.taskId)
			{
				taskId = message.taskId;
			}
		};
		function callPeer(peer_id) {
			console.log('now calling: ' + peer_id);
			console.log(peer);
			console.log(window.localStream);
			var call = peer.call(peer_id, window.localStream);
			console.log("call: ",call);
			call.on('error', function(err) {
				console.log(err);
			  });
			call.on('stream', function(stream){
			  window.peer_stream = stream;
			  console.log("connected to",peer_id);
			  onReceiveStream(stream, 'peer-camera');
			});
		}
		function callPeers(peers){
			peers.forEach(function(id){
				if(id !== my_id)
					callPeer(id);
			});
		}
		
		function connectPeer(peer_id){
		  console.log("connecting to ",peer_id)
		  var peerconn = peer.connect(peer_id, {metadata: {
			'username': NickName
		  }});
		  peerconn.on('open',function(){
			  conns.push(peerconn);
		  });
		  peerconn.on('data', handleMessage);
		  peerconn.on('error',function(error){
			  console.log("error connect to peer ",error);
		  });
		}
		
		function connectPeers(peers){
			peers.forEach(function(id){
				if(id !== my_id)
				{
					console.log("in connectpeers for each");
					connectPeer(id);
				}
			});			
		}
    });

	function onRemoveStream(element_id,peer_id){
	    console.log('video removed ',peer_id);
		var remotes = document.getElementById(element_id);
		var el = document.getElementById('container_'+peer_id);
		if (remotes && el) {
				remotes.removeChild(el);
		}
	}
	
	function onReceiveStream(stream, element_id,peer_id){
	  var div_container = document.getElementById(element_id);
	  var container = document.createElement('div');
	  console.log("peer: ",peer_id);
	  container.className = 'videoContainer';
	  container.id = 'container_'+peer_id;
	  var videoTag = document.createElement('video');
	  attachMediaStream(stream, videoTag);
	  videoTag.oncontextmenu = function () { return false; };
	  window.peer_stream = stream;
	  container.appendChild(videoTag);
	  div_container.appendChild(container);
	}	
	
    function onAudio(e) {
        var left = e.inputBuffer.getChannelData(0);
		//console.log(left);
        worker.postMessage({cmd: "resample", buffer: left});
        drawBuffer(left);
    }

    function convertFloat32ToInt16(buffer) {
        var l = buffer.length;
        var buf = new Int16Array(l);
        while (l--) {
            buf[l] = Math.min(1, buffer[l]) * 0x7FFF;
        }
        return buf.buffer;
    }

    //https://github.com/cwilso/Audio-Buffer-Draw/blob/master/js/audiodisplay.js
    function drawBuffer(data) {
        var canvas = document.getElementById("canvas"),
            width = canvas.width,
            height = canvas.height,
            context = canvas.getContext('2d');

        context.clearRect (0, 0, width, height);
        var step = Math.ceil(data.length / width);
        var amp = height / 2;
        for (var i = 0; i < width; i++) {
            var min = 1.0;
            var max = -1.0;
            for (var j = 0; j < step; j++) {
                var datum = data[(i * step) + j];
                if (datum < min)
                    min = datum;
                if (datum > max)
                    max = datum;
            }
            context.fillRect(i, (1 + min) * amp, 1, Math.max(1, (max - min) * amp));
        }
    }

    $("#stop-rec-btn").click(function () {
        close();
    });

    function close(){
        console.log('close');
        if(recorder)
            recorder.disconnect();
        if(client)
            client.close();
		if(connection)
		{
			connection.send(JSON.stringify({cmd:"peerClose",id:my_id,room:roomId,taskId:taskId}));
			connection.close();
		}
		if(peer&&!peer.disconnected)
		{
			//remove video tags of all peers
			for (var el in peerIds){
				onRemoveStream('peer-camera',peerIds[el]);
			}
			//disconnect from server
			peer.disconnect();
		}
    }
	function translateText(src_text,des_lang,src_lang,token,name){
		console.log("inside translateText");
		var chatZone = document.getElementById("chatZone");
		var http = new XMLHttpRequest();
		var url = "https://api.microsofttranslator.com/V2/Http.svc/Translate?text="+src_text+"&from="+src_lang+"&to="+des_lang+"&appId="+token;
		//http.setRequestHeader("Accept", "*/*");
		http.open("GET", url, true);
		http.send(null);
		http.onreadystatechange = function() {//Call a function when the state changes.
			if(http.readyState == 4 && http.status == 200) {
				console.log("get response from bing");
				chatZone.innerHTML += '<div class="chatmsg"><b>' + name + '</b>: ' + getResult(this) + '<br/></div>';
				//return getResult(this);
			}
		}
	}
	function getServerIP(){
		var http = new XMLHttpRequest();
		var url = "https://binary-server.appspot.com/";
		//var url = "http://52.33.199.111:8080/";
		//http.setRequestHeader("Accept", "*/*");
		http.open("GET", url, true);
		http.send(null);
		http.onreadystatechange = function() {//Call a function when the state changes.
			console.log("getIp ",http.responseText);
			if(http.readyState == 4 && http.status == 200) {
				var message = JSON.parse(http.responseText);
				serverIP =  message.externalIp;
				console.log("IP address: ",serverIP);
			}
		}
	}
	function getResult(xml) {
	  var x, xmlDoc, txt;
	  xmlDoc = xml.responseXML;
	  txt = "";
	  x = xmlDoc.getElementsByTagName("string");
	  for (i = 0; i < x.length; i++) {
		txt += x[i].childNodes[0].nodeValue;
	  }
	  return txt;
	}	
	
	function onReceiveCall(call){
		call.answer(window.localStream);
		call.on('stream', function(stream){
			window.peer_stream = stream;
			console.log("onreceivecall");
			onReceiveStream(stream, 'peer-camera',call.peer);
		});
	}
	  function handleMessage(data){
		console.log("receive data",data);
		var chatZone = document.getElementById("chatZone");
		chatZone.innerHTML += '<div class="chatmsg"><b>' + data.from + '</b>: ' + data.text + '<br/></div>';
	  } 
	$('#send-message').click(sendMsg);  
	$('#msg').keypress(function(e){
		msg = document.getElementById("msg").value;
		var data = {'from': NickName, 'text': msg};
		if(e.which == 13){
		  sendMsg();
		}
	  });
	//function used to deal with text box
	function sendMsg(){
		var msg = "";
		var chatZone = document.getElementById("chatZone");
		var oldata = "";
		//For sending message
		msg = document.getElementById("msg").value;
		chatZone.innerHTML += '<div class="chatmsg"><b>' + NickName + '</b>: ' + msg + '<br/></div>';
		oldata = '<div class="chatmsg"><b>' + NickName + '</b>: ' + msg + '<br/></div>';
		var data = {'from': NickName, 'text': msg};
		sendToAll(data);
	};
	function sendToAll(message){
		conns.forEach(function(conn){
			conn.send(message);
		});
	}

});

navigator.getUserMedia = navigator.getUserMedia ||
    navigator.webkitGetUserMedia ||
    navigator.mozGetUserMedia ||
    navigator.msGetUserMedia;
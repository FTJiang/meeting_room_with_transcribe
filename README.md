International Meeting
========

We're under development!
International Meeting is a web application which is capable of normal video conference and real-time transcribing. See http://meeting-web.appspot.com for project demo.
Note: 
1. Our project now only supports firefox browser and do not support https connection.
2. You can not restart meeting after pressing stop button.
3. Since speaker will affect recognization of your audio, you should use headphones.
4. Room creater should share unique roomId with other participants for them to join this room
5. Room will not be created until creater press start meeting button which means other participants can not enter this room until creater start meeting.

Our features:
1. Use google user authentication, get username automatically
2. Two options: join room by given roomId or create new room. Wrong roomId will be stocked in same page.
3. For deaf people, they can communicate with others by text input. For other users, they can chose language they like
4. Users can not visit other pages without login
5. All the transcribe user receives will be the language they chose regardless the source language of the text.
6. Participants can chose and speak any language that is shown in language list, our server will handle the transcribe for you

API used:
Google cloud speech API, Bing translate API, Google Log-in, Google datastore API

Architecture of the project:
![Alt text](/www/Images/architecture.jpg?raw=true "Project Architecture")

## Download and run

binaryjs Server



from Git

```console

$ git clone git://github.com/binaryjs/binaryjs.git

$ cd meeting_room_with_transcribe/binary-server
$ npm install
```

room Server



from Git

```console

$ git clone git://github.com/binaryjs/binaryjs.git

$ cd meeting_room_with_transcribe/room-server
$ npm install
```

## Deploy to GAE

binaryjs Server


```
$ cd meeting_room_with_transcribe/binary-server
$ gcloud app deploy --project yourprojectId
```

room Server

```
$ cd meeting_room_with_transcribe/room-server
$ gcloud app deploy --project yourprojectId
```

client side
```
$ cd meeting_room_with_transcribe
$ gcloud app deploy --project yourprojectId
```

##How to use demo
1. Visit homepage through Firefox after deployment
2. Login via google account
3. Choose a language you'd like to speak
4. Press create room button
5. Press "start meeting" button and grand access to you media device
6. Share roomId with other participants and then they can enter room by clicking join room
7. Start conference
8. Click stop meeting button to stop connection with others







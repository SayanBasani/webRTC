const express = require('express');
const cors = require("cors");

const port = 4000;
const app = express();
app.use(express.json());
app.use(cors({
  origin:"*",
}))

const userListWithUid = new Map();
const userListWithSocketId = new Map();
const server = require('http').createServer(app);
const io = require('socket.io')(server);

app.get("/",(req,res)=>{ res.send({hello:"hello"}) })

io.on('connection', (socket) => {
  const uid = socket.handshake.auth.uid; 
  console.log("uid is -->",uid);
  if (!uid) {
    console.warn("No UID provided during connection.");
    socket.disconnect(); // Optionally disconnect the socket if uid is required
    return;
  }
  const socketId = socket.id;
  userListWithUid.set(uid,{uid,socketId});
  userListWithSocketId.set(socketId,{uid,socketId});
  console.log(`connected user id is ${socketId}-->`,userListWithUid);


  socket.on("outgoingCall",(data)=>{
    const {reciverData , offer } = data;
    if(!reciverData || !offer){ return ;}
    const reciverDetails = userListWithUid.get(reciverData);
    if(!reciverDetails){
      console.log("no details of the reciver");
      socket.emit("incomingCallErr",{connected:false, message:"This User is Not Online |Ph No. ->",reciverData});
      return;
    }
    const reciverSocketId = reciverDetails.socketId;
    console.log("reciverData -->",reciverSocketId);
    socket.to(reciverSocketId).emit("incomingCall",{connected:true , reciverId : reciverSocketId, senderId :socket.id , offer});
  })

  socket.on("acceptCall",(data)=>{
    const {callerId,offer} = data;
    if (!callerId || !offer) {return;}
    socket.to(callerId).emit("incomingAnswer",{from:socket.id , offer});
  })

  // Event More i have to add -> cancelCall ,rejectCall,endCall
  socket.on("iceCandidate", (data) => {
    const { candidate, to } = data;
    socket.to(to).emit("iceCandidate", { candidate });
  });
  socket.on('disconnect', function () {
    console.log(socket.id,'user disconnected');
    userListWithUid.delete(uid);
    userListWithSocketId.delete(socketId);
  
  });
})

server.listen(port, function() {
  console.log(`Listening on port ${port}`);
});
const express = require('express');
const cors = require("cors");

const port = 4000;
const app = express();
app.use(express.json());
app.use(cors({
  origin:"*",
  methods:["GET","POST"]
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
    console.log("outgoingCall --> incomingCall");

    const {reciverData , offer } = data;
    if(!reciverData || !offer){ return ;}
    const reciverDetails = userListWithUid.get(reciverData);
    if(!reciverDetails){
      console.log("no details of the reciver");
      socket.emit("incomingCallErr",{connected:false, message:"This User is Not Online |Ph No. ->",reciverData});
      return;
    } 
    const reciverSocketId = reciverDetails.socketId;
    console.log("me--",socket.id , "reciver-->",reciverSocketId);
    console.log("reciverData -->",reciverSocketId);
    socket.to(reciverSocketId).emit("incomingCall",{connected:true , reciverId : reciverSocketId, senderId :socket.id ,senderPh:uid,offer});
  })

  socket.on("rejectOutingCall",(data)=>{
    console.log("rejectOutingCall --> incomingCall");

    const {reciverData } = data;
    if(!reciverData ){ return ;}
    const reciverDetails = userListWithUid.get(reciverData);
    if(!reciverDetails){
      console.log("no details of the reciver");
      socket.emit("incomingCallErr",{connected:false, message:"This User is Not Online |Ph No. ->",reciverData});
      return;
    }
    const reciverSocketId = reciverDetails.socketId;
    console.log("me--",socket.id , "reciver-->",reciverSocketId);
    console.log("reciverData -->",reciverSocketId);
    socket.to(reciverSocketId).emit("incomingCall",{connected:false , reciverId : reciverSocketId, senderId :socket.id ,senderPh:uid});
  })

  socket.on("acceptCall",(data)=>{
    console.log("acceptCall --- incomingAnswer");
    // const {callerId,offer} = data;
    const {callerId,answer} = data;
    if (!callerId || !answer) {return;}
    socket.to(callerId).emit("incomingAnswer",{from:socket.id , answer});
  })

  socket.on("answerCall",(data)=>{
    console.log("answerCall--",data);
    const { answer, reciverid, from} =data;
    socket.to(reciverid).emit("answerCall",{from:socket.id,answer})
  })

  // Event More i have to add -> cancelCall ,rejectCall,endCall
  socket.on("ice-candidate", (data) => {
    const { from,reciverData,candidate } = data;
    const reciverDetails = userListWithUid.get(reciverData);
    const reciverId = reciverDetails.socketId;
    console.log(from,"------------------------",reciverData,"-----",reciverId);
    console.log("ice-candidate from", from, "to", reciverData);
    socket.to(reciverId).emit("ice-candidate", { candidate,from });
  });
  socket.on("send-ice-candidate", ({ reciverData, candidate }) => {
    io.to(reciverData).emit("receive-ice-candidate", { candidate });
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
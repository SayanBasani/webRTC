import { useCallback, useContext, useEffect, useRef, useState } from 'react'
import './App.css'
import MyVideo from "./Components/myVideo"
import SenderVideo from "./Components/senderVideo"
import { socketContext } from './Providers/Socket'

function App() {
  const { uid, setuid, reciverUid, setreciverUid, socket } = useContext(socketContext);
  // const [localOffer, setlocalOffer] = useState(null);
  const [remoteCallStream, setremoteCallStream] = useState(null);
  const [localStream, setLocalStream] = useState(null);
  const [mode, setMode] = useState(null); // "caller" | "receiver"

  const [peer, setPeer] = useState(null);

  useEffect(() => {
    const createPeer = async () => {
      if (!reciverUid || !uid || !socket) return;
      const _peer = new RTCPeerConnection({
        iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
      });
      if(!socket){console.warn("no socket!"); return;}
      _peer.onicecandidate = (event) => {
        if (event.candidate) {
          socket.emit("iceCandidate", {
            target: reciverUid,
            candidate: event.candidate
          });
        }
      };
      
     
      const myStream = await navigator.mediaDevices.getUserMedia({ video: true });
  
      for (const track of myStream.getTracks()) {
        _peer.addTrack(track, myStream);
      }
      setLocalStream(myStream);
      setPeer(_peer);
    };
  
    createPeer();
  }, [reciverUid, uid, socket]);
  
  useEffect(()=>{
    if(!socket){console.warn("no socket !"); return;}
    
    socket.on("iceCandidate", ({ candidate }) => {
      // if (peer && candidate) {
      //   peer.addIceCandidate(new RTCIceCandidate(candidate));
      // }
      if (candidate) {
        peer.addIceCandidate(new RTCIceCandidate(candidate)).catch(e => console.warn("ICE error", e));
      }
      
    });
  },[uid ,socket ,peer])
  useEffect(() => {
    if (!peer) { console.warn("no peer"); return; }
    // peer.ontrack = (event)=>{
    //   const [remoteStream] = event.streams;
    //   setremoteCallStream(remoteStream);
    // }
    peer.ontrack = (event) => {
      const remoteStream = event.streams[0];
      if (remoteStream && remoteCallStream !== remoteStream) {
        setremoteCallStream(remoteStream);
      }
    };
    
  }, [peer]);

  const inpUid = useRef();
  const inpreciverUid = useRef();

  const handleUid = useCallback((data) => {
    const _uidValue = inpUid.current.value;
    if (!_uidValue) { return; }
    const uidValue = _uidValue.trim()
    console.log("data is--", uidValue);
    setuid(uidValue);
    setMode("caller");
  }, [uid]);

  const handleReciverUid = useCallback(async (data) => {
    const _uidReciverValue = inpreciverUid.current.value;
    if (!socket) { console.warn("Socket is not initialized yet."); return; }
    if (!uid || !_uidReciverValue) { alert("Must Need a Uid & reciver Id !"); return; }

    const uidReciverValue = _uidReciverValue.trim();
    setreciverUid(uidReciverValue);
    if (!peer) { console.warn("no peer"); return }
    const localOffer = await peer.createOffer();
    await peer.setLocalDescription(new RTCSessionDescription(localOffer));

    socket.emit("outgoingCall", { reciverData: uidReciverValue, offer: localOffer });

  }, [uid, reciverUid, socket]);

  useEffect(() => {
    if (!socket || !peer) { console.warn("Socket || peer is not initialized yet."); return; }

    const handleIncoming = async (data) => {
      if (!data.connected) { console.log("this is ofline"); return; }
      const { offer, senderId } = data;

      await peer.setRemoteDescription(new RTCSessionDescription(offer));
      const answer = await peer.createAnswer();
      await peer.setLocalDescription(answer);
      // socket.to(senderId).emit("acceptCall", { answer, to: socket.id })
      socket.emit("acceptCall", { callerId: senderId, offer: answer });

      console.log("the user is online -->", data);
      setMode("receiver");
    };

    socket.on("incomingCall", handleIncoming)

    socket.on('incomingAnswer', async (data) => {
      const { offer } = data;
      await peer.setRemoteDescription(new RTCSessionDescription(offer))
    })

    socket.on("incomingCallErr", (data) => {
      if (!data) { return; }
      console.log("the user is offline -->", data);
    })

return () => {
  socket.off("incomingCall", handleIncoming);
  socket.off("incomingAnswer");
  socket.off("incomingCallErr");
};
  }, [socket,peer])


  return (
    <>
      <div className='bg-slate-900 text-white w-full h-screen '>
        <div className='flex justify-center gap-2 py-3'>
          <div className='grid gap-2'>
            <h3>Enter Your uid</h3>
            <input ref={inpUid} type="text" className='border rounded-md' placeholder='  Enter Your Uid' />
            <button onClick={handleUid} className='bg-amber-700 rounded-md px-1'>submit</button>
          </div>
          <div className='grid gap-2'>
            <h3>Enter reciver uid</h3>
            <input ref={inpreciverUid} type="text" className='border rounded-md' placeholder='  Enter reciver Uid' />
            <button onClick={handleReciverUid} className='bg-amber-700 rounded-md px-1'>submit</button>
          </div>
        </div>
        <div className='flex gap-3 justify-around'>
          <div className='border'>
            <MyVideo mode={mode} peer={peer}></MyVideo>
          </div>
          <div className='border'>
            <SenderVideo stream={remoteCallStream}></SenderVideo>
          </div>
        </div>
        <div className='flex justify-center gap-2 py-3'>
          {/* <button className='bg-amber-700 rounded-md px-1' onClick={handleHi} ref={hi}>hi</button> */}
          {/* <button className='bg-amber-700 rounded-md px-1' onClick={handleHello} ref={hello}>hello</button> */}
        </div>
      </div>
    </>
  )
}

export default App

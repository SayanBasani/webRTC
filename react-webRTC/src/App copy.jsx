import { useCallback, useContext, useEffect, useRef, useState } from 'react'
import './App.css'
import MyVideo from "./Components/myVideo"
import SenderVideo from "./Components/senderVideo"
import { socketContext } from './Providers/Socket'

function App() {
  const [localOffer, setlocalOffer] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);
  const [mode, setMode] = useState(null); // "caller" | "receiver"

  const [peer, setpeer] = useState(()=>{return new RTCPeerConnection({ iceServers: [ { urls: "stun:stun.l.google.com:19302", }, ], })});

  const { uid, setuid, reciverUid, setreciverUid, socket } = useContext(socketContext);
  const hi = useRef();
  const inpUid = useRef();
  const inpreciverUid = useRef();
  const hello = useRef();
  const handleUid = useCallback((data) => {
    const _uidValue = inpUid.current.value;
    if (!_uidValue) { return; }
    const uidValue = _uidValue.trim()
    console.log("data is--", uidValue);
    setuid(uidValue);
    setMode("caller");
  }, [uid]);

  const handleReciverUid = useCallback(async(data) => {
    const _uidReciverValue = inpreciverUid.current.value;
    if (!socket) { console.warn("Socket is not initialized yet."); return; }
    if (!uid || !_uidReciverValue) { alert("Must Need a Uid & reciver Id !"); return; }
    const uidReciverValue = _uidReciverValue.trim();
    setreciverUid(uidReciverValue);
    if(!peer){ console.warn("no peer"); return}
    await peer.setLocalDescription(new RTCSessionDescription(localOffer));

    socket.emit("outgoingCall", { reciverData: uidReciverValue, offer: localOffer });

  }, [uid, reciverUid, socket]);

  useEffect(() => {
    if (!socket) { console.warn("Socket is not initialized yet."); return; }

    socket.on("incomingCall", async (data) => {
      if (!data.connected) { console.log("this is ofline"); return; }
      const { offer, senderUid } = data;
      // const _peer = new RTCPeerConnection({
      //   iceServers: [
      //     {
      //       urls: "stun:stun.l.google.com:19302",
      //     },
      //   ],
      // });
      // setpeer(_peer);
      _peer.ontrack = (event) => {
        const remoteStream = event.streams[0];
        setRemoteStream(remoteStream); // You need to define this with useState
      };
      navigator.mediaDevices.getUserMedia({ video: true }).then((stream) => {
        stream.getTracks().forEach((track) => _peer.addTrack(track, stream));
      })
      await _peer.setRemoteDescription(new RTCSessionDescription(offer));
      const answer = await _peer.createAnswer();
      await _peer.setLocalDescription(answer);
      socket.emit("acceptCall", { answer, to: senderUid })
      console.log("the user is online -->", data);
      setMode("receiver");
    })

    socket.on('incomingAnswer',async(data)=>{
      const {offer} = data;
      await peer.setLocalDescription(new RTCSessionDescription(offer))
    })

    socket.on("incomingCallErr", (data) => {
      if (!data) { return; }
      console.log("the user is offline -->", data);
    })

  }, [socket])

 
  // useEffect(() => {
  //   if (!uid) { return; }
  //   const _peer = new RTCPeerConnection({ iceServers: [ { urls: "stun:stun.l.google.com:19302", }, ], });
  //   navigator.mediaDevices.getUserMedia({ video: true }).then((stream) => {
  //     stream.getTracks().forEach((track) => _peer.addTrack(track, stream));
  //   });
  //   _peer.onicecandidate = (event) => {
  //     if (event.candidate) { }
  //   }
  //   _peer.createOffer().then(async (offer) => {
  //     await _peer.setLocalDescription(offer);
  //     setlocalOffer(offer);
  //   })
  // }, [uid])

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
            <MyVideo  mode={mode} peer={peer}></MyVideo>
          </div>
          <div className='border'>
            <SenderVideo stream={remoteStream}></SenderVideo>
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

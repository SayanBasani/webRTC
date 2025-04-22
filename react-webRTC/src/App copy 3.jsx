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
  const inpUid = useRef();
  const inpreciverUid = useRef();

  const [anyOnceCalling, setanyOnceCalling] = useState(null);

  const handleUid = useCallback(() => { //handle Uid
    const _uid = inpUid.current.value.trim();
    if (!_uid) { alert("No Uid"); return; }
    setuid(_uid);
    console.log("uid is ", _uid);
  }, []);


  const handleReciverUid = useCallback(() => { // handle reciver uid 
    const _ruid = inpreciverUid.current.value.trim();
    if (!_ruid) { alert("no _reciver uid !"); return; }
    setreciverUid(_ruid);
    console.log("_ruid is", _ruid);
  }, [])

  useEffect(() => {  // setup peer connection
    if (!socket) { console.warn({ socket }); return }
    const _peer = new RTCPeerConnection({ iceServers: [{ urls: "stun:stun.l.google.com:19302" }] });
    if (!_peer) { console.warn({ _peer }); return }
    // get the local tracks
    ;; (async () => {
      const myStream = await navigator.mediaDevices.getUserMedia({ video: true,audio: true });
      setLocalStream(myStream);
      for (const tracks of myStream.getTracks()) {
        _peer.addTrack(tracks, myStream);
      }
    }
    )();;

    // get the remote track
    // _peer.ontrack = event => {
    //   const [remoteStream] = event.streams;
    //   setremoteCallStream(remoteStream);
    // }
    _peer.ontrack = (event) => {
      console.log("🔴 ontrack called", event.streams);
      let stream = event.streams[0];
      if (!stream) {
        stream = new MediaStream([event.track]);
      }
      setremoteCallStream(stream);
    };


    // handle ice candidate
    _peer.onicecandidate = event => {
      if (event.candidate) {
        socket.emit('ice-candidate', {
          from: socket.id,
          reciverData: reciverUid,
          candidate: event.candidate,
        })
      }
    }
    setPeer(_peer);
  }, [socket]);

  useEffect(() => { //gpt for iec candidate listion
    if (!peer || !socket) { console.warn(`socket --${socket},peer --${peer}`); return; }
    socket.on("ice-candidate", async ({ candidate }) => {
      if (candidate && peer) {
        // try {
        await peer.addIceCandidate(new RTCIceCandidate(candidate));
        // console.log("✅ ICE Candidate added");
        // } catch (error) {
        //   console.error("Error adding ICE candidate:", error);
        // }
      }
    });
  }, [socket, peer]);


  useEffect(() => { // handle incomingCall data
    if (!socket) { console.warn(`socket --${socket}`); return; }
    socket.on("incomingCall", (data) => {
      if (!data) { setanyOnceCalling(null); console.warn("no data!"); return; }
      setanyOnceCalling(data);
      const { connected, reciverId, senderId, senderPh, offer } = data;
      console.log("incomingCall data ", data);
    })
    // setanyOnceCalling(null);

    socket.on("answerCall", async ({ answer }) => {
      console.log("on answer", answer);
      if (!peer) return;
      await peer.setRemoteDescription(new RTCSessionDescription(answer));
      setMode("connected");
      console.log("📞 Call connected!");
    });

  }, [socket])

  const Call = useCallback((fun) => { //create a outgoingCall emit
    const makeCall = async () => {
      if (!socket || !peer || !uid || !reciverUid) { console.warn(`socket--${socket},peer--${peer},uid--${uid},reciverUid--${reciverUid}`); }

      try {
        const offer = await peer.createOffer();
        await peer.setLocalDescription(offer);
        console.log("my offer ", offer);
        socket.emit("outgoingCall", { from: socket.id, offer: offer, reciverData: reciverUid });

      } catch (error) {
        console.error("Error creating offer:", error);
      }
    }
    makeCall();
  }, [socket, peer, uid, reciverUid]);

  const rejectOutgoingCall = useCallback(() => { //reject call
    const _rejectCall = async () => {
      // console.log("rejected");
      try {
        if (!socket || !uid || !reciverUid) { console.warn(`socket--${socket},peer--${peer},uid--${uid},reciverUid--${reciverUid}`); return }
        socket.emit("rejectOutingCall", { from: socket.id, reciverData: reciverUid })

      } catch (error) {
        console.error("Error creating offer:", error);
      }
    }
    _rejectCall();
  }, [uid, socket, reciverUid]);

  const aceptedCall = useCallback(async () => { // handle the answer of the call
    if (!socket || !peer || !uid) { console.warn(`socket--${socket},peer--${peer},uid--${uid}`); }
    if (!anyOnceCalling) { console.warn("wait data is not clear", anyOnceCalling); }
    // try {
    const { connected, reciverId, senderId, senderPh, offer } = anyOnceCalling;
    console.log({ peer });
    await peer.setRemoteDescription(new RTCSessionDescription(offer));
    const answer = await peer.createAnswer();
    await peer.setLocalDescription(answer);
    socket.emit("answerCall", { answer, reciverid: senderId, from: socket.id })
    console.log("emit answer");
    console.log(anyOnceCalling);

    // } catch (error) {
    //   console.error("Error accepting call:", error);
    // }
  }, [uid, socket, peer, anyOnceCalling])

  // const endCall = useCallback(() => {
  //   if (!socket) { console.warn(`socket --${socket}`); return; }
  // }, [uid, socket, reciverUid])
  const endCall = useCallback(() => {
    if (peer) {
      peer.close();
      setPeer(null);
    }
    setremoteCallStream(null);
    setanyOnceCalling(null);
    setMode(null);
    console.log("📞 Call ended.");
  }, [peer]);

  // remote video 
  const localVideoRef = useRef();
  const videoRef = useRef();

  
  useEffect(() => {
    if (remoteCallStream && videoRef.current) {
      videoRef.current.srcObject = null; // clear previous
      console.log("🎥 Setting remote video stream");
      videoRef.current.srcObject = remoteCallStream;

      videoRef.current.play().catch(e => console.warn("Video play error:", e));
    }

    // setInterval(() => {
    //   console.log("remote video -->",remoteCallStream);
    // }, 2000);
  }, [remoteCallStream]);

  // local video
  useEffect(() => {
    if (localStream && localVideoRef.current) {
      localVideoRef.current.srcObject = null; // Clear previous
      localVideoRef.current.srcObject = localStream;
      localVideoRef.current.play().catch((e) => console.warn("Local video play error:", e));
    }
  }, [localStream]);
  

  return (
    <>
      <div className='bg-slate-900 text-white w-full h-screen '>
        <div className='grid-cols-4 grid gap-2 py-3'>
          <div className='grid gap-3'>
            <div className={`${anyOnceCalling?.connected ? "" : "hidden"} grid gap-3`}>
              <span>Call From :{anyOnceCalling ? `${anyOnceCalling.senderPh}` : ""}</span>
              <button onClick={endCall} className='bg-red-700 rounded-md px-1'>Reject Call</button>
              <button onClick={aceptedCall} className='bg-green-500 rounded-md px-1'>Accept Call</button>
            </div>

          </div>
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
          <div className='grid gap-2'>
            <button onClick={rejectOutgoingCall} className='bg-red-700 rounded-md px-1'>End Call</button>
            <button onClick={Call} className='bg-green-500 rounded-md px-1'>Call</button>
          </div>

        </div>
        {/*  videos  */}
        <div className='flex gap-3 justify-around'>
          <div className='border'>
            {/* <MyVideo stream={localStream} mode={mode} peer={peer}></MyVideo> */}
            <video ref={localVideoRef} autoPlay className='rounded-md w-[300px]'></video>
          </div>
          <div className='border'>
            <video ref={videoRef} autoPlay className='rounded-md w-[300px]'></video>
            {/* <SenderVideo stream={remoteCallStream}></SenderVideo> */}
          </div>
        </div>
      </div>
    </>
  )
}

export default App

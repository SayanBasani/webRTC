import { useCallback, useContext, useEffect, useRef, useState } from 'react'
import './App.css'
import { socketContext } from './Providers/Socket'

function App() {
  const { uid, setuid, reciverUid, setreciverUid, socket } = useContext(socketContext);
  const localVideoRef = useRef();
  const remoteVideoRef = useRef();
  const inpUid = useRef();
  const inpreciverUid = useRef();
  const peerRef = useRef(null);
  const [anyOnceCalling, setanyOnceCalling] = useState(null);


  // set uids 
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
  }, []);
  // set uids !


  useEffect(() => {
    if (!socket) { console.warn("!socket", socket); return; }
    const handleIncomingCall = (data) => {
      if (!data) { console.warn("!data"); return; }
      const { connected, reciverId, senderId, senderPh, offer } = data;
      setanyOnceCalling(data);
      // socket.emit('acceptCall', { callerId:senderId, offer })
    };

    const handleIncomingAnswer = async ({ answer }) => {
      if (!peerRef.current) return;
      // console.log(answer);
      // await peerRef.current.setRemoteDescription(new RTCSessionDescription(answer));
      // console.log("Answer received and set as remote description");
      const peer = peerRef.current;

      // Check if a remote description has already been set
      if (peer.remoteDescription) {
        console.warn("Remote description already set. Skipping.");
        return;
      }
      try {
        await peer.setRemoteDescription(new RTCSessionDescription(answer));
        console.log("Answer received and set as remote description");
      } catch (error) {
        console.error("Error setting remote description:", error);
      }
    };

    const handleIceCandidate = async ({ candidate }) => {
      console.log("recived ice-candidate on with->",{candidate});
      if (candidate) {
        try {
          await peerRef.current.addIceCandidate(new RTCIceCandidate(candidate));
          console.log("ICE candidate added");
        } catch (error) {
          console.error("Error adding caller ICE candidate:", error);
        }
      }
    }

    socket.on("incomingCall", handleIncomingCall);
    socket.on("incomingAnswer", handleIncomingAnswer);
    socket.on("ice-candidate", handleIceCandidate);
    return () => {
      socket.off("incomingCall", handleIncomingCall);
      socket.off("incomingAnswer", handleIncomingAnswer);
      socket.off("ice-candidate", handleIceCandidate);
    };
  }, [socket])

  // get media & setup peer connection

  const startCall = async () => { // start call
    if (!socket) { console.warn("!socket"); return; }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      localVideoRef.current.srcObject = stream;

      const peer = new RTCPeerConnection({ iceServers: [{ urls: "stun:stun.l.google.com:19302" }] });
      peerRef.current = peer;

      stream.getTracks().forEach((track) => { peer.addTrack(track, stream); });
      // stream.getTracks().forEach(track => { peer.addTrack(track, stream); });
      console.log("Caller local stream tracks: ", stream.getTracks());
      peer.onicecandidate = (event) => {
        if (event.candidate) {
          // Fix this in startCall (caller side)
          console.log("start call ice-candidate emit with->",{candidate : event.candidate});
          socket.emit("ice-candidate", { from: socket.id, reciverData: reciverUid, candidate: event.candidate });

        }
      };

      peer.ontrack = (event) => { remoteVideoRef.current.srcObject = event.streams[0]; };

      const offer = await peer.createOffer();
      await peer.setLocalDescription(offer);

      socket.emit("outgoingCall", { reciverData: reciverUid, from: uid, offer: offer });

      console.log("Offer sent");
    } catch (error) {
      console.error("Error accessing media devices:", error);
    }
  };

  const aceptedCall = async () => {
    if (!anyOnceCalling) { console.warn("!Call Recived"); return; }
    if (!socket) { console.warn("!socket"); return; }

    try {
      const { connected, reciverId, senderId, senderPh, offer } = anyOnceCalling;
      console.log("anyOnceCalling",anyOnceCalling);
      const peer = new RTCPeerConnection({ iceServers: [{ urls: "stun:stun.l.google.com:19302" }] });

      peerRef.current = peer;
      // await peer.setRemoteDescription(new RTCSessionDescription(offer));
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      stream.getTracks().forEach((track) => { peer.addTrack(track, stream) });
      localVideoRef.current.srcObject = stream;
      await peer.setRemoteDescription(new RTCSessionDescription(offer)); //..
      const answer = await peer.createAnswer();
      await peer.setLocalDescription(answer);
      socket.emit('acceptCall', { callerId: senderId, answer })

      peer.onicecandidate = (event) => {
        if (event.candidate) {
          console.log("accept call ice-candidate emit with->",{candidate : event.candidate});
          socket.emit("ice-candidate", { from: socket.id, reciverData: senderPh, candidate: event.candidate })
        }
      }

      peer.ontrack = (event) => {
        // const remoteStream = event.streams[0];
        // remoteVideoRef.current.srcObject = remoteStream;
        if (remoteVideoRef.current) {
          remoteVideoRef.current.srcObject = event.streams[0];
        }
      }
      console.log("a Accept Call is Emit");
    } catch (error) {
      console.error("Error accessing media devices:", error);
    }
  }

  const endCall = () => {
    if (peerRef.current) {
      peerRef.current?.close();
      peerRef.current = null;
      setanyOnceCalling(null);
    }
    if (localVideoRef.current?.srcObject) {
      localVideoRef.current.srcObject.getTracks().forEach(track => track.stop());
      localVideoRef.current.srcObject = null;
    }
    if (remoteVideoRef.current?.srcObject) {
      remoteVideoRef.current.srcObject.getTracks().forEach(track => track.stop());
      remoteVideoRef.current.srcObject = null;
    }
    socket?.emit("endCall", { to: reciverUid });
    console.log("Call ended");
  };



  const rejectOutgoingCall = useCallback(() => { }, [])



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
            <button onClick={startCall} className='bg-green-500 rounded-md px-1'>Call</button>
          </div>

        </div>
        {/*  videos  */}
        <div className='flex gap-3 justify-around'>
          <div className='border'>
            {/* <MyVideo stream={localStream} mode={mode} peer={peer}></MyVideo> */}
            <video ref={localVideoRef} playsInline muted autoPlay className='rounded-md w-[300px]'></video>
          </div>
          <div className='border'>
            <video ref={remoteVideoRef} playsInline autoPlay className='rounded-md w-[300px]'></video>
            {/* <SenderVideo stream={remoteCallStream}></SenderVideo> */}
          </div>
        </div>
      </div>
    </>
  )
}

export default App

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
  useEffect(() => {
    const peer = new RTCPeerConnection({ iceServers: [{ urls: "stun:stun.l.google.com:19302" }] });
    peerRef.current = peer;
  }, [])

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

  const [iceCandidate, seticeCandidate] = useState(null);
  const candidateQueue = useRef([]);
  const isRemoteDescSet = useRef(false);
  useEffect(() => {
    if (!socket) { console.warn("!socket", socket); return; }
    const handleIncomingCall = (data) => {
      console.log(`handeling incoming Call --`, { data });
      if (!data) { console.warn("!data"); return; }
      const { connected, reciverId, senderId, senderPh, offer } = data;
      setanyOnceCalling(data);
      // socket.emit('acceptCall', { callerId:senderId, offer })
    };

    const handleIncomingAnswer = async ({ answer }) => {
      console.log(`handeling incoming Answer --`, { answer });
      if (!peerRef.current) return;
      console.log("peerRef.current", peerRef.current);
      await peerRef.current.setRemoteDescription(new RTCSessionDescription(answer));
      console.log("Answer received and set as remote description");
    };

    const handleIceCandidate = async ({ candidate }) => {
      console.log(`handeling ICE Candidate-`, { candidate });
      if (!peerRef.current) return;
      if (!candidate) return;
      console.log("peerRef.current", peerRef.current);

      if(isRemoteDescSet.current){
        await peerRef.current.addIceCandidate(new RTCIceCandidate(candidate));
        console.log("ICE candidate added immediately");
      } else {
        console.log("ICE candidate queued");
        candidateQueue.current.push(candidate);
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

      // const peer = new RTCPeerConnection({ iceServers: [{ urls: "stun:stun.l.google.com:19302" }] });
      // peerRef.current = peer;
      if (!peerRef.current) { console.warn(`!peer--${peerRef.current}`); }
      const peer = peerRef.current;

      stream.getTracks().forEach((track) => { peer.addTrack(track, stream); });
      console.log("Caller local stream tracks: ", stream.getTracks());
      peer.onicecandidate = (event) => {
        if (event.candidate) {
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

  const aceptedCall = async () => { // Accept Call
    if (!anyOnceCalling) { console.warn("!Call Recived"); return; }
    if (!socket) { console.warn("!socket"); return; }

    try {
      const { connected, reciverId, senderId, senderPh, offer } = anyOnceCalling;
      // const peer = new RTCPeerConnection({ iceServers: [{ urls: "stun:stun.l.google.com:19302" }] });
      // peerRef.current = peer;
      if (!peerRef.current) { console.warn(`!peer--${peerRef.current}`); }
      const peer = peerRef.current;

      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      stream.getTracks().forEach((track) => { peer.addTrack(track, stream) });
      localVideoRef.current.srcObject = stream;
      await peer.setRemoteDescription(new RTCSessionDescription(offer)); //..
      isRemoteDescSet.current = true;
      for (const candidate of candidateQueue.current){
        await peer.addIceCandidate(new RTCIceCandidate(candidate));
      }
      candidateQueue.current = [];
      console.log("flushed candidate queued");
      const answer = await peer.createAnswer();
      await peer.setLocalDescription(answer);
      socket.emit('acceptCall', { callerId: senderId, answer })

      peer.onicecandidate = (event) => {
        if (event.candidate) {
          socket.emit("ice-candidate", { from: socket.id, reciverData: senderPh, candidate: event.candidate })
        }
      }

      peer.ontrack = (event) => {
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

  // useEffect(() => {
  //   const peer = peerRef.current;
  //   if(!peer){console.warn({peer});return}
  //   if (peerRef.current?.remoteDescription && peerRef.current.remoteDescription.type) {
  //     console.log("it is ready to add ice candidate");
  //   }
    
  //   console.log({ peer});
  //   console.log("setRemoteDescription--",peer.setRemoteDescription );
  //   if (peer.setRemoteDescription) {
  //     ;; (async () => {
  //       peer.addIceCandidate(new RTCIceCandidate(iceCandidate));
  //     })()
  //       ;;
  //   }
  // }, [peerRef.current])

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

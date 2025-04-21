import React, { useEffect, useRef, useState } from 'react'

function MyVideo() {
  const [myVideo, setmyVideo] = useState(null);
  const videoRef = useRef(null);
  useEffect(() => {

    const startVideo = async () => {
    //  try {
       const myStrem = await navigator.mediaDevices.getUserMedia({
         video: true,
         audio: true,
       })
       setmyVideo(myStrem);
       if (videoRef.current) {
        videoRef.current.srcObject = myStrem;
      }
    //  } catch (error) {
    //   console.log("error on midia device");
    //  }
    }
    startVideo();
    return () =>{
      if (myVideo){
        myVideo.getTracks().forEach(track => track.stop());
      }
    }
  }, [])
  return (
    <div>
      <video ref={videoRef}  autoPlay muted className='w-200 h-100'></video>
    </div>
  )
}

export default MyVideo

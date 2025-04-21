import React, { useEffect, useRef } from 'react';

function SenderVideo({ remoteCallStream }) {
  const videoRef = useRef(null);

  useEffect(() => {
    if(!remoteCallStream){console.warn("no video streams !"); return;}
    if (videoRef.current && stream) {
      videoRef.current.srcObject = remoteCallStream;
    }
  }, [remoteCallStream]);

  return (
    <video
      ref={videoRef}
      autoPlay
      playsInline
      className='w-96 h-64 border rounded-md'
    />
  );
}

export default SenderVideo;

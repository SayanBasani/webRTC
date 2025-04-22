import React, { useEffect, useRef } from 'react';

function SenderVideo({ stream }) {
  const videoRef = useRef(null);

  useEffect(() => {
    if(!stream){console.warn("no video streams !"); return;}
    console.log('Remote Stream:', stream);
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

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

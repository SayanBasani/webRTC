import { createContext, useContext, useEffect, useState } from "react";
import { io } from "socket.io-client";
const backend_url = "localhost:4000";

export const socketContext = createContext(null);

export default function SocketProvider({ children }) {
  const [uid, setuid] = useState(null);
  const [reciverUid, setreciverUid] = useState(null);
  const [socket, setsocket] = useState(null);
  useEffect(() => {
    if (!uid) { console.log("must need the uid"); return; }
    const socketConn = io(`${backend_url}`, {
      transports: ["websocket"],
      auth: { uid: `${uid}` }
    });
    console.log("socked id -->", socketConn);
    setsocket(socketConn);
    return () => {
      socketConn.disconnect();
      console.log("Socket disconnected");
    }

  }, [uid]);
  return (
    <socketContext.Provider value={{ socket, uid, setuid,reciverUid, setreciverUid }}>
      {children}
    </socketContext.Provider>
  )
}
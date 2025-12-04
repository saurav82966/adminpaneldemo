import { Navigate } from "react-router-dom";
import { auth } from "../firebase";
import { ref, set, onDisconnect } from "firebase/database";
import { db } from "../firebase";

export default function ProtectedRoute({ children }) {
  const user = auth.currentUser;

  if (!user) return <Navigate to="/login" />;

  // ⭐ USER SESSION TRACKING
  const dbPath = localStorage.getItem("dbPath_" + user.uid);
  const sessionId = `${user.uid}_${Date.now()}`;

  const onlineRef = ref(db, `onlineAdmins/${dbPath}/${sessionId}`);

  const info = {
    email: user.email,
    browser: navigator.userAgent,
    platform: navigator.platform,
    lastActive: Date.now(),
    sessionId: sessionId
  };

  // Set online
  set(onlineRef, info);

  // Remove when tab closed
  onDisconnect(onlineRef).remove();

  return children;
}

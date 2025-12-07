import React, { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { auth } from "../firebase";

const ProtectedRoute = ({ children }) => {
  const [user, setUser] = useState(auth.currentUser);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = auth.onAuthStateChanged((u) => {
      setUser(u);
      setLoading(false);
    });

    const sync = (e) => {
      if (e.key === "force_logout") {
        window.location.reload();
      }
    };

    window.addEventListener("storage", sync);

    return () => {
      unsub();
      window.removeEventListener("storage", sync);
    };
  }, []);

  if (loading)
    return (
      <div style={{ textAlign: "center", paddingTop: "40px" }}>Loading...</div>
    );

  if (!user) return <Navigate to="/login" replace />;

  return children;
};

export default ProtectedRoute;

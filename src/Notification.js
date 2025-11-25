import React from 'react';
import './Notification.css';

const Notification = ({ message, onClose }) => {
  return (
    <div className="notification-item">
      <span>{message}</span>
      {/* The onClick handler calls the function passed from the parent to remove this notification */}
      <button onClick={onClose} className="close-btn">x</button>
    </div>
  );
};

export default Notification;
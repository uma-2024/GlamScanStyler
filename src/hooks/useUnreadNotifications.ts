import { useState, useEffect } from 'react';
import { API_BASE_URL_WITH_API } from '../config/api';

export const useUnreadNotifications = (userId?: string, activeTab?: string) => {
  const [hasUnread, setHasUnread] = useState(false);

  useEffect(() => {
    if (!userId) {
      setHasUnread(false);
      return;
    }

    const checkUnread = async () => {
      try {
        const response = await fetch(`${API_BASE_URL_WITH_API}/notifications/stylist/${userId}`);
        const result = await response.json();
        if (response.ok && result.success && Array.isArray(result.data)) {
          const unreadExists = result.data.some((n: any) => !n.isRead);
          setHasUnread(unreadExists);
        } else {
          setHasUnread(false);
        }
      } catch (error) {
        console.error('Error fetching unread notifications:', error);
      }
    };

    checkUnread();
    
    // Poll every 30 seconds
    const interval = setInterval(checkUnread, 30000);
    return () => clearInterval(interval);
  }, [userId, activeTab]); // Re-fetch when activeTab changes

  return hasUnread;
};


export interface Contact {
  id: string;
  name: string;
  avatar?: string;
  lastMessage?: string;
  lastMessageTime?: string;
  unreadCount?: number;
  status?: 'online' | 'offline';
  phoneNumber?: string;
}

export interface Message {
  id: string;
  contactId: string;
  text: string;
  timestamp: string;
  sender: 'user' | 'contact';
  status?: 'sent' | 'delivered' | 'read';
  media?: string;
}

export interface AnalyticsData {
  totalMessages: number;
  totalContacts: number;
  messagesByHour: { hour: number; count: number }[];
  messagesByDay: { day: string; count: number }[];
}

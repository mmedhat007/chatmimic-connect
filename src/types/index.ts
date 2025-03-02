export interface Contact {
  phoneNumber: string;
  lastMessage: string;
  lastTimestamp: number;
}

export interface Message {
  id: string;
  message: string;
  timestamp: number;
  sender: 'agent' | 'customer';
}

export interface AnalyticsData {
  totalMessages: number;
  totalContacts: number;
  messagesByHour: Array<{ hour: number; count: number }>;
  messagesByDay: { [key: string]: number };
}

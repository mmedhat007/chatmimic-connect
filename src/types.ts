export interface Contact {
  phoneNumber: string;
  contactName?: string;
  lastMessage: string;
  lastMessageTime: number;
  tags?: string[];
  agentStatus?: 'on' | 'off';
  humanAgent?: boolean;
  status?: 'open' | 'closed';
  lifecycle?: 'new_lead' | 'vip_lead' | 'hot_lead' | 'payment' | 'customer' | 'cold_lead';
  assignedTeam?: string;
  workflowStatus?: {
    name: string;
    status: 'started' | 'ended' | 'in_progress';
    timestamp?: number;
  };
}

export interface Message {
  id: string;
  message: string;
  timestamp: number;
  sender: 'agent' | 'human' | 'user';
  date?: string;
}

export interface AnalyticsData {
  totalMessages: number;
  totalContacts: number;
  messagesByHour: { hour: number; count: number }[];
  messagesByDay: { [key: string]: number };
} 
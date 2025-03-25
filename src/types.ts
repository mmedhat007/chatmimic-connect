export interface Contact {
  id: string;
  phone: string;
  name?: string;
  tags?: string[];
  lifecycle?: string;
  manually_set_lifecycle?: boolean;
  lastMessageAt?: number;
  phoneNumber: string;
  contactName?: string;
  lastMessage: string;
  lastMessageTime: number;
  agentStatus?: 'on' | 'off';
  humanAgent?: boolean;
  status?: 'open' | 'closed';
  assignedTeam?: string;
  workflowStatus?: {
    name: string;
    status: 'started' | 'ended' | 'in_progress';
    timestamp?: number;
  };
}

export interface Message {
  id: string;
  content: string;
  isFromCustomer: boolean;
  timestamp: number;
  message: string;
  date?: string;
  sender: 'agent' | 'human' | 'user';
}

export interface AnalyticsData {
  totalMessages: number;
  totalContacts: number;
  messagesByHour: { hour: number; count: number }[];
  messagesByDay: { [key: string]: number };
  messagesByTag?: { [tag: string]: number };
  messagesByLifecycle?: { [lifecycle: string]: number };
  contactsByLifecycle?: { [lifecycle: string]: number };
  selectedTags?: string[];
  selectedLifecycles?: string[];
}

export interface AnalyticsOptions {
  dateRange?: 'today' | 'week' | 'month' | 'all';
  tags?: string[];
  lifecycles?: string[];
}

export interface SheetColumn {
  id: string;
  name: string;
  description: string;
  type: 'text' | 'date' | 'name' | 'product' | 'inquiry' | 'phone';
  aiPrompt: string;
  isAutoPopulated?: boolean; // Whether this field should be auto-populated (e.g., phone number)
}

export interface SheetConfig {
  id?: string;
  name: string;
  description?: string;
  sheetId: string;
  columns: SheetColumn[];
  active: boolean;
  lastUpdated: number;
  addTrigger: 'first_message' | 'show_interest' | 'manual';
  autoUpdateFields: boolean; // Whether to update fields when new information is detected
} 
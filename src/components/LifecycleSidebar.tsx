import React, { useState, useEffect, useRef } from 'react';
import { Contact } from '../types';
import { ArrowLeft, ChevronDown, ChevronUp, CheckCircle, X, Flame, DollarSign, User, Phone, Inbox, ServerCrash, Layers, Edit2, Check, RotateCcw } from 'lucide-react';
import { getCurrentUser, getStageNames, updateStageName, resetStageName } from '../services/firebase';
import { db } from '../services/firebase';
import { collection, query, where, getDocs, onSnapshot } from 'firebase/firestore';

interface LifecycleSidebarProps {
  contact: Contact | null;
  onUpdateContactStatus: (contactId: string, status: string) => void;
  onClose?: () => void;
  isMobile?: boolean;
  onFilterByLifecycle?: (lifecycleId: string | null) => void;
  activeFilter?: string | null;
}

// Default lifecycle stages with icons and colors
const defaultLifecycleStages = [
  {
    id: 'new_lead',
    name: 'New Lead',
    icon: <Inbox className="w-5 h-5 text-blue-600" />,
    color: 'bg-blue-100 text-blue-600'
  },
  {
    id: 'vip_lead',
    name: 'VIP Lead',
    icon: <CheckCircle className="w-5 h-5 text-indigo-600" />,
    color: 'bg-indigo-100 text-indigo-600'
  },
  {
    id: 'hot_lead',
    name: 'Hot Lead',
    icon: <Flame className="w-5 h-5 text-orange-600" />,
    color: 'bg-orange-100 text-orange-600'
  },
  {
    id: 'payment',
    name: 'Payment',
    icon: <DollarSign className="w-5 h-5 text-yellow-600" />,
    color: 'bg-yellow-100 text-yellow-600'
  },
  {
    id: 'customer',
    name: 'Customer',
    icon: <User className="w-5 h-5 text-green-600" />,
    color: 'bg-green-100 text-green-600'
  },
  {
    id: 'cold_lead',
    name: 'Cold Lead',
    icon: <ServerCrash className="w-5 h-5 text-red-600" />,
    color: 'bg-red-100 text-red-600'
  }
];

const LifecycleSidebar: React.FC<LifecycleSidebarProps> = ({
  contact,
  onUpdateContactStatus,
  onClose,
  isMobile = false,
  onFilterByLifecycle,
  activeFilter = null
}) => {
  const [lifecycleOpen, setLifecycleOpen] = useState(true);
  const [teamInboxOpen, setTeamInboxOpen] = useState(true);
  const [customInboxOpen, setCustomInboxOpen] = useState(true);
  const [lifecycleCounts, setLifecycleCounts] = useState<{[key: string]: number}>({});
  const [totalContacts, setTotalContacts] = useState(0);
  const [loading, setLoading] = useState(true);
  
  // State for custom stage names
  const [customStageNames, setCustomStageNames] = useState<{[key: string]: string}>({});
  
  // State for editing stage names
  const [editingStageId, setEditingStageId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const editInputRef = useRef<HTMLInputElement>(null);
  
  // Combined lifecycle stages with custom names
  const lifecycleStages = defaultLifecycleStages.map(stage => ({
    ...stage,
    name: customStageNames[stage.id] || stage.name
  }));

  // Fetch custom stage names
  useEffect(() => {
    const fetchCustomStageNames = async () => {
      const names = await getStageNames();
      if (names) {
        setCustomStageNames(names);
      }
    };
    
    fetchCustomStageNames();
  }, []);
  
  // Focus input when editing
  useEffect(() => {
    if (editingStageId && editInputRef.current) {
      editInputRef.current.focus();
    }
  }, [editingStageId]);
  
  // Add click outside listener for edit mode
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (editingStageId && editInputRef.current && !editInputRef.current.contains(event.target as Node)) {
        setEditingStageId(null);
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [editingStageId]);

  // Fetch lifecycle counts
  useEffect(() => {
    const userUID = getCurrentUser();
    if (!userUID) return;
    
    setLoading(true);
    
    // Get all contacts for this user - use onSnapshot for real-time updates
    const chatsRef = collection(db, 'Whatsapp_Data', userUID, 'chats');
    
    // Set up a real-time listener for changes to contacts
    const unsubscribe = onSnapshot(chatsRef, (querySnapshot) => {
      const lifecycleCountMap: {[key: string]: number} = {};
      let total = 0;
      
      // Initialize with zeros
      defaultLifecycleStages.forEach(stage => {
        lifecycleCountMap[stage.id] = 0;
      });
      
      // Count contacts by lifecycle
      querySnapshot.forEach(doc => {
        const data = doc.data();
        total++;
        
        if (data.lifecycle && lifecycleCountMap[data.lifecycle] !== undefined) {
          lifecycleCountMap[data.lifecycle]++;
        }
      });
      
      setLifecycleCounts(lifecycleCountMap);
      setTotalContacts(total);
      setLoading(false);
    }, (error) => {
      console.error('Error in lifecycle counts listener:', error);
      setLoading(false);
    });
    
    // Clean up listener when component unmounts
    return () => unsubscribe();
  }, []);

  // Sample team inbox data
  const teamInboxes = [
    { id: 'sales_apac', name: 'Sales team APAC', count: 1 },
    { id: 'marketing_apac', name: 'Marketing team APAC', count: 0 },
    { id: 'sales_emea', name: 'Sales team EMEA', count: 10 },
    { id: 'marketing_emea', name: 'Marketing team EMEA', count: 7 }
  ];

  // Handle contact status update
  const handleStatusChange = (stageId: string) => {
    if (contact) {
      onUpdateContactStatus(contact.phoneNumber, stageId);
    }
  };

  // Handle filtering by lifecycle
  const handleFilterClick = (stageId: string | null) => {
    if (onFilterByLifecycle) {
      onFilterByLifecycle(stageId);
    }
  };
  
  // Start editing a stage name
  const handleEditName = (stageId: string, currentName: string) => {
    setEditingStageId(stageId);
    setEditingName(currentName);
  };
  
  // Save the edited stage name
  const handleSaveName = async (stageId: string) => {
    if (!editingName.trim()) {
      // If empty, revert to default name
      const defaultStage = defaultLifecycleStages.find(s => s.id === stageId);
      if (defaultStage) {
        setEditingName(defaultStage.name);
      }
      return;
    }
    
    try {
      await updateStageName(stageId, editingName.trim());
      
      // Update local state
      setCustomStageNames(prev => ({
        ...prev,
        [stageId]: editingName.trim()
      }));
      
      // Exit edit mode
      setEditingStageId(null);
    } catch (error) {
      console.error('Error updating stage name:', error);
    }
  };
  
  // Reset a stage name to its default
  const handleResetName = async (stageId: string) => {
    try {
      await resetStageName(stageId);
      
      // Update local state
      setCustomStageNames(prev => {
        const updated = { ...prev };
        delete updated[stageId];
        return updated;
      });
      
      // Get the default name and set it in the input
      const defaultStage = defaultLifecycleStages.find(s => s.id === stageId);
      if (defaultStage) {
        setEditingName(defaultStage.name);
      }
    } catch (error) {
      console.error('Error resetting stage name:', error);
    }
  };

  // Determine mode: 'filter' or 'update'
  const mode = activeFilter !== null ? 'filter' : 'update';

  return (
    <div className="h-full flex flex-col bg-white border-r w-64">
      {/* Mobile header with back button */}
      {isMobile && (
        <div className="p-3 border-b flex items-center">
          <button
            onClick={onClose}
            className="mr-2 p-1 rounded-full hover:bg-gray-100"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <span className="font-medium">Inbox</span>
        </div>
      )}

      {/* Main header */}
      {!isMobile && (
        <div className="p-4 border-b flex items-center justify-between">
          <h2 className="font-semibold text-gray-800">Inbox</h2>
          {activeFilter && (
            <button
              onClick={() => onFilterByLifecycle && onFilterByLifecycle(null)}
              className="text-gray-500 hover:text-gray-700 font-medium text-sm px-2 py-1 rounded hover:bg-gray-100"
            >
              Clear Filter
            </button>
          )}
        </div>
      )}

      {/* Mode Indicator */}
      <div className="px-4 py-2 bg-gray-50 border-b">
        <div className="flex justify-between items-center">
          <span className="text-xs font-medium text-gray-500">
            {mode === 'filter' ? 'Filter Mode' : contact ? 'Assignment Mode' : 'Filter Mode'}
          </span>
          <span className="text-xs text-gray-500">{loading ? 'Loading...' : `${totalContacts} contacts`}</span>
        </div>
      </div>

      {/* Lifecycle section */}
      <div className="border-b">
        <div 
          className="p-3 flex items-center justify-between cursor-pointer hover:bg-gray-50"
          onClick={() => setLifecycleOpen(!lifecycleOpen)}
        >
          <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
            <Layers className="w-4 h-4 text-gray-500" />
            <span>Stages</span>
          </div>
          <div className="flex items-center">
            {editingStageId ? (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setEditingStageId(null);
                }}
                className="p-1 rounded-full text-gray-400 hover:text-gray-700 hover:bg-gray-100 mr-2"
                title="Cancel Editing"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            ) : null}
            {lifecycleOpen ? (
              <ChevronUp className="w-4 h-4 text-gray-500" />
            ) : (
              <ChevronDown className="w-4 h-4 text-gray-500" />
            )}
          </div>
        </div>

        {lifecycleOpen && (
          <div className="px-2 pb-2">
            {/* All Inbox Option */}
            <div 
              className={`flex items-center justify-between p-2 rounded-md cursor-pointer text-sm my-1
                ${activeFilter === null ? 'bg-gray-200' : 'hover:bg-gray-50'}`}
              onClick={() => handleFilterClick(null)}
            >
              <div className="flex items-center gap-2">
                <div className="flex items-center justify-center w-6 h-6 rounded-md bg-gray-100">
                  <Inbox className="w-5 h-5 text-gray-600" />
                </div>
                <span className="text-gray-700">All Inbox</span>
              </div>
              
              <div className="flex items-center">
                {/* Show total count */}
                <span className="text-xs bg-gray-200 text-gray-700 px-2 py-0.5 rounded-full">
                  {loading ? '...' : totalContacts}
                </span>
                
                {/* Show indicator if this is the active filter (All) */}
                {activeFilter === null && (
                  <span className="w-2 h-2 rounded-full bg-blue-500 ml-2"></span>
                )}
              </div>
            </div>

            {/* Lifecycle stages */}
            {lifecycleStages.map((stage) => (
              <div 
                key={stage.id}
                className={`flex items-center justify-between p-2 rounded-md cursor-pointer text-sm my-1 group
                  ${activeFilter === stage.id ? 'bg-gray-200' : 'hover:bg-gray-50'}
                  ${contact?.lifecycle === stage.id ? 'border-l-4 border-blue-500 pl-1' : ''}`}
                onClick={() => {
                  if (editingStageId === stage.id) {
                    return; // Don't do anything if we're editing
                  }
                  
                  // Only filter by lifecycle stage, never assign from here
                  handleFilterClick(stage.id);
                }}
              >
                <div className="flex items-center gap-2 flex-grow min-w-0">
                  <div className={`flex items-center justify-center w-6 h-6 rounded-md ${stage.color.split(' ')[0]}`}>
                    {stage.icon}
                  </div>
                  
                  {editingStageId === stage.id ? (
                    <div className="flex items-center flex-grow min-w-0" onClick={e => e.stopPropagation()}>
                      <input
                        ref={editInputRef}
                        type="text"
                        value={editingName}
                        onChange={(e) => setEditingName(e.target.value)}
                        className="flex-grow p-0.5 text-sm border rounded min-w-0"
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            handleSaveName(stage.id);
                          } else if (e.key === 'Escape') {
                            setEditingStageId(null);
                          }
                        }}
                      />
                      <div className="flex items-center">
                        {/* Reset to default button - only show if this stage has a custom name */}
                        {customStageNames[stage.id] && (
                          <button
                            className="ml-1 p-1 text-orange-600 hover:bg-orange-50 rounded-full"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleResetName(stage.id);
                            }}
                            title="Reset to default name"
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                          </button>
                        )}
                        {/* Save button */}
                        <button
                          className="ml-1 p-1 text-green-600 hover:bg-green-50 rounded-full"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleSaveName(stage.id);
                          }}
                          title="Save name"
                        >
                          <Check className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between flex-grow min-w-0">
                      <span 
                        className={`text-gray-700 truncate ${
                          customStageNames[stage.id] ? 'font-medium italic' : ''
                        }`}
                        title={customStageNames[stage.id] ? `Custom name (default: ${
                          defaultLifecycleStages.find(s => s.id === stage.id)?.name
                        })` : stage.name}
                      >
                        {stage.name}
                        {customStageNames[stage.id] && (
                          <span className="ml-1 inline-block w-1.5 h-1.5 rounded-full bg-blue-500 align-middle"></span>
                        )}
                      </span>
                      <button 
                        className="ml-1 p-1 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleEditName(stage.id, stage.name);
                        }}
                        title="Edit Name"
                      >
                        <Edit2 className="w-3 h-3" />
                      </button>
                    </div>
                  )}
                </div>
                
                <div className="flex items-center">
                  {/* Show count for this stage */}
                  <span className="text-xs bg-gray-200 text-gray-700 px-2 py-0.5 rounded-full">
                    {loading ? '...' : lifecycleCounts[stage.id] || 0}
                  </span>
                  
                  {/* Context menu for easier lifecycle assignment */}
                  {contact && mode === 'update' && editingStageId !== stage.id && (
                    <button 
                      className={`p-1 rounded-full ml-1 ${
                        contact.lifecycle === stage.id 
                          ? 'bg-blue-100 text-blue-600' 
                          : 'text-gray-400 hover:text-gray-700 hover:bg-gray-100'
                      }`}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleStatusChange(stage.id);
                      }}
                      title={`Assign to ${stage.name}`}
                    >
                      <User className="w-3.5 h-3.5" />
                    </button>
                  )}
                  
                  {/* Show indicator if this is the active filter */}
                  {activeFilter === stage.id && (
                    <span className="w-2 h-2 rounded-full bg-blue-500 ml-1"></span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Team inbox section */}
      <div className="border-b">
        <div 
          className="p-3 flex items-center justify-between cursor-pointer hover:bg-gray-50"
          onClick={() => setTeamInboxOpen(!teamInboxOpen)}
        >
          <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
            <Inbox className="w-4 h-4 text-gray-500" />
            <span>Team Inbox</span>
          </div>
          {teamInboxOpen ? (
            <ChevronUp className="w-4 h-4 text-gray-500" />
          ) : (
            <ChevronDown className="w-4 h-4 text-gray-500" />
          )}
        </div>

        {teamInboxOpen && (
          <div className="px-2 pb-2">
            <div className="py-2 px-4 text-xs text-gray-500">
              Team assignment not available yet
            </div>
            {/* Disabled team inboxes for now */}
            {/*
            {teamInboxes.map((inbox) => (
              <div 
                key={inbox.id}
                className="flex items-center justify-between p-2 rounded-md cursor-pointer text-sm my-1 hover:bg-gray-50"
              >
                <span className="text-gray-700">{inbox.name}</span>
                {inbox.count > 0 && (
                  <span className="text-xs bg-gray-200 text-gray-700 px-2 py-0.5 rounded-full">{inbox.count}</span>
                )}
              </div>
            ))}
            */}
          </div>
        )}
      </div>

      {/* Custom inbox section */}
      <div className="border-b">
        <div 
          className="p-3 flex items-center justify-between cursor-pointer hover:bg-gray-50"
          onClick={() => setCustomInboxOpen(!customInboxOpen)}
        >
          <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
            <Inbox className="w-4 h-4 text-gray-500" />
            <span>Custom Inbox</span>
          </div>
          {customInboxOpen ? (
            <ChevronUp className="w-4 h-4 text-gray-500" />
          ) : (
            <ChevronDown className="w-4 h-4 text-gray-500" />
          )}
        </div>

        {customInboxOpen && (
          <div className="px-2 pb-2">
            <div className="py-2 px-4 text-xs text-gray-500">
              Custom inboxes not available yet
            </div>
            {/* Disabled custom inbox options for now */}
            {/*
            <div className="flex justify-between p-2 text-sm">
              <button className="text-gray-600 hover:text-gray-800">All</button>
              <button className="text-gray-600 hover:text-gray-800">By Me</button>
              <button className="text-gray-600 hover:text-gray-800">By Others</button>
            </div>
            <div className="p-2 rounded-md cursor-pointer text-sm my-1 hover:bg-gray-50">
              <div className="flex items-center gap-2">
                <Inbox className="w-4 h-4 text-gray-500" />
                <span className="text-gray-700">Respond.io Adventure Map</span>
              </div>
            </div>
            <div className="p-2 rounded-md cursor-pointer text-sm my-1 hover:bg-gray-50">
              <div className="flex items-center gap-2">
                <Inbox className="w-4 h-4 text-gray-500" />
                <span className="text-gray-700">Industry: Education</span>
              </div>
            </div>
            <div className="p-2 rounded-md cursor-pointer text-sm my-1 hover:bg-gray-50">
              <div className="flex items-center gap-2">
                <Inbox className="w-4 h-4 text-gray-500" />
                <span className="text-gray-700">Industry: Retail</span>
              </div>
            </div>
            */}
          </div>
        )}
      </div>

      {/* Workflow status section */}
      {contact && (
        <div className="px-3 py-2">
          <div className="bg-orange-50 text-orange-800 p-3 rounded-md text-sm">
            <p className="font-medium">Workflow Assignment: AI Agent started</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default LifecycleSidebar; 
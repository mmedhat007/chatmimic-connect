import { useState, useEffect } from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, Legend, PieChart, Pie, Cell
} from 'recharts';
import { getAnalyticsData, getContacts } from '../services/firebase';
import { getAvailableLifecycleStages } from '../services/lifecycleTagging';
import NavSidebar from '../components/NavSidebar';
import { useIsMobile } from '../hooks/use-mobile';
import { AnalyticsData, AnalyticsOptions, Contact } from '../types';

type TimeInterval = 'today' | 'week' | 'month' | 'all';

const COLORS = [
  '#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', 
  '#EC4899', '#F97316', '#14B8A6', '#6366F1', '#D946EF'
];

const Analytics = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [timeInterval, setTimeInterval] = useState<TimeInterval>('today');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [selectedLifecycles, setSelectedLifecycles] = useState<string[]>([]);
  const [availableTags, setAvailableTags] = useState<string[]>([]);
  const [availableLifecycles, setAvailableLifecycles] = useState<string[]>([]);
  const [analyticsData, setAnalyticsData] = useState<AnalyticsData>({
    totalMessages: 0,
    totalContacts: 0,
    messagesByHour: Array.from({ length: 24 }, (_, i) => ({ hour: i, count: 0 })),
    messagesByDay: {
      'Sunday': 0, 'Monday': 0, 'Tuesday': 0, 'Wednesday': 0,
      'Thursday': 0, 'Friday': 0, 'Saturday': 0
    },
    messagesByTag: {},
    messagesByLifecycle: {},
    contactsByLifecycle: {}
  });
  const isMobile = useIsMobile();

  // Effect to fetch available tags
  useEffect(() => {
    const fetchAvailableTags = () => {
      setLoading(true);
      
      const unsubscribe = getContacts((contacts: Contact[]) => {
        // Extract all unique tags
        const tagsSet = new Set<string>();
        contacts.forEach(contact => {
          contact.tags?.forEach(tag => tagsSet.add(tag));
        });
        
        setAvailableTags(Array.from(tagsSet).sort());
        setLoading(false);
      });
      
      return unsubscribe;
    };
    
    const unsubscribe = fetchAvailableTags();
    return () => unsubscribe();
  }, []);

  // Effect to fetch available lifecycle stages
  useEffect(() => {
    // Get the default lifecycle stages
    const defaultStages = getAvailableLifecycleStages();
    
    // Also discover any custom lifecycle stages from contacts
    const unsubscribe = getContacts((contacts: Contact[]) => {
      const lifecyclesSet = new Set<string>(defaultStages);
      
      // Add any custom lifecycle stages from contacts
      contacts.forEach(contact => {
        if (contact.lifecycle && !lifecyclesSet.has(contact.lifecycle)) {
          lifecyclesSet.add(contact.lifecycle);
        }
      });
      
      // Add 'none' for contacts without lifecycle
      lifecyclesSet.add('none');
      
      setAvailableLifecycles(Array.from(lifecyclesSet).sort());
    });
    
    return () => unsubscribe();
  }, []);

  // Effect to fetch analytics data
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError(null);
      
      try {
        console.log(`Fetching analytics data for time interval: ${timeInterval} and tags:`, selectedTags);
        
        const options: AnalyticsOptions = {
          dateRange: timeInterval
        };
        
        if (selectedTags.length > 0) {
          options.tags = selectedTags;
        }
        
        if (selectedLifecycles.length > 0) {
          options.lifecycles = selectedLifecycles;
        }
        
        const data = await getAnalyticsData(options);
        console.log('Analytics data received:', data);
        setAnalyticsData(data);
      } catch (error) {
        console.error('Error fetching analytics data:', error);
        setError(`Failed to load analytics data: ${error instanceof Error ? error.message : String(error)}`);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [timeInterval, selectedTags, selectedLifecycles]);

  // Handle tag selection/deselection
  const toggleTag = (tag: string) => {
    setSelectedTags(prev => 
      prev.includes(tag)
        ? prev.filter(t => t !== tag)
        : [...prev, tag]
    );
  };

  // Clear all selected tags
  const clearTagFilters = () => {
    setSelectedTags([]);
  };
  
  // Handle lifecycle selection/deselection
  const toggleLifecycle = (lifecycle: string) => {
    setSelectedLifecycles(prev => 
      prev.includes(lifecycle)
        ? prev.filter(l => l !== lifecycle)
        : [...prev, lifecycle]
    );
  };
  
  // Clear all selected lifecycles
  const clearLifecycleFilters = () => {
    setSelectedLifecycles([]);
  };

  // Transform messagesByDay data for the line chart
  const messagesByDayData = Object.entries(analyticsData.messagesByDay).map(([day, count]) => ({
    day,
    count
  }));

  // Transform messagesByTag data for the pie chart
  const messagesByTagData = analyticsData.messagesByTag ?
    Object.entries(analyticsData.messagesByTag)
      .filter(([_, count]) => count > 0)
      .sort((a, b) => b[1] - a[1]) // Sort by count (descending)
      .map(([tag, count], index) => ({
        tag,
        count,
        color: COLORS[index % COLORS.length]
      }))
    : [];
    
  // Transform messagesByLifecycle data for the pie chart
  const messagesByLifecycleData = analyticsData.messagesByLifecycle ?
    Object.entries(analyticsData.messagesByLifecycle)
      .filter(([_, count]) => count > 0)
      .sort((a, b) => b[1] - a[1]) // Sort by count (descending)
      .map(([lifecycle, count], index) => ({
        lifecycle,
        count,
        color: COLORS[index % COLORS.length]
      }))
    : [];
    
  // Transform contactsByLifecycle data for the pie chart
  const contactsByLifecycleData = analyticsData.contactsByLifecycle ?
    Object.entries(analyticsData.contactsByLifecycle)
      .filter(([_, count]) => count > 0)
      .sort((a, b) => b[1] - a[1]) // Sort by count (descending)
      .map(([lifecycle, count], index) => ({
        lifecycle,
        count,
        color: COLORS[index % COLORS.length]
      }))
    : [];

  const renderDebugInfo = () => {
    if (!error && analyticsData.totalMessages === 0 && analyticsData.totalContacts === 0) {
      return (
        <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-6">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <p className="text-sm text-yellow-700">
                No analytics data found. This could be because:
              </p>
              <ul className="mt-2 text-sm text-yellow-700 list-disc list-inside">
                <li>There are no messages in your account yet</li>
                <li>The selected time period contains no data</li>
                {selectedTags.length > 0 && <li>No data matches the selected tags</li>}
                {selectedLifecycles.length > 0 && <li>No data matches the selected lifecycle stages</li>}
                <li>There might be issues with data access permissions</li>
              </ul>
              <p className="mt-2 text-sm text-yellow-700">
                Try changing the time period filter
                {selectedTags.length > 0 ? ', tag filters' : ''}
                {selectedLifecycles.length > 0 ? ', or lifecycle filters' : ''} 
                or check back after receiving messages.
              </p>
            </div>
          </div>
        </div>
      );
    }
    return null;
  };

  if (loading && availableTags.length === 0) {
    return (
      <div className="h-screen w-screen bg-gray-100 flex items-center justify-center">
        <div className="text-xl text-gray-600">Loading analytics...</div>
      </div>
    );
  }

  return (
    <div className="flex h-screen">
      <NavSidebar />
      <div className="flex-1 overflow-auto ml-20">
        <div className="p-6">
          <h1 className="text-2xl font-semibold mb-6">Analytics</h1>
          <div className="flex justify-between items-center mb-8">
            <h1 className="text-3xl font-bold text-gray-900">Chat Analytics</h1>
            
            {/* Time Interval Selector */}
            <div className="flex space-x-2">
              {(['today', 'week', 'month', 'all'] as TimeInterval[]).map((interval) => (
                <button
                  key={interval}
                  onClick={() => setTimeInterval(interval)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    timeInterval === interval
                      ? 'bg-blue-600 text-white'
                      : 'bg-white text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  {interval === 'today' ? 'Today' :
                   interval === 'week' ? 'Last 7 Days' :
                   interval === 'month' ? 'Last 30 Days' : 'All Time'}
                </button>
              ))}
            </div>
          </div>

          {/* Tag Filter Section */}
          {availableTags.length > 0 && (
            <div className="bg-white rounded-lg shadow p-4 mb-6">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-md font-medium text-gray-900">Filter by Tags</h3>
                {selectedTags.length > 0 && (
                  <button 
                    onClick={clearTagFilters}
                    className="text-sm text-blue-600 hover:text-blue-800"
                  >
                    Clear Filters
                  </button>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                {availableTags.map(tag => (
                  <button
                    key={tag}
                    onClick={() => toggleTag(tag)}
                    className={`
                      px-3 py-1 rounded-full text-xs font-medium 
                      ${selectedTags.includes(tag)
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-100 text-gray-800 hover:bg-gray-200'}
                    `}
                  >
                    {tag}
                    {selectedTags.includes(tag) && (
                      <span className="ml-1">✓</span>
                    )}
                  </button>
                ))}
              </div>
              {selectedTags.length > 0 && (
                <div className="mt-2 text-sm text-gray-500">
                  Showing data for contacts with tags: {selectedTags.join(', ')}
                </div>
              )}
            </div>
          )}
          
          {/* Lifecycle Filter Section */}
          {availableLifecycles.length > 0 && (
            <div className="bg-white rounded-lg shadow p-4 mb-6">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-md font-medium text-gray-900">Filter by Lifecycle Stages</h3>
                {selectedLifecycles.length > 0 && (
                  <button 
                    onClick={clearLifecycleFilters}
                    className="text-sm text-blue-600 hover:text-blue-800"
                  >
                    Clear Filters
                  </button>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                {availableLifecycles.map(lifecycle => (
                  <button
                    key={lifecycle}
                    onClick={() => toggleLifecycle(lifecycle)}
                    className={`
                      px-3 py-1 rounded-full text-xs font-medium 
                      ${selectedLifecycles.includes(lifecycle)
                        ? 'bg-purple-600 text-white'
                        : 'bg-gray-100 text-gray-800 hover:bg-gray-200'}
                    `}
                  >
                    {lifecycle}
                    {selectedLifecycles.includes(lifecycle) && (
                      <span className="ml-1">✓</span>
                    )}
                  </button>
                ))}
              </div>
              {selectedLifecycles.length > 0 && (
                <div className="mt-2 text-sm text-gray-500">
                  Showing data for contacts in lifecycle stages: {selectedLifecycles.join(', ')}
                </div>
              )}
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="bg-red-50 border-l-4 border-red-400 p-4 mb-6">
              <div className="flex">
                <div className="flex-shrink-0">
                  <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="ml-3">
                  <p className="text-sm text-red-700">
                    {error}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Warning for missing data */}
          {renderDebugInfo()}

          {/* Overview Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <div className="bg-white rounded-lg shadow p-6 border-l-4 border-blue-500">
              <h3 className="text-sm font-medium text-gray-500 uppercase mb-1">Total Messages</h3>
              <p className="text-3xl font-bold text-gray-900">{analyticsData.totalMessages}</p>
              {selectedTags.length > 0 && (
                <p className="text-xs text-gray-500 mt-1">Filtered by {selectedTags.length} tag(s)</p>
              )}
              {selectedLifecycles.length > 0 && (
                <p className="text-xs text-gray-500 mt-1">Filtered by {selectedLifecycles.length} lifecycle(s)</p>
              )}
            </div>

            <div className="bg-white rounded-lg shadow p-6 border-l-4 border-green-500">
              <h3 className="text-sm font-medium text-gray-500 uppercase mb-1">Total Contacts</h3>
              <p className="text-3xl font-bold text-gray-900">{analyticsData.totalContacts}</p>
              {(selectedTags.length > 0 || selectedLifecycles.length > 0) && (
                <p className="text-xs text-gray-500 mt-1">
                  Matching current filters
                </p>
              )}
            </div>
            
            {messagesByTagData.length > 0 && (
              <div className="bg-white rounded-lg shadow p-6 border-l-4 border-purple-500">
                <h3 className="text-sm font-medium text-gray-500 uppercase mb-1">Top Tag</h3>
                {messagesByTagData.length > 0 ? (
                  <>
                    <p className="text-2xl font-bold text-gray-900 truncate" title={messagesByTagData[0].tag}>
                      {messagesByTagData[0].tag}
                    </p>
                    <p className="text-sm text-gray-500 mt-1">
                      {messagesByTagData[0].count} messages ({((messagesByTagData[0].count / analyticsData.totalMessages) * 100).toFixed(1)}%)
                    </p>
                  </>
                ) : (
                  <p className="text-lg text-gray-400">No tag data</p>
                )}
              </div>
            )}
            
            {messagesByLifecycleData.length > 0 && (
              <div className="bg-white rounded-lg shadow p-6 border-l-4 border-yellow-500">
                <h3 className="text-sm font-medium text-gray-500 uppercase mb-1">Top Lifecycle</h3>
                {messagesByLifecycleData.length > 0 ? (
                  <>
                    <p className="text-2xl font-bold text-gray-900 truncate" title={messagesByLifecycleData[0].lifecycle}>
                      {messagesByLifecycleData[0].lifecycle}
                    </p>
                    <p className="text-sm text-gray-500 mt-1">
                      {contactsByLifecycleData.find(c => c.lifecycle === messagesByLifecycleData[0].lifecycle)?.count || 0} contacts
                    </p>
                  </>
                ) : (
                  <p className="text-lg text-gray-400">No lifecycle data</p>
                )}
              </div>
            )}
          </div>

          {/* Messages by Tag Chart (Only show if tags are available and we have data) */}
          {messagesByTagData.length > 0 && (
            <div className="bg-white rounded-lg shadow p-6 mb-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Messages by Tag</h3>
              <div className="h-[300px] flex flex-col md:flex-row">
                <div className="w-full md:w-2/3 h-[250px] md:h-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={messagesByTagData}
                        dataKey="count"
                        nameKey="tag"
                        cx="50%"
                        cy="50%"
                        outerRadius={80}
                        labelLine={false}
                        label={({ tag, count, percent }) => {
                          // Only show label for slices with significant percentage
                          return percent > 0.05 ? 
                            `${(percent * 100).toFixed(0)}%` : 
                            '';
                        }}
                      >
                        {messagesByTagData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip 
                        formatter={(value: number, name: string, props) => [
                          `${value} (${((props.payload.count / analyticsData.totalMessages) * 100).toFixed(1)}%)`, 
                          'Messages'
                        ]}
                        labelFormatter={(label) => `Tag: ${label}`}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="w-full md:w-1/3 mt-4 md:mt-0 flex flex-col justify-center">
                  <h4 className="font-medium mb-2 text-gray-700">Tag Distribution</h4>
                  <div className="space-y-2 overflow-auto max-h-[200px] pr-2">
                    {messagesByTagData.map((entry, index) => (
                      <div key={index} className="flex items-center text-sm p-1 hover:bg-gray-50 rounded">
                        <div 
                          className="w-4 h-4 mr-2 rounded-sm" 
                          style={{ backgroundColor: entry.color }}
                        ></div>
                        <span className="mr-2 truncate max-w-[100px]" title={entry.tag}>
                          {entry.tag}:
                        </span>
                        <span className="font-medium">{entry.count}</span>
                        <span className="text-gray-500 text-xs ml-1">
                          ({((entry.count / analyticsData.totalMessages) * 100).toFixed(1)}%)
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
          
          {/* Messages by Lifecycle Stage Chart */}
          {messagesByLifecycleData.length > 0 && (
            <div className="bg-white rounded-lg shadow p-6 mb-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Messages by Lifecycle Stage</h3>
              <div className="h-[300px] flex flex-col md:flex-row">
                <div className="w-full md:w-2/3 h-[250px] md:h-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={messagesByLifecycleData}
                        dataKey="count"
                        nameKey="lifecycle"
                        cx="50%"
                        cy="50%"
                        outerRadius={80}
                        labelLine={false}
                        label={({ lifecycle, count, percent }) => {
                          // Only show label for slices with significant percentage
                          return percent > 0.05 ? 
                            `${(percent * 100).toFixed(0)}%` : 
                            '';
                        }}
                      >
                        {messagesByLifecycleData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip 
                        formatter={(value: number, name: string, props) => [
                          `${value} (${((props.payload.count / analyticsData.totalMessages) * 100).toFixed(1)}%)`, 
                          'Messages'
                        ]}
                        labelFormatter={(label) => `Lifecycle: ${label}`}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="w-full md:w-1/3 mt-4 md:mt-0 flex flex-col justify-center">
                  <h4 className="font-medium mb-2 text-gray-700">Lifecycle Message Distribution</h4>
                  <div className="space-y-2 overflow-auto max-h-[200px] pr-2">
                    {messagesByLifecycleData.map((entry, index) => (
                      <div key={index} className="flex items-center text-sm p-1 hover:bg-gray-50 rounded">
                        <div 
                          className="w-4 h-4 mr-2 rounded-sm" 
                          style={{ backgroundColor: entry.color }}
                        ></div>
                        <span className="mr-2 truncate max-w-[100px]" title={entry.lifecycle}>
                          {entry.lifecycle}:
                        </span>
                        <span className="font-medium">{entry.count}</span>
                        <span className="text-gray-500 text-xs ml-1">
                          ({((entry.count / analyticsData.totalMessages) * 100).toFixed(1)}%)
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
          
          {/* Contacts by Lifecycle Stage Chart */}
          {contactsByLifecycleData.length > 0 && (
            <div className="bg-white rounded-lg shadow p-6 mb-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Contacts by Lifecycle Stage</h3>
              <div className="h-[300px] flex flex-col md:flex-row">
                <div className="w-full md:w-2/3 h-[250px] md:h-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={contactsByLifecycleData}
                        dataKey="count"
                        nameKey="lifecycle"
                        cx="50%"
                        cy="50%"
                        outerRadius={80}
                        labelLine={false}
                        label={({ lifecycle, count, percent }) => {
                          // Only show label for slices with significant percentage
                          return percent > 0.05 ? 
                            `${(percent * 100).toFixed(0)}%` : 
                            '';
                        }}
                      >
                        {contactsByLifecycleData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip 
                        formatter={(value: number, name: string, props) => [
                          `${value} (${((props.payload.count / analyticsData.totalContacts) * 100).toFixed(1)}%)`, 
                          'Contacts'
                        ]}
                        labelFormatter={(label) => `Lifecycle: ${label}`}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="w-full md:w-1/3 mt-4 md:mt-0 flex flex-col justify-center">
                  <h4 className="font-medium mb-2 text-gray-700">Lifecycle Contact Distribution</h4>
                  <div className="space-y-2 overflow-auto max-h-[200px] pr-2">
                    {contactsByLifecycleData.map((entry, index) => (
                      <div key={index} className="flex items-center text-sm p-1 hover:bg-gray-50 rounded">
                        <div 
                          className="w-4 h-4 mr-2 rounded-sm" 
                          style={{ backgroundColor: entry.color }}
                        ></div>
                        <span className="mr-2 truncate max-w-[100px]" title={entry.lifecycle}>
                          {entry.lifecycle}:
                        </span>
                        <span className="font-medium">{entry.count}</span>
                        <span className="text-gray-500 text-xs ml-1">
                          ({((entry.count / analyticsData.totalContacts) * 100).toFixed(1)}%)
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Messages by Hour Chart */}
          <div className="bg-white rounded-lg shadow p-6 mb-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Messages by Hour</h3>
            <div className="h-[300px]">
              {analyticsData.totalMessages > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={analyticsData.messagesByHour}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis 
                      dataKey="hour"
                      tickFormatter={(hour) => `${hour}:00`}
                      tick={{ fill: '#374151', fontSize: 12 }}
                    />
                    <YAxis 
                      tick={{ fill: '#374151', fontSize: 12 }}
                      tickFormatter={(value) => value === 0 ? '0' : value}
                    />
                    <Tooltip
                      formatter={(value: number) => [`${value} messages`, 'Volume']}
                      labelFormatter={(hour: number) => `Hour: ${hour}:00`}
                      cursor={{ fill: 'rgba(59, 130, 246, 0.1)' }}
                      contentStyle={{ 
                        backgroundColor: 'white', 
                        border: '1px solid #e5e7eb',
                        borderRadius: '0.375rem',
                        padding: '0.5rem',
                        fontSize: '0.875rem'
                      }}
                    />
                    <Legend 
                      formatter={() => 'Hourly Message Volume'}
                      verticalAlign="top"
                      height={36}
                      iconSize={12}
                    />
                    <Bar 
                      dataKey="count"
                      name="Messages"
                      fill="#3B82F6"
                      minPointSize={1}
                      radius={[2, 2, 0, 0]}
                      background={{ fill: '#f3f4f6' }}
                    />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-gray-500">
                  No message data available for the selected time period
                </div>
              )}
            </div>
          </div>

          {/* Messages by Day Line Chart */}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Messages by Day</h3>
            <div className="h-[300px]">
              {analyticsData.totalMessages > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={messagesByDayData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis 
                      dataKey="day" 
                      tick={{ fill: '#374151', fontSize: 12 }}
                    />
                    <YAxis 
                      tick={{ fill: '#374151', fontSize: 12 }}
                      tickFormatter={(value) => value === 0 ? '0' : value}
                    />
                    <Tooltip 
                      formatter={(value: number) => [`${value} messages`, 'Volume']}
                      labelFormatter={(day) => `${day}`}
                      contentStyle={{ 
                        backgroundColor: 'white', 
                        border: '1px solid #e5e7eb',
                        borderRadius: '0.375rem',
                        padding: '0.5rem',
                        fontSize: '0.875rem'
                      }}
                    />
                    <Legend 
                      formatter={() => 'Message Volume'}
                      verticalAlign="top"
                      height={36}
                      iconSize={12}
                    />
                    <Line 
                      type="monotone"
                      dataKey="count"
                      name="Messages"
                      stroke="#3B82F6"
                      strokeWidth={3}
                      dot={{ fill: '#3B82F6', r: 6, strokeWidth: 2, stroke: 'white' }}
                      activeDot={{ r: 8, strokeWidth: 0 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-gray-500">
                  No message data available for the selected time period
                </div>
              )}
            </div>
          </div>

          {/* DenoteAI Branding */}
          <div className="mt-8 text-center">
            <p className="text-gray-500 text-sm">
              Powered by{' '}
              <span className="font-semibold text-gray-700">DenoteAI</span>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Analytics;

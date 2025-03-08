import { useState, useEffect } from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, Legend
} from 'recharts';
import { getAnalyticsData } from '../services/firebase';
import NavSidebar from '../components/NavSidebar';
import { useIsMobile } from '../hooks/use-mobile';
import { AnalyticsData } from '../types';

type TimeInterval = 'today' | 'week' | 'month' | 'all';

const Analytics = () => {
  const [loading, setLoading] = useState(true);
  const [timeInterval, setTimeInterval] = useState<TimeInterval>('today');
  const [analyticsData, setAnalyticsData] = useState<AnalyticsData>({
    totalMessages: 0,
    totalContacts: 0,
    messagesByHour: Array.from({ length: 24 }, (_, i) => ({ hour: i, count: 0 })),
    messagesByDay: {
      'Sunday': 0, 'Monday': 0, 'Tuesday': 0, 'Wednesday': 0,
      'Thursday': 0, 'Friday': 0, 'Saturday': 0
    }
  });
  const isMobile = useIsMobile();

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const data = await getAnalyticsData(timeInterval);
        setAnalyticsData(data);
      } catch (error) {
        console.error('Error fetching analytics data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [timeInterval]);

  // Transform messagesByDay data for the line chart
  const messagesByDayData = Object.entries(analyticsData.messagesByDay).map(([day, count]) => ({
    day,
    count
  }));

  if (loading) {
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

          {/* Overview Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-medium text-gray-900 mb-2">Total Messages</h3>
              <p className="text-3xl font-bold text-blue-600">{analyticsData.totalMessages}</p>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-medium text-gray-900 mb-2">Total Contacts</h3>
              <p className="text-3xl font-bold text-blue-600">{analyticsData.totalContacts}</p>
            </div>
          </div>

          {/* Messages by Hour Chart */}
          <div className="bg-white rounded-lg shadow p-6 mb-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Messages by Hour</h3>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={analyticsData.messagesByHour}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis 
                    dataKey="hour"
                    tickFormatter={(hour) => `${hour}:00`}
                  />
                  <YAxis />
                  <Tooltip
                    formatter={(value: number) => [value, 'Messages']}
                    labelFormatter={(hour: number) => `${hour}:00`}
                  />
                  <Bar 
                    dataKey="count"
                    fill="#3B82F6"
                    minPointSize={1}
                    background={{ fill: '#f3f4f6' }}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Messages by Day Line Chart */}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Messages by Day</h3>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={messagesByDayData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="day" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Line 
                    type="monotone"
                    dataKey="count"
                    name="Messages"
                    stroke="#3B82F6"
                    strokeWidth={2}
                    dot={{ fill: '#3B82F6', r: 4 }}
                    activeDot={{ r: 6 }}
                  />
                </LineChart>
              </ResponsiveContainer>
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

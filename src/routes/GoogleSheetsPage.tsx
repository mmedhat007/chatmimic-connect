import React from 'react';
import { BriefcaseBusiness, ChevronRight, Table } from 'lucide-react';
import PageHeader from '../components/PageHeader';
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbSeparator } from '../components/ui/breadcrumb';
import GoogleSheetsConfig from '../components/GoogleSheetsConfig';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';

const GoogleSheetsPage: React.FC = () => {
  return (
    <div className="container mx-auto p-6 space-y-8">
      {/* Page Header */}
      <PageHeader
        title="Google Sheets Integration"
        description="Configure data extraction from WhatsApp messages to Google Sheets"
        icon={<Table className="h-6 w-6" />}
      />

      {/* Breadcrumbs */}
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink href="/dashboard">Dashboard</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator>
            <ChevronRight className="h-4 w-4" />
          </BreadcrumbSeparator>
          <BreadcrumbItem>
            <BreadcrumbLink href="/integrations">Integrations</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator>
            <ChevronRight className="h-4 w-4" />
          </BreadcrumbSeparator>
          <BreadcrumbItem>
            <BreadcrumbLink>Google Sheets</BreadcrumbLink>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      {/* Overview */}
      <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-100 mb-8">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BriefcaseBusiness className="h-5 w-5 text-blue-600" />
            <span>Automate your customer data collection</span>
          </CardTitle>
          <CardDescription>
            Automatically extract and organize customer information from WhatsApp messages
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-gray-600">
            The Google Sheets integration allows you to specify what data to extract from your customer conversations,
            such as names, contact information, product interests, and more. This data is automatically sent to your
            Google Sheets, keeping your customer information organized and up to date.
          </p>
          <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white rounded-lg p-4 shadow-sm">
              <h3 className="font-medium text-gray-800 mb-2">Customizable Data Fields</h3>
              <p className="text-sm text-gray-600">
                Define exactly what information to extract from customer messages
              </p>
            </div>
            <div className="bg-white rounded-lg p-4 shadow-sm">
              <h3 className="font-medium text-gray-800 mb-2">Real-time Updates</h3>
              <p className="text-sm text-gray-600">
                New messages are automatically processed and added to your sheets
              </p>
            </div>
            <div className="bg-white rounded-lg p-4 shadow-sm">
              <h3 className="font-medium text-gray-800 mb-2">AI-Powered Extraction</h3>
              <p className="text-sm text-gray-600">
                Advanced AI analyzes messages to extract relevant customer information
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Google Sheets Configuration */}
      <GoogleSheetsConfig />
    </div>
  );
};

export default GoogleSheetsPage; 
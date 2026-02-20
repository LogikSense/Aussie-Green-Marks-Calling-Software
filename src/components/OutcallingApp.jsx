import React, { useState, useEffect, useCallback } from 'react';

import { Phone, Upload, Calendar, Download, CheckCircle, XCircle, Clock, Database, Settings, PlayCircle, Shield, AlertCircle, Users, Activity, FileSpreadsheet, X, ArrowRight, Wifi, WifiOff, Loader, Archive, History, FileText, Key, Copy, Eye, EyeOff } from 'lucide-react';
import * as XLSX from 'xlsx';
import { useAuth } from '../context/AuthContext';
import DashboardLayout from './DashboardLayout';

const API_BASE_URL = import.meta.env.VITE_API_URL || '';

const OutcallingApp = () => {
  const { user, logout, getAuthHeaders } = useAuth();
  const [activeTab, setActiveTab] = useState('import');

  const [customers, setCustomers] = useState([]);

  const [scheduledCalls, setScheduledCalls] = useState([]);

  const [completedCalls, setCompletedCalls] = useState([]);

  const [apiConfig, setApiConfig] = useState({

    crmApiKey: '',

    vapiApiKey: '',

    vapiPhoneNumberId: '',

    vapiAssistantId: '',

    webhookUrl: '',

    crmEndpoint: ''

  });

  const [scheduleSettings, setScheduleSettings] = useState({

    date: '',

    time: '',

    timezone: 'America/New_York',

    retryFailedCalls: true,

    maxRetries: 2

  });

  const [verificationConfig, setVerificationConfig] = useState({

    verifyName: true,

    verifyPhone: true,

    verifyEmail: true,

    verifyAddress: true,

    verifyDOB: false,

    verifySSN: false,

    securityQuestion: false

  });

  const [excelMapping, setExcelMapping] = useState(null);

  const [excelPreview, setExcelPreview] = useState(null);

  const [connectionStatus, setConnectionStatus] = useState({

    crm: { status: 'disconnected', message: '', testing: false },

    vapi: { status: 'disconnected', message: '', testing: false }

  });

  const [importHistory, setImportHistory] = useState(() => {
    const saved = localStorage.getItem('importHistory');
    return saved ? JSON.parse(saved) : [];
  });

  const [scheduleHistory, setScheduleHistory] = useState(() => {
    const saved = localStorage.getItem('scheduleHistory');
    return saved ? JSON.parse(saved) : [];
  });

  const [archivedData, setArchivedData] = useState(() => {
    const saved = localStorage.getItem('archivedData');
    return saved ? JSON.parse(saved) : [];
  });

  const [apiKeys, setApiKeys] = useState(() => {
    const saved = localStorage.getItem('apiKeys');
    return saved ? JSON.parse(saved) : [];
  });

  const [newApiKey, setNewApiKey] = useState(null);
  const [showApiKey, setShowApiKey] = useState(false);
  const [apiKeyName, setApiKeyName] = useState('');
  const [apiKeyDescription, setApiKeyDescription] = useState('');
  const [generatingApiKey, setGeneratingApiKey] = useState(false);
  const [currentApiKey, setCurrentApiKey] = useState(() => {
    return localStorage.getItem('currentApiKey') || '';
  });

  const fetchCustomers = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/customers?limit=500`, { headers: getAuthHeaders() });
      if (!res.ok) return;
      const data = await res.json();
      const list = (data.customers || []).map(c => ({ ...c, selected: !!c.selected }));
      setCustomers(list);
    } catch (e) {
      console.error('Fetch customers failed', e);
    }
  }, [getAuthHeaders]);

  useEffect(() => {
    if (user) fetchCustomers();
  }, [user, fetchCustomers]);

  const fetchSettings = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/settings`, { headers: getAuthHeaders() });
      if (!res.ok) return;
      const data = await res.json();
      if (data.config)
        setApiConfig(prev => ({ ...prev, ...data.config }));
    } catch (e) {
      console.error('Fetch settings failed', e);
    }
  }, [getAuthHeaders]);

  useEffect(() => {
    if (user) fetchSettings();
  }, [user, fetchSettings]);

  const saveSettings = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/settings`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify(apiConfig)
      });
      if (res.ok) alert('Configuration saved.');
      else alert('Failed to save configuration.');
    } catch (e) {
      console.error('Save settings failed', e);
      alert('Failed to save configuration.');
    }
  }, [getAuthHeaders, apiConfig]);

  // Auto-archive data older than 1 week
  useEffect(() => {
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

    // Archive old completed calls
    const toArchive = completedCalls.filter(call => {
      const callDate = new Date(call.completedAt);
      return callDate < oneWeekAgo;
    });

    if (toArchive.length > 0) {
      const archiveEntry = {
        id: `archive_${Date.now()}`,
        type: 'completed_calls',
        data: toArchive,
        archivedAt: new Date().toISOString(),
        originalDate: toArchive[0]?.completedAt
      };

      setArchivedData([...archivedData, archiveEntry]);
      setCompletedCalls(completedCalls.filter(call => {
        const callDate = new Date(call.completedAt);
        return callDate >= oneWeekAgo;
      }));
    }

    // Archive old import history
    const oldImports = importHistory.filter(imp => {
      const impDate = new Date(imp.timestamp);
      return impDate < oneWeekAgo;
    });

    if (oldImports.length > 0) {
      const archiveEntry = {
        id: `archive_imports_${Date.now()}`,
        type: 'import_history',
        data: oldImports,
        archivedAt: new Date().toISOString()
      };

      setArchivedData([...archivedData, archiveEntry]);
      setImportHistory(importHistory.filter(imp => {
        const impDate = new Date(imp.timestamp);
        return impDate >= oneWeekAgo;
      }));
    }

    // Archive old schedule history
    const oldSchedules = scheduleHistory.filter(sched => {
      const schedDate = new Date(sched.timestamp);
      return schedDate < oneWeekAgo;
    });

    if (oldSchedules.length > 0) {
      const archiveEntry = {
        id: `archive_schedules_${Date.now()}`,
        type: 'schedule_history',
        data: oldSchedules,
        archivedAt: new Date().toISOString()
      };

      setArchivedData([...archivedData, archiveEntry]);
      setScheduleHistory(scheduleHistory.filter(sched => {
        const schedDate = new Date(sched.timestamp);
        return schedDate >= oneWeekAgo;
      }));
    }
  }, [completedCalls.length]);

  // Save to localStorage whenever data changes
  useEffect(() => {
    localStorage.setItem('importHistory', JSON.stringify(importHistory));
  }, [importHistory]);

  useEffect(() => {
    localStorage.setItem('scheduleHistory', JSON.stringify(scheduleHistory));
  }, [scheduleHistory]);

  useEffect(() => {
    localStorage.setItem('archivedData', JSON.stringify(archivedData));
  }, [archivedData]);

  // Import customers from CRM with full verification fields

  const handleImportFromCRM = async () => {

    try {

      // In production: Replace with actual CRM API call

      // const response = await fetch(`${apiConfig.crmEndpoint}/customers?status=ready_for_auditing`, {

      //   headers: { 'Authorization': `Bearer ${apiConfig.crmApiKey}` }

      // });

      // const data = await response.json();

      

      const mockData = [

        {

          id: 1,

          customerId: 'CUST-12345',

          firstName: 'John',

          lastName: 'Smith',

          phone: '+1-555-0101',

          email: 'john.smith@email.com',

          address: '123 Main St, New York, NY 10001',

          dateOfBirth: '1985-03-15',

          lastFourSSN: '1234',

          securityAnswer: 'fluffy',

          status: 'ready_for_auditing',

          importDate: new Date().toISOString(),

          previousAttempts: 0,

          lastContactDate: null

        },

        {

          id: 2,

          customerId: 'CUST-67890',

          firstName: 'Sarah',

          lastName: 'Johnson',

          phone: '+1-555-0102',

          email: 'sarah.j@email.com',

          address: '456 Oak Ave, Los Angeles, CA 90001',

          dateOfBirth: '1990-07-22',

          lastFourSSN: '5678',

          securityAnswer: 'rover',

          status: 'ready_for_auditing',

          importDate: new Date().toISOString(),

          previousAttempts: 0,

          lastContactDate: null

        },

        {

          id: 3,

          customerId: 'CUST-11223',

          firstName: 'Michael',

          lastName: 'Davis',

          phone: '+1-555-0103',

          email: 'mdavis@email.com',

          address: '789 Pine Rd, Chicago, IL 60601',

          dateOfBirth: '1988-11-30',

          lastFourSSN: '9012',

          securityAnswer: 'sunshine',

          status: 'ready_for_auditing',

          importDate: new Date().toISOString(),

          previousAttempts: 0,

          lastContactDate: null

        }

      ];

      

      setCustomers(mockData);

      // Record import history
      const importRecord = {
        id: `import_${Date.now()}`,
        type: 'crm',
        source: 'CRM API',
        customerCount: mockData.length,
        timestamp: new Date().toISOString(),
        fileName: null,
        customers: mockData.map(c => ({ id: c.id, customerId: c.customerId, name: `${c.firstName} ${c.lastName}` }))
      };
      setImportHistory([importRecord, ...importHistory]);

      alert(`Successfully imported ${mockData.length} customers from CRM`);

    } catch (error) {

      alert('Error importing from CRM: ' + error.message);

    }

  };

  // Intelligent column detection using fuzzy matching
  const detectColumnType = (headerText) => {
    const normalized = String(headerText || '').toLowerCase().trim().replace(/[^a-z0-9\s]/g, '');
    
    // Customer ID patterns
    if (normalized.match(/\b(customer\s*id|id|cust\s*id|item)\b/)) return 'customerId';
    
    // Name patterns - check for combined name first
    if (normalized.match(/\b(customer\s*name|name|full\s*name|client\s*name)\b/)) return 'fullName';
    if (normalized.match(/\b(first\s*name|fname|firstname|given\s*name)\b/)) return 'firstName';
    if (normalized.match(/\b(last\s*name|lname|lastname|surname|family\s*name)\b/)) return 'lastName';
    
    // Phone patterns
    if (normalized.match(/\b(contact\s*number|phone|phonenumber|mobile|tel|telephone|contact)\b/)) return 'phone';
    
    // Email patterns
    if (normalized.match(/\b(email|email\s*address|e-mail|mail)\b/)) return 'email';
    
    // Address patterns
    if (normalized.match(/\b(job\s*address|address|street|location|property\s*address|mailing\s*address)\b/)) return 'address';
    
    // Other fields
    if (normalized.match(/\b(date\s*of\s*birth|dob|birthdate|birth\s*date)\b/)) return 'dateOfBirth';
    if (normalized.match(/\b(ssn|social\s*security|last\s*four|ssn\s*last)\b/)) return 'lastFourSSN';
    if (normalized.match(/\b(security|security\s*answer|security\s*question)\b/)) return 'securityAnswer';
    if (normalized.match(/\b(status|state|verification\s*status)\b/)) return 'status';
    
    return null;
  };

  // Split full name into first and last name
  const splitFullName = (fullName) => {
    if (!fullName) return { firstName: '', lastName: '' };
    const parts = String(fullName).trim().split(/\s+/);
    if (parts.length === 1) return { firstName: parts[0], lastName: '' };
    return {
      firstName: parts[0],
      lastName: parts.slice(1).join(' ')
    };
  };

  // Import customers from Excel file with intelligent column mapping
  const handleImportFromExcel = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const validExtensions = ['.xlsx', '.xls', '.csv'];
    const fileExtension = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();
    if (!validExtensions.includes(fileExtension)) {
      alert('Please upload a valid Excel file (.xlsx, .xls, or .csv)');
      return;
    }

    try {
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const data = new Uint8Array(e.target.result);
          const workbook = XLSX.read(data, { type: 'array' });
          const firstSheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[firstSheetName];
          const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });

          if (jsonData.length < 2) {
            alert('Excel file must contain at least a header row and one data row');
            return;
          }

          // Get headers (first row)
          const headers = jsonData[0].map(h => String(h || '').trim());
          
          // Auto-detect column types
          const detectedMapping = {};
          headers.forEach((header, index) => {
            const detectedType = detectColumnType(header);
            if (detectedType) {
              if (!detectedMapping[detectedType]) {
                detectedMapping[detectedType] = [];
              }
              detectedMapping[detectedType].push({ index, header });
            }
          });

          // Show mapping interface if auto-detection is incomplete or user wants to review
          const requiredFields = ['phone'];
          const hasPhone = detectedMapping.phone && detectedMapping.phone.length > 0;
          const hasName = (detectedMapping.firstName || detectedMapping.lastName || detectedMapping.fullName);
          
          if (!hasPhone || !hasName) {
            // Show mapping interface
            setExcelPreview({
              headers,
              data: jsonData.slice(1, Math.min(6, jsonData.length)), // Preview first 5 rows
              detectedMapping,
              fullData: jsonData,
              fileName: file.name,
              fileSize: file.size
            });
            setExcelMapping({});
            event.target.value = '';
            return;
          }

          // Process with auto-detected mapping
          await processExcelData(jsonData, headers, detectedMapping, file.name, file.size);
        } catch (error) {
          console.error('Error parsing Excel:', error);
          alert('Error parsing Excel file: ' + error.message);
        }
      };
      reader.onerror = () => {
        alert('Error reading file. Please try again.');
      };
      reader.readAsArrayBuffer(file);
    } catch (error) {
      alert('Error importing Excel file: ' + error.message);
    }
  };

  // Process Excel data - send directly to backend (no API key needed!)
  const processExcelData = async (jsonData, headers, columnMapping, fileName = null, fileSize = null) => {
    try {
      // Convert the processed data back to Excel format and send to backend
      // OR: Send the processed customer data directly to backend
      
      // For now, let's send the Excel file directly to backend which will process and store it
      // But we need the original file... Let me use a different approach:
      // Process locally for UI, then send processed data to backend
      
      const importedCustomers = [];
      let nextId = Math.max(...customers.map(c => c.id || 0), 0) + 1;

      // Build column index map
      const columnIndices = {};
      
      // Handle full name
      if (columnMapping.fullName && columnMapping.fullName.length > 0) {
        columnIndices.fullName = columnMapping.fullName[0].index;
      }
      if (columnMapping.firstName && columnMapping.firstName.length > 0) {
        columnIndices.firstName = columnMapping.firstName[0].index;
      }
      if (columnMapping.lastName && columnMapping.lastName.length > 0) {
        columnIndices.lastName = columnMapping.lastName[0].index;
      }
      if (columnMapping.phone && columnMapping.phone.length > 0) {
        columnIndices.phone = columnMapping.phone[0].index;
      }
      if (columnMapping.email && columnMapping.email.length > 0) {
        columnIndices.email = columnMapping.email[0].index;
      }
      if (columnMapping.address && columnMapping.address.length > 0) {
        columnIndices.address = columnMapping.address[0].index;
      }
      if (columnMapping.customerId && columnMapping.customerId.length > 0) {
        columnIndices.customerId = columnMapping.customerId[0].index;
      }
      if (columnMapping.dateOfBirth && columnMapping.dateOfBirth.length > 0) {
        columnIndices.dateOfBirth = columnMapping.dateOfBirth[0].index;
      }
      if (columnMapping.lastFourSSN && columnMapping.lastFourSSN.length > 0) {
        columnIndices.lastFourSSN = columnMapping.lastFourSSN[0].index;
      }
      if (columnMapping.securityAnswer && columnMapping.securityAnswer.length > 0) {
        columnIndices.securityAnswer = columnMapping.securityAnswer[0].index;
      }
      if (columnMapping.status && columnMapping.status.length > 0) {
        columnIndices.status = columnMapping.status[0].index;
      }

      // Process rows
      for (let i = 1; i < jsonData.length; i++) {
        const row = jsonData[i];
        if (!row || row.length === 0) continue;

        // Extract name
        let firstName = '';
        let lastName = '';
        
        if (columnIndices.fullName !== undefined) {
          const fullName = String(row[columnIndices.fullName] || '').trim();
          const nameParts = splitFullName(fullName);
          firstName = nameParts.firstName;
          lastName = nameParts.lastName;
        } else {
          firstName = columnIndices.firstName !== undefined ? String(row[columnIndices.firstName] || '').trim() : '';
          lastName = columnIndices.lastName !== undefined ? String(row[columnIndices.lastName] || '').trim() : '';
        }

        const phone = columnIndices.phone !== undefined ? String(row[columnIndices.phone] || '').trim() : '';
        
        // Skip if no name or phone
        if ((!firstName && !lastName) || !phone) {
          continue;
        }

        // Collect all other columns as metadata
        const metadata = {};
        headers.forEach((header, idx) => {
          const value = row[idx];
          if (value !== undefined && value !== null && value !== '') {
            const headerKey = header.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();
            if (!Object.values(columnIndices).includes(idx)) {
              metadata[headerKey] = String(value).trim();
            }
          }
        });

        const customer = {
          id: nextId++,
          customerId: columnIndices.customerId !== undefined 
            ? String(row[columnIndices.customerId] || '').trim() 
            : `CUST-${Date.now()}-${i}`,
          firstName: firstName || 'Unknown',
          lastName: lastName || '',
          phone: phone,
          email: columnIndices.email !== undefined ? String(row[columnIndices.email] || '').trim() : '',
          address: columnIndices.address !== undefined ? String(row[columnIndices.address] || '').trim() : '',
          dateOfBirth: columnIndices.dateOfBirth !== undefined ? String(row[columnIndices.dateOfBirth] || '').trim() : '',
          lastFourSSN: columnIndices.lastFourSSN !== undefined ? String(row[columnIndices.lastFourSSN] || '').trim() : '',
          securityAnswer: columnIndices.securityAnswer !== undefined ? String(row[columnIndices.securityAnswer] || '').trim() : '',
          status: columnIndices.status !== undefined ? String(row[columnIndices.status] || '').trim() : 'ready_for_auditing',
          importDate: new Date().toISOString(),
          previousAttempts: 0,
          lastContactDate: null,
          metadata: Object.keys(metadata).length > 0 ? metadata : undefined
        };

        importedCustomers.push(customer);
      }

      if (importedCustomers.length === 0) {
        alert('No valid customer records found. Please ensure the file contains name and phone number columns.');
        return;
      }

      // Send customers directly to backend - NO API KEY NEEDED!
      try {
        console.log(`📤 Sending ${importedCustomers.length} customers to backend database...`);
        
        // Prepare customer data for backend (remove frontend-only fields)
        const customersForBackend = importedCustomers.map(c => ({
          customerId: c.customerId,
          firstName: c.firstName,
          lastName: c.lastName,
          phone: c.phone,
          email: c.email || '',
          address: c.address || '',
          dateOfBirth: c.dateOfBirth || '',
          lastFourSSN: c.lastFourSSN || '',
          securityAnswer: c.securityAnswer || '',
          status: c.status || 'ready_for_auditing',
          metadata: c.metadata || null
        }));
        
        // Send to backend batch import endpoint (no API key required!)
        const response = await fetch(`${API_BASE_URL}/api/customers/import-batch`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...getAuthHeaders()
          },
          body: JSON.stringify({
            customers: customersForBackend
          })
        });
        
        if (response.ok) {
          const result = await response.json();
          console.log(`✅ Backend import result:`, result);
          await fetchCustomers();
          // Record import history
          const importRecord = {
            id: `import_${Date.now()}`,
            type: 'excel',
            source: 'Excel File',
            customerCount: importedCustomers.length,
            timestamp: new Date().toISOString(),
            fileName: fileName || 'Unknown',
            fileSize: fileSize || 0,
            customers: importedCustomers.map(c => ({ id: c.id, customerId: c.customerId, name: `${c.firstName} ${c.lastName}` }))
          };
          setImportHistory([importRecord, ...importHistory]);

          alert(`✅ Successfully imported ${result.stored} customers from Excel file!\n\n${result.skipped > 0 ? `${result.skipped} customers were skipped (duplicates).\n\n` : ''}Customers are now in the backend database and ready for scheduling calls.`);
        } else {
          const errorData = await response.json().catch(() => ({ detail: response.statusText }));
          throw new Error(errorData.detail || `HTTP ${response.status}`);
        }
        
        setExcelMapping(null);
        setExcelPreview(null);
      } catch (error) {
        console.error('Error sending customers to backend:', error);
        // Still store in frontend even if backend fails
        setCustomers([...customers, ...importedCustomers]);
        alert(`⚠️ Imported ${importedCustomers.length} customers to frontend, but failed to sync to backend: ${error.message}\n\nYou can still schedule calls, but customers may not be found in backend.`);
      }
    } catch (error) {
      console.error('Error processing Excel:', error);
      alert('Error processing Excel file: ' + error.message);
    }
  };

  // Apply manual column mapping
  const applyExcelMapping = async () => {
    if (!excelPreview) return;
    
    const mapping = { ...excelMapping };
    
    // Use detected mapping as fallback
    Object.keys(excelPreview.detectedMapping).forEach(key => {
      if (!mapping[key] && excelPreview.detectedMapping[key].length > 0) {
        mapping[key] = excelPreview.detectedMapping[key];
      }
    });

    await processExcelData(
      excelPreview.fullData, 
      excelPreview.headers, 
      mapping, 
      excelPreview.fileName || null, 
      excelPreview.fileSize || null
    );
  };

  // Test CRM API connection
  const testCrmConnection = async () => {
    if (!apiConfig.crmEndpoint || !apiConfig.crmApiKey) {
      setConnectionStatus({
        ...connectionStatus,
        crm: { status: 'error', message: 'Please enter CRM endpoint and API key', testing: false }
      });
      return;
    }

    setConnectionStatus({
      ...connectionStatus,
      crm: { status: 'testing', message: 'Testing connection...', testing: true }
    });

    try {
      // Use test connection endpoint first (doesn't require exact customers endpoint)
      const response = await fetch(`${API_BASE_URL}/api/crm/test-connection`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders()
        },
        body: JSON.stringify({
          crmEndpoint: apiConfig.crmEndpoint,
          crmApiKey: apiConfig.crmApiKey
        })
      });

      // Get response text first to check if it's empty
      const responseText = await response.text();
      
      if (response.ok) {
        if (responseText && responseText.trim().length > 0) {
          try {
            const data = JSON.parse(responseText);
            setConnectionStatus({
              ...connectionStatus,
              crm: { 
                status: data.warning ? 'connected' : 'connected', 
                message: data.message || 'Connection successful!', 
                testing: false 
              }
            });
          } catch (parseError) {
            setConnectionStatus({
              ...connectionStatus,
              crm: { 
                status: 'connected', 
                message: 'Connection successful!', 
                testing: false 
              }
            });
          }
        } else {
          setConnectionStatus({
            ...connectionStatus,
            crm: { status: 'connected', message: 'Connection successful!', testing: false }
          });
        }
        try {
          await fetch(`${API_BASE_URL}/api/v1/settings`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
            body: JSON.stringify(apiConfig)
          });
        } catch (_) {}
      } else {
        // Handle error response
        let errorMessage = 'Connection failed. Please check your credentials and endpoint URL.';
        if (responseText && responseText.trim().length > 0) {
          try {
            const error = JSON.parse(responseText);
            errorMessage = error.detail || error.message || error.error || responseText.substring(0, 200);
          } catch {
            errorMessage = responseText.substring(0, 200);
          }
        }
        
        setConnectionStatus({
          ...connectionStatus,
          crm: { 
            status: 'error', 
            message: errorMessage, 
            testing: false 
          }
        });
      }
    } catch (error) {
      setConnectionStatus({
        ...connectionStatus,
        crm: { 
          status: 'error', 
          message: `Connection error: ${error.message}. Please ensure the backend server is running.`, 
          testing: false 
        }
      });
    }
  };

  // Generate API Key
  const generateApiKey = async () => {
    setGeneratingApiKey(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/v1/api-keys/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders()
        },
        body: JSON.stringify({
          name: apiKeyName || undefined,
          description: apiKeyDescription || undefined
        })
      });

      const data = await response.json();
      
      if (response.ok && data.apiKey) {
        const newKey = {
          ...data.apiKey,
          fullKey: data.apiKey.key,
          createdAt: new Date().toISOString()
        };
        setNewApiKey(newKey);
        setApiKeys([...apiKeys, newKey]);
        localStorage.setItem('apiKeys', JSON.stringify([...apiKeys, newKey]));
        setApiKeyName('');
        setApiKeyDescription('');
      } else {
        alert(data.detail || 'Failed to generate API key. Make sure your current API key is valid.');
      }
    } catch (error) {
      alert(`Error generating API key: ${error.message}`);
    } finally {
      setGeneratingApiKey(false);
    }
  };

  const copyApiKey = (key) => {
    navigator.clipboard.writeText(key);
    alert('API key copied to clipboard!');
  };

  // Test Vapi API connection
  const testVapiConnection = async () => {
    if (!apiConfig.vapiApiKey) {
      setConnectionStatus({
        ...connectionStatus,
        vapi: { status: 'error', message: 'Please enter Vapi API key', testing: false }
      });
      return;
    }

    setConnectionStatus({
      ...connectionStatus,
      vapi: { status: 'testing', message: 'Testing connection...', testing: true }
    });

    try {
      // Use backend proxy to avoid CORS issues
      const response = await fetch(`${API_BASE_URL}/api/vapi/test-connection`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders()
        },
        body: JSON.stringify({
          vapiApiKey: apiConfig.vapiApiKey
        })
      });

      // Get response text first to check if it's empty
      const responseText = await response.text();
      
      if (response.ok) {
        if (responseText && responseText.trim().length > 0) {
          try {
            const data = JSON.parse(responseText);
            setConnectionStatus({
              ...connectionStatus,
              vapi: { status: 'connected', message: data.message || 'Connection successful! API key is valid.', testing: false }
            });
          } catch (parseError) {
            setConnectionStatus({
              ...connectionStatus,
              vapi: { status: 'connected', message: 'Connection successful! API key is valid.', testing: false }
            });
          }
        } else {
          setConnectionStatus({
            ...connectionStatus,
            vapi: { status: 'connected', message: 'Connection successful! API key is valid.', testing: false }
          });
        }
        try {
          await fetch(`${API_BASE_URL}/api/v1/settings`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
            body: JSON.stringify(apiConfig)
          });
        } catch (_) {}
      } else {
        // Handle error response
        let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
        if (responseText && responseText.trim().length > 0) {
          try {
            const errorJson = JSON.parse(responseText);
            errorMessage = errorJson.detail || errorJson.message || errorJson.error || responseText.substring(0, 150);
          } catch {
            errorMessage = responseText.substring(0, 150);
          }
        }
        
        setConnectionStatus({
          ...connectionStatus,
          vapi: { 
            status: 'error', 
            message: `Connection failed: ${errorMessage}`, 
            testing: false 
          }
        });
      }
    } catch (error) {
      setConnectionStatus({
        ...connectionStatus,
        vapi: { 
          status: 'error', 
          message: `Connection error: ${error.message}. Please check your API key and ensure the backend server is running.`, 
          testing: false 
        }
      });
    }
  };

  // Create Vapi verification assistant configuration

  const createVapiAssistant = async () => {

    const assistantConfig = {

      name: "Customer Verification Agent",

      firstMessage: "Hello, this is calling from the verification department. I'm calling to verify some information on your account. This will only take a few minutes. May I have your full legal name please?",

      model: {

        provider: "openai",

        model: "gpt-4o",

        messages: [{

          role: "system",

          content: `# Customer Verification Agent

## Identity & Purpose

You are a professional verification agent calling to confirm customer identity and account details. You must verify the customer's information against existing records.

## Verification Process

1. **Introduction**: Explain you're calling to verify account information

2. **Primary Verification**: 

   - Full legal name (first and last)

   - Phone number confirmation

   - Email address

   - Current address

3. **Secondary Verification** (if enabled):

   - Date of birth (MM/DD/YYYY)

   - Last 4 digits of SSN

   - Security question answer

4. **Confirmation**: Clearly state verification result

## Conversation Flow

1. **Opening**: Introduce yourself and explain the purpose

2. **Collect Information**: Ask for each piece clearly and one at a time

3. **Verification**: Use verify_customer_details function to check information

4. **Result**: 

   - **Success**: "Thank you, I've successfully verified your information. Your account is now updated."

   - **Partial**: "I was able to verify some information. You may need to update [specific fields]."

   - **Failure**: "I'm unable to verify the information provided. Please contact customer service."

## Guidelines

- Be professional and courteous

- Explain why you're asking for information

- Never share customer data you have on file

- If verification fails twice, end call politely

- Keep responses concise (under 30 words)

- Speak clearly when asking for sensitive information

- Allow customer to skip optional verification fields`

        }],

        temperature: 0.7,

        maxTokens: 250

      },

      voice: {

        provider: "11labs",

        voiceId: "rachel"

      },

      tools: [{

        type: "function",

        function: {

          name: "verify_customer_details",

          description: "Verify customer information against database records. Returns verification status for each field.",

          parameters: {

            type: "object",

            properties: {

              customer_id: { 

                type: "string",

                description: "Customer ID from the database"

              },

              phone_number: { 

                type: "string",

                description: "Customer's phone number"

              },

              full_name: { 

                type: "string",

                description: "Customer's full legal name"

              },

              email: {

                type: "string",

                description: "Customer's email address"

              },

              address: {

                type: "string",

                description: "Customer's current address"

              },

              date_of_birth: { 

                type: "string",

                description: "Date of birth in YYYY-MM-DD format"

              },

              last_four_ssn: { 

                type: "string",

                description: "Last 4 digits of SSN"

              },

              security_answer: {

                type: "string",

                description: "Answer to security question"

              }

            },

            required: ["customer_id", "phone_number", "full_name"]

          }

        }

      }],

      endCallFunctionEnabled: true,

      recordingEnabled: true,

      endCallMessage: "Thank you for your time. Have a great day. Goodbye.",

      voicemailMessage: "Hello, this is the verification department. We're calling to verify information on your account. Please call us back at your earliest convenience."

    };

    return assistantConfig;

  };

  // Schedule calls with Vapi using proper API integration

  const handleScheduleCalls = async () => {

    if (!scheduleSettings.date || !scheduleSettings.time) {

      alert('Please select both date and time for scheduling');

      return;

    }

    if (!apiConfig.vapiApiKey || !apiConfig.vapiPhoneNumberId || !apiConfig.vapiAssistantId) {

      alert('Please configure Vapi API settings first');

      return;

    }

    const selectedCustomers = customers.filter(c => c.selected);

    if (selectedCustomers.length === 0) {

      alert('Please select at least one customer to schedule calls');

      return;

    }

    try {

      // Get customer IDs - customers should already be in backend from Excel import
      const customerIds = selectedCustomers.map(c => c.customerId || `CUST-${c.id}`);
      
      // Call backend API to schedule calls with proper timezone handling
      const requestBody = {
        customerIds: customerIds,
        scheduledDate: scheduleSettings.date,
        scheduledTime: scheduleSettings.time,
        timezone: scheduleSettings.timezone, // This will be properly converted to ISO 8601 in backend
        maxRetries: scheduleSettings.maxRetries,
        crmApiKey: apiConfig.crmApiKey || undefined,
        vapiApiKey: apiConfig.vapiApiKey,
        vapiPhoneNumberId: apiConfig.vapiPhoneNumberId,
        vapiAssistantId: apiConfig.vapiAssistantId,
        webhookUrl: apiConfig.webhookUrl || undefined,
        crmEndpoint: apiConfig.crmEndpoint || undefined
      };
      
      console.log('📞 Scheduling calls with timezone:', scheduleSettings.timezone, 'at', scheduleSettings.date, scheduleSettings.time);
      console.log('📋 Customer IDs to schedule:', customerIds);
      
      const response = await fetch(`${API_BASE_URL}/api/calls/schedule`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders()
        },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ detail: response.statusText }));
        throw new Error(errorData.detail || `HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.message || 'Failed to schedule calls');
      }

      // Map backend response to frontend format
      const scheduled = result.scheduledCalls.map(scheduledCall => {
        const customer = selectedCustomers.find(c => 
          (c.customerId || `CUST-${c.id}`) === scheduledCall.customerId
        );
        
        return {
          ...customer,
          customerId: scheduledCall.customerId,
          scheduledDate: scheduleSettings.date,
          scheduledTime: scheduleSettings.time,
          timezone: scheduleSettings.timezone,
          vapiCallId: scheduledCall.vapiCallId,
          status: scheduledCall.status || 'scheduled',
          scheduledAt: scheduledCall.scheduledAt,
          retryCount: 0,
          maxRetries: scheduleSettings.maxRetries,
          customerPhone: scheduledCall.customerPhone,
          customerName: scheduledCall.customerName
        };
      });

      setScheduledCalls([...scheduledCalls, ...scheduled]);

      setCustomers(customers.map(c => ({ ...c, selected: false })));

      // Record schedule history
      const scheduleRecord = {
        id: `schedule_${Date.now()}`,
        batchId: `batch_${Date.now()}`,
        customerCount: selectedCustomers.length,
        scheduledDate: scheduleSettings.date,
        scheduledTime: scheduleSettings.time,
        timezone: scheduleSettings.timezone,
        timestamp: new Date().toISOString(),
        customers: scheduled.map(c => ({
          customerId: c.customerId,
          name: c.customerName || `${c.firstName} ${c.lastName}`,
          phone: c.customerPhone || c.phone,
          vapiCallId: c.vapiCallId
        })),
        status: 'scheduled'
      };
      setScheduleHistory([scheduleRecord, ...scheduleHistory]);

      alert(`Successfully scheduled ${result.count} calls with Vapi (Timezone: ${scheduleSettings.timezone})`);

    } catch (error) {

      console.error('Error scheduling calls:', error);
      alert('Error scheduling calls: ' + error.message);

    }

  };

  // Simulate call completion with detailed verification results

  const simulateCallCompletion = (callId) => {

    const call = scheduledCalls.find(c => c.vapiCallId === callId);

    if (!call) return;

    // Simulate different verification outcomes

    const outcomes = [

      {

        status: 'fully_verified',

        verifiedFields: ['firstName', 'lastName', 'email', 'phone', 'address'],

        failedFields: [],

        confidence: 0.98

      },

      {

        status: 'partially_verified',

        verifiedFields: ['firstName', 'lastName', 'phone'],

        failedFields: ['email', 'address'],

        confidence: 0.75

      },

      {

        status: 'not_verified',

        verifiedFields: [],

        failedFields: ['firstName', 'lastName', 'email', 'phone', 'address'],

        confidence: 0.20

      },

      {

        status: 'no_answer',

        verifiedFields: [],

        failedFields: [],

        confidence: 0

      }

    ];

    

    const outcome = outcomes[Math.floor(Math.random() * outcomes.length)];

    

    const completedCall = {

      ...call,

      status: 'completed',

      callOutcome: outcome.status,

      verifiedFields: outcome.verifiedFields,

      failedFields: outcome.failedFields,

      verificationConfidence: outcome.confidence,

      recordingUrl: `https://vapi-recordings.example.com/${callId}.mp3`,

      transcriptUrl: `https://vapi-transcripts.example.com/${callId}.txt`,

      callDuration: Math.floor(Math.random() * 300) + 60,

      completedAt: new Date().toISOString(),

      callCost: (Math.random() * 0.5 + 0.1).toFixed(3),

      aiTokensUsed: Math.floor(Math.random() * 1000) + 500,

      needsRetry: outcome.status === 'no_answer' && call.retryCount < call.maxRetries

    };

    setCompletedCalls([...completedCalls, completedCall]);

    setScheduledCalls(scheduledCalls.filter(c => c.vapiCallId !== callId));

    // Auto-schedule retry if needed

    if (completedCall.needsRetry && scheduleSettings.retryFailedCalls) {

      const retryCall = {

        ...call,

        retryCount: call.retryCount + 1,

        previousAttempt: callId,

        status: 'scheduled'

      };

      setTimeout(() => {

        setScheduledCalls(prev => [...prev, retryCall]);

      }, 1000);

    }

  };

  const toggleCustomerSelection = (id) => {

    setCustomers(customers.map(c => 

      c.id === id ? { ...c, selected: !c.selected } : c

    ));

  };

  const exportResults = (batchId = null) => {
    let callsToExport = completedCalls;
    
    // If batchId provided, export specific batch from history
    if (batchId) {
      const batch = scheduleHistory.find(s => s.batchId === batchId);
      if (batch) {
        const batchCallIds = batch.customers.map(c => c.vapiCallId);
        callsToExport = completedCalls.filter(call => batchCallIds.includes(call.vapiCallId));
      }
    }

    const exportData = callsToExport.map(call => ({
      customerId: call.customerId,
      customerName: `${call.firstName} ${call.lastName}`,
      phone: call.phone,
      email: call.email,
      callOutcome: call.callOutcome,
      verifiedFields: call.verifiedFields.join(', '),
      failedFields: call.failedFields.join(', '),
      verificationConfidence: call.verificationConfidence,
      callDuration: call.callDuration,
      completedAt: call.completedAt,
      recordingUrl: call.recordingUrl,
      transcriptUrl: call.transcriptUrl,
      vapiCallId: call.vapiCallId
    }));

    const dataStr = JSON.stringify(exportData, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
    const exportFileDefaultName = batchId 
      ? `batch_results_${batchId}_${new Date().toISOString().split('T')[0]}.json`
      : `verification_results_${new Date().toISOString().split('T')[0]}.json`;

    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
  };

  const downloadArchivedBatch = (archiveId) => {
    const archive = archivedData.find(a => a.id === archiveId);
    if (!archive) return;

    const dataStr = JSON.stringify(archive.data, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
    const exportFileDefaultName = `archived_${archive.type}_${archive.id}_${new Date(archive.archivedAt).toISOString().split('T')[0]}.json`;

    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
  };

  // Calculate statistics

  const stats = {

    totalCalls: completedCalls.length,

    fullyVerified: completedCalls.filter(c => c.callOutcome === 'fully_verified').length,

    partiallyVerified: completedCalls.filter(c => c.callOutcome === 'partially_verified').length,

    notVerified: completedCalls.filter(c => c.callOutcome === 'not_verified').length,

    noAnswer: completedCalls.filter(c => c.callOutcome === 'no_answer').length,

    avgDuration: completedCalls.length > 0 

      ? Math.round(completedCalls.reduce((sum, c) => sum + c.callDuration, 0) / completedCalls.length) 

      : 0,

    avgConfidence: completedCalls.length > 0

      ? (completedCalls.reduce((sum, c) => sum + c.verificationConfidence, 0) / completedCalls.length * 100).toFixed(1)

      : 0

  };

  return (
    <DashboardLayout
      activeTab={activeTab}
      setActiveTab={setActiveTab}
      user={user}
      logout={logout}
      stats={{
        customers: customers.length,
        scheduledCalls: scheduledCalls.length,
        completedCalls: completedCalls.length,
      }}
    >
      {completedCalls.length > 0 && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 mb-6">
          <div className="card p-4">
            <div className="flex items-center gap-2 mb-1">
              <CheckCircle className="h-4 w-4 text-emerald-600" />
              <span className="text-xs font-medium text-slate-500">Fully Verified</span>
            </div>
            <div className="text-xl font-semibold text-slate-900">{stats.fullyVerified}</div>
            <div className="text-xs text-slate-500">{stats.totalCalls ? ((stats.fullyVerified / stats.totalCalls) * 100).toFixed(1) : 0}% success rate</div>
          </div>
          <div className="card p-4">
            <div className="flex items-center gap-2 mb-1">
              <AlertCircle className="h-4 w-4 text-amber-600" />
              <span className="text-xs font-medium text-slate-500">Partial Verification</span>
            </div>
            <div className="text-xl font-semibold text-slate-900">{stats.partiallyVerified}</div>
            <div className="text-xs text-slate-500">{stats.totalCalls ? ((stats.partiallyVerified / stats.totalCalls) * 100).toFixed(1) : 0}% of calls</div>
          </div>
          <div className="card p-4">
            <div className="flex items-center gap-2 mb-1">
              <Clock className="h-4 w-4 text-slate-600" />
              <span className="text-xs font-medium text-slate-500">Avg Duration</span>
            </div>
            <div className="text-xl font-semibold text-slate-900">{stats.avgDuration}s</div>
            <div className="text-xs text-slate-500">{Math.floor(stats.avgDuration / 60)}m {stats.avgDuration % 60}s per call</div>
          </div>
          <div className="card p-4">
            <div className="flex items-center gap-2 mb-1">
              <Activity className="h-4 w-4 text-slate-600" />
              <span className="text-xs font-medium text-slate-500">Avg Confidence</span>
            </div>
            <div className="text-xl font-semibold text-slate-900">{stats.avgConfidence}%</div>
            <div className="text-xs text-slate-500">Verification confidence</div>
          </div>
        </div>
      )}

      <div className="card-elevated">
        <div className="p-4 md:p-6">
          {activeTab === 'import' && (
              <div>
                <div className="info-box mb-6">
                  <h3 className="info-box-title">
                    <Database className="h-5 w-5 text-slate-600" />
                    Import Customer Data for Verification
                  </h3>
                  <p className="info-box-body">
                    Import customers from your CRM API or upload an Excel file (.xlsx, .xls, or .csv). Each customer record should include verification fields like name, phone, email, address, and optional security fields (DOB, SSN last 4).
                  </p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
                  <button
                    onClick={handleImportFromCRM}
                    className="btn-primary py-3"
                  >
                    <Database className="h-5 w-5" />
                    Import from CRM
                  </button>
                  <label className="btn-primary py-3 cursor-pointer bg-emerald-600 hover:bg-emerald-700">
                    <FileSpreadsheet className="h-5 w-5" />
                    Import from Excel
                    <input
                      type="file"
                      accept=".xlsx,.xls,.csv"
                      onChange={handleImportFromExcel}
                      className="hidden"
                    />
                  </label>
                </div>
                <div className="info-box mb-6">
                  <h4 className="font-semibold text-slate-800 mb-2">Excel File Format</h4>
                  <p className="text-sm text-slate-600 mb-3">
                    <strong>You can upload Excel files in any format.</strong> The system will automatically detect and map columns. If needed, you can manually assign columns in the mapping step.
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                    <div className="rounded-lg border border-emerald-200 bg-emerald-50/50 p-3">
                      <p className="font-medium text-emerald-800 mb-2">Required fields</p>
                      <ul className="list-disc list-inside space-y-1 text-emerald-800">
                        <li><strong>Name:</strong> Customer Name, Full Name, or First + Last Name</li>
                        <li><strong>Phone:</strong> Contact Number, Phone, Mobile, or Telephone</li>
                      </ul>
                    </div>
                    <div className="rounded-lg border border-slate-200 bg-slate-50/50 p-3">
                      <p className="font-medium text-slate-800 mb-2">Optional (auto-detected)</p>
                      <ul className="list-disc list-inside space-y-1 text-slate-700">
                        <li>Customer ID, Email, Address / Job Address</li>
                        <li>Date of Birth, SSN, Security Info</li>
                        <li>All other columns are preserved as metadata</li>
                      </ul>
                    </div>
                  </div>
                  <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50/50 p-3">
                    <p className="text-xs text-amber-800">
                      <strong>Examples:</strong> "Customer Name" is split into first/last automatically. "Contact Number" maps to phone, "Job Address" to address. Upload and map if needed.
                    </p>
                  </div>
                </div>

                {excelPreview && (
                  <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50">
                    <div className="card-elevated max-w-4xl w-full max-h-[90vh] overflow-y-auto">
                      <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white p-4">
                        <h3 className="text-lg font-semibold text-slate-900">Map Excel Columns</h3>
                        <button
                          onClick={() => {
                            setExcelPreview(null);
                            setExcelMapping({});
                          }}
                          className="rounded-lg p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-700"
                          aria-label="Close"
                        >
                          <X className="h-5 w-5" />
                        </button>
                      </div>
                      <div className="p-6">
                        <p className="text-sm text-slate-600 mb-4">
                          Map your Excel columns to the required fields. Auto-detected columns are indicated below.
                        </p>
                        <div className="mb-4 info-box">
                          <p className="info-box-title mb-2">Data preview (first 5 rows)</p>
                          <div className="overflow-x-auto">
                            <table className="w-full text-xs border-collapse border border-slate-200">
                              <thead>
                                <tr className="table-header">
                                  {excelPreview.headers.map((h, i) => (
                                    <th key={i} className="table-cell">{h}</th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody>
                                {excelPreview.data.map((row, ri) => (
                                  <tr key={ri} className="border-b border-slate-100 hover:bg-slate-50">
                                    {row.map((cell, ci) => (
                                      <td key={ci} className="table-cell">{String(cell || '')}</td>
                                    ))}
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>

                        <div className="space-y-3">
                          {[
                            { key: 'customerId', label: 'Customer ID', required: false },
                            { key: 'fullName', label: 'Full Name (or separate First/Last)', required: false },
                            { key: 'firstName', label: 'First Name', required: false },
                            { key: 'lastName', label: 'Last Name', required: false },
                            { key: 'phone', label: 'Phone/Contact Number', required: true },
                            { key: 'email', label: 'Email Address', required: false },
                            { key: 'address', label: 'Address/Job Address', required: false },
                            { key: 'dateOfBirth', label: 'Date of Birth', required: false },
                            { key: 'lastFourSSN', label: 'Last 4 SSN', required: false },
                            { key: 'securityAnswer', label: 'Security Answer', required: false },
                            { key: 'status', label: 'Status', required: false }
                          ].map(field => {
                            const detected = excelPreview.detectedMapping[field.key];
                            const selectedIndex = excelMapping[field.key]?.[0]?.index ?? detected?.[0]?.index;
                            
                            return (
                              <div key={field.key} className="flex flex-col sm:flex-row sm:items-center gap-3 p-3 border border-slate-200 rounded-lg bg-white">
                                <div className="flex-1 min-w-0">
                                  <label className="block text-sm font-medium text-slate-700 mb-1">
                                    {field.label}
                                    {field.required && <span className="text-red-500 ml-1">*</span>}
                                    {detected && (
                                      <span className="ml-2 text-xs text-emerald-600">(Auto-detected)</span>
                                    )}
                                  </label>
                                  <select
                                    value={selectedIndex !== undefined ? selectedIndex : ''}
                                    onChange={(e) => {
                                      const idx = e.target.value ? parseInt(e.target.value) : null;
                                      setExcelMapping({
                                        ...excelMapping,
                                        [field.key]: idx !== null ? [{ index: idx, header: excelPreview.headers[idx] }] : []
                                      });
                                    }}
                                    className="input-standard"
                                  >
                                    <option value="">-- Select Column --</option>
                                    {excelPreview.headers.map((header, idx) => (
                                      <option key={idx} value={idx}>
                                        {header} {detected?.some(d => d.index === idx) && '(detected)'}
                                      </option>
                                    ))}
                                  </select>
                                </div>
                                {selectedIndex !== undefined && (
                                  <div className="text-xs text-slate-500 shrink-0">
                                    Sample: {String(excelPreview.data[0]?.[selectedIndex] || 'N/A').substring(0, 30)}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                        <div className="mt-6 flex flex-wrap gap-3 justify-end">
                          <button
                            onClick={() => {
                              setExcelPreview(null);
                              setExcelMapping({});
                            }}
                            className="btn-secondary"
                          >
                            Cancel
                          </button>
                          <button
                            onClick={applyExcelMapping}
                            className="btn-primary"
                          >
                            Import Data
                            <ArrowRight className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {customers.length > 0 && (

                  <div>

                    <div className="flex justify-between items-center mb-4">

                      <h3 className="text-lg font-semibold">Imported Customers ({customers.length})</h3>

                      <button

                        onClick={() => {

                          const allSelected = customers.every(c => c.selected);

                          setCustomers(customers.map(c => ({ ...c, selected: !allSelected })));

                        }}

                        className="text-sm text-slate-600 hover:text-slate-900"

                      >

                        {customers.every(c => c.selected) ? 'Deselect All' : 'Select All'}

                      </button>

                    </div>

                    <div className="overflow-x-auto">

                      <table className="w-full">

                        <thead>

                          <tr className="table-header">

                            <th className="table-cell">

                              <input 

                                type="checkbox" 

                                checked={customers.every(c => c.selected)}

                                onChange={(e) => {

                                  setCustomers(customers.map(c => ({ ...c, selected: e.target.checked })));

                                }}

                                className="w-4 h-4"

                              />

                            </th>

                            <th className="table-cell">Customer ID</th>

                            <th className="table-cell">Name</th>

                            <th className="table-cell">Phone</th>

                            <th className="table-cell">Email</th>

                            <th className="table-cell">Address</th>

                            <th className="table-cell">Status</th>

                          </tr>

                        </thead>

                        <tbody>

                          {customers.map(customer => (

                            <tr key={customer.id} className="border-b hover:bg-slate-50">

                              <td className="p-3">

                                <input 

                                  type="checkbox" 

                                  checked={customer.selected || false}

                                  onChange={() => toggleCustomerSelection(customer.id)}

                                  className="w-4 h-4"

                                />

                              </td>

                              <td className="p-3 text-sm font-mono">{customer.customerId}</td>

                              <td className="p-3">{customer.firstName} {customer.lastName}</td>

                              <td className="p-3">{customer.phone}</td>

                              <td className="p-3 text-sm">{customer.email}</td>

                              <td className="p-3 text-sm">{customer.address}</td>

                              <td className="p-3">

                                <span className="px-2 py-1 bg-green-100 text-green-800 rounded text-xs font-medium">

                                  {customer.status.replace('_', ' ')}

                                </span>

                              </td>

                            </tr>

                          ))}

                        </tbody>

                      </table>

                    </div>

                  </div>

                )}

              </div>

            )}

            {/* Schedule Tab */}

            {activeTab === 'schedule' && (

              <div>

                <div className="mb-6 info-box">

                  <h3 className="info-box-title">

                    <Calendar className="w-5 h-5" />

                    Schedule Verification Calls

                  </h3>

                  <p className="info-box-body">Schedule automated verification calls with Vapi. The AI agent will verify customer details and update the verification status.</p>

                </div>

                <div className="grid grid-cols-4 gap-4 mb-6">

                  <div>

                    <label className="block text-sm font-medium text-slate-700 mb-2">

                      Call Date

                    </label>

                    <input

                      type="date"

                      value={scheduleSettings.date}

                      onChange={(e) => setScheduleSettings({...scheduleSettings, date: e.target.value})}

                      className="w-full p-2 border rounded-lg"

                    />

                  </div>

                  <div>

                    <label className="block text-sm font-medium text-slate-700 mb-2">

                      Call Time

                    </label>

                    <input

                      type="time"

                      value={scheduleSettings.time}

                      onChange={(e) => setScheduleSettings({...scheduleSettings, time: e.target.value})}

                      className="w-full p-2 border rounded-lg"

                    />

                  </div>

                  <div>

                    <label className="block text-sm font-medium text-slate-700 mb-2">

                      Timezone

                    </label>

                    <select

                      value={scheduleSettings.timezone}

                      onChange={(e) => setScheduleSettings({...scheduleSettings, timezone: e.target.value})}

                      className="w-full p-2 border rounded-lg"

                    >

                      <optgroup label="United States">

                        <option value="America/New_York">Eastern (ET)</option>

                        <option value="America/Chicago">Central (CT)</option>

                        <option value="America/Denver">Mountain (MT)</option>

                        <option value="America/Los_Angeles">Pacific (PT)</option>

                      </optgroup>

                      <optgroup label="Australia">

                        <option value="Australia/Sydney">Australian Eastern (AEST/AEDT) - Sydney</option>

                        <option value="Australia/Melbourne">Australian Eastern (AEST/AEDT) - Melbourne</option>

                        <option value="Australia/Brisbane">Australian Eastern Standard (AEST) - Brisbane</option>

                        <option value="Australia/Adelaide">Australian Central (ACST/ACDT) - Adelaide</option>

                        <option value="Australia/Darwin">Australian Central Standard (ACST) - Darwin</option>

                        <option value="Australia/Perth">Australian Western Standard (AWST) - Perth</option>

                      </optgroup>

                    </select>

                  </div>

                  <div>

                    <label className="block text-sm font-medium text-slate-700 mb-2">

                      Max Retries

                    </label>

                    <input

                      type="number"

                      min="0"

                      max="5"

                      value={scheduleSettings.maxRetries}

                      onChange={(e) => setScheduleSettings({...scheduleSettings, maxRetries: parseInt(e.target.value)})}

                      className="w-full p-2 border rounded-lg"

                    />

                  </div>

                </div>

                <div className="mb-6 flex items-center gap-2">

                  <input

                    type="checkbox"

                    checked={scheduleSettings.retryFailedCalls}

                    onChange={(e) => setScheduleSettings({...scheduleSettings, retryFailedCalls: e.target.checked})}

                    className="w-4 h-4"

                  />

                  <label className="text-sm text-slate-700">

                    Automatically retry failed calls (no answer, busy)

                  </label>

                </div>

                <button

                  onClick={handleScheduleCalls}

                  disabled={customers.filter(c => c.selected).length === 0}

                  className="flex items-center gap-2 px-6 py-3 btn-primary transition-colors disabled:bg-slate-300 disabled:cursor-not-allowed shadow-md mb-6"

                >

                  <Calendar className="w-5 h-5" />

                  Schedule {customers.filter(c => c.selected).length} Verification Call{customers.filter(c => c.selected).length !== 1 ? 's' : ''}

                </button>

                {scheduledCalls.length > 0 && (

                  <div>

                    <h3 className="text-lg font-semibold mb-4">Scheduled Calls ({scheduledCalls.length})</h3>

                    <div className="overflow-x-auto">

                      <table className="w-full">

                        <thead>

                          <tr className="table-header">

                            <th className="table-cell">Customer</th>

                            <th className="table-cell">Phone</th>

                            <th className="table-cell">Scheduled</th>

                            <th className="table-cell">Vapi Call ID</th>

                            <th className="table-cell">Retry Count</th>

                            <th className="table-cell">Status</th>

                            <th className="table-cell">Action</th>

                          </tr>

                        </thead>

                        <tbody>

                          {scheduledCalls.map(call => (

                            <tr key={call.vapiCallId} className="border-b hover:bg-slate-50">

                              <td className="p-3">{call.firstName} {call.lastName}</td>

                              <td className="p-3">{call.phone}</td>

                              <td className="p-3 text-sm">{call.scheduledDate} {call.scheduledTime}</td>

                              <td className="p-3 text-xs text-slate-600 font-mono">{call.vapiCallId}</td>

                              <td className="p-3">

                                <span className="px-2 py-1 bg-orange-100 text-orange-800 rounded text-xs">

                                  {call.retryCount}/{call.maxRetries}

                                </span>

                              </td>

                              <td className="p-3">

                                <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-sm flex items-center gap-1 w-fit">

                                  <Clock className="w-3 h-3" />

                                  {call.status}

                                </span>

                              </td>

                              <td className="p-3">

                                <button

                                  onClick={() => simulateCallCompletion(call.vapiCallId)}

                                  className="px-3 py-1 bg-green-600 text-white rounded text-sm hover:bg-green-700"

                                >

                                  Simulate Complete

                                </button>

                              </td>

                            </tr>

                          ))}

                        </tbody>

                      </table>

                    </div>

                  </div>

                )}

              </div>

            )}

            {/* Results Tab */}

            {activeTab === 'results' && (

              <div>

                <div className="mb-6 flex justify-between items-center">

                  <div>

                    <h3 className="text-lg font-semibold">Verification Results</h3>

                    <p className="text-sm text-slate-600">Detailed verification outcomes with field-level validation</p>

                  </div>

                  {completedCalls.length > 0 && (

                    <button

                      onClick={exportResults}

                      className="flex items-center gap-2 px-4 py-2 btn-primary bg-emerald-600 hover:bg-emerald-700 shadow-md"

                    >

                      <Download className="w-4 h-4" />

                      Export Results

                    </button>

                  )}

                </div>

                {completedCalls.length === 0 ? (

                  <div className="text-center py-12 text-slate-500">

                    <Shield className="w-16 h-16 mx-auto mb-4 opacity-50" />

                    <p className="text-lg">No verification results yet</p>

                    <p className="text-sm">Schedule and complete calls to see verification data</p>

                  </div>

                ) : (

                  <div className="space-y-4">

                    {completedCalls.map(call => (

                      <div key={call.vapiCallId} className="border rounded-lg p-5 bg-white shadow-sm hover:shadow-md transition-shadow">

                        <div className="flex justify-between items-start mb-4">

                          <div>

                            <h4 className="font-semibold text-lg flex items-center gap-2">

                              <Users className="w-5 h-5 text-slate-600" />

                              {call.firstName} {call.lastName}

                            </h4>

                            <p className="text-sm text-slate-600">{call.phone} • {call.email}</p>

                            <p className="text-xs text-slate-500 font-mono mt-1">Customer ID: {call.customerId}</p>

                          </div>

                          <div className="text-right">

                            {call.callOutcome === 'fully_verified' && (

                              <span className="px-3 py-2 bg-green-100 text-green-800 rounded-lg text-sm font-medium flex items-center gap-2">

                                <CheckCircle className="w-5 h-5" />

                                Fully Verified

                              </span>

                            )}

                            {call.callOutcome === 'partially_verified' && (

                              <span className="px-3 py-2 bg-yellow-100 text-yellow-800 rounded-lg text-sm font-medium flex items-center gap-2">

                                <AlertCircle className="w-5 h-5" />

                                Partially Verified

                              </span>

                            )}

                            {call.callOutcome === 'not_verified' && (

                              <span className="px-3 py-2 bg-red-100 text-red-800 rounded-lg text-sm font-medium flex items-center gap-2">

                                <XCircle className="w-5 h-5" />

                                Not Verified

                              </span>

                            )}

                            {call.callOutcome === 'no_answer' && (

                              <span className="px-3 py-2 bg-slate-100 text-slate-800 rounded-lg text-sm font-medium flex items-center gap-2">

                                <Phone className="w-5 h-5" />

                                No Answer

                              </span>

                            )}

                            <div className="text-xs text-slate-500 mt-1">

                              Confidence: {(call.verificationConfidence * 100).toFixed(1)}%

                            </div>

                          </div>

                        </div>

                        <div className="grid grid-cols-3 gap-4 mb-4 p-3 bg-slate-50 rounded-lg">

                          <div>

                            <p className="text-xs text-slate-500">Duration</p>

                            <p className="text-sm font-medium">{Math.floor(call.callDuration / 60)}m {call.callDuration % 60}s</p>

                          </div>

                          <div>

                            <p className="text-xs text-slate-500">Completed</p>

                            <p className="text-sm font-medium">{new Date(call.completedAt).toLocaleString()}</p>

                          </div>

                          <div>

                            <p className="text-xs text-slate-500">Cost / Tokens</p>

                            <p className="text-sm font-medium">${call.callCost} / {call.aiTokensUsed}</p>

                          </div>

                        </div>

                        {call.verifiedFields.length > 0 && (

                          <div className="mb-3">

                            <p className="text-sm font-medium text-slate-700 mb-2 flex items-center gap-1">

                              <CheckCircle className="w-4 h-4 text-green-600" />

                              Verified Fields ({call.verifiedFields.length}):

                            </p>

                            <div className="flex flex-wrap gap-2">

                              {call.verifiedFields.map(field => (

                                <span key={field} className="px-3 py-1 bg-green-50 text-green-700 rounded-full text-xs font-medium border border-green-200">

                                  ✓ {field}

                                </span>

                              ))}

                            </div>

                          </div>

                        )}

                        {call.failedFields.length > 0 && (

                          <div className="mb-3">

                            <p className="text-sm font-medium text-slate-700 mb-2 flex items-center gap-1">

                              <XCircle className="w-4 h-4 text-red-600" />

                              Failed Verification ({call.failedFields.length}):

                            </p>

                            <div className="flex flex-wrap gap-2">

                              {call.failedFields.map(field => (

                                <span key={field} className="px-3 py-1 bg-red-50 text-red-700 rounded-full text-xs font-medium border border-red-200">

                                  ✗ {field}

                                </span>

                              ))}

                            </div>

                          </div>

                        )}

                        <div className="flex gap-2 pt-3 border-t">

                          <a

                            href={call.recordingUrl}

                            target="_blank"

                            rel="noopener noreferrer"

                            className="flex items-center gap-1 px-3 py-2 bg-slate-700 text-white rounded-lg hover:bg-slate-800 text-sm"

                          >

                            <PlayCircle className="w-4 h-4" />

                            Play Recording

                          </a>

                          <a

                            href={call.transcriptUrl}

                            target="_blank"

                            rel="noopener noreferrer"

                            className="flex items-center gap-1 px-3 py-2 bg-slate-600 text-white rounded-lg text-sm hover:bg-slate-700"

                          >

                            <Download className="w-4 h-4" />

                            View Transcript

                          </a>

                          <span className="text-xs text-slate-500 self-center ml-auto font-mono">

                            Vapi ID: {call.vapiCallId}

                          </span>

                        </div>

                        {call.needsRetry && (

                          <div className="mt-3 p-2 bg-orange-50 border border-orange-200 rounded text-xs text-orange-800">

                            Call will be automatically retried (Attempt {call.retryCount + 1}/{call.maxRetries})

                          </div>

                        )}

                      </div>

                    ))}

                  </div>

                )}

              </div>

            )}

            {/* History & Archive Tab */}

            {activeTab === 'history' && (

              <div>

                <div className="mb-6 info-box">

                  <h3 className="info-box-title">

                    <Archive className="w-5 h-5" />

                    Import & Schedule History

                  </h3>

                  <p className="info-box-body">View all import and scheduling activities. Data older than 7 days is automatically archived.</p>

                </div>

                <div className="grid grid-cols-2 gap-6 mb-6">

                  {/* Import History */}

                  <div className="bg-white rounded-lg shadow p-4">

                    <h4 className="font-semibold text-slate-800 mb-4 flex items-center gap-2">

                      <Upload className="w-5 h-5 text-slate-600" />

                      Import History ({importHistory.length})

                    </h4>

                    <div className="space-y-3 max-h-96 overflow-y-auto">

                      {importHistory.length === 0 ? (

                        <p className="text-sm text-slate-500 text-center py-4">No import history yet</p>

                      ) : (

                        importHistory.map(record => (

                          <div key={record.id} className="border rounded-lg p-3 hover:bg-slate-50">

                            <div className="flex justify-between items-start mb-2">

                              <div>

                                <p className="font-medium text-sm">{record.source}</p>

                                <p className="text-xs text-slate-500">{new Date(record.timestamp).toLocaleString()}</p>

                              </div>

                              <span className="px-2 py-1 bg-slate-100 text-slate-800 rounded text-xs">

                                {record.customerCount} customers

                              </span>

                            </div>

                            {record.fileName && (

                              <p className="text-xs text-slate-600 mb-1">

                                <FileText className="w-3 h-3 inline mr-1" />

                                {record.fileName}

                                {record.fileSize && ` (${(record.fileSize / 1024).toFixed(1)} KB)`}

                              </p>

                            )}

                            <p className="text-xs text-slate-500">

                              Type: {record.type === 'crm' ? 'CRM API' : 'Excel Import'}

                            </p>

                          </div>

                        ))

                      )}

                    </div>

                  </div>

                  {/* Schedule History */}

                  <div className="bg-white rounded-lg shadow p-4">

                    <h4 className="font-semibold text-slate-800 mb-4 flex items-center gap-2">

                      <Calendar className="w-5 h-5 text-slate-600" />

                      Schedule History ({scheduleHistory.length})

                    </h4>

                    <div className="space-y-3 max-h-96 overflow-y-auto">

                      {scheduleHistory.length === 0 ? (

                        <p className="text-sm text-slate-500 text-center py-4">No schedule history yet</p>

                      ) : (

                        scheduleHistory.map(record => {

                          const completedCount = completedCalls.filter(c => 

                            record.customers.some(rc => rc.vapiCallId === c.vapiCallId)

                          ).length;

                          return (

                            <div key={record.id} className="border rounded-lg p-3 hover:bg-slate-50">

                              <div className="flex justify-between items-start mb-2">

                                <div>

                                  <p className="font-medium text-sm">Batch {record.batchId.substring(6, 13)}</p>

                                  <p className="text-xs text-slate-500">

                                    {record.scheduledDate} {record.scheduledTime} ({record.timezone.split('/')[1]})

                                  </p>

                                  <p className="text-xs text-slate-500">

                                    {new Date(record.timestamp).toLocaleString()}

                                  </p>

                                </div>

                                <div className="text-right">

                                  <span className="px-2 py-1 bg-slate-100 text-slate-800 rounded text-xs block mb-1">

                                    {record.customerCount} scheduled

                                  </span>

                                  {completedCount > 0 && (

                                    <span className="px-2 py-1 bg-green-100 text-green-800 rounded text-xs block">

                                      {completedCount} completed

                                    </span>

                                  )}

                                </div>

                              </div>

                              <div className="flex gap-2 mt-2">

                                {completedCount > 0 && (

                                  <button

                                    onClick={() => exportResults(record.batchId)}

                                    className="flex items-center gap-1 px-2 py-1 bg-green-600 text-white rounded text-xs hover:bg-green-700"

                                  >

                                    <Download className="w-3 h-3" />

                                    Download Batch

                                  </button>

                                )}

                                <span className="text-xs text-slate-500 self-center">

                                  Status: {record.status}

                                </span>

                              </div>

                            </div>

                          );

                        })

                      )}

                    </div>

                  </div>

                </div>

                {/* Archived Data */}

                <div className="bg-white rounded-lg shadow p-4">

                  <h4 className="font-semibold text-slate-800 mb-4 flex items-center gap-2">

                    <Archive className="w-5 h-5 text-orange-600" />

                    Archived Data ({archivedData.length})

                  </h4>

                  <p className="text-sm text-slate-600 mb-4">

                    Data older than 7 days is automatically archived. You can download archived batches anytime.

                  </p>

                  <div className="space-y-3 max-h-96 overflow-y-auto">

                    {archivedData.length === 0 ? (

                      <p className="text-sm text-slate-500 text-center py-4">No archived data yet</p>

                    ) : (

                      archivedData.map(archive => (

                        <div key={archive.id} className="border rounded-lg p-3 hover:bg-slate-50">

                          <div className="flex justify-between items-start mb-2">

                            <div>

                              <p className="font-medium text-sm">

                                {archive.type === 'completed_calls' ? 'Completed Calls' :

                                 archive.type === 'import_history' ? 'Import History' :

                                 'Schedule History'}

                              </p>

                              <p className="text-xs text-slate-500">

                                Archived: {new Date(archive.archivedAt).toLocaleString()}

                              </p>

                              {archive.originalDate && (

                                <p className="text-xs text-slate-500">

                                  Original Date: {new Date(archive.originalDate).toLocaleDateString()}

                                </p>

                              )}

                            </div>

                            <span className="px-2 py-1 bg-orange-100 text-orange-800 rounded text-xs">

                              {Array.isArray(archive.data) ? archive.data.length : Object.keys(archive.data).length} items

                            </span>

                          </div>

                          <button

                            onClick={() => downloadArchivedBatch(archive.id)}

                            className="flex items-center gap-1 px-3 py-1 bg-orange-600 text-white rounded text-sm hover:bg-orange-700 mt-2"

                          >

                            <Download className="w-4 h-4" />

                            Download Archive

                          </button>

                        </div>

                      ))

                    )}

                  </div>

                </div>

              </div>

            )}

            {/* Verification Config Tab */}

            {activeTab === 'verification' && (

              <div>

                <div className="mb-6 info-box">

                  <h3 className="info-box-title">

                    <Shield className="w-5 h-5" />

                    Configure Verification Fields

                  </h3>

                  <p className="info-box-body">Select which customer fields the AI agent should verify during calls. Required fields must be verified for a "fully verified" status.</p>

                </div>

                <div className="max-w-2xl">

                  <div className="space-y-4 mb-6">

                    <h4 className="font-semibold text-slate-800">Primary Verification Fields</h4>

                    

                    <div className="flex items-center justify-between p-3 bg-white border rounded-lg">

                      <div>

                        <label className="font-medium text-slate-700">First & Last Name</label>

                        <p className="text-sm text-slate-500">Verify customer's full legal name</p>

                      </div>

                      <input

                        type="checkbox"

                        checked={verificationConfig.verifyName}

                        onChange={(e) => setVerificationConfig({...verificationConfig, verifyName: e.target.checked})}

                        className="w-5 h-5"

                      />

                    </div>

                    <div className="flex items-center justify-between p-3 bg-white border rounded-lg">

                      <div>

                        <label className="font-medium text-slate-700">Phone Number</label>

                        <p className="text-sm text-slate-500">Confirm phone number on file</p>

                      </div>

                      <input

                        type="checkbox"

                        checked={verificationConfig.verifyPhone}

                        onChange={(e) => setVerificationConfig({...verificationConfig, verifyPhone: e.target.checked})}

                        className="w-5 h-5"

                      />

                    </div>

                    <div className="flex items-center justify-between p-3 bg-white border rounded-lg">

                      <div>

                        <label className="font-medium text-slate-700">Email Address</label>

                        <p className="text-sm text-slate-500">Verify email address for account</p>

                      </div>

                      <input

                        type="checkbox"

                        checked={verificationConfig.verifyEmail}

                        onChange={(e) => setVerificationConfig({...verificationConfig, verifyEmail: e.target.checked})}

                        className="w-5 h-5"

                      />

                    </div>

                    <div className="flex items-center justify-between p-3 bg-white border rounded-lg">

                      <div>

                        <label className="font-medium text-slate-700">Physical Address</label>

                        <p className="text-sm text-slate-500">Confirm current mailing address</p>

                      </div>

                      <input

                        type="checkbox"

                        checked={verificationConfig.verifyAddress}

                        onChange={(e) => setVerificationConfig({...verificationConfig, verifyAddress: e.target.checked})}

                        className="w-5 h-5"

                      />

                    </div>

                  </div>

                  <div className="space-y-4 mb-6">

                    <h4 className="font-semibold text-slate-800">Secondary Verification Fields (Optional)</h4>

                    <p className="text-sm text-slate-600">Additional security verification for high-value accounts or fraud prevention</p>

                    

                    <div className="flex items-center justify-between p-3 bg-white border rounded-lg">

                      <div>

                        <label className="font-medium text-slate-700">Date of Birth</label>

                        <p className="text-sm text-slate-500">Verify DOB in MM/DD/YYYY format</p>

                      </div>

                      <input

                        type="checkbox"

                        checked={verificationConfig.verifyDOB}

                        onChange={(e) => setVerificationConfig({...verificationConfig, verifyDOB: e.target.checked})}

                        className="w-5 h-5"

                      />

                    </div>

                    <div className="flex items-center justify-between p-3 bg-white border rounded-lg">

                      <div>

                        <label className="font-medium text-slate-700">Last 4 of SSN</label>

                        <p className="text-sm text-slate-500">Last 4 digits of Social Security Number</p>

                      </div>

                      <input

                        type="checkbox"

                        checked={verificationConfig.verifySSN}

                        onChange={(e) => setVerificationConfig({...verificationConfig, verifySSN: e.target.checked})}

                        className="w-5 h-5"

                      />

                    </div>

                    <div className="flex items-center justify-between p-3 bg-white border rounded-lg">

                      <div>

                        <label className="font-medium text-slate-700">Security Question</label>

                        <p className="text-sm text-slate-500">Custom security question answer</p>

                      </div>

                      <input

                        type="checkbox"

                        checked={verificationConfig.securityQuestion}

                        onChange={(e) => setVerificationConfig({...verificationConfig, securityQuestion: e.target.checked})}

                        className="w-5 h-5"

                      />

                    </div>

                  </div>

                  <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">

                    <h4 className="font-semibold text-amber-900 mb-2">Compliance Notice</h4>

                    <ul className="text-sm text-yellow-800 space-y-1">

                      <li>• Ensure TCPA compliance before making verification calls</li>

                      <li>• Never have the AI read back sensitive information</li>

                      <li>• Follow PCI DSS guidelines for payment data</li>

                      <li>• Maintain call recordings for compliance audits</li>

                      <li>• Implement proper consent mechanisms</li>

                    </ul>

                  </div>

                </div>

              </div>

            )}

            {/* Settings Tab */}

            {activeTab === 'settings' && (

              <div>

                <div className="mb-6 info-box">

                  <h3 className="font-semibold text-blue-900 mb-2">API Configuration</h3>

                  <p className="info-box-body">Configure your CRM and Vapi API credentials for integration</p>

                </div>

                <div className="space-y-6 max-w-2xl">

                  <div className="border rounded-lg p-5 bg-white shadow-sm">

                    <div className="flex items-center justify-between mb-4">

                      <h4 className="font-semibold text-slate-800 flex items-center gap-2">

                        <Database className="w-5 h-5 text-slate-600" />

                        CRM Integration

                      </h4>

                      <div className="flex items-center gap-3">

                        {connectionStatus.crm.status === 'connected' && (

                          <span className="flex items-center gap-1 text-sm text-green-600">

                            <CheckCircle className="w-4 h-4" />

                            Connected

                          </span>

                        )}

                        {connectionStatus.crm.status === 'error' && (

                          <span className="flex items-center gap-1 text-sm text-red-600">

                            <XCircle className="w-4 h-4" />

                            Failed

                          </span>

                        )}

                        {connectionStatus.crm.status === 'disconnected' && (

                          <span className="flex items-center gap-1 text-sm text-slate-500">

                            <WifiOff className="w-4 h-4" />

                            Not Connected

                          </span>

                        )}

                        <button

                          onClick={testCrmConnection}

                          disabled={connectionStatus.crm.testing}

                          className="flex items-center gap-2 px-4 py-2 btn-primary transition-colors disabled:bg-slate-400 disabled:cursor-not-allowed text-sm font-medium"

                        >

                          {connectionStatus.crm.testing ? (

                            <>

                              <Loader className="w-4 h-4 animate-spin" />

                              Testing...

                            </>

                          ) : (

                            <>

                              <Wifi className="w-4 h-4" />

                              Test Connection

                            </>

                          )}

                        </button>

                      </div>

                    </div>

                    {connectionStatus.crm.message && (

                      <div className={`mb-4 p-3 rounded-lg text-sm ${

                        connectionStatus.crm.status === 'connected' ? 'bg-green-50 text-green-800 border border-green-200' :

                        connectionStatus.crm.status === 'error' ? 'bg-red-50 text-red-800 border border-red-200' :

                        'bg-blue-50 text-blue-800 border border-blue-200'

                      }`}>

                        {connectionStatus.crm.message}

                      </div>

                    )}

                    <div className="space-y-4">

                      <div>

                        <label className="block text-sm font-medium text-slate-700 mb-2">

                          CRM API Endpoint

                        </label>

                        <input

                          type="text"

                          value={apiConfig.crmEndpoint}

                          onChange={(e) => {

                            setApiConfig({...apiConfig, crmEndpoint: e.target.value});

                            setConnectionStatus({...connectionStatus, crm: { status: 'disconnected', message: '', testing: false }});

                          }}

                          placeholder="https://api.dataforce.com/v1"

                          className="w-full p-3 border rounded-lg"

                        />

                      </div>

                      <div>

                        <label className="block text-sm font-medium text-slate-700 mb-2">

                          CRM API Key

                        </label>

                        <input

                          type="password"

                          value={apiConfig.crmApiKey}

                          onChange={(e) => {

                            setApiConfig({...apiConfig, crmApiKey: e.target.value});

                            setConnectionStatus({...connectionStatus, crm: { status: 'disconnected', message: '', testing: false }});

                          }}

                          placeholder="Enter your CRM API key"

                          className="w-full p-3 border rounded-lg"

                        />

                      </div>

                    </div>

                  </div>

                  <div className="border rounded-lg p-5 bg-white shadow-sm">

                    <div className="flex items-center justify-between mb-4">

                      <h4 className="font-semibold text-slate-800 flex items-center gap-2">

                        <Phone className="w-5 h-5 text-slate-600" />

                        Vapi Integration

                      </h4>

                      <div className="flex items-center gap-3">

                        {connectionStatus.vapi.status === 'connected' && (

                          <span className="flex items-center gap-1 text-sm text-green-600">

                            <CheckCircle className="w-4 h-4" />

                            Connected

                          </span>

                        )}

                        {connectionStatus.vapi.status === 'error' && (

                          <span className="flex items-center gap-1 text-sm text-red-600">

                            <XCircle className="w-4 h-4" />

                            Failed

                          </span>

                        )}

                        {connectionStatus.vapi.status === 'disconnected' && (

                          <span className="flex items-center gap-1 text-sm text-slate-500">

                            <WifiOff className="w-4 h-4" />

                            Not Connected

                          </span>

                        )}

                        <button

                          onClick={testVapiConnection}

                          disabled={connectionStatus.vapi.testing}

                          className="flex items-center gap-2 px-4 py-2 btn-primary transition-colors disabled:bg-slate-400 disabled:cursor-not-allowed text-sm font-medium"

                        >

                          {connectionStatus.vapi.testing ? (

                            <>

                              <Loader className="w-4 h-4 animate-spin" />

                              Testing...

                            </>

                          ) : (

                            <>

                              <Wifi className="w-4 h-4" />

                              Test Connection

                            </>

                          )}

                        </button>

                      </div>

                    </div>

                    {connectionStatus.vapi.message && (

                      <div className={`mb-4 p-3 rounded-lg text-sm ${

                        connectionStatus.vapi.status === 'connected' ? 'bg-green-50 text-green-800 border border-green-200' :

                        connectionStatus.vapi.status === 'error' ? 'bg-red-50 text-red-800 border border-red-200' :

                        'bg-blue-50 text-blue-800 border border-blue-200'

                      }`}>

                        {connectionStatus.vapi.message}

                      </div>

                    )}

                    <div className="space-y-4">

                      <div>

                        <label className="block text-sm font-medium text-slate-700 mb-2">

                          Vapi API Key

                        </label>

                        <input

                          type="password"

                          value={apiConfig.vapiApiKey}

                          onChange={(e) => {

                            setApiConfig({...apiConfig, vapiApiKey: e.target.value});

                            setConnectionStatus({...connectionStatus, vapi: { status: 'disconnected', message: '', testing: false }});

                          }}

                          placeholder="Enter your Vapi API key"

                          className="w-full p-3 border rounded-lg"

                        />

                        <p className="text-xs text-slate-500 mt-1">Get your API key from Vapi dashboard</p>

                      </div>

                      <div>

                        <label className="block text-sm font-medium text-slate-700 mb-2">

                          Vapi Phone Number ID

                        </label>

                        <input

                          type="text"

                          value={apiConfig.vapiPhoneNumberId}

                          onChange={(e) => {

                            setApiConfig({...apiConfig, vapiPhoneNumberId: e.target.value});

                            setConnectionStatus({...connectionStatus, vapi: { status: 'disconnected', message: '', testing: false }});

                          }}

                          placeholder="e.g., pn_abc123..."

                          className="w-full p-3 border rounded-lg"

                        />

                        <p className="text-xs text-slate-500 mt-1">The phone number ID to use for outbound calls</p>

                      </div>

                      <div>

                        <label className="block text-sm font-medium text-slate-700 mb-2">

                          Vapi Assistant ID

                        </label>

                        <input

                          type="text"

                          value={apiConfig.vapiAssistantId}

                          onChange={(e) => {

                            setApiConfig({...apiConfig, vapiAssistantId: e.target.value});

                            setConnectionStatus({...connectionStatus, vapi: { status: 'disconnected', message: '', testing: false }});

                          }}

                          placeholder="e.g., asst_abc123..."

                          className="w-full p-3 border rounded-lg"

                        />

                        <p className="text-xs text-slate-500 mt-1">Your verification assistant ID</p>

                      </div>

                      <div>

                        <label className="block text-sm font-medium text-slate-700 mb-2">

                          Webhook URL (Optional)

                        </label>

                        <input

                          type="text"

                          value={apiConfig.webhookUrl}

                          onChange={(e) => setApiConfig({...apiConfig, webhookUrl: e.target.value})}

                          placeholder="https://your-server.com/webhook/vapi"

                          className="w-full p-3 border rounded-lg"

                        />

                        <p className="text-xs text-slate-500 mt-1">Endpoint for receiving verification results and function calls</p>

                      </div>

                    </div>

                  </div>

                  {/* API Key Management Section */}
                  <div className="border rounded-lg p-5 bg-white shadow-sm">
                    <div className="flex items-center justify-between mb-4">
                      <h4 className="font-semibold text-slate-800 flex items-center gap-2">
                        <Key className="w-5 h-5 text-slate-600" />
                        API Key Management
                      </h4>
                    </div>

                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">
                          Current API Key (for generating new API keys)
                        </label>
                        <div className="flex gap-2">
                          <input
                            type={showApiKey ? "text" : "password"}
                            value={currentApiKey}
                            onChange={(e) => {
                              setCurrentApiKey(e.target.value);
                              localStorage.setItem('currentApiKey', e.target.value);
                            }}
                            placeholder="Paste your API key here (get it from backend console)"
                            className="flex-1 p-3 border rounded-lg"
                          />
                          <button
                            onClick={() => setShowApiKey(!showApiKey)}
                            className="px-4 py-2 border rounded-lg hover:bg-slate-50"
                            title={showApiKey ? "Hide API key" : "Show API key"}
                          >
                            {showApiKey ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                          </button>
                        </div>
                        <div className="mt-2 p-2 bg-blue-50 border border-blue-200 rounded text-xs">
                          <p className="text-blue-800 mb-1">
                            <strong>Note:</strong> Excel imports work automatically without an API key! 
                            Customers are automatically synced to the backend database.
                          </p>
                          <p className="text-blue-800">
                            This API key is only needed if you want to generate new API keys for external integrations (n8n, Zapier, etc.).
                          </p>
                        </div>
                      </div>

                      <div className="border-t pt-4">
                        <h5 className="font-medium text-slate-700 mb-3">Generate New API Key</h5>
                        <div className="space-y-3">
                          <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">
                              Name (Optional)
                            </label>
                            <input
                              type="text"
                              value={apiKeyName}
                              onChange={(e) => setApiKeyName(e.target.value)}
                              placeholder="e.g., n8n Integration"
                              className="w-full p-2 border rounded-lg text-sm"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">
                              Description (Optional)
                            </label>
                            <textarea
                              value={apiKeyDescription}
                              onChange={(e) => setApiKeyDescription(e.target.value)}
                              placeholder="Describe what this API key will be used for"
                              rows="2"
                              className="w-full p-2 border rounded-lg text-sm"
                            />
                          </div>
                          <button
                            onClick={generateApiKey}
                            disabled={!currentApiKey || generatingApiKey}
                            className="w-full px-4 py-2 btn-primary transition-colors disabled:bg-slate-400 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                          >
                            {generatingApiKey ? (
                              <>
                                <Loader className="w-4 h-4 animate-spin" />
                                Generating...
                              </>
                            ) : (
                              <>
                                <Key className="w-4 h-4" />
                                Generate API Key
                              </>
                            )}
                          </button>
                        </div>
                      </div>

                      {newApiKey && (
                        <div className="mt-4 p-4 bg-yellow-50 border-2 border-yellow-200 rounded-lg">
                          <div className="flex items-start justify-between mb-2">
                            <div>
                              <h5 className="font-semibold text-amber-900 mb-1">New API Key Generated</h5>
                              <p className="text-sm text-yellow-800 mb-3">
                                Save this key immediately! It won't be shown again.
                              </p>
                            </div>
                            <button
                              onClick={() => setNewApiKey(null)}
                              className="text-yellow-700 hover:text-yellow-900"
                            >
                              <X className="w-5 h-5" />
                            </button>
                          </div>
                          <div className="bg-white p-3 rounded border border-yellow-300 mb-3">
                            <div className="flex items-center justify-between">
                              <code className="text-sm font-mono break-all">{newApiKey.fullKey}</code>
                              <button
                                onClick={() => copyApiKey(newApiKey.fullKey)}
                                className="ml-2 p-1 hover:bg-slate-100 rounded"
                                title="Copy to clipboard"
                              >
                                <Copy className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                          <div className="text-xs text-yellow-700">
                            <p className="mb-1"><strong>Name:</strong> {newApiKey.name}</p>
                            {newApiKey.description && <p className="mb-1"><strong>Description:</strong> {newApiKey.description}</p>}
                            <p><strong>Created:</strong> {new Date(newApiKey.createdAt).toLocaleString()}</p>
                          </div>
                        </div>
                      )}

                      {apiKeys.length > 0 && (
                        <div className="border-t pt-4">
                          <h5 className="font-medium text-slate-700 mb-3">Generated API Keys</h5>
                          <div className="space-y-2">
                            {apiKeys.map((key, index) => (
                              <div key={index} className="p-3 bg-slate-50 rounded-lg flex items-center justify-between">
                                <div>
                                  <div className="font-medium text-sm">{key.name}</div>
                                  <code className="text-xs text-slate-600">{key.prefix || key.fullKey?.substring(0, 16) + '...'}</code>
                                </div>
                                <button
                                  onClick={() => copyApiKey(key.fullKey)}
                                  className="p-1 hover:bg-slate-200 rounded"
                                  title="Copy full key"
                                >
                                  <Copy className="w-4 h-4" />
                                </button>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* API Configuration Info */}
                  <div className="border rounded-lg p-5 bg-white shadow-sm">
                    <h4 className="font-semibold text-slate-800 mb-4 flex items-center gap-2">
                      <Settings className="w-5 h-5 text-slate-600" />
                      API Configuration
                    </h4>
                    <div className="space-y-4">
                      <div>
                        <div className="text-sm font-medium text-slate-700 mb-1">Base URL</div>
                        <code className="block p-2 bg-slate-100 rounded text-sm">{API_BASE_URL || `${window.location.protocol === 'https:' ? 'https' : 'http'}://localhost:8000`}/api/v1</code>
                      </div>
                      <div>
                        <div className="text-sm font-medium text-slate-700 mb-1">Authentication</div>
                        <div className="p-3 bg-slate-50 rounded text-sm">
                          <div className="mb-2">Include your API key in the Authorization header:</div>
                          <code className="block p-2 bg-slate-100 rounded">Authorization: Bearer &lt;your-api-key&gt;</code>
                        </div>
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={saveSettings}
                    className="w-full px-6 py-3 btn-primary transition-colors font-medium shadow-md"
                  >
                    Save Configuration
                  </button>

                  <div className="mt-6 p-5 bg-slate-50 rounded-lg border">

                    <h4 className="font-semibold mb-3 flex items-center gap-2">

                      <Settings className="w-5 h-5" />

                      Integration Guide

                    </h4>

                    <div className="space-y-3 text-sm text-slate-700">

                      <div>

                        <p className="font-medium mb-1">1. CRM Setup</p>

                        <ul className="list-disc list-inside pl-2 space-y-1 text-xs">

                          <li>Configure API endpoint and authentication</li>

                          <li>Ensure customers are marked "ready_for_auditing"</li>

                          <li>Include all required verification fields in export</li>

                        </ul>

                      </div>

                      

                      <div>

                        <p className="font-medium mb-1">2. Vapi Setup</p>

                        <ul className="list-disc list-inside pl-2 space-y-1 text-xs">

                          <li>Create verification assistant with system prompt</li>

                          <li>Configure function tool: verify_customer_details</li>

                          <li>Set up webhook endpoint for real-time results</li>

                          <li>Purchase and verify phone number for outbound calls</li>

                          <li>Enable call recording and transcription</li>

                        </ul>

                      </div>

                      

                      <div>

                        <p className="font-medium mb-1">3. Workflow</p>

                        <ul className="list-disc list-inside pl-2 space-y-1 text-xs">

                          <li>Import customers from CRM</li>

                          <li>Configure verification fields to check</li>

                          <li>Schedule calls with date/time</li>

                          <li>Vapi AI executes verification calls</li>

                          <li>Results auto-sync with verification status</li>

                          <li>Export results back to CRM or as JSON/CSV</li>

                        </ul>

                      </div>

                      <div>

                        <p className="font-medium mb-1">4. Function Tool Implementation</p>

                        <ul className="list-disc list-inside pl-2 space-y-1 text-xs">

                          <li>Create webhook endpoint to handle verify_customer_details</li>

                          <li>Query your database with provided customer info</li>

                          <li>Return verification status and confidence score</li>

                          <li>Log all verification attempts for audit</li>

                        </ul>

                      </div>

                    </div>

                  </div>

                  <div className="p-4 bg-green-50 border border-green-200 rounded-lg">

                    <h4 className="font-semibold text-emerald-900 mb-2">Best Practices</h4>

                    <ul className="text-sm text-green-800 space-y-1">

                      <li>• Use OAuth authentication for Vapi API (more secure)</li>

                      <li>• Implement rate limiting on verification webhook</li>

                      <li>• Store API keys in environment variables</li>

                      <li>• Enable retry logic for failed calls</li>

                      <li>• Monitor call costs and AI token usage</li>

                      <li>• Complete Trust Hub verification for better delivery</li>

                    </ul>

                  </div>

                </div>

              </div>

            )}

            {/* API Documentation Tab */}
            {activeTab === 'api-docs' && (
              <div>
                <div className="mb-6 info-box">
                  <h3 className="info-box-title">
                    <FileText className="w-5 h-5" />
                    API Documentation for Integration
                  </h3>
                  <p className="info-box-body">
                    Access interactive API documentation and integrate with n8n, Zapier, Make.com, and other automation tools.
                  </p>
                </div>

                <div className="space-y-6">
                  {/* Interactive API Docs */}
                  <div className="border rounded-lg p-6 bg-white shadow-sm">
                    <h4 className="font-semibold text-slate-800 mb-4 flex items-center gap-2">
                      <FileText className="w-5 h-5 text-slate-600" />
                      Interactive API Documentation
                    </h4>
                    <p className="text-slate-600 mb-4">
                      Explore and test all available API endpoints with interactive documentation:
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <a
                        href={`${API_BASE_URL || `${window.location.protocol === 'https:' ? 'https' : 'http'}://localhost:8000`}/docs`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-3 p-4 border-2 border-slate-200 rounded-lg hover:border-slate-300 hover:bg-slate-50 transition-colors"
                      >
                        <div className="p-2 bg-slate-100 rounded-lg">
                          <FileText className="w-6 h-6 text-slate-600" />
                        </div>
                        <div className="flex-1">
                          <div className="font-semibold text-slate-800">Swagger UI</div>
                          <div className="text-sm text-slate-600">Interactive API explorer</div>
                        </div>
                        <ArrowRight className="w-5 h-5 text-slate-600" />
                      </a>
                      <a
                        href={`${API_BASE_URL || `${window.location.protocol === 'https:' ? 'https' : 'http'}://localhost:8000`}/redoc`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-3 p-4 border-2 border-slate-200 rounded-lg hover:border-slate-300 hover:bg-slate-50 transition-colors"
                      >
                        <div className="p-2 bg-slate-100 rounded-lg">
                          <FileText className="w-6 h-6 text-slate-600" />
                        </div>
                        <div className="flex-1">
                          <div className="font-semibold text-slate-800">ReDoc</div>
                          <div className="text-sm text-slate-600">Beautiful API documentation</div>
                        </div>
                        <ArrowRight className="w-5 h-5 text-slate-600" />
                      </a>
                    </div>
                  </div>

                  {/* API Information */}
                  <div className="border rounded-lg p-6 bg-white shadow-sm">
                    <h4 className="font-semibold text-slate-800 mb-4 flex items-center gap-2">
                      <Settings className="w-5 h-5 text-slate-600" />
                      API Configuration
                    </h4>
                    <div className="space-y-4">
                      <div>
                        <div className="text-sm font-medium text-slate-700 mb-1">Base URL</div>
                        <code className="block p-2 bg-slate-100 rounded text-sm">{API_BASE_URL || `${window.location.protocol === 'https:' ? 'https' : 'http'}://localhost:8000`}/api/v1</code>
                      </div>
                      <div>
                        <div className="text-sm font-medium text-slate-700 mb-1">Authentication</div>
                        <div className="p-3 bg-slate-50 rounded text-sm">
                          <div className="mb-2">Include your API key in the Authorization header:</div>
                          <code className="block p-2 bg-slate-100 rounded">Authorization: Bearer &lt;your-api-key&gt;</code>
                        </div>
                      </div>
                      <div>
                        <div className="text-sm font-medium text-slate-700 mb-1">Getting Your API Key</div>
                        <div className="p-3 bg-blue-50 rounded text-sm text-slate-700">
                          <p className="mb-2">1. Check the backend console for the auto-generated default key (development only)</p>
                          <p className="mb-2">2. Or set <code className="bg-white px-1 rounded">API_KEYS</code> in your <code className="bg-white px-1 rounded">backend/.env</code> file</p>
                          <p>3. Multiple API keys can be comma-separated</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Quick Links */}
                  <div className="border rounded-lg p-6 bg-white shadow-sm">
                    <h4 className="font-semibold text-slate-800 mb-4 flex items-center gap-2">
                      <Activity className="w-5 h-5 text-slate-600" />
                      Quick API Endpoints
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div className="p-3 border rounded-lg">
                        <div className="text-xs font-semibold text-slate-600 mb-1">POST</div>
                        <code className="text-sm">/api/v1/customers</code>
                        <div className="text-xs text-slate-600 mt-1">Create a new customer</div>
                      </div>
                      <div className="p-3 border rounded-lg">
                        <div className="text-xs font-semibold text-green-600 mb-1">GET</div>
                        <code className="text-sm">/api/v1/customers</code>
                        <div className="text-xs text-slate-600 mt-1">List all customers</div>
                      </div>
                      <div className="p-3 border rounded-lg">
                        <div className="text-xs font-semibold text-slate-600 mb-1">POST</div>
                        <code className="text-sm">/api/v1/calls/schedule</code>
                        <div className="text-xs text-slate-600 mt-1">Schedule verification calls</div>
                      </div>
                      <div className="p-3 border rounded-lg">
                        <div className="text-xs font-semibold text-green-600 mb-1">GET</div>
                        <code className="text-sm">/api/v1/calls/results/completed</code>
                        <div className="text-xs text-slate-600 mt-1">Get completed call results</div>
                      </div>
                      <div className="p-3 border rounded-lg">
                        <div className="text-xs font-semibold text-green-600 mb-1">GET</div>
                        <code className="text-sm">/api/v1/stats</code>
                        <div className="text-xs text-slate-600 mt-1">Get system statistics</div>
                      </div>
                      <div className="p-3 border rounded-lg">
                        <div className="text-xs font-semibold text-slate-600 mb-1">POST</div>
                        <code className="text-sm">/api/v1/webhooks/custom</code>
                        <div className="text-xs text-slate-600 mt-1">Custom webhook endpoint</div>
                      </div>
                    </div>
                  </div>

                  {/* Integration Guides */}
                  <div className="border rounded-lg p-6 bg-white shadow-sm">
                    <h4 className="font-semibold text-slate-800 mb-4 flex items-center gap-2">
                      <Users className="w-5 h-5 text-slate-600" />
                      Integration Guides
                    </h4>
                    <div className="space-y-3">
                      <div className="p-3 bg-slate-50 rounded">
                        <div className="font-medium text-slate-800 mb-1">n8n Integration</div>
                        <div className="text-sm text-slate-600">
                          Use the HTTP Request node with POST/GET methods. Set Authorization header with your API key.
                        </div>
                      </div>
                      <div className="p-3 bg-slate-50 rounded">
                        <div className="font-medium text-slate-800 mb-1">Zapier Integration</div>
                        <div className="text-sm text-slate-600">
                          Use "Webhooks by Zapier" action. Add Authorization header: <code className="bg-white px-1 rounded">Bearer &lt;api-key&gt;</code>
                        </div>
                      </div>
                      <div className="p-3 bg-slate-50 rounded">
                        <div className="font-medium text-slate-800 mb-1">Make.com (Integromat)</div>
                        <div className="text-sm text-slate-600">
                          Use HTTP module with Authorization header. Map your data fields to the API request body.
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Documentation File */}
                  <div className="border rounded-lg p-6 bg-white shadow-sm">
                    <h4 className="font-semibold text-slate-800 mb-4 flex items-center gap-2">
                      <FileText className="w-5 h-5 text-slate-600" />
                      Full Documentation
                    </h4>
                    <p className="text-slate-600 mb-3">
                      Complete API documentation with examples, request/response formats, and integration guides is available in:
                    </p>
                    <code className="block p-2 bg-slate-100 rounded text-sm">backend/API_DOCUMENTATION.md</code>
                  </div>
                </div>
              </div>
            )}

          </div>

        </div>

    </DashboardLayout>

  );

};

export default OutcallingApp;

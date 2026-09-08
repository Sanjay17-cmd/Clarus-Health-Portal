import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Upload, FileText, Search, CheckCircle, Clock,
  FlaskConical, FolderOpen, AlertCircle,
} from 'lucide-react';
import GlassCard from '../../components/ui/GlassCard';
import StatCard from '../../components/ui/StatCard';
import Badge from '../../components/ui/Badge';
import Button from '../../components/ui/Button';
import DataTable from '../../components/ui/DataTable';
import FileUpload from '../../components/shared/FileUpload';
import api from '../../api/client';

const departments = [
  'Pathology', 'Radiology', 'Cardiology', 'Endocrinology',
  'Neurology', 'Oncology', 'Hematology', 'Microbiology',
];

export default function LabTechDashboard() {
  const [reports, setReports] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'upload' | 'history'>('upload');

  // Upload form state
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [patientId, setPatientId] = useState('');
  const [title, setTitle] = useState('');
  const [department, setDepartment] = useState('');
  const [notes, setNotes] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const [uploadError, setUploadError] = useState('');

  // Patient search
  const [patientSearch, setPatientSearch] = useState('');
  const [patientResults, setPatientResults] = useState<any[]>([]);
  const [searchingPatients, setSearchingPatients] = useState(false);

  useEffect(() => {
    fetchReports();
  }, []);

  const fetchReports = async () => {
    try {
      const res = await api.get('/reports');
      setReports(res.data.reports);
    } catch (err) {
      console.error('Failed to fetch reports:', err);
    } finally {
      setLoading(false);
    }
  };

  const searchPatients = async (query: string) => {
    setPatientSearch(query);
    if (query.length < 2) {
      setPatientResults([]);
      return;
    }
    setSearchingPatients(true);
    try {
      const res = await api.get(`/users/patients?search=${encodeURIComponent(query)}`);
      setPatientResults(res.data.patients);
    } catch (err) {
      console.error('Patient search failed:', err);
    } finally {
      setSearchingPatients(false);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile || !patientId || !title || !department) {
      setUploadError('Please fill all required fields and select a file.');
      return;
    }

    setUploading(true);
    setUploadError('');
    setUploadSuccess(false);

    try {
      const formData = new FormData();
      formData.append('file', selectedFile);
      formData.append('patient_id', patientId);
      formData.append('title', title);
      formData.append('department', department);
      formData.append('notes', notes);

      await api.post('/reports/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      setUploadSuccess(true);
      setSelectedFile(null);
      setPatientId('');
      setTitle('');
      setDepartment('');
      setNotes('');
      setPatientSearch('');
      setPatientResults([]);
      fetchReports();

      setTimeout(() => setUploadSuccess(false), 4000);
    } catch (err: any) {
      setUploadError(err.response?.data?.message || 'Upload failed.');
    } finally {
      setUploading(false);
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString('en-US', {
      month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
    });
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1048576).toFixed(1)} MB`;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-2xl font-bold text-navy-500">Lab Technician Dashboard</h1>
        <p className="text-sm text-slate-400 mt-1">Upload and manage medical reports</p>
      </motion.div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard label="My Uploads" value={reports.length} icon={<Upload className="w-5 h-5" />} color="azure" delay={0} />
        <StatCard
          label="Verified"
          value={reports.filter(r => r.status === 'Verified').length}
          icon={<CheckCircle className="w-5 h-5" />}
          color="teal"
          delay={0.08}
        />
        <StatCard
          label="Pending Review"
          value={reports.filter(r => r.status === 'Pending').length}
          icon={<Clock className="w-5 h-5" />}
          color="amber"
          delay={0.16}
        />
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 p-1 bg-slate-100/60 rounded-xl w-fit">
        {(['upload', 'history'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-5 py-2 rounded-lg text-sm font-semibold transition-all duration-200 flex items-center gap-2 ${
              activeTab === tab
                ? 'bg-white text-navy-500 shadow-sm'
                : 'text-slate-500 hover:text-navy-400'
            }`}
          >
            {tab === 'upload' ? <Upload className="w-4 h-4" /> : <FolderOpen className="w-4 h-4" />}
            {tab === 'upload' ? 'Upload Report' : 'Upload History'}
          </button>
        ))}
      </div>

      {/* Upload Tab */}
      {activeTab === 'upload' && (
        <GlassCard>
          {uploadSuccess && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-6 flex items-center gap-3 p-4 bg-teal-50 rounded-xl border border-teal-100"
            >
              <CheckCircle className="w-5 h-5 text-teal-600 shrink-0" />
              <p className="text-sm font-semibold text-teal-700">Report uploaded successfully!</p>
            </motion.div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Left — Form */}
            <div className="space-y-5">
              <h3 className="text-sm font-bold text-navy-500 uppercase tracking-wider">Report Details</h3>

              {/* Patient ID Lookup */}
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-2">Patient *</label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    value={patientSearch}
                    onChange={(e) => searchPatients(e.target.value)}
                    placeholder="Search patient by name or email..."
                    className="input-glass pl-10"
                  />
                </div>
                {patientResults.length > 0 && (
                  <div className="mt-1 bg-white rounded-xl border border-slate-100 shadow-glass max-h-40 overflow-y-auto">
                    {patientResults.map((p) => (
                      <button
                        key={p.id}
                        onClick={() => {
                          setPatientId(String(p.id));
                          setPatientSearch(p.full_name);
                          setPatientResults([]);
                        }}
                        className="w-full text-left px-4 py-2.5 text-sm hover:bg-azure-50/50 transition-colors border-b border-slate-50 last:border-0"
                      >
                        <span className="font-semibold text-navy-500">{p.full_name}</span>
                        <span className="text-xs text-slate-400 ml-2">ID: {p.id} • {p.email}</span>
                      </button>
                    ))}
                  </div>
                )}
                {patientId && (
                  <p className="mt-1 text-[11px] text-teal-600 font-medium">Patient ID: {patientId}</p>
                )}
              </div>

              {/* Title */}
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-2">Report Title *</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g., Complete Blood Count — September 2026"
                  className="input-glass"
                />
              </div>

              {/* Department */}
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-2">Department *</label>
                <select
                  value={department}
                  onChange={(e) => setDepartment(e.target.value)}
                  className="input-glass cursor-pointer"
                >
                  <option value="">Select department...</option>
                  {departments.map((d) => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-2">Clinical Notes</label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                  placeholder="Optional notes or observations..."
                  className="input-glass resize-none"
                />
              </div>
            </div>

            {/* Right — File Upload */}
            <div className="space-y-5">
              <h3 className="text-sm font-bold text-navy-500 uppercase tracking-wider">File Upload</h3>
              <FileUpload
                onFileSelect={setSelectedFile}
                selectedFile={selectedFile}
                onClear={() => setSelectedFile(null)}
              />

              {uploadError && (
                <div className="flex items-center gap-2 p-3 bg-red-50 rounded-xl border border-red-100 text-red-600 text-xs font-medium">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  {uploadError}
                </div>
              )}

              <Button
                variant="primary"
                size="lg"
                icon={<Upload className="w-4 h-4" />}
                loading={uploading}
                onClick={handleUpload}
                className="w-full"
              >
                Upload Report
              </Button>
            </div>
          </div>
        </GlassCard>
      )}

      {/* History Tab */}
      {activeTab === 'history' && (
        <GlassCard>
          <DataTable
            columns={[
              { key: 'title', label: 'Report Title', sortable: true, render: (row: any) => (
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-azure-400 shrink-0" />
                  <span className="font-medium text-navy-500 truncate max-w-[200px]">{row.title}</span>
                </div>
              )},
              { key: 'patient_name', label: 'Patient', sortable: true },
              { key: 'department', label: 'Department' },
              { key: 'status', label: 'Status', render: (row: any) => <Badge status={row.status} /> },
              { key: 'file_size', label: 'Size', render: (row: any) => <span className="text-xs text-slate-400">{formatSize(row.file_size)}</span> },
              { key: 'created_at', label: 'Uploaded', sortable: true, render: (row: any) => (
                <span className="text-xs text-slate-400">{formatDate(row.created_at)}</span>
              )},
            ]}
            data={reports}
            searchable
            searchKeys={['title', 'patient_name', 'department']}
            emptyMessage="No uploads yet."
          />
        </GlassCard>
      )}
    </div>
  );
}

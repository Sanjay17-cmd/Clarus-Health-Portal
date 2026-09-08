import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search, Users, FileText, Eye, KeyRound,
  ChevronRight, Stethoscope, CheckCircle, Clock,
} from 'lucide-react';
import GlassCard from '../../components/ui/GlassCard';
import StatCard from '../../components/ui/StatCard';
import Badge from '../../components/ui/Badge';
import Button from '../../components/ui/Button';
import Modal from '../../components/ui/Modal';
import ReportTimeline from '../../components/shared/ReportTimeline';
import api from '../../api/client';

interface Patient {
  id: number;
  full_name: string;
  email: string;
  phone: string;
  report_count: number;
  last_report_date: string | null;
}

export default function DoctorWorkspace() {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [search, setSearch] = useState('');
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [patientReports, setPatientReports] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [reportsLoading, setReportsLoading] = useState(false);

  // Break-Glass Modal
  const [breakGlassOpen, setBreakGlassOpen] = useState(false);
  const [shareToken, setShareToken] = useState('');
  const [tokenResult, setTokenResult] = useState<any>(null);
  const [tokenError, setTokenError] = useState('');
  const [tokenLoading, setTokenLoading] = useState(false);

  useEffect(() => {
    fetchPatients();
  }, []);

  const fetchPatients = async (query?: string) => {
    try {
      const params = query ? `?search=${encodeURIComponent(query)}` : '';
      const res = await api.get(`/users/patients${params}`);
      setPatients(res.data.patients);
    } catch (err) {
      console.error('Failed to fetch patients:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (value: string) => {
    setSearch(value);
    fetchPatients(value);
  };

  const handleSelectPatient = async (patient: Patient) => {
    setSelectedPatient(patient);
    setReportsLoading(true);
    try {
      const res = await api.get(`/reports?patient_id=${patient.id}`);
      setPatientReports(res.data.reports);
    } catch (err) {
      console.error('Failed to fetch patient reports:', err);
    } finally {
      setReportsLoading(false);
    }
  };

  const handleDownload = async (reportId: number) => {
    try {
      const res = await api.get(`/reports/${reportId}/download`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.download = `report-${reportId}.pdf`;
      link.click();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Download failed:', err);
    }
  };

  const handleVerifyToken = async () => {
    if (!shareToken.trim()) return;
    setTokenLoading(true);
    setTokenError('');
    setTokenResult(null);
    try {
      const res = await api.get(`/share/verify/${shareToken.trim()}`);
      setTokenResult(res.data);
    } catch (err: any) {
      setTokenError(err.response?.data?.message || 'Invalid or expired token.');
    } finally {
      setTokenLoading(false);
    }
  };

  const handleStatusChange = async (reportId: number, status: string) => {
    try {
      await api.patch(`/reports/${reportId}/status`, { status });
      setPatientReports(patientReports.map(r =>
        r.id === reportId ? { ...r, status } : r
      ));
    } catch (err) {
      console.error('Status update failed:', err);
    }
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return 'No reports';
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric',
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-3 border-azure-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="text-2xl font-bold text-navy-500">Doctor Workspace</h1>
          <p className="text-sm text-slate-400 mt-1">Patient records and report management</p>
        </motion.div>
        <Button
          variant="secondary"
          icon={<KeyRound className="w-4 h-4" />}
          onClick={() => setBreakGlassOpen(true)}
        >
          Enter Share Token
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard label="Total Patients" value={patients.length} icon={<Users className="w-5 h-5" />} color="azure" delay={0} />
        <StatCard label="Selected Patient" value={selectedPatient?.full_name || '—'} icon={<Stethoscope className="w-5 h-5" />} color="teal" delay={0.08} />
        <StatCard label="Patient Reports" value={selectedPatient ? patientReports.length : '—'} icon={<FileText className="w-5 h-5" />} color="navy" delay={0.16} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Patient List */}
        <div className="lg:col-span-4">
          <GlassCard padding="none">
            <div className="p-4 border-b border-slate-100/60">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search patients..."
                  value={search}
                  onChange={(e) => handleSearch(e.target.value)}
                  className="input-glass pl-10 py-2.5"
                />
              </div>
            </div>
            <div className="max-h-[500px] overflow-y-auto">
              {patients.length === 0 ? (
                <div className="text-center py-12 text-slate-400 text-sm">No patients found.</div>
              ) : (
                patients.map((patient, idx) => (
                  <motion.button
                    key={patient.id}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: idx * 0.04 }}
                    onClick={() => handleSelectPatient(patient)}
                    className={`w-full text-left px-5 py-4 border-b border-slate-50 transition-all duration-200 flex items-center gap-3 group ${
                      selectedPatient?.id === patient.id
                        ? 'bg-azure-50/50 border-l-2 border-l-azure-500'
                        : 'hover:bg-slate-50/50'
                    }`}
                  >
                    <div className="w-10 h-10 rounded-full bg-azure-100 flex items-center justify-center text-azure-700 font-bold text-sm shrink-0">
                      {patient.full_name.charAt(0)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-navy-500 truncate">{patient.full_name}</p>
                      <p className="text-[11px] text-slate-400">{patient.report_count} reports • Last: {formatDate(patient.last_report_date)}</p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-azure-400 transition-colors shrink-0" />
                  </motion.button>
                ))
              )}
            </div>
          </GlassCard>
        </div>

        {/* Report Panel */}
        <div className="lg:col-span-8">
          <GlassCard>
            {!selectedPatient ? (
              <div className="text-center py-20">
                <Users className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                <p className="text-sm font-medium text-slate-400">Select a patient to view their reports</p>
              </div>
            ) : reportsLoading ? (
              <div className="flex items-center justify-center py-20">
                <div className="w-8 h-8 border-3 border-azure-500 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : (
              <div>
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h3 className="text-lg font-bold text-navy-500">{selectedPatient.full_name}</h3>
                    <p className="text-xs text-slate-400">{selectedPatient.email} • {selectedPatient.phone}</p>
                  </div>
                </div>

                {/* Status actions */}
                {patientReports.length > 0 && (
                  <div className="mb-6 p-4 bg-slate-50/50 rounded-xl border border-slate-100/60">
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Quick Status Update</p>
                    <div className="flex flex-wrap gap-2">
                      {patientReports.filter(r => r.status === 'Pending').map(r => (
                        <div key={r.id} className="flex items-center gap-2 bg-white rounded-lg px-3 py-2 shadow-sm border border-slate-100">
                          <span className="text-xs font-medium text-navy-500 truncate max-w-[160px]">{r.title}</span>
                          <button
                            onClick={() => handleStatusChange(r.id, 'Verified')}
                            className="p-1 rounded-md bg-teal-50 text-teal-600 hover:bg-teal-100 transition-colors"
                            title="Verify"
                          >
                            <CheckCircle className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                      {patientReports.filter(r => r.status === 'Pending').length === 0 && (
                        <span className="text-xs text-slate-400">All reports are reviewed.</span>
                      )}
                    </div>
                  </div>
                )}

                <ReportTimeline reports={patientReports} onDownload={handleDownload} />
              </div>
            )}
          </GlassCard>
        </div>
      </div>

      {/* Break-Glass / Share-Token Modal */}
      <Modal
        isOpen={breakGlassOpen}
        onClose={() => { setBreakGlassOpen(false); setTokenResult(null); setTokenError(''); setShareToken(''); }}
        title="Access Shared Record"
        subtitle="Enter a share token to access a restricted report"
      >
        <div className="space-y-4">
          {!tokenResult ? (
            <>
              <div className="relative">
                <KeyRound className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  value={shareToken}
                  onChange={(e) => setShareToken(e.target.value)}
                  placeholder="Paste share token here..."
                  className="input-glass pl-11 font-mono text-xs"
                />
              </div>
              {tokenError && (
                <p className="text-xs font-medium text-red-500">{tokenError}</p>
              )}
              <Button
                variant="primary"
                icon={<Eye className="w-4 h-4" />}
                loading={tokenLoading}
                onClick={handleVerifyToken}
                className="w-full"
              >
                Verify & Access
              </Button>
            </>
          ) : (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
              <div className="p-4 bg-teal-50 rounded-xl border border-teal-100">
                <p className="text-xs font-bold text-teal-700 mb-2">Report Unlocked</p>
                <h4 className="text-base font-bold text-navy-500">{tokenResult.report.title}</h4>
                <p className="text-xs text-slate-500 mt-1">{tokenResult.report.department} • {tokenResult.report.patient_name}</p>
                {tokenResult.report.notes && (
                  <p className="text-xs text-slate-400 mt-2">{tokenResult.report.notes}</p>
                )}
              </div>
              <div className="flex items-center gap-4 text-xs text-slate-400">
                <span>Views: {tokenResult.share.views_used}/{tokenResult.share.max_views}</span>
                <span>Expires: {new Date(tokenResult.share.expires_at).toLocaleString()}</span>
              </div>
              <Badge status={tokenResult.report.status} />
            </motion.div>
          )}
        </div>
      </Modal>
    </div>
  );
}

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  FileText, Share2, Download, Link2, Eye,
  Clock, CheckCircle, QrCode, Shield,
} from 'lucide-react';
import GlassCard from '../../components/ui/GlassCard';
import StatCard from '../../components/ui/StatCard';
import Badge from '../../components/ui/Badge';
import Button from '../../components/ui/Button';
import ReportTimeline from '../../components/shared/ReportTimeline';
import ShareModal from '../../components/shared/ShareModal';
import QRCodeDisplay from '../../components/shared/QRCodeDisplay';
import Modal from '../../components/ui/Modal';
import api from '../../api/client';

export default function PatientPortal() {
  const [reports, setReports] = useState<any[]>([]);
  const [shareLinks, setShareLinks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'reports' | 'shares'>('reports');

  // Share modal
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [selectedReportId, setSelectedReportId] = useState<number | null>(null);
  const [selectedReportTitle, setSelectedReportTitle] = useState('');

  // QR modal
  const [qrModalOpen, setQrModalOpen] = useState(false);
  const [qrToken, setQrToken] = useState('');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [reportsRes, linksRes] = await Promise.all([
        api.get('/reports'),
        api.get('/share/my-links'),
      ]);
      setReports(reportsRes.data.reports);
      setShareLinks(linksRes.data.links);
    } catch (err) {
      console.error('Failed to fetch data:', err);
    } finally {
      setLoading(false);
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

  const handleShare = (reportId: number) => {
    const report = reports.find(r => r.id === reportId);
    setSelectedReportId(reportId);
    setSelectedReportTitle(report?.title || '');
    setShareModalOpen(true);
  };

  const handleShowQR = (token: string) => {
    setQrToken(token);
    setQrModalOpen(true);
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit',
    });
  };

  const isExpired = (dateStr: string) => new Date(dateStr) < new Date();

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
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-2xl font-bold text-navy-500">My Health Portal</h1>
        <p className="text-sm text-slate-400 mt-1">View, download, and securely share your medical reports</p>
      </motion.div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatCard label="Total Reports" value={reports.length} icon={<FileText className="w-5 h-5" />} color="azure" delay={0} />
        <StatCard
          label="Verified"
          value={reports.filter(r => r.status === 'Verified').length}
          icon={<CheckCircle className="w-5 h-5" />}
          color="teal"
          delay={0.08}
        />
        <StatCard
          label="Active Shares"
          value={shareLinks.filter(l => l.is_active && !isExpired(l.expires_at)).length}
          icon={<Share2 className="w-5 h-5" />}
          color="amber"
          delay={0.16}
        />
        <StatCard
          label="Pending"
          value={reports.filter(r => r.status === 'Pending').length}
          icon={<Clock className="w-5 h-5" />}
          color="navy"
          delay={0.24}
        />
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 p-1 bg-slate-100/60 rounded-xl w-fit">
        {(['reports', 'shares'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-5 py-2 rounded-lg text-sm font-semibold transition-all duration-200 flex items-center gap-2 ${
              activeTab === tab
                ? 'bg-white text-navy-500 shadow-sm'
                : 'text-slate-500 hover:text-navy-400'
            }`}
          >
            {tab === 'reports' ? <FileText className="w-4 h-4" /> : <Link2 className="w-4 h-4" />}
            {tab === 'reports' ? 'My Reports' : 'Shared Links'}
          </button>
        ))}
      </div>

      {/* Reports Tab */}
      {activeTab === 'reports' && (
        <GlassCard>
          <ReportTimeline
            reports={reports}
            onDownload={handleDownload}
            onShare={handleShare}
            showShareButton
          />
        </GlassCard>
      )}

      {/* Shares Tab */}
      {activeTab === 'shares' && (
        <GlassCard>
          {shareLinks.length === 0 ? (
            <div className="text-center py-16">
              <Share2 className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <p className="text-sm font-medium text-slate-400">No share links created yet.</p>
              <p className="text-xs text-slate-300 mt-1">Go to "My Reports" and click "Share" to create one.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {shareLinks.map((link, idx) => {
                const expired = isExpired(link.expires_at);
                const exhausted = link.current_views >= link.max_views;
                const inactive = !link.is_active || expired || exhausted;

                return (
                  <motion.div
                    key={link.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.06 }}
                    className={`glass-card-sm p-4 flex items-center gap-4 ${inactive ? 'opacity-60' : ''}`}
                  >
                    <div className={`p-2.5 rounded-xl ${inactive ? 'bg-slate-100' : 'bg-azure-50'}`}>
                      <Link2 className={`w-5 h-5 ${inactive ? 'text-slate-400' : 'text-azure-600'}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-navy-500 truncate">{link.report_title}</p>
                      <div className="flex items-center gap-3 mt-1 text-[11px] text-slate-400">
                        <span className="flex items-center gap-1">
                          <Eye className="w-3 h-3" />
                          {link.current_views}/{link.max_views} views
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {expired ? 'Expired' : `Expires ${formatDate(link.expires_at)}`}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {!inactive && (
                        <>
                          <Button
                            variant="ghost"
                            size="sm"
                            icon={<QrCode className="w-3.5 h-3.5" />}
                            onClick={() => handleShowQR(link.token)}
                          >
                            QR
                          </Button>
                          <motion.button
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            onClick={() => {
                              navigator.clipboard.writeText(link.token);
                            }}
                            className="p-2 rounded-lg text-slate-400 hover:text-azure-600 hover:bg-azure-50 transition-colors"
                            title="Copy token"
                          >
                            <Shield className="w-4 h-4" />
                          </motion.button>
                        </>
                      )}
                      <span className={`px-2 py-1 rounded-full text-[10px] font-bold ${
                        inactive
                          ? 'bg-slate-100 text-slate-500'
                          : 'bg-teal-50 text-teal-700'
                      }`}>
                        {inactive ? (expired ? 'Expired' : exhausted ? 'Exhausted' : 'Inactive') : 'Active'}
                      </span>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </GlassCard>
      )}

      {/* Share Modal */}
      <ShareModal
        isOpen={shareModalOpen}
        onClose={() => { setShareModalOpen(false); fetchData(); }}
        reportId={selectedReportId}
        reportTitle={selectedReportTitle}
      />

      {/* QR Code Modal */}
      <Modal
        isOpen={qrModalOpen}
        onClose={() => setQrModalOpen(false)}
        title="Share QR Code"
        subtitle="Scan this code to access the shared report"
        size="sm"
      >
        <QRCodeDisplay token={qrToken} />
      </Modal>
    </div>
  );
}

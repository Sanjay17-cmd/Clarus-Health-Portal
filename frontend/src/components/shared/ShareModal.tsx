import { useState } from 'react';
import { motion } from 'framer-motion';
import { Copy, Check, Clock, Eye, Link2 } from 'lucide-react';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import api from '../../api/client';

interface ShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  reportId: number | null;
  reportTitle?: string;
}

export default function ShareModal({ isOpen, onClose, reportId, reportTitle }: ShareModalProps) {
  const [expiresInHours, setExpiresInHours] = useState(24);
  const [maxViews, setMaxViews] = useState(5);
  const [loading, setLoading] = useState(false);
  const [shareData, setShareData] = useState<{ token: string; url: string; expires_at: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState('');

  const handleCreate = async () => {
    if (!reportId) return;
    setLoading(true);
    setError('');
    try {
      const res = await api.post('/share/create', {
        report_id: reportId,
        expires_in_hours: expiresInHours,
        max_views: maxViews,
      });
      setShareData(res.data.share);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to create share link.');
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = () => {
    if (shareData?.token) {
      navigator.clipboard.writeText(shareData.token);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleClose = () => {
    setShareData(null);
    setError('');
    setCopied(false);
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Secure Share"
      subtitle={reportTitle ? `Share "${reportTitle}"` : 'Generate a secure share link'}
    >
      {!shareData ? (
        <div className="space-y-5">
          {/* Expiry */}
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
              <Clock className="w-3.5 h-3.5 inline mr-1.5" />
              Link Expiry
            </label>
            <div className="grid grid-cols-4 gap-2">
              {[1, 6, 24, 72].map((h) => (
                <motion.button
                  key={h}
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.97 }}
                  onClick={() => setExpiresInHours(h)}
                  className={`
                    py-2.5 rounded-xl text-sm font-semibold transition-all duration-200
                    ${expiresInHours === h
                      ? 'bg-azure-500 text-white shadow-md'
                      : 'bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-100'
                    }
                  `}
                >
                  {h < 24 ? `${h}h` : `${h / 24}d`}
                </motion.button>
              ))}
            </div>
          </div>

          {/* Max Views */}
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
              <Eye className="w-3.5 h-3.5 inline mr-1.5" />
              Maximum Views
            </label>
            <div className="grid grid-cols-4 gap-2">
              {[1, 3, 5, 10].map((v) => (
                <motion.button
                  key={v}
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.97 }}
                  onClick={() => setMaxViews(v)}
                  className={`
                    py-2.5 rounded-xl text-sm font-semibold transition-all duration-200
                    ${maxViews === v
                      ? 'bg-azure-500 text-white shadow-md'
                      : 'bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-100'
                    }
                  `}
                >
                  {v} {v === 1 ? 'view' : 'views'}
                </motion.button>
              ))}
            </div>
          </div>

          {error && (
            <p className="text-xs font-medium text-red-500">{error}</p>
          )}

          <Button
            variant="primary"
            size="lg"
            icon={<Link2 className="w-4 h-4" />}
            loading={loading}
            onClick={handleCreate}
            className="w-full"
          >
            Generate Secure Link
          </Button>
        </div>
      ) : (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-5"
        >
          <div className="text-center">
            <div className="w-14 h-14 rounded-2xl bg-teal-50 flex items-center justify-center mx-auto mb-3">
              <Check className="w-7 h-7 text-teal-600" />
            </div>
            <h4 className="text-base font-bold text-navy-500">Link Generated!</h4>
            <p className="text-xs text-slate-400 mt-1">Share this token securely with the recipient</p>
          </div>

          {/* Token Display */}
          <div className="relative">
            <div className="bg-slate-50 rounded-xl p-4 border border-slate-100 font-mono text-xs text-slate-600 break-all leading-relaxed">
              {shareData.token}
            </div>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={handleCopy}
              className="absolute top-3 right-3 p-2 rounded-lg bg-white shadow-sm border border-slate-100 text-slate-500 hover:text-azure-600 transition-colors"
            >
              {copied ? <Check className="w-4 h-4 text-teal-600" /> : <Copy className="w-4 h-4" />}
            </motion.button>
          </div>

          {/* Meta info */}
          <div className="flex items-center justify-center gap-6 text-xs text-slate-400">
            <span className="flex items-center gap-1">
              <Clock className="w-3.5 h-3.5" />
              Expires: {new Date(shareData.expires_at).toLocaleString()}
            </span>
            <span className="flex items-center gap-1">
              <Eye className="w-3.5 h-3.5" />
              Max views: {maxViews}
            </span>
          </div>

          <Button variant="secondary" onClick={handleClose} className="w-full">
            Done
          </Button>
        </motion.div>
      )}
    </Modal>
  );
}

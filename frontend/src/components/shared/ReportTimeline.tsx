import { motion } from 'framer-motion';
import { FileText, Download, Share2, CheckCircle, Clock, AlertTriangle } from 'lucide-react';
import Badge from '../ui/Badge';
import Button from '../ui/Button';

interface Report {
  id: number;
  title: string;
  department: string;
  status: string;
  file_type: string;
  file_size: number;
  notes: string | null;
  created_at: string;
  uploader_name?: string;
}

interface ReportTimelineProps {
  reports: Report[];
  onDownload?: (id: number) => void;
  onShare?: (id: number) => void;
  showShareButton?: boolean;
}

export default function ReportTimeline({
  reports,
  onDownload,
  onShare,
  showShareButton = false,
}: ReportTimelineProps) {
  const statusIcons: Record<string, React.ReactNode> = {
    Verified: <CheckCircle className="w-4 h-4 text-teal-500" />,
    Pending:  <Clock className="w-4 h-4 text-amber-500" />,
    Flagged:  <AlertTriangle className="w-4 h-4 text-red-500" />,
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1048576).toFixed(1)} MB`;
  };

  if (reports.length === 0) {
    return (
      <div className="text-center py-16">
        <FileText className="w-12 h-12 text-slate-300 mx-auto mb-3" />
        <p className="text-sm font-medium text-slate-400">No reports available yet.</p>
      </div>
    );
  }

  return (
    <div className="relative">
      {/* Vertical line */}
      <div className="absolute left-6 top-0 bottom-0 w-px bg-gradient-to-b from-azure-200 via-slate-200 to-transparent" />

      <div className="space-y-4">
        {reports.map((report, idx) => (
          <motion.div
            key={report.id}
            initial={{ opacity: 0, x: -16 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: idx * 0.08, duration: 0.4 }}
            className="relative pl-14"
          >
            {/* Timeline dot */}
            <div className="absolute left-[18px] top-5 w-3 h-3 rounded-full border-2 border-white shadow-sm bg-azure-400 ring-4 ring-azure-50" />

            <div className="glass-card-sm p-5 hover:shadow-glass transition-shadow duration-300">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h4 className="text-sm font-bold text-navy-500 truncate">{report.title}</h4>
                    <Badge status={report.status} size="sm" />
                  </div>
                  <div className="flex items-center gap-3 text-xs text-slate-400">
                    <span>{report.department}</span>
                    <span>•</span>
                    <span>{formatDate(report.created_at)}</span>
                    <span>•</span>
                    <span>{formatSize(report.file_size)}</span>
                  </div>
                  {report.notes && (
                    <p className="mt-2 text-xs text-slate-500 line-clamp-2">{report.notes}</p>
                  )}
                  {report.uploader_name && (
                    <p className="mt-1.5 text-[11px] text-slate-400">
                      Uploaded by <span className="font-medium text-slate-500">{report.uploader_name}</span>
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {onDownload && (
                    <Button
                      variant="secondary"
                      size="sm"
                      icon={<Download className="w-3.5 h-3.5" />}
                      onClick={() => onDownload(report.id)}
                    >
                      Download
                    </Button>
                  )}
                  {showShareButton && onShare && (
                    <Button
                      variant="ghost"
                      size="sm"
                      icon={<Share2 className="w-3.5 h-3.5" />}
                      onClick={() => onShare(report.id)}
                    >
                      Share
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

import { motion } from 'framer-motion';
import { Upload, FileText, X, Image, CheckCircle } from 'lucide-react';
import React, { useState, useCallback, useRef } from 'react';

interface FileUploadProps {
  onFileSelect: (file: File) => void;
  accept?: string;
  maxSizeMB?: number;
  selectedFile?: File | null;
  onClear?: () => void;
}

export default function FileUpload({
  onFileSelect,
  accept = '.pdf,.jpg,.jpeg,.png',
  maxSizeMB = 10,
  selectedFile,
  onClear,
}: FileUploadProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const validateFile = useCallback((file: File) => {
    const allowedTypes = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png'];
    if (!allowedTypes.includes(file.type)) {
      setError('Invalid file type. Accepted: PDF, JPG, PNG.');
      return false;
    }
    if (file.size > maxSizeMB * 1024 * 1024) {
      setError(`File too large. Maximum: ${maxSizeMB}MB.`);
      return false;
    }
    setError('');
    return true;
  }, [maxSizeMB]);

  const handleFile = useCallback((file: File) => {
    if (validateFile(file)) {
      onFileSelect(file);
    }
  }, [validateFile, onFileSelect]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, [handleFile]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const getFileIcon = (type: string) => {
    if (type.startsWith('image/')) return <Image className="w-8 h-8 text-azure-500" />;
    return <FileText className="w-8 h-8 text-azure-500" />;
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1048576).toFixed(1)} MB`;
  };

  if (selectedFile) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="glass-card-sm p-4 flex items-center gap-4"
      >
        <div className="p-3 rounded-xl bg-azure-50">
          {getFileIcon(selectedFile.type)}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-navy-500 truncate">{selectedFile.name}</p>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-xs text-slate-400">{formatSize(selectedFile.size)}</span>
            <span className="text-xs text-teal-600 flex items-center gap-1">
              <CheckCircle className="w-3 h-3" /> Ready to upload
            </span>
          </div>
        </div>
        {onClear && (
          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={onClear}
            className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors"
          >
            <X className="w-4 h-4" />
          </motion.button>
        )}
      </motion.div>
    );
  }

  return (
    <div>
      <motion.div
        whileHover={{ scale: 1.01 }}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={() => setIsDragging(false)}
        onClick={() => inputRef.current?.click()}
        className={`
          relative cursor-pointer rounded-2xl border-2 border-dashed p-8
          flex flex-col items-center justify-center gap-3 transition-all duration-300
          ${isDragging
            ? 'border-azure-400 bg-azure-50/50 shadow-glass'
            : 'border-slate-200/80 bg-white/40 hover:border-azure-300 hover:bg-azure-50/20'
          }
        `}
      >
        <div className={`p-4 rounded-2xl transition-colors duration-300 ${isDragging ? 'bg-azure-100' : 'bg-slate-50'}`}>
          <Upload className={`w-8 h-8 transition-colors duration-300 ${isDragging ? 'text-azure-600' : 'text-slate-400'}`} />
        </div>
        <div className="text-center">
          <p className="text-sm font-semibold text-navy-500">
            {isDragging ? 'Drop your file here' : 'Drag & drop your file here'}
          </p>
          <p className="text-xs text-slate-400 mt-1">
            or <span className="text-azure-500 font-medium">browse files</span> • PDF, JPG, PNG up to {maxSizeMB}MB
          </p>
        </div>
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFile(file);
            e.target.value = '';
          }}
          className="hidden"
        />
      </motion.div>
      {error && (
        <motion.p
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-2 text-xs font-medium text-red-500 pl-1"
        >
          {error}
        </motion.p>
      )}
    </div>
  );
}

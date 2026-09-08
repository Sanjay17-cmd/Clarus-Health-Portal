import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { QRCodeSVG } from 'qrcode.react';
import { Download } from 'lucide-react';
import api from '../../api/client';
import Button from '../ui/Button';

interface QRCodeDisplayProps {
  token: string;
  size?: number;
}

export default function QRCodeDisplay({ token, size = 200 }: QRCodeDisplayProps) {
  const [qrUrl, setQrUrl] = useState('');

  useEffect(() => {
    // Build the verification URL
    const baseUrl = window.location.origin;
    setQrUrl(`${baseUrl}/api/share/verify/${token}`);
  }, [token]);

  const handleDownloadQR = () => {
    const svgElement = document.getElementById(`qr-${token}`);
    if (!svgElement) return;

    const svgData = new XMLSerializer().serializeToString(svgElement);
    const canvas = document.createElement('canvas');
    canvas.width = size * 2;
    canvas.height = size * 2;
    const ctx = canvas.getContext('2d');

    const img = new window.Image();
    img.onload = () => {
      ctx?.drawImage(img, 0, 0, size * 2, size * 2);
      const link = document.createElement('a');
      link.download = `clarus-share-${token.substring(0, 8)}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    };
    img.src = `data:image/svg+xml;base64,${btoa(svgData)}`;
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      className="flex flex-col items-center gap-4"
    >
      <div className="p-4 bg-white rounded-2xl shadow-glass border border-slate-100">
        <QRCodeSVG
          id={`qr-${token}`}
          value={qrUrl}
          size={size}
          bgColor="#FFFFFF"
          fgColor="#0A2540"
          level="H"
          includeMargin={false}
        />
      </div>
      <p className="text-[11px] text-slate-400 font-mono">{token.substring(0, 16)}...</p>
      <Button
        variant="ghost"
        size="sm"
        icon={<Download className="w-3.5 h-3.5" />}
        onClick={handleDownloadQR}
      >
        Download QR
      </Button>
    </motion.div>
  );
}

'use client';

import React from 'react';
import { X, Download } from 'lucide-react';

interface ImageModalProps {
  isOpen: boolean;
  onClose: () => void;
  imageUrl: string;
  title?: string;
}

const ImageModal: React.FC<ImageModalProps> = ({ isOpen, onClose, imageUrl, title = '图片预览' }) => {
  if (!isOpen) return null;

  const handleDownload = async () => {
    try {
      const res = await fetch(imageUrl, { mode: 'cors' });
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const filename = imageUrl.split('/').pop()?.split('?')[0] || 'generated-image.png';
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      window.open(imageUrl, '_blank');
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[200] p-8">
      <div className="bg-white shadow-2xl w-full max-w-4xl h-full max-h-[80vh] flex flex-col rounded-3xl overflow-hidden border border-white/20">
        <div className="flex items-center justify-between p-4 border-b border-gray-100">
          <h2 className="text-lg font-bold text-gray-900 px-2">{title}</h2>
          <div className="flex items-center gap-3 pr-2">
            <button
              onClick={handleDownload}
              className="flex items-center gap-2 px-4 py-2 text-sm font-bold bg-gray-900 text-white rounded-xl hover:bg-black transition-all active:scale-95 shadow-lg shadow-gray-200"
            >
              <Download size={16} />
              <span>下载</span>
            </button>
            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-xl transition-all"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-hidden bg-gray-50/50 relative group">
          <div className="w-full h-full flex items-center justify-center p-6">
            <img
              src={imageUrl}
              alt="生成的图片"
              className="max-w-full max-h-full object-contain rounded-xl shadow-sm transition-transform duration-500"
            />
          </div>
        </div>

      </div>
    </div>
  );
};

export default ImageModal;

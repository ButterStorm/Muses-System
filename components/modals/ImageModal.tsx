'use client';

import React from 'react';
import { createPortal } from 'react-dom';
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

  return createPortal(
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-[99999] p-4 sm:p-6 md:p-8">
      <div className="bg-white shadow-2xl w-full max-w-5xl h-[90vh] flex flex-col rounded-3xl overflow-hidden border border-white/20">
        <div className="flex items-center justify-between p-4 border-b border-gray-100">
          <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
          <div className="flex items-center gap-2">
            <button
              onClick={handleDownload}
              className="px-4 py-1.5 text-sm bg-slate-800 text-white rounded-full hover:bg-slate-900 transition-all duration-200 shadow-sm flex items-center gap-1.5"
            >
              <Download size={14} />
              <span>下载</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 text-gray-400 hover:text-gray-600 transition-colors"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-hidden bg-gray-50 relative">
          <div className="w-full h-full flex items-center justify-center p-6">
            <img
              src={imageUrl}
              alt="生成的图片"
              className="max-w-full max-h-full object-contain rounded-xl shadow-lg"
            />
          </div>
        </div>

      </div>
    </div>,
    document.body
  );
};

export default ImageModal;

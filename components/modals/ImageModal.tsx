'use client';

import React from 'react';
import { createPortal } from 'react-dom';
import { X, Download } from 'lucide-react';
import { downloadImageUrl } from '@/lib/downloadMedia';
import { useModalFocus } from '@/hooks/useModalFocus';

interface ImageModalProps {
  isOpen: boolean;
  onClose: () => void;
  imageUrl: string;
  title?: string;
}

const ImageModal: React.FC<ImageModalProps> = ({ isOpen, onClose, imageUrl, title = '图片预览' }) => {
  const dialogRef = useModalFocus<HTMLDivElement>(isOpen, onClose);
  if (!isOpen) return null;

  const handleDownload = async () => {
    try {
      await downloadImageUrl(imageUrl);
    } catch (error) {
      console.error('图片下载失败:', error);
    }
  };

  return createPortal(
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-[99999] p-4 sm:p-6 md:p-8">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="image-modal-title"
        tabIndex={-1}
        className="bg-white shadow-2xl w-full max-w-5xl h-[90vh] flex flex-col rounded-3xl overflow-hidden border border-white/20"
      >
        <div className="flex items-center justify-between p-4 border-b border-gray-100">
          <h2 id="image-modal-title" className="text-lg font-semibold text-gray-900">{title}</h2>
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
              aria-label="关闭图片预览"
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

'use client';

type UploadSlot = 'moments' | 'life';

type UploadedFile = {
  id: string;
  url: string;
};

type Props = {
  slot: UploadSlot;
  title: string;
  desc: string;
  icon: string;
  uploads: UploadedFile[];
  maxFiles: number;
  isUploading: boolean;
  onUpload: (slot: UploadSlot, files: File[]) => void;
  onRemove: (slot: UploadSlot, fileId: string) => void;
};

export function UploadSection({ slot, title, desc, icon, uploads, maxFiles, isUploading, onUpload, onRemove }: Props) {
  const inputId = slot === 'moments' ? 'file-moments' : 'file-life';

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (files.length > 0) {
      onUpload(slot, files);
    }
    e.target.value = '';
  };

  return (
    <div className="ref-upload-section">
      <h2 className="step-title ref-step-h2">{title}</h2>
      <p className="step-desc">{desc}</p>
      <div className="ref-upload-cap">
        <span>{uploads.length}/{maxFiles}</span>
      </div>
      <div className="ref-upload-slot">
        {uploads.length > 0 && (
          <div className="ref-upload-thumb-grid">
            {uploads.map((item) => (
              <div key={item.id} className="ref-upload-thumb-card">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={item.url} alt="" className="ref-upload-thumb" />
                <button
                  type="button"
                  className="ref-upload-remove"
                  aria-label="删除图片"
                  onClick={(e) => {
                    e.stopPropagation();
                    onRemove(slot, item.id);
                  }}
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}
        <label
          className={`upload-area ref-upload-dashed${isUploading ? ' ref-upload-busy' : ''}`}
          htmlFor={inputId}
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              document.getElementById(inputId)?.click();
            }
          }}
        >
          <div className="upload-icon">{icon}</div>
          <div className="upload-text">
            {isUploading ? '正在上传…' : '点击添加图片（支持多选）'}
          </div>
          <input
            id={inputId}
            type="file"
            style={{ display: 'none' }}
            accept="image/*"
            multiple
            onChange={handleFileChange}
          />
        </label>
      </div>
    </div>
  );
}

import { useState } from 'react';

export function useCanvasFileUploads(canvasId) {
  const [uploads, setUploads] = useState([]);

  const beginUpload = name => {
    const id = Symbol();
    setUploads(current => [...current, { id, canvasId, name, percent: null }]);
    return {
      onUploadProgress(bytes, total) {
        if (!total) return;
        const percent = Math.min(100, Math.floor(bytes / total * 100));
        setUploads(current => {
          const upload = current.find(entry => entry.id === id);
          if (!upload || upload.percent === percent) return current;
          return current.map(entry => entry === upload ? { ...entry, percent } : entry);
        });
      },
      finish() {
        setUploads(current => current.filter(entry => entry.id !== id));
      },
    };
  };

  return { beginUpload, uploads: uploads.filter(upload => upload.canvasId === canvasId) };
}

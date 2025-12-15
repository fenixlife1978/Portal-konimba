'use client';
import { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { UploadCloud, File as FileIcon } from 'lucide-react';

interface FileUploadProps {
  onFileSelect: (file: File) => void;
  disabled?: boolean;
}

export function FileUpload({ onFileSelect, disabled }: FileUploadProps) {
  const [fileName, setFileName] = useState<string | null>(null);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles && acceptedFiles.length > 0) {
      const file = acceptedFiles[0];
      setFileName(file.name);
      onFileSelect(file);
    }
  }, [onFileSelect]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    multiple: false,
    disabled: disabled,
    accept: {
      'image/png': ['.png'],
      'image/jpeg': ['.jpg', '.jpeg'],
    }
  });

  return (
    <div
      {...getRootProps()}
      className={`
        border-2 border-dashed rounded-lg p-8 text-center cursor-pointer 
        transition-colors duration-200 ease-in-out
        ${isDragActive ? 'border-primary bg-primary/10' : 'border-border hover:border-primary'}
        ${disabled ? 'cursor-not-allowed bg-muted/50 opacity-50' : ''}
      `}
    >
      <input {...getInputProps()} />
      <div className="flex flex-col items-center justify-center gap-4">
        <UploadCloud className={`h-12 w-12 ${isDragActive ? 'text-primary' : 'text-muted-foreground'}`} />
        <div>
          {isDragActive ? (
            <p className="font-semibold text-primary">Suelta el archivo aquí...</p>
          ) : (
            <>
              <p className="font-semibold">Arrastra y suelta un archivo o haz clic para seleccionar</p>
              <p className="text-sm text-muted-foreground">PNG, JPG, o JPEG</p>
            </>
          )}
        </div>
        {fileName && !isDragActive && (
          <div className="mt-4 flex items-center gap-2 text-sm font-medium bg-muted p-2 rounded-md">
            <FileIcon className="h-4 w-4" />
            <span>{fileName}</span>
          </div>
        )}
      </div>
    </div>
  );
}

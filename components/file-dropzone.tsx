'use client';

import { useId, useState } from 'react';
import { FileArchive, UploadCloud, X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

type FileDropzoneProps = {
  file: File | null;
  onFileChange: (file: File | null) => void;
  accept?: string;
  helperText?: string;
  disabled?: boolean;
};

export function FileDropzone({
  file,
  onFileChange,
  accept = '.zip',
  helperText = '压缩包内需包含 package.json 和 build 脚本，构建产物固定输出到 dist/',
  disabled = false,
}: FileDropzoneProps) {
  const inputId = useId();
  const [isDragging, setIsDragging] = useState(false);

  return (
    <div className="space-y-3">
      <label
        htmlFor={inputId}
        className={cn(
          'group flex cursor-pointer flex-col items-center justify-center rounded-[16px] border-2 border-dashed border-slate-300 bg-[linear-gradient(180deg,rgba(248,250,252,0.92),rgba(239,246,255,0.76))] px-6 py-10 text-center transition hover:border-sky-300 hover:bg-[linear-gradient(180deg,rgba(239,246,255,0.9),rgba(219,234,254,0.72))]',
          isDragging && 'border-sky-400 bg-[linear-gradient(180deg,rgba(239,246,255,0.92),rgba(219,234,254,0.76))]',
          disabled && 'pointer-events-none opacity-60',
        )}
        onDragEnter={() => setIsDragging(true)}
        onDragLeave={() => setIsDragging(false)}
        onDragOver={(event) => {
          event.preventDefault();
          setIsDragging(true);
        }}
        onDrop={(event) => {
          event.preventDefault();
          setIsDragging(false);
          const nextFile = event.dataTransfer.files[0] ?? null;
          onFileChange(nextFile);
        }}
      >
        <input
          id={inputId}
          type="file"
          accept={accept}
          className="sr-only"
          disabled={disabled}
          onChange={(event) => {
            onFileChange(event.target.files?.[0] ?? null);
          }}
        />
        <div className="mb-4 inline-flex size-14 items-center justify-center rounded-2xl bg-white/80 text-[var(--primary)] shadow-[var(--shadow-soft)]">
          <UploadCloud className="size-7" />
        </div>
        <div className="text-sm font-semibold text-slate-800">拖拽或点击上传源码 zip</div>
        <div className="mt-2 max-w-xl text-sm leading-6 text-slate-500">{helperText}</div>
      </label>

      {file ? (
        <div className="flex items-center justify-between gap-3 rounded-2xl border border-[color:var(--border)] bg-white/90 px-4 py-3 shadow-[var(--shadow-soft)]">
          <div className="flex min-w-0 items-center gap-3">
            <div className="inline-flex size-10 items-center justify-center rounded-2xl bg-sky-50 text-[var(--primary)]">
              <FileArchive className="size-5" />
            </div>
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold text-slate-800">{file.name}</div>
              <div className="text-xs text-slate-500">{Math.max(1, Math.round(file.size / 1024))} KB</div>
            </div>
          </div>
          <Button type="button" variant="ghost" size="icon" onClick={() => onFileChange(null)}>
            <X />
            <span className="sr-only">移除文件</span>
          </Button>
        </div>
      ) : null}
    </div>
  );
}

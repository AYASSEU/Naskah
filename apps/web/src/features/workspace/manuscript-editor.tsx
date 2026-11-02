'use client';
import MDEditor from '@uiw/react-md-editor';
import { useEffect, useState } from 'react';
import { useTheme } from 'next-themes';
import { useTranslations } from 'next-intl';
import { nextId, duplicateIds } from '@/entities/requirement/parsing';
import { Button } from '@/shared/ui';
export default function ManuscriptEditor({
  value,
  onChange,
  saving,
  finish,
  usedMarkdown,
}: {
  usedMarkdown: string;
  value: string;
  onChange: (value: string) => void;
  saving: boolean;
  finish: () => void;
}) {
  const { resolvedTheme } = useTheme();
  const t = useTranslations();
  const [wide, setWide] = useState(false);
  useEffect(() => {
    setWide(window.innerWidth >= 1280);
  }, []);
  const duplicates = duplicateIds(value);
  return (
    <div className="editor-container" data-color-mode={resolvedTheme === 'dark' ? 'dark' : 'light'}>
      <MDEditor
        value={value}
        onChange={(v) => onChange(v || '')}
        height={400}
        preview={wide ? 'live' : 'edit'}
        textareaProps={{ 'aria-label': 'Markdown' }}
      />
      <div className="editor-footer">
        <Button
          onClick={() =>
            onChange(
              `${value}\n\n**${nextId(usedMarkdown + value)} — Kebutuhan baru**\nSistem harus…\n\nPrioritas: [High]`,
            )
          }
        >
          {t('addRequirement')}
        </Button>
        <span>{t(saving ? 'saving' : 'saved')}</span>
        <Button onClick={finish}>{t('finishEditing')}</Button>
      </div>
      {duplicates.length > 0 && (
        <p className="inline-error">
          {t('duplicateWarning')}: {duplicates.join(', ')}
        </p>
      )}
    </div>
  );
}

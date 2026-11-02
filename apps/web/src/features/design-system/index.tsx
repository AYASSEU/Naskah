'use client';
import { useState } from 'react';
import { Button, Status, Segments, Toggle, Modal } from '@/shared/ui';
export function DesignSystem() {
  const [open, setOpen] = useState(false);
  const [checked, setChecked] = useState(true);
  return (
    <main className="page">
      <h1>Design system</h1>
      <div className="design-system">
        {['light', 'dark'].map((theme) => (
          <section data-theme={theme} key={theme}>
            <Button variant="primary" onClick={() => setOpen(true)}>
              Primary action
            </Button>
            <Button>Secondary action</Button>
            <Status status="in_review" />
            <Status status="finalized" />
            <Segments values={['complete', 'drafted', 'active', 'pending']} />
            <Toggle label="Toggle" checked={checked} onChange={setChecked} />
            <input placeholder="Input" />
          </section>
        ))}
      </div>
      <Modal open={open} onOpenChange={setOpen} title="Dialog">
        <p>Focus is contained by Radix.</p>
      </Modal>
    </main>
  );
}

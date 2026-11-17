'use client';
import Link, { useLinkStatus } from 'next/link';
import { createPortal } from 'react-dom';
import type { ComponentProps } from 'react';
import { RouteLoading } from './route-loading';

function PendingNavigation({ label }: { label: string }) {
  const { pending } = useLinkStatus();
  return pending ? createPortal(<RouteLoading label={label} overlay />, document.body) : null;
}

export function NavigationLink({
  loadingLabel,
  children,
  ...props
}: ComponentProps<typeof Link> & { loadingLabel: string }) {
  return (
    <Link {...props}>
      {children}
      <PendingNavigation label={loadingLabel} />
    </Link>
  );
}

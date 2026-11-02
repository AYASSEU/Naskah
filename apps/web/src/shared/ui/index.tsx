'use client';
import * as Dialog from '@radix-ui/react-dialog';
import * as Dropdown from '@radix-ui/react-dropdown-menu';
import * as SelectPrimitive from '@radix-ui/react-select';
import * as Switch from '@radix-ui/react-switch';
import { X, MoreHorizontal, Check, ChevronDown, ChevronUp } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { ReactNode, ButtonHTMLAttributes } from 'react';
export function Button({
  children,
  variant = 'secondary',
  className = '',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'text' }) {
  return (
    <button className={`button ${variant} ${className}`} {...props}>
      {children}
    </button>
  );
}
export function Modal({
  open,
  onOpenChange,
  title,
  description,
  children,
  wide = false,
  onEscape,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: ReactNode;
  wide?: boolean;
  onEscape?: () => void;
}) {
  const t = useTranslations();
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="modal-overlay" />
        <Dialog.Content
          className={`modal ${wide ? 'modal-wide' : ''}`}
          onEscapeKeyDown={(event) => {
            if (onEscape) {
              event.preventDefault();
              onEscape();
            }
          }}
        >
          <div className="modal-heading">
            <div>
              <Dialog.Title>{title}</Dialog.Title>
              {description && <Dialog.Description>{description}</Dialog.Description>}
            </div>
            <Dialog.Close className="icon-button" aria-label={t('close')}>
              <X />
            </Dialog.Close>
          </div>
          {children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
export function Menu({
  items,
  label,
}: {
  items: { label: string; action: () => void; danger?: boolean; icon?: ReactNode }[];
  label: string;
}) {
  return (
    <Dropdown.Root>
      <Dropdown.Trigger className="icon-button" aria-label={label}>
        <MoreHorizontal />
      </Dropdown.Trigger>
      <Dropdown.Portal>
        <Dropdown.Content className="dropdown" align="end" sideOffset={6}>
          {items.map((item) => (
            <Dropdown.Item
              key={item.label}
              className={item.danger ? 'danger' : ''}
              onSelect={item.action}
            >
              {item.icon}
              {item.label}
            </Dropdown.Item>
          ))}
        </Dropdown.Content>
      </Dropdown.Portal>
    </Dropdown.Root>
  );
}
export function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  label: string;
}) {
  return (
    <Switch.Root className="switch" checked={checked} onCheckedChange={onChange} aria-label={label}>
      <Switch.Thumb className="switch-thumb" />
    </Switch.Root>
  );
}
export function Status({ status }: { status: string }) {
  const t = useTranslations();
  return (
    <span className={`status status-${status}`}>
      <span />
      {t(status)}
    </span>
  );
}
export function Segments({ values }: { values: string[] }) {
  return (
    <span className="segments" aria-label={values.join(', ')}>
      {values.map((v, i) => (
        <span key={i} className={v} />
      ))}
    </span>
  );
}
export function CheckMark() {
  return (
    <span className="checkmark">
      <Check />
    </span>
  );
}
export function Select({
  id,
  label,
  value,
  onChange,
  options,
}: {
  id?: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <span className="select-wrap">
      <SelectPrimitive.Root value={value} onValueChange={onChange}>
        <SelectPrimitive.Trigger id={id} className="select-trigger" aria-label={label}>
          <SelectPrimitive.Value />
          <SelectPrimitive.Icon asChild>
            <ChevronDown />
          </SelectPrimitive.Icon>
        </SelectPrimitive.Trigger>
        <SelectPrimitive.Portal>
          <SelectPrimitive.Content
            className="select-menu"
            position="popper"
            sideOffset={6}
            collisionPadding={16}
          >
            <SelectPrimitive.ScrollUpButton className="select-scroll">
              <ChevronUp />
            </SelectPrimitive.ScrollUpButton>
            <SelectPrimitive.Viewport className="select-viewport">
              {options.map((option) => (
                <SelectPrimitive.Item
                  key={option.value}
                  value={option.value}
                  className="select-option"
                >
                  <SelectPrimitive.ItemText>{option.label}</SelectPrimitive.ItemText>
                  <SelectPrimitive.ItemIndicator className="select-indicator">
                    <Check />
                  </SelectPrimitive.ItemIndicator>
                </SelectPrimitive.Item>
              ))}
            </SelectPrimitive.Viewport>
            <SelectPrimitive.ScrollDownButton className="select-scroll">
              <ChevronDown />
            </SelectPrimitive.ScrollDownButton>
          </SelectPrimitive.Content>
        </SelectPrimitive.Portal>
      </SelectPrimitive.Root>
    </span>
  );
}

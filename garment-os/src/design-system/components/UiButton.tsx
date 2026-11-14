import type { ButtonHTMLAttributes, ReactNode } from 'react';

export type UiButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'toggle';
export type UiButtonSize = 'sm' | 'md' | 'lg';

export interface UiButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: UiButtonVariant;
  size?: UiButtonSize;
  active?: boolean;
  leading?: ReactNode;
}

/** Shared button contract for the workbench and feature modules. */
export function UiButton({
  variant = 'secondary',
  size = 'md',
  active = false,
  leading,
  className = '',
  children,
  ...props
}: UiButtonProps) {
  const classes = ['ui-button', `ui-button--${variant}`, `ui-button--${size}`, active && 'is-active', className]
    .filter(Boolean)
    .join(' ');

  return (
    <button {...props} className={classes} aria-pressed={props['aria-pressed'] ?? (variant === 'toggle' ? active : undefined)}>
      {leading && <span className="ui-button__leading" aria-hidden="true">{leading}</span>}
      {children}
    </button>
  );
}

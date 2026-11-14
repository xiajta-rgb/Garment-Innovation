import { useId, useState, type ReactNode } from 'react';

interface UiSectionProps {
  title: string;
  defaultExpanded?: boolean;
  children: ReactNode;
}

/** Collapsible section with a stable layout and accessibility contract. */
export function UiSection({ title, defaultExpanded = true, children }: UiSectionProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const [activated, setActivated] = useState(defaultExpanded);
  const contentId = `ui-section-content-${useId().replace(/:/g, '')}`;

  return (
    <section className="ui-section">
      <button
        className="ui-section__trigger"
        type="button"
        aria-expanded={expanded}
        aria-controls={contentId}
        onClick={() => { setActivated(true); setExpanded((value) => !value); }}
      >
        <span>{title}</span>
        <svg className={`ui-section__chevron${expanded ? '' : ' is-collapsed'}`} width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
          <path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      <div id={contentId} className={`ui-section__content${expanded ? ' is-expanded' : ' is-collapsed'}`} hidden={!expanded}>
        {activated && children}
      </div>
    </section>
  );
}

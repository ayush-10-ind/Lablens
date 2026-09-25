import React from 'react';

export interface NotRecognizedSheetProps {
  isOpen: boolean;
  onTryAgain: () => void;
  onSelectExperiment?: (experimentId: string) => void;
  notice?: string | null;
}

/**
 * Not Recognized Bottom Sheet (docs/design.md §3.8, docs/rules.md §B2, docs/architecture.md §5.0).
 *
 * Appears when rule R9 fails for 2 seconds (unsupported scene / 0 supported components).
 * Keeps live camera running in background.
 * Provides a path forward: "Choose experiment" list (LED circuit lab) or "Try again" dismissal.
 */
export const NotRecognizedSheet: React.FC<NotRecognizedSheetProps> = ({
  isOpen,
  onTryAgain,
  onSelectExperiment,
  notice,
}) => {
  if (!isOpen) return null;

  return (
    <section
      role="dialog"
      aria-modal="false"
      aria-labelledby="not-recognized-title"
      aria-describedby="not-recognized-desc"
      className="fixed bottom-0 inset-x-0 z-40 px-4 pb-safe pointer-events-auto"
    >
      <div className="max-w-md mx-auto w-full bg-surface border-t border-x border-muted/20 rounded-t-card p-5 shadow-2xl space-y-4 backdrop-blur-md">
        {/* Drag handle / pill indicator */}
        <div className="w-8 h-1 mx-auto bg-muted/40 rounded-full" aria-hidden="true" />

        {/* Headline & Body */}
        <div className="space-y-1">
          <h2 id="not-recognized-title" className="text-base font-bold text-text">
            I don't recognize this yet.
          </h2>
          <p id="not-recognized-desc" className="text-xs text-muted">
            LabLens works with circuit parts for now.
          </p>
        </div>

        {/* Choose experiment list */}
        <div className="space-y-2">
          <span className="text-[11px] font-semibold text-muted tracking-wider uppercase">
            Supported today
          </span>

          <div className="space-y-1.5">
            {/* LED circuit lab row */}
            <button
              type="button"
              onClick={() => onSelectExperiment?.('led-circuit')}
              className="w-full min-h-[44px] flex items-center justify-between px-3.5 py-2.5 rounded-card bg-bg/60 hover:bg-bg/90 border border-muted/20 hover:border-accent/40 text-left transition-colors group focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              <div className="flex items-center space-x-2.5">
                <span className="h-2 w-2 rounded-full bg-accent" aria-hidden="true" />
                <span className="text-xs font-semibold text-text group-hover:text-accent transition-colors">
                  LED circuit lab
                </span>
              </div>
              <span
                className="text-muted text-base font-semibold group-hover:text-accent transition-colors"
                aria-hidden="true"
              >
                ›
              </span>
            </button>

            {/* Coming soon informational row */}
            <div
              className="w-full min-h-[38px] flex items-center justify-between px-3.5 py-2 rounded-card bg-bg/30 border border-muted/10 text-xs text-muted/60 select-none"
              aria-disabled="true"
            >
              <span>More coming soon</span>
            </div>
          </div>

          {/* Explicit deferred notice if user selects experiment */}
          {notice && (
            <p className="text-[11px] text-accent/90 text-center font-medium pt-1 animate-pulse">
              {notice}
            </p>
          )}
        </div>

        {/* Secondary Try Again Action */}
        <div className="pt-1">
          <button
            type="button"
            onClick={onTryAgain}
            className="w-full min-h-[44px] py-2 px-4 rounded-chip bg-surface hover:bg-muted/10 active:bg-muted/20 border border-muted/30 text-xs font-semibold text-text text-center transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            Try again
          </button>
        </div>
      </div>
    </section>
  );
};

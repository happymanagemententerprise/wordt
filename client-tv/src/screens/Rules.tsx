import type { ReactNode } from 'react';

import { HOW_TO_PLAY } from '@wordt/shared';

export function Rules({ onBack }: { onBack: () => void }): ReactNode {
  return (
    <div className="tv-solo tv-rules">
      <div className="tv-rules__head">
        <p className="tv-brand tv-brand--hero">Wordt</p>
        <button className="tv-btn tv-btn--ghost" type="button" onClick={onBack}>
          Back to entry
        </button>
      </div>

      <h1 className="tv-rules__title">How to play</h1>

      <div className="tv-rules__grid">
        {HOW_TO_PLAY.map((section, index) => (
          <section key={section.heading} className="tv-rules__card">
            <p className="tv-eyebrow">Part {index + 1}</p>
            <h2 className="tv-rules__heading">{section.heading}</h2>
            {section.intro ? <p className="tv-rules__intro">{section.intro}</p> : null}
            {section.steps ? (
              <ol className="tv-rules__list">
                {section.steps.map((step) => (
                  <li key={step} className="tv-rules__item">
                    {step}
                  </li>
                ))}
              </ol>
            ) : null}
            {section.bullets ? (
              <ul className="tv-rules__list tv-rules__list--bullets">
                {section.bullets.map((bullet) => (
                  <li key={bullet} className="tv-rules__item">
                    {bullet}
                  </li>
                ))}
              </ul>
            ) : null}
          </section>
        ))}
      </div>
    </div>
  );
}
import type { ReactNode } from 'react';

import { HOW_TO_PLAY } from '@wordt/shared';

export function Rules({ onBack }: { onBack: () => void }): ReactNode {
  return (
    <div className="app app--rules">
      <button className="btn btn--ghost rules__back" type="button" onClick={onBack}>
        ← Back
      </button>

      <div className="rules">
        <h1 className="rules__title">How to play</h1>
        <p className="rules__tagline">Pick letters together. Make the most words.</p>

        {HOW_TO_PLAY.map((section, index) => (
          <section key={section.heading} className="rules__section">
            <h2 className="rules__heading">
              <span className="rules__num">{index + 1}</span>
              {section.heading}
            </h2>
            {section.intro ? <p className="rules__intro">{section.intro}</p> : null}
            {section.steps ? (
              <ol className="rules__list">
                {section.steps.map((step) => (
                  <li key={step} className="rules__item">
                    {step}
                  </li>
                ))}
              </ol>
            ) : null}
            {section.bullets ? (
              <ul className="rules__list rules__list--bullets">
                {section.bullets.map((bullet) => (
                  <li key={bullet} className="rules__item">
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
import { useEffect, useState, type ReactNode } from 'react';

import { isConsentPending, setConsent, subscribeConsent } from '@wordt/shared';

export function ConsentBanner(): ReactNode {
  const [pending, setPending] = useState(() => isConsentPending());

  useEffect(() => subscribeConsent(() => setPending(isConsentPending())), []);

  if (!pending) return null;

  return (
    <aside className="consent" role="dialog" aria-label="Cookie consent" aria-live="polite">
      <p className="consent__text">
        We’d like to load optional third-party scripts (such as analytics) to see how the game is
        played. They stay switched off until you choose.
      </p>
      <div className="consent__actions">
        <button type="button" className="consent__btn" onClick={() => setConsent('denied')}>
          Decline
        </button>
        <button
          type="button"
          className="consent__btn consent__btn--primary"
          onClick={() => setConsent('granted')}
        >
          Accept
        </button>
      </div>
    </aside>
  );
}

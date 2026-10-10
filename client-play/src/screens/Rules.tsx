import { useEffect, useRef, useState, type ReactNode } from 'react';

const SLIDES = [2, 3, 4, 5, 6, 7, 8].map(
  (n) => `${import.meta.env.BASE_URL}how-to-play/slide-${n}.png`,
);

export function Rules({ onBack }: { onBack: () => void }): ReactNode {
  const [index, setIndex] = useState(0);
  const touchX = useRef<number | null>(null);
  const total = SLIDES.length;

  const go = (next: number) => setIndex(((next % total) + total) % total);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'ArrowRight') go(index + 1);
      else if (event.key === 'ArrowLeft') go(index - 1);
      else if (event.key === 'Escape') onBack();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [index, onBack]);

  return (
    <div className="app app--rules">
      <button className="btn btn--ghost rules__back" type="button" onClick={onBack}>
        ← Back
      </button>

      <div className="rules">
        <h1 className="rules__title">How to play</h1>
        <p className="rules__tagline">Pick letters together. Make the most words.</p>

        <div
          className="slides"
          onTouchStart={(event) => {
            touchX.current = event.changedTouches[0]?.clientX ?? null;
          }}
          onTouchEnd={(event) => {
            if (touchX.current == null) return;
            const dx = (event.changedTouches[0]?.clientX ?? touchX.current) - touchX.current;
            touchX.current = null;
            if (Math.abs(dx) > 40) go(index + (dx < 0 ? 1 : -1));
          }}
        >
          <button
            className="slides__nav slides__nav--prev"
            type="button"
            aria-label="Previous slide"
            onClick={() => go(index - 1)}
          >
            ‹
          </button>
          <img
            className="slide"
            src={SLIDES[index]}
            alt={`How to play, slide ${index + 1} of ${total}`}
            draggable={false}
          />
          <button
            className="slides__nav slides__nav--next"
            type="button"
            aria-label="Next slide"
            onClick={() => go(index + 1)}
          >
            ›
          </button>
        </div>

        <div className="slides__dots">
          {SLIDES.map((slide, i) => (
            <button
              key={slide}
              type="button"
              className={`slides__dot${i === index ? ' slides__dot--on' : ''}`}
              aria-label={`Go to slide ${i + 1}`}
              aria-current={i === index}
              onClick={() => go(i)}
            />
          ))}
        </div>
        <p className="rules__count">
          {index + 1} / {total}
        </p>
      </div>
    </div>
  );
}

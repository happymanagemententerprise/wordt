import { useEffect, useState, type ReactNode } from 'react';

const SLIDES = [2, 3, 4, 5, 6, 7, 8].map(
  (n) => `${import.meta.env.BASE_URL}how-to-play/slide-${n}.png`,
);

export function Rules({ onBack }: { onBack: () => void }): ReactNode {
  const [index, setIndex] = useState(0);
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
    <div className="tv-solo tv-rules">
      <div className="tv-rules__head">
        <p className="tv-brand tv-brand--hero">Wordt</p>
        <button className="tv-btn tv-btn--ghost" type="button" onClick={onBack}>
          Back to entry
        </button>
      </div>

      <h1 className="tv-rules__title">How to play</h1>

      <div className="tv-slides">
        <button
          className="tv-slides__nav tv-slides__nav--prev"
          type="button"
          aria-label="Previous slide"
          onClick={() => go(index - 1)}
        >
          ‹
        </button>
        <img
          className="tv-slide"
          src={SLIDES[index]}
          alt={`How to play, slide ${index + 1} of ${total}`}
          draggable={false}
        />
        <button
          className="tv-slides__nav tv-slides__nav--next"
          type="button"
          aria-label="Next slide"
          onClick={() => go(index + 1)}
        >
          ›
        </button>
      </div>

      <div className="tv-slides__dots">
        {SLIDES.map((slide, i) => (
          <button
            key={slide}
            type="button"
            className={`tv-slides__dot${i === index ? ' tv-slides__dot--on' : ''}`}
            aria-label={`Go to slide ${i + 1}`}
            aria-current={i === index}
            onClick={() => go(i)}
          />
        ))}
      </div>
      <p className="tv-slides__count">
        {index + 1} / {total}
      </p>
    </div>
  );
}

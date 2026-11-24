import React, { useEffect, useState } from 'react';
import { ArrowUp } from 'lucide-react';

// Long pages: a "Back to top" control appears once the page heading has scrolled out of view.
export default function BackToTop() {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const update = () => setVisible(window.scrollY > 600);
    update(); window.addEventListener('scroll', update, { passive: true });
    return () => window.removeEventListener('scroll', update);
  }, []);
  if (!visible) return null;
  const top = () => {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    window.scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' });
    document.getElementById('main-content')?.focus({ preventScroll: true });
  };
  return <button type="button" className="back-to-top" onClick={top} aria-label="Back to top of page"><ArrowUp size={18} aria-hidden="true" /><span>Top</span></button>;
}

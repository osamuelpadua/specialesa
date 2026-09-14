/**
 * Mapas (iframes) só carregam quando chegam perto da tela. O loading="lazy" nativo usa uma
 * margem de milhares de pixels e, em páginas curtas, baixava o Google Maps já na abertura.
 *
 * Marcação: <iframe data-src="https://maps.google.com/…" loading="lazy" title="…">
 */
(() => {
	'use strict';

	const frames = document.querySelectorAll('iframe[data-src]');
	if (!frames.length) return;

	const load = (frame) => {
		frame.src = frame.dataset.src;
		frame.removeAttribute('data-src');
	};

	const io = new IntersectionObserver((entries) => {
		for (const entry of entries) {
			if (!entry.isIntersecting) continue;
			io.unobserve(entry.target);
			load(entry.target);
		}
	}, { rootMargin: '300px 0px' });

	frames.forEach((frame) => io.observe(frame));
})();

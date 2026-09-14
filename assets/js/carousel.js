/**
 * Carrossel de imagens — substitui o Swiper do Elementor mantendo a mesma geometria
 * e o mesmo comportamento: largura do slide em px ((largura − espaços) / slides por vista),
 * espaço entre slides, loop contínuo com clones, autoplay, setas, bolinhas e arraste.
 *
 * Configuração no widget:
 *   data-carousel data-autoplay="5000" data-speed="500"
 *   data-pause-hover         pausa com o mouse em cima (e retoma ao sair)
 *   data-pause-interaction   para o autoplay depois de um clique/arraste
 *   style="--spv-m:1;--spv-t:2;--spv-d:3;--gap-m:0;--gap-t:0;--gap-d:20"
 *     slides por vista e espaço (px) no celular / tablet / desktop
 * Os limites de 767px e 1024px ficam no CSS (static.css), os mesmos do Swiper.
 */
(() => {
	'use strict';

	const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');

	function carousel(root) {
		const swiper = root.querySelector('.swiper');
		const track = swiper.querySelector('.swiper-wrapper');
		const slides = [...track.children];
		const n = slides.length;
		if (n < 2) return;

		const bullets = [...root.querySelectorAll('.swiper-pagination-bullet')];
		const delay = Number(root.dataset.autoplay) || 0;
		const speed = Number(root.dataset.speed) || 300;
		const pauseOnHover = root.hasAttribute('data-pause-hover');
		const pauseOnInteraction = root.hasAttribute('data-pause-interaction');
		const cssNumber = (prop) => parseFloat(getComputedStyle(root).getPropertyValue(prop)) || 0;
		const clones = Math.ceil(Math.max(cssNumber('--spv-m'), cssNumber('--spv-t'), cssNumber('--spv-d'), 1));

		// Clones nas duas pontas, como o loop do Swiper: [n-k … n-1] reais [0 … k-1]
		const dup = (slide) => {
			const c = slide.cloneNode(true);
			c.classList.add('swiper-slide-duplicate');
			c.setAttribute('aria-hidden', 'true');
			c.inert = true;
			return c;
		};
		for (let i = 0; i < clones; i++) {
			track.insertBefore(dup(slides[(((i - clones) % n) + n) % n]), slides[0]);
			track.appendChild(dup(slides[i % n]));
		}
		const all = [...track.children];

		// Slides fora da vista ficam cortados pelo overflow, e o lazy-load nativo nunca os
		// carregaria: perto da tela, carrega todas as imagens do carrossel (como o Swiper).
		new IntersectionObserver((entries, io) => {
			if (!entries[0].isIntersecting) return;
			io.disconnect();
			for (const img of track.querySelectorAll('img[loading="lazy"]')) img.loading = 'eager';
		}, { rootMargin: '800px 0px' }).observe(swiper);

		let index = 0; // slide real ativo
		let step = 0; // largura de um slide + espaço, em px
		let anim = null;
		let timer = 0;
		let hover = false;
		let stopped = false;
		let visible = false;
		let drag = null;

		const offset = (i) => -(clones + i) * step;
		const translate = (x) => `translate3d(${x}px, 0px, 0px)`;
		const currentX = () => (anim ? new DOMMatrixReadOnly(getComputedStyle(track).transform).m41 : offset(index));

		function halt() {
			if (!anim) return;
			anim.onfinish = null;
			anim.cancel();
			anim = null;
		}

		function schedule() {
			clearTimeout(timer);
			if (!delay || hover || stopped || !visible || drag || document.hidden || reducedMotion.matches) return;
			timer = setTimeout(() => go(index + 1), delay);
		}

		function go(to, byUser = false, from = currentX()) {
			halt();
			// Destino num clone: desloca origem e destino em n slides. O quadro é idêntico e o
			// trilho sempre termina num slide real (é o que o loopFix do Swiper faz).
			if (to >= n) { to -= n; from += n * step; }
			else if (to < 0) { to += n; from -= n * step; }
			index = to;

			track.style.transform = translate(offset(index));
			anim = track.animate(
				[{ transform: translate(from) }, { transform: translate(offset(index)) }],
				{ duration: speed, easing: 'ease' },
			);
			anim.onfinish = () => { anim = null; schedule(); };

			bullets.forEach((b, i) => {
				b.classList.toggle('swiper-pagination-bullet-active', i === index);
				if (i === index) b.setAttribute('aria-current', 'true');
				else b.removeAttribute('aria-current');
			});
			if (byUser && pauseOnInteraction) stopped = true;
			clearTimeout(timer);
		}

		function layout() {
			const cs = getComputedStyle(swiper);
			const width = swiper.clientWidth - parseInt(cs.paddingLeft, 10) - parseInt(cs.paddingRight, 10);
			if (width <= 0) return; // oculto (display:none num ancestral): mede de novo quando aparecer
			halt();
			const perView = cssNumber('--spv') || 1;
			const gap = cssNumber('--gap');
			const size = (width - gap * (perView - 1)) / perView;
			step = size + gap;
			for (const s of all) {
				s.style.width = `${size}px`;
				s.style.marginRight = `${gap}px`;
			}
			// O Swiper só usa backface-hidden com até 10 slides (contando os clones da vista atual)
			swiper.classList.toggle('swiper-backface-hidden', n + 2 * Math.ceil(perView) <= 10);
			track.style.transform = translate(offset(index));
			schedule();
		}

		// Setas e bolinhas (mouse e teclado)
		const press = (el, fn) => {
			if (!el) return;
			el.addEventListener('click', fn);
			el.addEventListener('keydown', (e) => {
				if (e.key !== 'Enter' && e.key !== ' ') return;
				e.preventDefault();
				fn();
			});
		};
		press(root.querySelector('.elementor-swiper-button-prev'), () => go(index - 1, true));
		press(root.querySelector('.elementor-swiper-button-next'), () => go(index + 1, true));
		bullets.forEach((b, i) => press(b, () => go(i, true)));

		// Arraste (toque e mouse). O touch-action: pan-y do Swiper mantém a rolagem vertical.
		swiper.addEventListener('dragstart', (e) => e.preventDefault());
		swiper.addEventListener('pointerdown', (e) => {
			if (e.button !== 0 || e.target.closest('.elementor-swiper-button, .swiper-pagination')) return;
			const base = currentX();
			halt();
			track.style.transform = translate(base);
			drag = { x0: e.clientX, y0: e.clientY, t0: e.timeStamp, base, dx: 0, axis: '' };
			clearTimeout(timer);
		});
		swiper.addEventListener('pointermove', (e) => {
			if (!drag) return;
			const dx = e.clientX - drag.x0;
			const dy = e.clientY - drag.y0;
			if (!drag.axis) {
				if (Math.abs(dx) < 6 && Math.abs(dy) < 6) return;
				drag.axis = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y';
				if (drag.axis === 'x') swiper.setPointerCapture(e.pointerId);
			}
			if (drag.axis !== 'x') return;
			drag.dx = Math.max(-step, Math.min(step, dx));
			track.style.transform = translate(drag.base + drag.dx);
		});
		const release = (e) => {
			if (!drag) return;
			const { base, dx, t0, axis } = drag;
			drag = null;
			const quick = e.timeStamp - t0 < 300 && Math.abs(dx) > 10;
			const move = axis === 'x' && (quick || Math.abs(dx) > step / 2) ? (dx < 0 ? 1 : -1) : 0;
			go(index + move, axis === 'x', base + dx);
		};
		swiper.addEventListener('pointerup', release);
		swiper.addEventListener('pointercancel', release);

		// Autoplay: pausa fora da tela (não gasta CPU à toa) e, se configurado, com o mouse em cima
		if (pauseOnHover) {
			swiper.addEventListener('pointerenter', (e) => {
				if (e.pointerType !== 'mouse') return;
				hover = true;
				clearTimeout(timer);
			});
			swiper.addEventListener('pointerleave', (e) => {
				if (e.pointerType !== 'mouse') return;
				hover = false;
				stopped = false; // o Elementor retoma o autoplay ao tirar o mouse
				schedule();
			});
		}
		new IntersectionObserver(([entry]) => {
			visible = entry.isIntersecting;
			schedule();
		}).observe(swiper);
		document.addEventListener('visibilitychange', schedule);
		new ResizeObserver(layout).observe(swiper);
	}

	document.querySelectorAll('[data-carousel]').forEach(carousel);
})();

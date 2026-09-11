/**
 * FAQ (acordeão aninhado do Elementor). O <details>/<summary> já abre e fecha sem JS;
 * aqui entram só a animação de altura, o limite de um item aberto por vez e o teclado
 * (Esc fecha; setas, Home e End navegam entre as perguntas) — como no Elementor.
 *
 * Configuração em .e-n-accordion:  data-max="one|multiple"  data-duration="400"
 */
(() => {
	'use strict';

	const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
	const animations = new WeakMap();

	function animate(item, from, to, open) {
		animations.get(item)?.cancel();
		item.style.overflow = 'hidden';
		const duration = reducedMotion.matches ? 0 : Number(item.parentElement.dataset.duration) || 400;
		const a = item.animate({ height: [from, to] }, { duration });
		a.onfinish = () => {
			item.open = open;
			item.style.height = '';
			item.style.overflow = '';
			animations.delete(item);
		};
		animations.set(item, a);
		item.querySelector('summary').setAttribute('aria-expanded', String(open));
	}

	function close(item) {
		animate(item, `${item.offsetHeight}px`, `${item.querySelector('summary').offsetHeight}px`, false);
	}

	function open(item) {
		item.style.overflow = 'hidden';
		item.style.height = `${item.offsetHeight}px`;
		item.open = true;
		requestAnimationFrame(() => {
			const title = item.querySelector('summary');
			const content = title.nextElementSibling;
			animate(item, `${item.offsetHeight}px`, `${title.offsetHeight + content.offsetHeight}px`, true);
		});
	}

	for (const accordion of document.querySelectorAll('.e-n-accordion')) {
		const items = [...accordion.children].filter((el) => el.matches('details'));
		const titles = items.map((item) => item.querySelector('summary'));
		const single = accordion.dataset.max !== 'multiple';

		items.forEach((item, i) => {
			// Sem JS, o atributo name dá a exclusividade nativa; com JS, a animação cuida disso.
			item.removeAttribute('name');
			titles[i].addEventListener('click', (e) => {
				e.preventDefault();
				if (single) items.forEach((other) => other !== item && other.open && close(other));
				if (item.open) close(item);
				else open(item);
			});
		});

		accordion.addEventListener('keydown', (e) => {
			const i = titles.indexOf(e.target);
			if (i < 0) return;
			const last = titles.length - 1;
			const next = {
				ArrowDown: i === last ? 0 : i + 1,
				ArrowRight: i === last ? 0 : i + 1,
				ArrowUp: i === 0 ? last : i - 1,
				ArrowLeft: i === 0 ? last : i - 1,
				Home: 0,
				End: last,
			}[e.key];
			if (e.key === 'Escape' && items[i].open) close(items[i]);
			else if (next !== undefined) {
				e.preventDefault();
				titles[next].focus();
			}
		});
	}
})();

/**
 * Vídeos do YouTube sem carregar o YouTube na abertura da página — nada é requisitado
 * a ele antes do clique.
 *
 * - .yt-facade (no lugar do Presto Player): pôster local + botão; o clique troca o botão
 *   por um <iframe> do youtube-nocookie já tocando.
 * - Widget de vídeo do Elementor (imagem de overlay): como no original, o clique remove
 *   o overlay e inicia o vídeo. Configuração em .elementor-wrapper: data-youtube, data-title.
 */
(() => {
	'use strict';

	function player(id, title, className) {
		const frame = document.createElement('iframe');
		frame.src = `https://www.youtube-nocookie.com/embed/${id}?autoplay=1&playsinline=1&rel=0&modestbranding=1`;
		frame.title = title || 'Vídeo do YouTube';
		frame.className = className;
		frame.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share; fullscreen';
		frame.allowFullscreen = true;
		return frame;
	}

	function play(target) {
		const facade = target.closest('.yt-facade');
		if (facade) {
			const frame = player(facade.dataset.youtube, facade.dataset.title, 'yt-facade__frame');
			facade.replaceWith(frame);
			frame.focus();
			return true;
		}

		const overlay = target.closest('.elementor-custom-embed-image-overlay');
		if (overlay) {
			const wrapper = overlay.closest('.elementor-wrapper');
			const frame = player(wrapper.dataset.youtube, wrapper.dataset.title, 'elementor-video');
			wrapper.querySelector('.elementor-video').replaceWith(frame);
			overlay.remove();
			frame.focus();
			return true;
		}
		return false;
	}

	document.addEventListener('click', (e) => play(e.target));

	// O "play" do overlay do Elementor é role="button": Enter e Espaço também iniciam.
	document.addEventListener('keydown', (e) => {
		if (e.key !== 'Enter' && e.key !== ' ') return;
		if (e.target.closest('.elementor-custom-embed-play') && play(e.target)) e.preventDefault();
	});
})();

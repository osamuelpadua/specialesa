/**
 * Questionário antes do WhatsApp — página /coluna (inspirado no quiz do Dr. Danilo Soares).
 *
 * Todo CTA que leva ao WhatsApp (a[href^="https://wa.me/"]) abre o questionário. No fim, a
 * mensagem pré-preenchida leva o nome e TODAS as respostas. Nada é gravado em lugar nenhum:
 * as respostas chegam só pela conversa. Se o JS falhar, os CTAs continuam sendo links wa.me.
 *
 * O CSS (assets/css/quiz.css) é carregado por este script, sem bloquear a renderização.
 */
(() => {
	'use strict';

	// ---- Configuração: número, texto de abertura e perguntas --------------------------------
	const CONFIG = {
		whatsapp: '5571991019525',
		intro: 'Vim através da BIO do Instagram e gostaria de informações sobre o Plano de tratamento para dores na coluna - método COLUNA LIVRE.',
		steps: [
			{
				key: 'presencial',
				summary: 'Presencial em Salvador',
				question: 'O tratamento é presencial, na Speciale, na Pituba, em Salvador. Você consegue comparecer?',
				options: [
					{ label: 'Sim, moro em Salvador ou região' },
					{ label: 'Sim, venho de outra cidade e consigo me organizar' },
					{
						label: 'Não consigo ir presencialmente',
						notice: 'O tratamento é presencial, na Pituba, em Salvador. Como você não consegue comparecer, pode não ser o ideal agora. Mas, se quiser tirar uma dúvida, estamos aqui.',
					},
				],
			},
			{
				key: 'caso',
				summary: 'Sobre a minha dor',
				question: 'Sobre a sua dor na coluna, o que mais se aplica?',
				options: [
					{ label: 'Tenho hérnia de disco ou outro diagnóstico na coluna' },
					{ label: 'Sinto dor que irradia para a perna ou para o braço' },
					{ label: 'Tenho dor na lombar ou na cervical, ainda sem diagnóstico' },
					{ label: 'Já me indicaram cirurgia' },
				],
			},
			{
				key: 'particular',
				summary: 'Atendimento particular',
				question: 'O atendimento é particular: não trabalhamos com convênios. Tudo certo seguir assim?',
				options: [
					{ label: 'Sim, consigo seguir no particular' },
					{
						label: 'Hoje não consigo pagar particular',
						notice: 'Tudo bem. Como o atendimento é particular, pode não ser o ideal para o seu momento. Mas, se quiser tirar uma dúvida, estamos aqui.',
					},
				],
			},
		],
	};

	const TOTAL = CONFIG.steps.length + 1; // perguntas + nome
	const WA_ICON = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M17.5 14.4c-.3-.2-1.7-.9-2-1-.3-.1-.5-.1-.7.1-.2.3-.7 1-.9 1.2-.2.2-.3.2-.6.1-.3-.2-1.2-.5-2.3-1.4-.9-.8-1.4-1.7-1.6-2-.2-.3 0-.5.1-.6l.5-.5c.1-.2.2-.3.3-.5 0-.2 0-.4 0-.5 0-.2-.7-1.6-.9-2.2-.2-.6-.5-.5-.7-.5h-.6c-.2 0-.5.1-.8.4-.3.3-1 1-1 2.5s1.1 2.9 1.2 3.1c.1.2 2.1 3.2 5 4.4.7.3 1.3.5 1.7.6.7.2 1.4.2 1.9.1.6-.1 1.7-.7 2-1.4.2-.7.2-1.2.2-1.4-.1-.1-.3-.2-.6-.4z"/><path d="M12 2a10 10 0 0 0-8.6 15L2 22l5.2-1.4A10 10 0 1 0 12 2zm0 18.2c-1.6 0-3.1-.4-4.4-1.2l-.3-.2-3.1.8.8-3-.2-.3A8.2 8.2 0 1 1 12 20.2z"/></svg>';

	// CSS do questionário, ao lado deste script (../css/quiz.css)
	const script = document.currentScript || document.querySelector('script[src*="quiz.js"]');
	if (script) {
		const css = document.createElement('link');
		css.rel = 'stylesheet';
		css.href = script.src.replace(/js\/quiz\.js(?:\?.*)?$/, 'css/quiz.css');
		document.head.appendChild(css);
	}

	let overlay, box, body, bar, answers, trigger;

	const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

	// Eventos para as tags que forem configuradas (sem nenhuma tag, não fazem nada)
	function track(event, extra = {}) {
		window.dataLayer = window.dataLayer || [];
		window.dataLayer.push({ event, ...extra });
	}

	function progress(n) {
		bar.style.width = `${Math.max(4, (n / TOTAL) * 100)}%`;
	}

	function render(html, focusSelector) {
		body.innerHTML = html;
		const el = body.querySelector(focusSelector);
		if (el) el.focus();
	}

	// ---- Passos -------------------------------------------------------------------------------

	function next(i) {
		if (i < CONFIG.steps.length) renderStep(i);
		else renderName();
	}

	function renderStep(i) {
		const step = CONFIG.steps[i];
		progress(i);
		render(
			`<p class="sq-eyebrow">Passo ${i + 1} de ${TOTAL}</p>`
			+ `<h2 class="sq-title" id="sq-title">${esc(step.question)}</h2>`
			+ `<div class="sq-options">${step.options.map((o, n) => `<button class="sq-option" type="button" data-opt="${n}">${esc(o.label)}</button>`).join('')}</div>`,
			'.sq-option',
		);
		body.onclick = (e) => {
			const btn = e.target.closest('.sq-option');
			if (!btn) return;
			body.onclick = null;
			const opt = step.options[Number(btn.dataset.opt)];
			answers[step.key] = opt.label;
			track('quiz_step', { quiz_step: i + 1, quiz_answer: opt.label });
			if (opt.notice) renderNotice(opt.notice, i + 1);
			else next(i + 1);
		};
	}

	// Resposta que talvez não combine com o atendimento: avisa e deixa seguir. As próximas
	// perguntas continuam, para a mensagem sempre levar todas as respostas.
	function renderNotice(text, nextIndex) {
		render(
			'<p class="sq-eyebrow">Obrigado pela sinceridade</p>'
			+ '<h2 class="sq-title" id="sq-title">Talvez a gente não seja o ideal para o seu caso agora.</h2>'
			+ `<p class="sq-text">${esc(text)}</p>`
			+ '<button class="sq-btn sq-btn--ghost" type="button" data-anyway>Mesmo assim, quero falar</button>',
			'[data-anyway]',
		);
		body.onclick = (e) => {
			if (!e.target.closest('[data-anyway]')) return;
			body.onclick = null;
			next(nextIndex);
		};
	}

	function renderName() {
		progress(TOTAL - 1);
		render(
			`<p class="sq-eyebrow">Passo ${TOTAL} de ${TOTAL}</p>`
			+ '<h2 class="sq-title" id="sq-title">Por último: como você se chama?</h2>'
			+ '<form class="sq-form" novalidate>'
			+ '<input class="sq-input" type="text" name="nome" placeholder="Seu nome" autocomplete="name" aria-label="Seu nome" required>'
			+ '<p class="sq-error" hidden></p>'
			+ '<button class="sq-btn" type="submit">Continuar</button>'
			+ '</form>',
			'.sq-input',
		);
		const form = body.querySelector('.sq-form');
		const input = form.querySelector('.sq-input');
		const error = form.querySelector('.sq-error');
		form.addEventListener('submit', (e) => {
			e.preventDefault();
			const nome = input.value.trim().replace(/\s+/g, ' ');
			if (!nome) {
				error.textContent = 'Por favor, escreva seu nome.';
				error.hidden = false;
				input.classList.add('is-invalid');
				input.focus();
				return;
			}
			renderSuccess(nome);
		});
	}

	function message(nome) {
		const lines = CONFIG.steps.filter((s) => answers[s.key]).map((s) => `- ${s.summary}: ${answers[s.key]}`);
		return `Olá! Meu nome é ${nome}. ${CONFIG.intro}\n\nMinhas respostas:\n${lines.join('\n')}`;
	}

	function renderSuccess(nome) {
		progress(TOTAL);
		const link = `https://wa.me/${CONFIG.whatsapp}?text=${encodeURIComponent(message(nome))}`;
		render(
			'<p class="sq-eyebrow">Tudo certo</p>'
			+ `<h2 class="sq-title" id="sq-title">Perfeito, ${esc(nome)}!</h2>`
			+ '<p class="sq-text">Suas respostas já vão prontas na mensagem. É só enviar no WhatsApp que a nossa equipe te responde.</p>'
			+ `<a class="sq-btn sq-btn--wa" href="${esc(link)}" target="_blank" rel="noopener">${WA_ICON}Enviar no WhatsApp</a>`,
			'.sq-btn--wa',
		);
		track('quiz_lead');
		body.querySelector('.sq-btn--wa').addEventListener('click', () => setTimeout(close, 400));
	}

	// ---- Abrir / fechar -------------------------------------------------------------------------

	function mount() {
		overlay = document.createElement('div');
		overlay.className = 'sq-quiz';
		overlay.hidden = true;
		overlay.innerHTML = '<div class="sq-box" role="dialog" aria-modal="true" aria-labelledby="sq-title" tabindex="-1">'
			+ '<div class="sq-progress" aria-hidden="true"><span class="sq-progress-bar"></span></div>'
			+ '<button class="sq-close" type="button" aria-label="Fechar">&times;</button>'
			+ '<div class="sq-body"></div>'
			+ '</div>';
		document.body.appendChild(overlay);
		box = overlay.querySelector('.sq-box');
		body = overlay.querySelector('.sq-body');
		bar = overlay.querySelector('.sq-progress-bar');
		overlay.querySelector('.sq-close').addEventListener('click', close);
		// Clique fora fecha. Só conta se começou fora: arrastar a seleção do campo de nome
		// para fora da caixa não fecha. No click (e não no mousedown) o foco volta ao CTA.
		let downOutside = false;
		overlay.addEventListener('pointerdown', (e) => { downOutside = e.target === overlay; });
		overlay.addEventListener('click', (e) => { if (downOutside && e.target === overlay) close(); });
	}

	function open(el) {
		if (!overlay) mount();
		trigger = el;
		answers = {};
		overlay.hidden = false;
		document.documentElement.style.overflow = 'hidden';
		renderStep(0);
		track('quiz_open');
	}

	function close() {
		if (!overlay || overlay.hidden) return;
		overlay.hidden = true;
		document.documentElement.style.overflow = '';
		body.innerHTML = '';
		body.onclick = null;
		if (trigger) trigger.focus({ preventScroll: true });
	}

	document.addEventListener('click', (e) => {
		if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
		const cta = e.target.closest('a[href^="https://wa.me/"]');
		if (!cta || cta.closest('.sq-quiz')) return;
		e.preventDefault();
		open(cta);
	});

	document.addEventListener('keydown', (e) => {
		if (!overlay || overlay.hidden) return;
		if (e.key === 'Escape') { close(); return; }
		if (e.key !== 'Tab') return;
		// Prende o foco dentro do questionário
		const focusable = box.querySelectorAll('button, a[href], input');
		if (!focusable.length) return;
		const first = focusable[0];
		const last = focusable[focusable.length - 1];
		if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
		else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
	});
})();

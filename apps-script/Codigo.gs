/**
 * @OnlyCurrentDoc
 *
 * Speciale Saúde: grava na planilha as respostas do questionário da página /coluna/
 * (assets/js/quiz.js). Assim a equipe tem o contato até de quem não chega a clicar em
 * "Enviar no WhatsApp".
 *
 * Como publicar (uma vez só):
 *  1. Abra a planilha → Extensões → Apps Script.
 *  2. Apague o que estiver em Código.gs, cole este arquivo inteiro e salve (Ctrl+S).
 *  3. Implantar → Nova implantação → engrenagem de "Selecionar tipo" → App da Web.
 *       Executar como:        Eu (a conta dona da planilha)
 *       Quem pode acessar:    Qualquer pessoa
 *     Clique em Implantar e autorize o acesso. Se aparecer "O Google não verificou este app",
 *     clique em Avançado → Acessar: o app é seu e só mexe nesta planilha (@OnlyCurrentDoc).
 *  4. Copie a URL do App da Web (termina em /exec). No site, ela vai em `planilha`, no CONFIG
 *     de assets/js/quiz.js.
 *
 * Mudou este código depois? Implantar → Gerenciar implantações → lápis → Versão: Nova versão
 * → Implantar. Assim a URL continua a mesma (uma nova implantação geraria outra URL).
 *
 * Cada questionário concluído vira uma linha, identificada pelo ID. Quando a pessoa clica em
 * "Enviar no WhatsApp", o site manda o mesmo ID de novo e a coluna do clique passa a "Sim".
 *
 * O visual da aba (larguras, cores, filtro, linhas alternadas) é aplicado pelo próprio script
 * sempre que LAYOUT muda. Se a aba ficar bagunçada, rode organizarPlanilha no editor.
 */

var ABA = 'Questionário coluna';

// Suba este número quando mudar COLUNAS ou o visual: a aba é reorganizada no próximo envio
var LAYOUT = '2';

var LINHAS_MIN = 1000; // linhas já formatadas à espera dos próximos contatos
var FOLGA = 50;        // com menos linhas livres que isso, formata mais 500

var CORES = {
  contato: '#2e4227',   // verde da Speciale
  respostas: '#6b7a45', // oliva
  origem: '#5f6368',    // cinza
  interno: '#9aa0a6'    // cinza claro
};

// Ordem das colunas na aba. `antigos`: nomes usados por versões anteriores deste script.
var COLUNAS = [
  { chave: 'data', nome: 'Data e hora', antigos: ['Data/Hora'], grupo: 'contato',
    largura: 125, alinhar: 'center', formato: 'dd/MM/yyyy HH:mm' },
  { chave: 'nome', nome: 'Nome', grupo: 'contato', largura: 190, negrito: true },
  { chave: 'whatsapp', nome: 'WhatsApp', grupo: 'contato', largura: 135, alinhar: 'center' },
  { chave: 'conversa', nome: 'Conversa', antigos: ['Abrir conversa'], grupo: 'contato',
    largura: 125, alinhar: 'center',
    nota: 'Clique em "Abrir conversa" para falar com a pessoa no WhatsApp.' },
  { chave: 'clicou', nome: 'Clicou em "Enviar no WhatsApp"?', antigos: ['Clicou em Enviar no WhatsApp'],
    grupo: 'contato', largura: 135, alinhar: 'center',
    nota: 'Sim: a pessoa clicou no botão do site (não garante que a mensagem foi enviada). ' +
          'Não: ela respondeu tudo, mas não clicou. Vale a equipe chamar.' },
  { chave: 'presencial', nome: 'Consegue ir presencialmente?', antigos: ['Presencial em Salvador'],
    grupo: 'respostas', largura: 230,
    nota: 'O tratamento é presencial, na Pituba, em Salvador.' },
  { chave: 'caso', nome: 'Sobre o caso', grupo: 'respostas', largura: 250 },
  { chave: 'particular', nome: 'Consegue seguir no particular?', antigos: ['Atendimento particular'],
    grupo: 'respostas', largura: 220,
    nota: 'Atendimento particular, com nota fiscal para pedir reembolso ao plano.' },
  { chave: 'pagina', nome: 'Página', grupo: 'origem', largura: 250,
    nota: 'Página do site em que a pessoa respondeu o questionário.' },
  { chave: 'utm_source', nome: 'Origem (utm_source)', antigos: ['utm_source'], grupo: 'origem',
    largura: 120, nota: 'Vem do link de onde a pessoa chegou. Ex.: ig = Instagram.' },
  { chave: 'utm_medium', nome: 'Mídia (utm_medium)', antigos: ['utm_medium'], grupo: 'origem',
    largura: 120, nota: 'Vem do link de onde a pessoa chegou. Ex.: social, cpc.' },
  { chave: 'utm_campaign', nome: 'Campanha (utm_campaign)', antigos: ['utm_campaign'], grupo: 'origem',
    largura: 140, nota: 'Nome da campanha, quando o link tem.' },
  { chave: 'utm_content', nome: 'Conteúdo (utm_content)', antigos: ['utm_content'], grupo: 'origem',
    largura: 130, nota: 'Qual link ou anúncio. Ex.: link_in_bio = link da bio.' },
  { chave: 'utm_term', nome: 'Termo (utm_term)', antigos: ['utm_term'], grupo: 'origem',
    largura: 120, nota: 'Palavra-chave, quando o link tem.' },
  { chave: 'referrer', nome: 'Veio de (referrer)', antigos: ['Referrer'], grupo: 'origem',
    largura: 200, nota: 'Site em que a pessoa estava antes de abrir a página, quando o navegador informa.' },
  { chave: 'id', nome: 'ID (uso interno)', antigos: ['ID'], grupo: 'interno', largura: 250, quebra: false,
    nota: 'Liga o envio da tela final ao clique no botão. Não apague nem edite.' }
];

var COL_DATA = coluna_('data');
var COL_WHATSAPP = coluna_('whatsapp');
var COL_CONVERSA = coluna_('conversa');
var COL_CLIQUE = coluna_('clicou');
var COL_ID = coluna_('id');

function doPost(e) {
  var trava = LockService.getScriptLock();

  try {
    // o envio da tela final e o do clique podem chegar juntos: um de cada vez na planilha
    trava.waitLock(20000);

    var d = JSON.parse(e.postData.contents);
    var id = String(d.id || '');
    var nome = texto_(d.nome, 120);
    var digitos = String(d.whatsapp || '').replace(/\D/g, '');

    // o endereço é público: só grava o que tem cara de questionário de verdade
    if (!/^[A-Za-z0-9-]{8,64}$/.test(id) || !nome || !/^[1-9]{2}\d{8,9}$/.test(digitos)) {
      return resposta_({ ok: false, erro: 'dados inválidos' });
    }

    var aba = preparaAba_();
    var linha = linhaDoId_(aba, id);

    // os dois envios podem chegar fora de ordem: um "Sim" nunca volta a "Não"
    var clicou = d.clicou === true ||
      (linha > 0 && aba.getRange(linha, COL_CLIQUE).getValue() === 'Sim');

    var registro = {
      data: linha > 0 ? aba.getRange(linha, COL_DATA).getValue() : new Date(),
      nome: nome,
      whatsapp: texto_(d.whatsapp, 20),
      conversa: '',
      clicou: clicou ? 'Sim' : 'Não',
      presencial: texto_(d.presencial, 200),
      caso: texto_(d.caso, 200),
      particular: texto_(d.particular, 200),
      pagina: texto_(semParametros_(d.pagina), 300),
      utm_source: texto_(d.utm_source, 200),
      utm_medium: texto_(d.utm_medium, 200),
      utm_campaign: texto_(d.utm_campaign, 200),
      utm_content: texto_(d.utm_content, 200),
      utm_term: texto_(d.utm_term, 200),
      referrer: texto_(d.referrer, 1000),
      id: id
    };
    var valores = COLUNAS.map(function (c) { return registro[c.chave]; });

    if (linha > 0) {
      aba.getRange(linha, 1, 1, valores.length).setValues([valores]);
    } else {
      aba.appendRow(valores);
      linha = aba.getLastRow();
    }
    aba.getRange(linha, COL_CONVERSA).setRichTextValue(link_(digitos));

    return resposta_({ ok: true });
  } catch (err) {
    return resposta_({ ok: false, erro: String(err) });
  } finally {
    trava.releaseLock();
  }
}

// Abrir a URL /exec no navegador confere se está no ar (e já prepara e organiza a aba)
function doGet() {
  var trava = LockService.getScriptLock();

  try {
    trava.waitLock(20000);
    preparaAba_();
    return resposta_({ ok: true, status: 'no ar' });
  } catch (err) {
    return resposta_({ ok: false, erro: String(err) });
  } finally {
    trava.releaseLock();
  }
}

// Para rodar à mão no editor (Executar), se a aba ficar bagunçada: reorganiza e reaplica o visual
function organizarPlanilha() {
  var trava = LockService.getScriptLock();
  trava.waitLock(20000);

  try {
    var aba = preparaAba_();
    reorganiza_(aba);
    estiliza_(aba);
    marcaLayout_(aba);
  } finally {
    trava.releaseLock();
  }
}

function preparaAba_() {
  var pl = SpreadsheetApp.getActiveSpreadsheet();
  var aba = pl.getSheetByName(ABA);

  if (!aba) {
    var abas = pl.getSheets();
    // planilha nova, só com a aba padrão vazia: usa essa em vez de criar outra
    if (abas.length === 1 && abas[0].getLastRow() === 0) {
      aba = abas[0].setName(ABA);
    } else {
      aba = pl.insertSheet(ABA);
    }
  }

  if (layout_(aba) !== LAYOUT) {
    reorganiza_(aba);
    estiliza_(aba);
    marcaLayout_(aba);
  } else if (aba.getMaxRows() - aba.getLastRow() < FOLGA) {
    estiliza_(aba); // acabando as linhas formatadas: cria e formata mais
  }

  return aba;
}

// Põe o cabeçalho e as colunas na ordem de COLUNAS, sem perder dados. Colunas que a equipe
// criou na aba continuam lá, depois das do questionário.
function reorganiza_(aba) {
  var nomes = COLUNAS.map(function (c) { return c.nome; });
  var ultima = aba.getLastRow();

  if (ultima === 0) {
    aba.getRange(1, 1, 1, nomes.length).setValues([nomes]);
    return;
  }

  var largura = Math.max(aba.getLastColumn(), 1);
  var dados = aba.getRange(1, 1, ultima, largura).getValues();
  var cabecalho = dados[0].map(function (v) { return String(v); });

  // onde cada coluna está hoje, pelo nome atual ou por um nome antigo
  var origem = COLUNAS.map(function (c) {
    var procurados = [c.nome].concat(c.antigos || []);
    for (var i = 0; i < procurados.length; i++) {
      var j = cabecalho.indexOf(procurados[i]);
      if (j >= 0) return j;
    }
    return -1;
  });

  var extras = [];
  for (var j = 0; j < largura; j++) {
    if (origem.indexOf(j) >= 0) continue;
    var temDados = dados.some(function (l) { return l[j] !== ''; });
    if (temDados) extras.push(j);
  }

  var novas = dados.map(function (l, r) {
    var linha = COLUNAS.map(function (c, k) {
      if (r === 0) return c.nome;
      var v = origem[k] >= 0 ? l[origem[k]] : '';
      if (c.chave === 'pagina') v = semParametros_(v);
      return protege_(v);
    });
    return linha.concat(extras.map(function (j) { return protege_(l[j]); }));
  });

  var total = nomes.length + extras.length;
  aba.getRange(1, 1, ultima, Math.max(largura, total)).clearContent();
  aba.getRange(1, 1, novas.length, total).setValues(novas);

  if (novas.length > 1) {
    aba.getRange(2, COL_CONVERSA, novas.length - 1, 1).setRichTextValues(
      novas.slice(1).map(function (l) {
        return [link_(String(l[COL_WHATSAPP - 1]).replace(/\D/g, ''))];
      })
    );
  }
}

// Visual da aba. Pode rodar de novo quando quiser: refaz tudo do zero.
function estiliza_(aba) {
  var n = COLUNAS.length;

  var alvo = Math.max(LINHAS_MIN, aba.getLastRow() + FOLGA * 10);
  if (aba.getMaxRows() < alvo) aba.insertRowsAfter(aba.getMaxRows(), alvo - aba.getMaxRows());

  var max = aba.getMaxRows();
  var corpo = max - 1;
  var largura = Math.max(n, aba.getLastColumn());

  aba.setTabColor(CORES.contato);
  aba.setFrozenRows(1);
  aba.setFrozenColumns(2); // data e nome continuam à vista ao rolar para o lado
  aba.setRowHeight(1, 48);

  // cabeçalho: cor por grupo (contato, respostas, origem) e nota explicando a coluna
  aba.getRange(1, 1, 1, n)
    .setValues([COLUNAS.map(function (c) { return c.nome; })])
    .setBackgrounds([COLUNAS.map(function (c) { return CORES[c.grupo]; })])
    .setFontColor('#ffffff')
    .setFontWeight('bold')
    .setFontSize(10)
    .setWrap(true)
    .setVerticalAlignment('middle')
    .setHorizontalAlignment('center');

  if (largura > n) {
    aba.getRange(1, n + 1, 1, largura - n)
      .setBackground('#e8e6dc')
      .setFontColor(CORES.contato)
      .setFontWeight('bold')
      .setWrap(true)
      .setVerticalAlignment('middle')
      .setHorizontalAlignment('center');
  }

  // corpo: texto quebrando na largura da coluna, para nada ficar escondido
  aba.getRange(2, 1, corpo, n)
    .setFontColor('#1f2a1c')
    .setFontWeight('normal')
    .setFontSize(10)
    .setWrap(true)
    .setVerticalAlignment('middle');

  COLUNAS.forEach(function (c, i) {
    aba.setColumnWidth(i + 1, c.largura);
    aba.getRange(1, i + 1).setNote(c.nota || '');

    var col = aba.getRange(2, i + 1, corpo, 1)
      .setNumberFormat(c.formato || '@')
      .setHorizontalAlignment(c.alinhar || 'left');
    if (c.negrito) col.setFontWeight('bold');
    if (c.quebra === false) col.setWrap(false);
    if (c.grupo === 'interno') col.setFontColor('#80868b').setFontSize(8);
  });

  // linhas alternadas
  aba.getBandings().forEach(function (b) { b.remove(); });
  aba.getRange(2, 1, corpo, largura)
    .applyRowBanding(SpreadsheetApp.BandingTheme.LIGHT_GREY, false, false)
    .setFirstRowColor('#ffffff')
    .setSecondRowColor('#f3f2ec');

  // "Sim" em verde e "Não" em laranja. Regras que a equipe criou em outras colunas ficam.
  var clique = aba.getRange(2, COL_CLIQUE, corpo, 1);
  var outras = aba.getConditionalFormatRules().filter(function (regra) {
    return !regra.getRanges().some(function (g) { return g.getColumn() === COL_CLIQUE; });
  });
  aba.setConditionalFormatRules(outras.concat([
    SpreadsheetApp.newConditionalFormatRule()
      .whenTextEqualTo('Sim')
      .setBackground('#d6ebd0')
      .setFontColor('#1e5b1e')
      .setBold(true)
      .setRanges([clique])
      .build(),
    SpreadsheetApp.newConditionalFormatRule()
      .whenTextEqualTo('Não')
      .setBackground('#fde7cc')
      .setFontColor('#8a4a00')
      .setBold(true)
      .setRanges([clique])
      .build()
  ]));

  // filtro no cabeçalho (ex.: ver só quem não clicou)
  var filtro = aba.getFilter();
  if (filtro) filtro.remove();
  aba.getRange(1, 1, max, largura).createFilter();
}

function layout_(aba) {
  var marca = aba.getDeveloperMetadata().filter(function (m) { return m.getKey() === 'layout'; })[0];
  return marca ? marca.getValue() : '';
}

function marcaLayout_(aba) {
  aba.getDeveloperMetadata().forEach(function (m) {
    if (m.getKey() === 'layout') m.remove();
  });
  aba.addDeveloperMetadata('layout', LAYOUT);
}

function linhaDoId_(aba, id) {
  var ultima = aba.getLastRow();
  if (ultima < 2) return 0;

  var achou = aba.getRange(2, COL_ID, ultima - 1, 1)
    .createTextFinder(id)
    .matchEntireCell(true)
    .findNext();

  return achou ? achou.getRow() : 0;
}

function coluna_(chave) {
  for (var i = 0; i < COLUNAS.length; i++) {
    if (COLUNAS[i].chave === chave) return i + 1;
  }
  throw new Error('coluna desconhecida: ' + chave);
}

// "Abrir conversa" com o link do WhatsApp da pessoa
function link_(digitos) {
  var valido = /^[1-9]{2}\d{8,9}$/.test(digitos);
  var texto = SpreadsheetApp.newRichTextValue().setText(valido ? 'Abrir conversa' : '');
  if (valido) texto.setLinkUrl('https://wa.me/55' + digitos);
  return texto.build();
}

// Só o endereço da página: os parâmetros de campanha já vão nas colunas de UTM
function semParametros_(url) {
  return String(url == null ? '' : url).split(/[?#]/)[0];
}

// Texto limpo e curto. Começando com = + - @, o Sheets executaria como fórmula.
function texto_(valor, max) {
  var s = String(valor == null ? '' : valor)
    .replace(/[\x00-\x1f\x7f]/g, ' ')
    .trim()
    .slice(0, max);
  return protege_(s);
}

function protege_(valor) {
  return typeof valor === 'string' && /^[=+\-@]/.test(valor) ? "'" + valor : valor;
}

function resposta_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

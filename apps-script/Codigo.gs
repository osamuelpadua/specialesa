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
 */

var ABA = 'Questionário coluna';

var COLUNAS = [
  'Data/Hora', 'Nome', 'WhatsApp', 'Abrir conversa',
  'Presencial em Salvador', 'Sobre o caso', 'Atendimento particular',
  'Clicou em Enviar no WhatsApp',
  'Página', 'utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term',
  'Referrer', 'ID'
];

var COL_CLIQUE = COLUNAS.indexOf('Clicou em Enviar no WhatsApp') + 1;
var COL_ID = COLUNAS.indexOf('ID') + 1;

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

    var valores = [
      linha > 0 ? aba.getRange(linha, 1).getValue() : new Date(),
      nome,
      texto_(d.whatsapp, 20),
      'https://wa.me/55' + digitos,
      texto_(d.presencial, 200),
      texto_(d.caso, 200),
      texto_(d.particular, 200),
      clicou ? 'Sim' : 'Não',
      texto_(d.pagina, 1000),
      texto_(d.utm_source, 200),
      texto_(d.utm_medium, 200),
      texto_(d.utm_campaign, 200),
      texto_(d.utm_content, 200),
      texto_(d.utm_term, 200),
      texto_(d.referrer, 1000),
      id
    ];

    if (linha > 0) {
      aba.getRange(linha, 1, 1, valores.length).setValues([valores]);
    } else {
      aba.appendRow(valores);
    }

    return resposta_({ ok: true });
  } catch (err) {
    return resposta_({ ok: false, erro: String(err) });
  } finally {
    trava.releaseLock();
  }
}

// Abrir a URL /exec no navegador confere se está no ar (e já cria o cabeçalho da aba)
function doGet() {
  preparaAba_();
  return resposta_({ ok: true, status: 'no ar' });
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

  if (aba.getLastRow() === 0) {
    aba.appendRow(COLUNAS);
    aba.getRange(1, 1, 1, COLUNAS.length).setFontWeight('bold');
    aba.setFrozenRows(1);
    return aba;
  }

  // aba criada por uma versão anterior: completa o cabeçalho que faltar
  if (aba.getLastColumn() < COLUNAS.length) {
    aba.getRange(1, 1, 1, COLUNAS.length)
       .setValues([COLUNAS])
       .setFontWeight('bold');
  }

  return aba;
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

// Texto limpo e curto. Começando com = + - @, o Sheets executaria como fórmula.
function texto_(valor, max) {
  var s = String(valor == null ? '' : valor)
    .replace(/[\x00-\x1f\x7f]/g, ' ')
    .trim()
    .slice(0, max);
  return /^[=+\-@]/.test(s) ? "'" + s : s;
}

function resposta_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

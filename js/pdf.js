/**
 * pdf.js — Módulo de geração de PDF do PontoWeb
 * Conformidade: Portaria MTE 671/2021 · Art. 74 §2º CLT · SREP
 * Biblioteca: jsPDF (carregada via CDN como window.jspdf)
 */

// ── Paleta de cores ────────────────────────────────────────────────────────────
const PRIMARY  = [37, 99, 235];    // azul institucional
const SUCCESS  = [5, 150, 105];
const DANGER   = [220, 38, 38];
const WARNING_C = [217, 119, 6];
const MUTED    = [107, 114, 128];
const TEXT     = [17, 24, 39];
const BG       = [243, 244, 246];
const WHITE    = [255, 255, 255];
const BORDER   = [209, 213, 219];
const DARK_BG  = [17, 24, 39];
const LEGAL_BG = [239, 246, 255];  // azul claro para aviso legal
const LEGAL_TXT= [30, 64, 175];

// ── Utilitários ────────────────────────────────────────────────────────────────
function getJsPDF() {
  if (window.jspdf && window.jspdf.jsPDF) return window.jspdf.jsPDF;
  if (window.jsPDF) return window.jsPDF;
  throw new Error('jsPDF nao carregado. Verifique a tag script no HTML.');
}

function formatMinutes(totalMinutes) {
  const sign = totalMinutes < 0 ? '-' : '';
  const abs  = Math.abs(Math.round(totalMinutes));
  return `${sign}${String(Math.floor(abs / 60)).padStart(2, '0')}:${String(abs % 60).padStart(2, '0')}`;
}

function formatDate(d) {
  return d.toLocaleDateString('pt-BR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
}

function fmtTime(d, withSec = true) {
  const opts = { hour: '2-digit', minute: '2-digit' };
  if (withSec) opts.second = '2-digit';
  return d.toLocaleTimeString('pt-BR', opts);
}

/**
 * Gera NSR (Número Sequencial de Registro) — identificador único do evento
 * de ponto, conforme nomenclatura da Portaria 671/2021.
 * Implementado como hash determinístico do ID do registro.
 */
function generateNSR(recordId) {
  if (!recordId) return 'N/A';
  let hash = 0;
  for (let i = 0; i < recordId.length; i++) {
    hash = ((hash << 5) - hash) + recordId.charCodeAt(i);
    hash |= 0;
  }
  const abs = Math.abs(hash);
  return String(abs).padStart(9, '0').slice(0, 9);
}

/**
 * Gera código de autenticidade (hex truncado) para verificação de integridade.
 */
function generateAuthCode(recordId, timestamp) {
  const seed = `${recordId}-${timestamp}`;
  let h1 = 0xdeadbeef, h2 = 0x41c6ce57;
  for (let i = 0; i < seed.length; i++) {
    const c = seed.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 2654435761);
    h2 = Math.imul(h2 ^ c, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507);
  h1 = Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507);
  h2 = Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  const combined = (h1 >>> 0) ^ (h2 >>> 0);
  return combined.toString(16).toUpperCase().padStart(8, '0');
}

// ── Componentes de layout ──────────────────────────────────────────────────────
function drawHeader(doc, title, subtitle, compact = false) {
  const pageW = doc.internal.pageSize.getWidth();
  const hH    = compact ? 22 : 26;

  // Barra de fundo
  doc.setFillColor(...DARK_BG);
  doc.rect(0, 0, pageW, hH, 'F');

  // Faixa colorida lateral esquerda
  doc.setFillColor(...PRIMARY);
  doc.rect(0, 0, compact ? 3 : 4, hH, 'F');

  doc.setTextColor(...WHITE);
  doc.setFontSize(compact ? 11 : 14);
  doc.setFont('helvetica', 'bold');
  doc.text('PontoWeb', compact ? 8 : 10, compact ? 8 : 9);

  doc.setFontSize(compact ? 6 : 7);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(156, 163, 175);
  doc.text('Sistema de Registro Eletronico de Ponto · Portaria MTE 671/2021', compact ? 8 : 10, compact ? 14 : 15);

  doc.setTextColor(...WHITE);
  doc.setFontSize(compact ? 9 : 11);
  doc.setFont('helvetica', 'bold');
  doc.text(title, pageW - 6, compact ? 8 : 9, { align: 'right' });

  if (subtitle) {
    doc.setFontSize(compact ? 6.5 : 7.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(156, 163, 175);
    doc.text(subtitle, pageW - 6, compact ? 15 : 16, { align: 'right' });
  }

  return hH + 6;
}

function drawFooter(doc, authCode) {
  const pageW  = doc.internal.pageSize.getWidth();
  const pageH  = doc.internal.pageSize.getHeight();
  const total  = doc.internal.getNumberOfPages();
  const now    = new Date().toLocaleString('pt-BR');

  for (let i = 1; i <= total; i++) {
    doc.setPage(i);

    // Linha divisória
    doc.setDrawColor(...BORDER);
    doc.setLineWidth(0.2);
    doc.line(8, pageH - 16, pageW - 8, pageH - 16);

    doc.setTextColor(...MUTED);
    doc.setFontSize(6);
    doc.setFont('helvetica', 'normal');
    doc.text(`Gerado em: ${now}`, 8, pageH - 11);
    doc.text(`Pagina ${i} de ${total}`, pageW - 8, pageH - 11, { align: 'right' });

    if (authCode) {
      doc.setFontSize(6);
      doc.setTextColor(...MUTED);
      doc.text(`Cod. Autenticidade: ${authCode}`, pageW / 2, pageH - 11, { align: 'center' });
    }

    doc.setFontSize(5.5);
    doc.setTextColor(180, 180, 180);
    doc.text(
      'Documento gerado pelo Sistema PontoWeb. Validade: Art. 74 §2º CLT · Portaria MTE 671/2021.',
      pageW / 2, pageH - 6, { align: 'center' }
    );
  }
}

function legalBox(doc, x, y, w, lines, bgColor, textColor) {
  bgColor   = bgColor   || LEGAL_BG;
  textColor = textColor || LEGAL_TXT;

  const lineH  = 4.5;
  const pad    = 3;
  const boxH   = lines.length * lineH + pad * 2;

  doc.setFillColor(...bgColor);
  doc.roundedRect(x, y, w, boxH, 2, 2, 'F');
  doc.setDrawColor(...textColor);
  doc.setLineWidth(0.3);
  doc.line(x + 1, y, x + 1, y + boxH);   // borda esquerda colorida

  doc.setTextColor(...textColor);
  doc.setFontSize(6.5);
  doc.setFont('helvetica', 'normal');
  lines.forEach((line, idx) => {
    doc.text(line, x + pad + 1, y + pad + idx * lineH + 3);
  });

  return boxH + 2;
}

// ══════════════════════════════════════════════════════════════════════════════
// 1. COMPROVANTE INDIVIDUAL DE PONTO
// ══════════════════════════════════════════════════════════════════════════════
/**
 * Gera o comprovante individual de um registro de ponto.
 * Segue as diretrizes da Portaria MTE 671/2021 e Art. 74 §2º CLT.
 *
 * @param {object} record      - Dados do registro (Firestore doc)
 * @param {string} userName    - Nome do funcionário
 * @param {string} [companyName] - Razão social do empregador (opcional)
 */
export function gerarComprovantePDF(record, userName, companyName) {
  const jsPDF = getJsPDF();
  // A6 retrato (105×148 mm) — tamanho padrão para comprovante de caixa
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: [105, 160] });
  const pageW = doc.internal.pageSize.getWidth();

  const ts = record.timestamp && record.timestamp.toDate
    ? record.timestamp.toDate()
    : new Date(record.timestamp);

  const nsr      = generateNSR(record.id);
  const authCode = generateAuthCode(record.id || 'unknown', ts.getTime());

  const typeColors = {
    'Entrada':           SUCCESS,
    'Pausa para Almoco': [245, 158, 11],
    'Volta do Almoco':   [59, 130, 246],
    'Saida':             DANGER,
    'Pausa para Almoço': [245, 158, 11],
    'Volta do Almoço':   [59, 130, 246],
    'Saída':             DANGER,
  };
  const typeColor = typeColors[record.type] || PRIMARY;

  // ── Cabeçalho ──
  let y = drawHeader(doc, 'Comprovante de Ponto', fmtTime(ts, false), true);

  // ── Banner do tipo de evento ──
  doc.setFillColor(...typeColor);
  doc.roundedRect(8, y, pageW - 16, 16, 2, 2, 'F');
  doc.setTextColor(...WHITE);
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text(record.type, pageW / 2, y + 7, { align: 'center' });
  if (record.edited) {
    doc.setFontSize(6.5);
    doc.setFont('helvetica', 'italic');
    doc.text('Registro editado pelo administrador', pageW / 2, y + 13, { align: 'center' });
  }
  y += 21;

  // ── Horário em destaque ──
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(8, y, pageW - 16, 28, 2, 2, 'F');
  doc.setTextColor(...typeColor);
  doc.setFontSize(30);
  doc.setFont('helvetica', 'bold');
  doc.text(fmtTime(ts, false), pageW / 2, y + 13, { align: 'center' });
  doc.setTextColor(...MUTED);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.text(`e ${String(ts.getSeconds()).padStart(2, '0')} segundos`, pageW / 2, y + 20, { align: 'center' });
  doc.setFontSize(7);
  const dateCapitalized = formatDate(ts);
  doc.text(dateCapitalized.charAt(0).toUpperCase() + dateCapitalized.slice(1),
    pageW / 2, y + 26, { align: 'center', maxWidth: pageW - 20 });
  y += 33;

  // ── Dados do funcionário e empregador ──
  const colW = (pageW - 18) / 2;

  // Funcionário
  doc.setFillColor(...BG);
  doc.roundedRect(8, y, colW, 20, 2, 2, 'F');
  doc.setTextColor(...MUTED);
  doc.setFontSize(6);
  doc.setFont('helvetica', 'bold');
  doc.text('FUNCIONARIO', 11, y + 5);
  doc.setTextColor(...TEXT);
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'bold');
  const nameLines = doc.splitTextToSize(userName || record.userEmail || '—', colW - 6);
  doc.text(nameLines, 11, y + 11);
  doc.setFontSize(6);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...MUTED);
  doc.text(record.userEmail || '—', 11, y + 17, { maxWidth: colW - 5 });

  // Empregador
  doc.setFillColor(...BG);
  doc.roundedRect(10 + colW, y, colW, 20, 2, 2, 'F');
  doc.setTextColor(...MUTED);
  doc.setFontSize(6);
  doc.setFont('helvetica', 'bold');
  doc.text('EMPREGADOR', 13 + colW, y + 5);
  doc.setTextColor(...TEXT);
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'bold');
  doc.text(companyName || 'Conforme contrato', 13 + colW, y + 11, { maxWidth: colW - 6 });
  y += 25;

  // ── NSR e identificadores legais ──
  doc.setFillColor(239, 246, 255);
  doc.roundedRect(8, y, pageW - 16, 18, 2, 2, 'F');
  doc.setDrawColor(...LEGAL_TXT);
  doc.setLineWidth(0.3);
  doc.line(9, y, 9, y + 18);

  doc.setTextColor(...LEGAL_TXT);
  doc.setFontSize(6);
  doc.setFont('helvetica', 'bold');
  doc.text('NSR (Numero Sequencial do Registro)', 12, y + 5);
  doc.setFontSize(9);
  doc.text(nsr, 12, y + 11);

  doc.setFontSize(6);
  doc.text('ID DO REGISTRO', pageW / 2 + 2, y + 5);
  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');
  doc.text(record.id || 'N/A', pageW / 2 + 2, y + 11, { maxWidth: colW - 5 });
  doc.setFontSize(6);
  doc.setFont('helvetica', 'bold');
  doc.text(`COD. AUTENTICIDADE: ${authCode}`, pageW / 2 + 2, y + 16);
  y += 22;

  // ── Aviso legal ──
  const legalLines = [
    'Documento valido como comprovante de jornada nos termos do Art. 74 §2° da CLT',
    'e da Portaria MTE 671/2021 que regulamenta o Sistema de Registro Eletronico',
    'de Ponto (SREP). Este comprovante e gerado automaticamente pelo sistema PontoWeb.',
  ];
  legalBox(doc, 8, y, pageW - 16, legalLines);

  drawFooter(doc, authCode);

  const safeType = (record.type || 'ponto').replace(/[^a-zA-Z0-9]/g, '_');
  const dateStr  = ts.toISOString().slice(0, 10);
  doc.save(`comprovante_${safeType}_${dateStr}_NSR${nsr}.pdf`);
}


// ══════════════════════════════════════════════════════════════════════════════
// 2. ESPELHO DE PONTO (DETALHADO POR BATIDA)
// ══════════════════════════════════════════════════════════════════════════════
/**
 * Gera o Espelho de Ponto — relatório detalhado com todas as batidas individuais
 * do período, exigido para fiscalização trabalhista (CLT Art. 74 §2° e Portaria
 * MTE 671/2021, Anexo II).
 *
 * @param {Array}  records      - Array de registros brutos do Firestore
 * @param {string} userName     - Nome do funcionário
 * @param {string} periodoLabel - Ex: "01/08/2026 a 31/08/2026"
 * @param {object} totals       - { totalWorkedMin, totalExpectedMin, totalBalanceMin, daysWorked }
 * @param {number} [dailyHours] - Meta diária em horas
 * @param {string} [companyName] - Razão social do empregador
 */
export function gerarEspelhoPontoPDF(records, userName, periodoLabel, totals, dailyHours, companyName) {
  dailyHours = dailyHours || 8;
  const jsPDF = getJsPDF();
  const doc   = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const mX    = 10;
  const cW    = pageW - mX * 2;

  // Ordenar registros por data e hora
  const sorted = [...records].sort((a, b) => {
    const ta = a.timestamp?.toDate?.() ?? new Date(a.timestamp);
    const tb = b.timestamp?.toDate?.() ?? new Date(b.timestamp);
    return ta - tb;
  });

  // Agrupar por dia
  const byDay = {};
  sorted.forEach(r => {
    const ds = r.dateString || r.timestamp?.toDate?.()?.toISOString?.().slice(0, 10) || '?';
    if (!byDay[ds]) byDay[ds] = [];
    byDay[ds].push(r);
  });

  const authCode = generateAuthCode(userName + periodoLabel, Date.now());

  // ── Cabeçalho ──
  let y = drawHeader(doc, 'Espelho de Ponto', periodoLabel);

  // ── Bloco de identificação ──
  doc.setFillColor(239, 246, 255);
  doc.roundedRect(mX, y, cW, 26, 2, 2, 'F');
  doc.setDrawColor(...PRIMARY);
  doc.setLineWidth(0.5);
  doc.line(mX + 1, y, mX + 1, y + 26);

  doc.setTextColor(...PRIMARY);
  doc.setFontSize(7);
  doc.setFont('helvetica', 'bold');
  doc.text('FUNCIONARIO', mX + 5, y + 6);
  doc.setTextColor(...TEXT);
  doc.setFontSize(12);
  doc.text(userName, mX + 5, y + 14);
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...MUTED);
  doc.text(`Periodo: ${periodoLabel}`, mX + 5, y + 21);

  doc.setTextColor(...PRIMARY);
  doc.setFontSize(7);
  doc.setFont('helvetica', 'bold');
  doc.text('EMPREGADOR', pageW / 2 + 5, y + 6);
  doc.setTextColor(...TEXT);
  doc.setFontSize(10);
  doc.text(companyName || 'Conforme contrato de trabalho', pageW / 2 + 5, y + 14);
  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...MUTED);
  doc.text(`Meta diaria: ${dailyHours}h | Cod. Autenticidade: ${authCode}`, pageW / 2 + 5, y + 21);
  y += 31;

  // ── Cards de totais ──
  const cardW = (cW - 9) / 4;
  const isPos = totals.totalBalanceMin >= 0;
  const summaryCards = [
    { label: 'Horas Trabalhadas', value: formatMinutes(totals.totalWorkedMin), color: [240, 253, 244], tColor: SUCCESS },
    { label: 'Horas Esperadas',   value: formatMinutes(totals.totalExpectedMin), color: BG,            tColor: TEXT },
    { label: 'Saldo do Periodo',  value: (isPos ? '+' : '') + formatMinutes(totals.totalBalanceMin),
      color: isPos ? [240, 253, 244] : [254, 242, 242], tColor: isPos ? SUCCESS : DANGER },
    { label: 'Dias Trabalhados',  value: String(totals.daysWorked), color: BG, tColor: TEXT },
  ];

  summaryCards.forEach((card, i) => {
    const cx = mX + i * (cardW + 3);
    doc.setFillColor(...card.color);
    doc.roundedRect(cx, y, cardW, 18, 2, 2, 'F');
    doc.setTextColor(...MUTED);
    doc.setFontSize(6);
    doc.setFont('helvetica', 'normal');
    doc.text(card.label.toUpperCase(), cx + cardW / 2, y + 5.5, { align: 'center' });
    doc.setTextColor(...card.tColor);
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text(card.value, cx + cardW / 2, y + 14, { align: 'center' });
  });
  y += 23;

  // ── Base legal ──
  const lH = legalBox(doc, mX, y, cW, [
    'ESPELHO DE PONTO — Documento obrigatorio nos termos do Art. 74 §2° da CLT e Portaria MTE 671/2021.',
    'Este relatorio lista todas as marcacoes individuais de jornada. Deve ser mantido pelo empregador por no minimo 5 anos.',
  ], LEGAL_BG, LEGAL_TXT);
  y += lH + 2;

  // ── Tabela de batidas ──
  // Colunas: Data | Horario | Tipo de Evento | NSR | Localizacao
  const cols = [
    { label: 'Data',          w: 26, align: 'left' },
    { label: 'Hora (HH:MM:SS)', w: 30, align: 'left' },
    { label: 'Tipo de Evento', w: 48, align: 'left' },
    { label: 'NSR',           w: 26, align: 'center' },
    { label: 'Localizacao',   w: cW - 26 - 30 - 48 - 26, align: 'left' },
  ];
  const rowH = 7;

  function drawTableHead(yPos) {
    doc.setFillColor(...PRIMARY);
    doc.rect(mX, yPos, cW, rowH + 1, 'F');
    let cx = mX + 2;
    doc.setTextColor(...WHITE);
    doc.setFontSize(7);
    doc.setFont('helvetica', 'bold');
    cols.forEach(col => {
      doc.text(col.label, cx + (col.align === 'center' ? col.w / 2 - 2 : 0), yPos + rowH - 1,
        col.align === 'center' ? { align: 'center' } : {});
      cx += col.w;
    });
    return yPos + rowH + 1;
  }

  y = drawTableHead(y);

  const days = Object.keys(byDay).sort();
  let rowIdx = 0;

  days.forEach(ds => {
    const dayRecords = byDay[ds];
    const dateLabel  = new Date(ds + 'T12:00:00').toLocaleDateString('pt-BR',
      { weekday: 'short', day: '2-digit', month: '2-digit', year: '2-digit' });

    // Calcular totais do dia
    const byType = {};
    dayRecords.forEach(r => { byType[r.type] = r.timestamp?.toDate?.() ?? new Date(r.timestamp); });
    const ent    = byType['Entrada'];
    const pau    = byType['Pausa para Almoço'] || byType['Pausa para Almoco'];
    const vol    = byType['Volta do Almoço']   || byType['Volta do Almoco'];
    const sai    = byType['Saída']             || byType['Saida'];
    let dayWorked = 0;
    if (ent && sai) {
      dayWorked = (sai - ent) / 60000 - ((pau && vol) ? (vol - pau) / 60000 : 0);
    }
    const dayBalance = dayWorked - dailyHours * 60;

    dayRecords.forEach(r => {
      if (y > pageH - 22) {
        doc.addPage();
        y = drawTableHead(22);
        rowIdx = 0;
      }

      const ts   = r.timestamp?.toDate?.() ?? new Date(r.timestamp);
      const nsr  = generateNSR(r.id);
      const even = rowIdx % 2 === 0;
      doc.setFillColor(even ? 249 : 255, even ? 250 : 255, even ? 251 : 255);
      doc.rect(mX, y, cW, rowH, 'F');

      const typeColors2 = {
        'Entrada':           [...SUCCESS, 180],
        'Pausa para Almoço': [245, 158, 11],
        'Volta do Almoço':   [59, 130, 246],
        'Saída':             [...DANGER, 180],
        'Pausa para Almoco': [245, 158, 11],
        'Volta do Almoco':   [59, 130, 246],
        'Saida':             DANGER,
      };

      let cx = mX + 2;
      const cells = [
        { text: dateLabel, color: TEXT, bold: false },
        { text: fmtTime(ts, true), color: TEXT, bold: true },
        { text: r.type + (r.edited ? ' ✎' : ''), color: typeColors2[r.type] || TEXT, bold: false },
        { text: nsr, color: MUTED, bold: false, align: 'center' },
        { text: (r.latitude && r.longitude)
            ? `${r.latitude.toFixed(4)},${r.longitude.toFixed(4)}`
            : '—', color: MUTED, bold: false },
      ];

      cells.forEach((cell, ci) => {
        doc.setTextColor(...cell.color);
        doc.setFont('helvetica', cell.bold ? 'bold' : 'normal');
        doc.setFontSize(7);
        const tx = cell.align === 'center' ? cx + cols[ci].w / 2 - 1 : cx;
        doc.text(cell.text, tx, y + rowH - 2,
          cell.align === 'center' ? { align: 'center', maxWidth: cols[ci].w - 2 } : { maxWidth: cols[ci].w - 2 });
        cx += cols[ci].w;
      });

      doc.setDrawColor(...BORDER);
      doc.setLineWidth(0.1);
      doc.line(mX, y + rowH, mX + cW, y + rowH);
      y += rowH;
      rowIdx++;
    });

    // Subtotal do dia
    if (dayWorked > 0) {
      if (y > pageH - 18) { doc.addPage(); y = drawTableHead(22); rowIdx = 0; }
      const balSign = dayBalance >= 0 ? '+' : '';
      const balCol  = dayBalance >= 0 ? SUCCESS : DANGER;
      doc.setFillColor(243, 232, 255);
      doc.rect(mX, y, cW, 5.5, 'F');
      doc.setTextColor(109, 40, 217);
      doc.setFontSize(6);
      doc.setFont('helvetica', 'bold');
      doc.text(
        `Total do dia: ${formatMinutes(dayWorked)}   Saldo: ${balSign}${formatMinutes(dayBalance)}`,
        mX + 4, y + 4
      );
      doc.setTextColor(...balCol);
      y += 5.5;
    }

    // Espaço entre dias
    y += 2;
  });

  // ── Bloco de assinatura ──
  if (y > pageH - 36) { doc.addPage(); y = 20; }
  y += 4;
  const sigW = (cW - 10) / 2;
  doc.setDrawColor(...BORDER);
  doc.setLineWidth(0.3);
  // Empregado
  doc.line(mX, y + 14, mX + sigW, y + 14);
  doc.setTextColor(...MUTED);
  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');
  doc.text('Assinatura do Empregado', mX + sigW / 2, y + 18, { align: 'center' });
  doc.setFontSize(6.5);
  doc.text(userName, mX + sigW / 2, y + 22, { align: 'center' });
  // Empregador
  doc.line(mX + sigW + 10, y + 14, mX + cW, y + 14);
  doc.text('Assinatura do Empregador / Responsavel', mX + sigW + 10 + sigW / 2, y + 18, { align: 'center' });
  doc.text(companyName || 'Empregador', mX + sigW + 10 + sigW / 2, y + 22, { align: 'center' });

  drawFooter(doc, authCode);

  const safeName   = userName.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();
  const safePeriod = periodoLabel.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();
  doc.save(`espelho_ponto_${safeName}_${safePeriod}.pdf`);
}


// ══════════════════════════════════════════════════════════════════════════════
// 3. RELATÓRIO MENSAL (BANCO DE HORAS — RESUMO)
// ══════════════════════════════════════════════════════════════════════════════
/**
 * Gera o Relatório Mensal de Banco de Horas (resumo por dia).
 * Conformidade: Portaria MTE 671/2021 · Art. 74 §2º CLT.
 *
 * @param {Array}  bhData       - Array de objetos de dia (saída de calcBancoDeHoras)
 * @param {string} userName     - Nome do funcionário
 * @param {string} periodoLabel - Ex: "01/08/2026 a 31/08/2026"
 * @param {object} totals       - { totalWorkedMin, totalExpectedMin, totalBalanceMin, daysWorked }
 * @param {number} [dailyHours] - Meta diária em horas
 * @param {string} [companyName] - Razão social do empregador
 */
export function gerarRelatorioMensalPDF(bhData, userName, periodoLabel, totals, dailyHours, companyName) {
  dailyHours = dailyHours || 8;
  const jsPDF = getJsPDF();
  const doc   = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const mX    = 10;
  const cW    = pageW - mX * 2;

  const authCode = generateAuthCode(userName + periodoLabel + 'mensal', Date.now());

  let y = drawHeader(doc, 'Relatorio de Banco de Horas', periodoLabel);

  // ── Identificação ──
  doc.setFillColor(239, 246, 255);
  doc.roundedRect(mX, y, cW, 22, 2, 2, 'F');
  doc.setDrawColor(...PRIMARY);
  doc.setLineWidth(0.5);
  doc.line(mX + 1, y, mX + 1, y + 22);

  doc.setTextColor(...PRIMARY);
  doc.setFontSize(7);
  doc.setFont('helvetica', 'bold');
  doc.text('FUNCIONARIO', mX + 5, y + 6);
  doc.setTextColor(...TEXT);
  doc.setFontSize(12);
  doc.text(userName, mX + 5, y + 13);
  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...MUTED);
  doc.text(`Periodo: ${periodoLabel}  |  Meta diaria: ${dailyHours}h  |  Cod. Auth.: ${authCode}`, mX + 5, y + 19);

  doc.setTextColor(...PRIMARY);
  doc.setFontSize(7);
  doc.setFont('helvetica', 'bold');
  doc.text('EMPREGADOR', pageW / 2 + 5, y + 6);
  doc.setTextColor(...TEXT);
  doc.setFontSize(10);
  doc.text(companyName || 'Conforme contrato de trabalho', pageW / 2 + 5, y + 13);
  y += 27;

  // ── Cards de resumo ──
  const cardW = (cW - 9) / 4;
  const balOk = totals.totalBalanceMin >= 0;
  const cards = [
    { label: 'Horas Trabalhadas', value: formatMinutes(totals.totalWorkedMin), color: [240, 253, 244], tColor: SUCCESS },
    { label: 'Horas Esperadas',   value: formatMinutes(totals.totalExpectedMin), color: BG, tColor: TEXT },
    { label: 'Saldo Total',
      value: (balOk ? '+' : '') + formatMinutes(totals.totalBalanceMin),
      color: balOk ? [240, 253, 244] : [254, 242, 242], tColor: balOk ? SUCCESS : DANGER },
    { label: 'Dias Trabalhados',  value: String(totals.daysWorked), color: BG, tColor: TEXT },
  ];

  cards.forEach((card, i) => {
    const cx = mX + i * (cardW + 3);
    doc.setFillColor(...card.color);
    doc.roundedRect(cx, y, cardW, 18, 2, 2, 'F');
    doc.setTextColor(...MUTED);
    doc.setFontSize(6);
    doc.setFont('helvetica', 'normal');
    doc.text(card.label.toUpperCase(), cx + cardW / 2, y + 5.5, { align: 'center' });
    doc.setTextColor(...card.tColor);
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text(card.value, cx + cardW / 2, y + 14, { align: 'center' });
  });
  y += 23;

  // ── Aviso legal ──
  const lH = legalBox(doc, mX, y, cW, [
    'RELATORIO DE BANCO DE HORAS — Art. 59 §2° CLT · Portaria MTE 671/2021.',
    'Este documento comprova o controle de jornada. O empregador deve manter registros por no minimo 5 anos.',
  ], LEGAL_BG, LEGAL_TXT);
  y += lH + 2;

  // ── Tabela de dias ──
  const cols = [
    { label: 'Data',    w: 40 },
    { label: 'Entrada', w: 24 },
    { label: 'Pausa',   w: 22 },
    { label: 'Volta',   w: 22 },
    { label: 'Saida',   w: 22 },
    { label: 'Total',   w: 24 },
    { label: 'Saldo',   w: cW - 40 - 24 - 22 - 22 - 22 - 24 },
  ];
  const rowH = 7.5;

  function drawTableHead(yPos) {
    doc.setFillColor(...PRIMARY);
    doc.rect(mX, yPos, cW, rowH, 'F');
    let cx = mX + 2;
    doc.setTextColor(...WHITE);
    doc.setFontSize(7);
    doc.setFont('helvetica', 'bold');
    cols.forEach(col => { doc.text(col.label, cx, yPos + rowH - 2); cx += col.w; });
    return yPos + rowH;
  }

  y = drawTableHead(y);

  bhData.forEach((day, idx) => {
    if (y > pageH - 22) {
      doc.addPage();
      y = drawTableHead(20);
    }

    const even = idx % 2 === 0;
    doc.setFillColor(even ? 249 : 255, even ? 250 : 255, even ? 251 : 255);
    doc.rect(mX, y, cW, rowH, 'F');

    const balSign = day.balanceMin >= 0 ? '+' : '';
    const cells = [
      { text: day.dateLabel, color: TEXT, bold: day.hasData },
      { text: day.entrada, color: TEXT, bold: false },
      { text: day.pausa,   color: TEXT, bold: false },
      { text: day.volta,   color: TEXT, bold: false },
      { text: day.saida,   color: TEXT, bold: false },
      { text: day.hasData ? formatMinutes(day.workedMin) : '—', color: TEXT, bold: day.hasData },
      { text: day.hasData ? balSign + formatMinutes(day.balanceMin) : '—',
        color: day.hasData ? (day.balanceMin >= 0 ? [5, 150, 105] : [185, 28, 28]) : MUTED,
        bold: day.hasData },
    ];

    let cx = mX + 2;
    cells.forEach((cell, ci) => {
      doc.setTextColor(...cell.color);
      doc.setFont('helvetica', cell.bold ? 'bold' : 'normal');
      doc.setFontSize(7);
      doc.text(cell.text, cx, y + rowH - 2, { maxWidth: cols[ci].w - 2 });
      cx += cols[ci].w;
    });

    doc.setDrawColor(...BORDER);
    doc.setLineWidth(0.1);
    doc.line(mX, y + rowH, mX + cW, y + rowH);
    y += rowH;
  });

  // ── Assinaturas ──
  y += 8;
  if (y > pageH - 36) { doc.addPage(); y = 20; }
  const sigW = (cW - 10) / 2;
  doc.setDrawColor(...BORDER);
  doc.setLineWidth(0.3);
  doc.line(mX, y + 12, mX + sigW, y + 12);
  doc.setTextColor(...MUTED);
  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');
  doc.text('Assinatura do Empregado', mX + sigW / 2, y + 16, { align: 'center' });
  doc.text(userName, mX + sigW / 2, y + 20, { align: 'center' });

  doc.line(mX + sigW + 10, y + 12, mX + cW, y + 12);
  doc.text('Assinatura do Empregador / Responsavel', mX + sigW + 10 + sigW / 2, y + 16, { align: 'center' });
  doc.text(companyName || 'Empregador', mX + sigW + 10 + sigW / 2, y + 20, { align: 'center' });

  drawFooter(doc, authCode);

  const safeName   = userName.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();
  const safePeriod = periodoLabel.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();
  doc.save(`relatorio_bh_${safeName}_${safePeriod}.pdf`);
}

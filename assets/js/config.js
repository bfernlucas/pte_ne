/**
 * Configuração do dashboard PTE2026.
 *
 * COMO CONECTAR SUA PLANILHA DO GOOGLE SHEETS:
 * 1. Crie uma ABA LIMPA na sua planilha só para o dashboard, com os
 *    cabeçalhos na PRIMEIRA linha (o painel original tem 3 linhas de
 *    cabeçalho mescladas, que o dashboard não entende).
 *    Cabeçalhos sugeridos (exatamente estes nomes):
 *      id | iniciativa | objetivo | tematica | organizacao | municipio |
 *      estado | bioma | eixo | avaliador | lat | lon | pontuacao
 *    Dica: você pode preencher essa aba com fórmulas que apontam para o
 *    painel original (ex. ='Exercício - Matriz de avaliação'!A4), assim
 *    ela se atualiza sozinha.
 * 2. Compartilhe a planilha: "Qualquer pessoa com o link" → "Leitor".
 * 3. Copie o ID da URL (trecho entre /d/ e /edit) e cole em SHEET_ID.
 * 4. Ajuste SHEET_NAME para o nome da aba limpa.
 * 5. Defina USE_DEMO_DATA = false.
 */
const CONFIG = {
  // --- Conexão com o Google Sheets ---
  SHEET_ID: "1cdpIInSfNVRdaz4YEBIf5Wxkcx5Mwpc__SToVnssRyg",
  SHEET_GID: "1168173087", // id da aba (vem na URL após gid=). Tem prioridade.
  SHEET_NAME: "Dashboard", // usado só se SHEET_GID estiver vazio

  // true = usa os 52 registros embutidos; false = lê a planilha do Google ao vivo.
  USE_DEMO_DATA: false,

  // Atualização automática (tempo real). Intervalo em segundos. 0 = desligado.
  REFRESH_SECONDS: 60,

  // --- Mapeamento de colunas ---
  COLUMNS: {
    label: "iniciativa", // rótulo principal de cada registro
    lat: "lat",
    lon: "lon",
    // Campos exibidos no popup do mapa
    popup: ["organizacao", "municipio", "estado", "eixo", "setor"],
    // Colunas mostradas na tabela: { key, label, format }
    table: [
      { key: "id", label: "ID", format: "int" },
      { key: "iniciativa", label: "Iniciativa" },
      { key: "organizacao", label: "Organização" },
      { key: "data_fundacao", label: "Fundação" },
      { key: "municipio", label: "Município" },
      { key: "estado", label: "UF" },
      { key: "bioma", label: "Bioma" },
      { key: "eixo", label: "Eixo" },
      { key: "setor", label: "Setor" },
      { key: "natureza", label: "Natureza jurídica" },
      { key: "pontuacao", label: "Pontuação", format: "num" },
    ],
  },

  // --- Cartões KPI ---
  // Tipos: "count" (nº de registros), "distinct" (valores únicos de uma coluna),
  //        "avg" (média), "sum" (soma). 'format' opcional: int|money|num
  KPIS: [
    { type: "count", label: "Iniciativas" },
    { type: "distinct", key: "estado", label: "Estados" },
    { type: "distinct", key: "eixo", label: "Eixos" },
    { type: "avg", key: "pontuacao", label: "Pontuação média", format: "num" },
  ],

  // --- Gráficos (contagem de registros por categoria) ---
  CHARTS: {
    bar: { key: "estado", title: "Iniciativas por estado" },
    pie: { key: "eixo", title: "Distribuição por eixo" },
  },

  // --- Filtros (geram menus suspensos no topo) ---
  FILTERS: [
    { key: "eixo", label: "Eixo" },
    { key: "estado", label: "Estado" },
    { key: "bioma", label: "Bioma" },
    { key: "setor", label: "Setor" },
    { key: "natureza", label: "Natureza jurídica" },
  ],
};

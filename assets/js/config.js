/**
 * Configuração do dashboard.
 *
 * COMO CONECTAR SUA PLANILHA DO GOOGLE SHEETS:
 * 1. Abra sua planilha no Google Sheets.
 * 2. Clique em "Compartilhar" → "Qualquer pessoa com o link" → "Leitor".
 * 3. Copie o ID da planilha da URL. Exemplo:
 *      https://docs.google.com/spreadsheets/d/AQUI_ESTA_O_ID/edit
 *    O ID é o trecho entre /d/ e /edit.
 * 4. Cole o ID em SHEET_ID abaixo e ajuste SHEET_NAME para o nome da aba.
 * 5. Defina USE_DEMO_DATA = false.
 *
 * Não precisa de chave de API: o dashboard usa o endpoint público "gviz"
 * do Google, que devolve os dados em tempo real a cada carregamento.
 */
const CONFIG = {
  // --- Conexão com o Google Sheets ---
  SHEET_ID: "COLE_O_ID_DA_SUA_PLANILHA_AQUI",
  SHEET_NAME: "Página1", // nome da aba (guia) que contém os dados

  // Enquanto não plugar a planilha, deixe true para ver dados de exemplo.
  USE_DEMO_DATA: true,

  // Atualização automática (tempo real). Intervalo em segundos. 0 = desligado.
  REFRESH_SECONDS: 60,

  // --- Mapeamento de colunas ---
  // Diga ao dashboard quais colunas da sua planilha usar.
  // Os valores devem bater EXATAMENTE com os cabeçalhos da primeira linha.
  COLUMNS: {
    label: "bairro", // nome de cada item (rótulo de gráficos/tabela)
    category: "cidade", // usado para agrupar/filtrar
    lat: "lat", // latitude (para o mapa)
    lon: "lon", // longitude (para o mapa)
    // Métricas numéricas: { coluna, rótulo, formato }
    metrics: [
      { key: "estabelecimentos", label: "Estabelecimentos", format: "int" },
      { key: "renda_media", label: "Renda média", format: "money" },
      { key: "populacao", label: "População", format: "int" },
    ],
  },

  // Métrica principal exibida nas barras do gráfico e no tamanho dos pontos.
  PRIMARY_METRIC: "estabelecimentos",
};

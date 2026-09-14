#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Monta dados_campo.json -- a camada de evidencia das incursoes (P3, P4, P5).

Fonte: Documentos Tecnicos 3, 4 e 5 (Quanta/OEI). As notas vem do Apendice 2
do P5, que e a fonte canonica: o texto corrido dos eixos tem rotulos de
classificacao divergentes e a coluna "peso" das fichas e ambigua.

Cruza cada experiencia com a base de prospeccao (assets/data/iniciativas.js)
para permitir a comparacao gabinete x campo.
"""
import json, os, re, unicodedata

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BASE = os.path.join(ROOT, "assets", "data", "iniciativas.js")
OUT = os.path.join(ROOT, "dados_campo.json")

# nome | eixo | A oper | B inv | C impacto | D inov | total/100 | classif
# | envelope min | max (R$ mi) | postura | base informacional | rota | o que se apoia
EXP = [
 ("Fazenda Nutrilite Brasil","NIVA",5,5,5,5,100,"alta",1.1,2.2,"condicionado","parcial","R2",
  "Semimecanização da colheita de acerola, diversificação de culturas e contabilização de emissões."),
 ("Trilha Caminhos da Ibiapaba","NIVA",5,5,5,5,100,"alta",3.6,5.1,"condicionado","parcial","R2",
  "Formalização jurídica do movimento, indicadores e cadeia do ecoturismo comunitário."),
 ("No Clima da Caatinga","NIVA",5,5,5,5,100,"alta",5.1,8.3,"quantificacao","ausente","R2",
  "Restauração com raízes alongadas, SAFs, segurança hídrica e diversificação financeira."),
 ("Tecnologia SARA","NIVA",5,5,5,5,100,"alta",3.0,5.6,"quantificacao","ausente","R1",
  "Programa permanente de difusão, dimensionamento nas três escalas e unidades nos 9 estados."),
 ("Rede Xique Xique","BIO",5,4,5,5,97,"alta",2.0,3.5,"quantificacao","ausente","Extra",
  "Política de logística para 33 municípios, capital de giro e unidade de polpa com SIF."),
 ("Acreditar Microcrédito","FSI",4,5,5,5,95,"alta",10.2,13.6,"direto","completa","R3",
  "Ampliação do fundo, redução de juros por diluição de custo e formação de agentes de crédito."),
 ("Sistema Metroviário do Ceará","NIVA",5,5,4,5,94,"alta",40.0,80.0,"condicionado","parcial","Extra",
  "Interiorização (VLT Cariri e Sobral), integração tarifária e transição para energia limpa."),
 ("Porto Digital — Recife","ADT",5,4,4,5,91,"alta",13.0,23.5,"quantificacao","ausente","R3",
  "Interiorização para Petrolina, Garanhuns e Araripina e sistematização da transferência."),
 ("Fazenda Tamanduá","NIVA",5,4,5,4,91,"alta",1.7,3.0,"quantificacao","ausente","Extra",
  "Crédito e ATER para médio porte, mecanismo de PSA e selo de origem. Não é custeio."),
 ("CTERSA","TE",3,5,5,5,90,"alta",3.6,6.1,"preparacao","ausente","R1",
  "Definição da configuração jurídica (gargalo primário) e custeio pós-implantação."),
 ("EMBRAPII IA — IFCE","ADT",5,4,3,5,85,"alta",4.8,8.8,"condicionado","parcial","Extra",
  "Prospecção dirigida à transformação ecológica e serviços tecnológicos a pequenos produtores."),
 ("Projeto Vale Sustentável","NIVA",4,3,5,4,83,"alta",10.4,12.7,"condicionado","parcial","R1",
  "Metodologia de contabilização de carbono para a Caatinga e piloto de PSA com o INCRA."),
 ("Instituto Caburé","NIVA",3,4,5,4,81,"alta",3.4,4.5,"direto","completa","R2",
  "Fortalecimento institucional, sistematização da metodologia e economia azul."),
 ("Instituto Casaca de Couro","NIVA",4,4,4,4,80,"alta",2.3,3.9,"preparacao","ausente","R1",
  "Irrigação de áreas coletivas, redução do custo da certificação e ampliação da equipe."),
 ("Cooperativa Pindorama","TE",4,4,4,4,80,"alta",5.9,11.1,"preparacao","ausente","R3",
  "Antecipação do projeto de biogás da vinhaça e sistematização da repartição de CBIOs."),
 ("Blue C","NIVA",3,3,5,4,78,"estrategico",0.15,0.35,"preparatorio","completa","Extra",
  "Capital de giro para produzir algas antes da venda. Menor operação da carteira."),
 ("Um Milhão de Tetos Solares","TE",5,3,3,4,76,"estrategico",0.8,1.5,"preparatorio","ausente","R1",
  "Assessoria jurídica para a barreira regulatória com a concessionária."),
 ("Consórcio Público da Ibiapaba","EC",3,4,4,4,75,"estrategico",1.5,3.0,"preparatorio","parcial","R2",
  "Centrais de resíduos, redução da dependência do ICMS Verde e inclusão de catadores."),
 ("Cooperativa Solar Bem Viver","TE",3,4,4,4,75,"estrategico",0.4,0.8,"preparatorio","ausente","R1",
  "Equacionamento da divisão de áreas de concessão entre dois cadastros da concessionária."),
 ("Porto Digital — Caruaru","ADT",3,4,2,4,63,"estrategico",0.0,0.0,"preparatorio","ausente","R3",
  "Sem alocação própria: contemplada no envelope do Porto Digital — Recife."),
 ("Programa Terra Plantar","BIO",4,2,3,3,62,"estrategico",1.0,2.0,"preparatorio","ausente","R3",
  "Estruturação de indicadores e rastreabilidade da aplicação de recursos."),
 ("AMAREZ","EC",3,3,3,3,60,"estrategico",0.10,0.20,"preparatorio","parcial","R1",
  "Capital de giro para estocar material e vender direto à indústria, sem intermediação."),
 ("Banco Comunitário de Araçoiaba","FSI",2,2,2,3,46,"nao",0.0,0.0,"","","R3",
  "Não recomendada nesta etapa: requer fortalecimento institucional prévio."),
 ("Carbono Social do Bioma Caatinga","FSI",2,2,1,3,40,"nao",0.0,0.0,"","","R3",
  "Não recomendada nesta etapa: sem créditos gerados, sem receita e sem financiamento."),
]

# ---------------------------------------------------------------------------
# Gargalos e potencialidades recorrentes, codificados a partir das fichas
# dos Produtos 3 e 4 (secoes de analise) e das fichas de recomendacao do P5.
# So se registra o que o relatorio afirma sobre a iniciativa -- ausencia de
# codigo significa "nao afirmado", nao "nao existe".
# ---------------------------------------------------------------------------
GARGALOS = {
    "fonte_unica":      "Dependência de fonte única de financiamento",
    "sem_indicadores":  "Indicadores de impacto ausentes ou frágeis",
    "equipe_reduzida":  "Equipe reduzida ou sem remuneração",
    "governanca":       "Governança concentrada em poucas lideranças",
    "metodologia":      "Metodologia não documentada, impedindo replicação",
    "regulatorio":      "Barreira regulatória ou jurídica",
    "sem_cnpj":         "Sem personalidade jurídica ou delimitação institucional",
    "descontinuidade":  "Descontinuidade política e administrativa",
    "hidrica":          "Insegurança hídrica e climática",
    "credito":          "Dificuldade de acesso a crédito e financiamento verde",
}
POTENCIAIS = {
    "replicabilidade":  "Replicabilidade comprovada, não apenas potencial",
    "participativa":    "Governança participativa e base social organizada",
    "mulheres":         "Protagonismo de mulheres e juventude",
    "carbono":          "Mercado de carbono ou PSA como oportunidade declarada",
    "conserva_renda":   "Conservação convertida em renda",
    "tec_social":       "Tecnologia social adaptada ao semiárido",
    "consorcio":        "Interesse explícito na carteira do Consórcio Nordeste",
    "inov_governanca":  "Inovação de governança transferível",
}

# nome -> (gargalos, potencialidades)
ANALISE = {
 "Consórcio Público da Ibiapaba": (["fonte_unica","sem_indicadores","equipe_reduzida","governanca","descontinuidade"], ["replicabilidade","inov_governanca"]),
 "Instituto Caburé": (["fonte_unica","equipe_reduzida","governanca","metodologia"], ["participativa","mulheres","carbono","conserva_renda"]),
 "Fazenda Nutrilite Brasil": (["hidrica"], ["replicabilidade","mulheres","conserva_renda"]),
 "Trilha Caminhos da Ibiapaba": (["fonte_unica","sem_indicadores","equipe_reduzida","sem_cnpj"], ["participativa","carbono","conserva_renda"]),
 "No Clima da Caatinga": (["fonte_unica"], ["replicabilidade","participativa","carbono","conserva_renda","tec_social"]),
 "AMAREZ": (["fonte_unica","sem_indicadores","governanca","metodologia","regulatorio","credito"], []),
 "CTERSA": (["fonte_unica","sem_indicadores","equipe_reduzida","governanca","metodologia","sem_cnpj","descontinuidade","credito"], ["consorcio"]),
 "Tecnologia SARA": (["fonte_unica","sem_indicadores","hidrica","credito"], ["replicabilidade","tec_social","consorcio"]),
 "Projeto Vale Sustentável": (["fonte_unica","sem_indicadores","equipe_reduzida","governanca","metodologia","regulatorio","hidrica"], ["replicabilidade","participativa","mulheres","carbono","conserva_renda","tec_social"]),
 "Cooperativa Solar Bem Viver": (["fonte_unica","sem_indicadores","governanca","metodologia","regulatorio","credito"], ["participativa","mulheres","consorcio"]),
 "Um Milhão de Tetos Solares": (["fonte_unica","sem_indicadores","regulatorio"], ["participativa","mulheres","tec_social","consorcio"]),
 "Instituto Casaca de Couro": (["fonte_unica","sem_indicadores","equipe_reduzida","governanca","hidrica","credito"], ["replicabilidade","conserva_renda","consorcio"]),
 "Porto Digital — Recife": (["sem_indicadores","governanca"], ["replicabilidade","participativa","mulheres"]),
 "Programa Terra Plantar": (["fonte_unica","sem_indicadores","equipe_reduzida","metodologia","descontinuidade","hidrica","credito"], ["tec_social","inov_governanca"]),
 "Banco Comunitário de Araçoiaba": (["fonte_unica","sem_indicadores","equipe_reduzida","governanca","sem_cnpj","descontinuidade"], ["mulheres"]),
 "Acreditar Microcrédito": (["equipe_reduzida","credito"], ["replicabilidade","participativa","mulheres"]),
 "Porto Digital — Caruaru": (["fonte_unica","sem_indicadores","descontinuidade"], ["consorcio"]),
 "Carbono Social do Bioma Caatinga": (["fonte_unica","sem_indicadores","sem_cnpj"], ["participativa","carbono"]),
 "Cooperativa Pindorama": (["fonte_unica","sem_indicadores","equipe_reduzida","governanca","metodologia"], ["carbono","conserva_renda","inov_governanca"]),
 "Rede Xique Xique": (["sem_indicadores"], ["participativa","mulheres","conserva_renda"]),
 "Fazenda Tamanduá": (["credito","metodologia"], ["replicabilidade","conserva_renda"]),
 "Sistema Metroviário do Ceará": ([], ["replicabilidade"]),
 "EMBRAPII IA — IFCE": (["sem_indicadores"], ["replicabilidade","consorcio"]),
 "Blue C": (["equipe_reduzida","credito"], ["carbono","tec_social"]),
}

# Perfil institucional e agenda da visita. Valores None = nao informado na fonte.
# custo_anual e gap em reais. Fonte: fichas dos P3/P4 e secao 7 do P5.
PERFIL = {
 "Consórcio Público da Ibiapaba":   dict(ano=2021, natureza="Consórcio Público", equipe=2, benef="128 catadores · 8 municípios", custo_anual=840_000, gap=None, custo_p5=True, gap_p5=False, mun="Tianguá", uf="CE", data="17/07", modo="presencial"),
 "Instituto Caburé":                dict(ano=2020, natureza="Associação Privada", equipe=0, benef="~1.400 hab. · 30 mulheres", custo_anual=607_400, gap=1_822_200, custo_p5=True, gap_p5=True, mun="Cajueiro da Praia", uf="PI", data="22/07", modo="virtual"),
 "Fazenda Nutrilite Brasil":        dict(ano=1998, natureza="Sociedade Empresária Ltda.", equipe=226, benef="138 produtores integrados", custo_anual=None, gap=None, mun="Ubajara", uf="CE", data="23/07", modo="presencial"),
 "Trilha Caminhos da Ibiapaba":     dict(ano=2023, natureza="Movimento sem CNPJ", equipe=8, benef="18 comunidades · 6 municípios", custo_anual=421_000, gap=None, custo_p5=True, gap_p5=False, mun="Viçosa do Ceará", uf="CE", data="28/07", modo="presencial"),
 "No Clima da Caatinga":            dict(ano=2011, natureza="Associação Privada", equipe=32, benef="33.309 pessoas · 40 comunidades", custo_anual=None, gap=None, mun="Crateús", uf="CE", data="29/07", modo="virtual"),
 "AMAREZ":                          dict(ano=2018, natureza="Associação civil", equipe=13, benef="13 associados", custo_anual=72_000, gap=100_000, custo_p5=False, gap_p5=True, mun="Arez", uf="RN", data="16/07", modo="presencial"),
 "CTERSA":                          dict(ano=2026, natureza="Unidade de pesquisa (INSA)", equipe=1, benef="pesquisadores e empresas do semiárido", custo_anual=None, gap=None, mun="Campina Grande", uf="PB", data="17/07", modo="presencial"),
 "Tecnologia SARA":                 dict(ano=2019, natureza="Órgão Público Federal", equipe=None, benef="+500 unidades em 9 estados", custo_anual=None, gap=None, mun="Campina Grande", uf="PB", data="17/07", modo="presencial"),
 "Projeto Vale Sustentável":        dict(ano=2013, natureza="Associação Privada", equipe=9, benef="11 municípios · 26 comunidades", custo_anual=2_250_000, gap=None, custo_p5=True, gap_p5=False, mun="Assú", uf="RN", data="21/07", modo="presencial"),
 "Cooperativa Solar Bem Viver":     dict(ano=2015, natureza="Sociedade Cooperativa", equipe=0, benef="26 cooperados", custo_anual=None, gap=None, mun="Maturéia", uf="PB", data="22/07", modo="presencial"),
 "Um Milhão de Tetos Solares":      dict(ano=2024, natureza="Associação Privada", equipe=None, benef="100 famílias · 100 jovens", custo_anual=None, gap=None, mun="Remígio", uf="PB", data="23/07", modo="presencial"),
 "Instituto Casaca de Couro":       dict(ano=2003, natureza="Associação Privada", equipe=7, benef="984 famílias · 71 municípios", custo_anual=None, gap=None, mun="Pirpirituba", uf="PB", data="23/07", modo="presencial"),
 "Porto Digital — Recife":          dict(ano=2000, natureza="Organização Social + ICT", equipe=150, benef="~600 empresas · 24 mil postos", custo_anual=None, gap=None, mun="Recife", uf="PE", data="27/07", modo="presencial"),
 "Programa Terra Plantar":          dict(ano=2022, natureza="Órgão Público Estadual", equipe=None, benef="+100 mil agricultores · 184 municípios", custo_anual=None, gap=None, custo_p5=False, gap_p5=True, mun="Recife", uf="PE", data="27/07", modo="presencial"),
 "Banco Comunitário de Araçoiaba":  dict(ano=2024, natureza="Não localizada", equipe=3, benef="~500 pessoas · 11 estabelecimentos", custo_anual=None, gap=None, mun="Araçoiaba", uf="PE", data="28/07", modo="presencial"),
 "Acreditar Microcrédito":          dict(ano=2006, natureza="OSCIP", equipe=32, benef="~20 mil beneficiários acumulados", custo_anual=650_000, gap=10000000, custo_p5=False, gap_p5=True, mun="Glória do Goitá", uf="PE", data="29/07", modo="presencial"),
 "Porto Digital — Caruaru":         dict(ano=2016, natureza="Organização Social + ICT", equipe=None, benef="11 empresas · 34 profissionais", custo_anual=None, gap=None, mun="Caruaru", uf="PE", data="29/07", modo="presencial"),
 "Carbono Social do Bioma Caatinga":dict(ano=2020, natureza="Associação Privada", equipe=None, benef="8 municípios do Alto Sertão", custo_anual=None, gap=None, mun="Delmiro Gouveia", uf="AL", data="30/07", modo="presencial"),
 "Cooperativa Pindorama":           dict(ano=1956, natureza="Sociedade Cooperativa", equipe=6, benef="1.100 associados · ~30 mil pessoas", custo_anual=None, gap=None, mun="Coruripe", uf="AL", data="31/07", modo="presencial"),
 "Rede Xique Xique":                dict(ano=2004, natureza="Rede + cooperativa", equipe=None, benef="~1.000 vinculadas · 80% mulheres", custo_anual=None, gap=None, mun="Mossoró", uf="RN", data=None, modo="presencial"),
 "Fazenda Tamanduá":                dict(ano=1977, natureza="Empresa privada", equipe=None, benef="2.717 ha · RPPN de 381,8 ha", custo_anual=None, gap=None, mun="Patos", uf="PB", data=None, modo="presencial"),
 "Sistema Metroviário do Ceará":    dict(ano=1997, natureza="Empresa estadual", equipe=None, benef="16,4 mi de passageiros/ano", custo_anual=None, gap=400_000_000, custo_p5=False, gap_p5=True, mun="Fortaleza", uf="CE", data="06/08", modo="presencial"),
 "EMBRAPII IA — IFCE":              dict(ano=2015, natureza="Unidade EMBRAPII (IFCE)", equipe=None, benef="186 empresas · +3.000 estudantes", custo_anual=None, gap=27_000_000, custo_p5=False, gap_p5=True, mun="Fortaleza", uf="CE", data="06/08", modo="presencial"),
 "Blue C":                          dict(ano=2017, natureza="Empresa (deep tech)", equipe=5, benef="4 famílias produtoras", custo_anual=10_000, gap=20_000, custo_p5=True, gap_p5=True, mun="Flecheiras", uf="CE", data="07/08", modo="presencial"),
}

# Correspondencias que o cruzamento por tokens nao acha (nomes muito distintos
# entre o relatorio e a planilha). Conferidas uma a uma contra municipio e
# organizacao. None = confirmado como ausente da base de prospeccao.
REF_OVERRIDES = {
    "EMBRAPII IA — IFCE": 9,               # Rede MCTI/EMBRAPII de Inovacao em IA
    "AMAREZ": 31,                          # Modelo de Gestao Municipal de Residuos de Arez
    "Blue C": 55,                          # BlueC (grafia sem espaco na planilha)
    "Carbono Social do Bioma Caatinga": 53, # Projetos de Conservacao do Bioma Caatinga, Delmiro Gouveia/AL
}

# Descobertas em campo: nao constam da base de prospecao. Coordenadas do local
# efetivamente visitado, para que aparecam no mapa.
NOVAS_EM_CAMPO = {
    "CTERSA":            {"municipio": "Campina Grande", "estado": "PB", "lat": -7.2306, "lon": -35.8811},
    "Instituto Caburé":  {"municipio": "Cajueiro da Praia", "estado": "PI", "lat": -2.9333, "lon": -41.3417},
}

# ---------------------------------------------------------------------------
# Secao 7.4 do P5: familias de mecanismos de captacao e a aproximacao
# postura -> familia. O documento nunca mapeia mecanismo a iniciativa
# nominalmente; o mapa e por grupo, e assim fica registrado aqui.
# ---------------------------------------------------------------------------
CAPTACAO = [
 {"nome": "Instrumentos do Plano de Transformação Ecológica nacional",
  "aderencia": "Carteira integralmente climática; o PTE-NE é desdobramento territorial do plano nacional",
  "atencao": "Desenhados para operações de valor elevado e de acesso tecnicamente complexo. A classificação na Taxonomia Sustentável Brasileira tende a virar requisito de elegibilidade."},
 {"nome": "Canal regional em capitalização — NBD e AFD via FDNE/Sudene",
  "aderencia": "O fluxo internacional mais diretamente destinado ao Nordeste",
  "atencao": "Porte mínimo de R$ 15 a 20 mi, com redução excepcional a R$ 5 mi, e contrapartida de 20%. Nenhuma iniciativa da carteira acessou a Sudene."},
 {"nome": "Fundos climáticos internacionais",
  "aderencia": "Experiências de infraestrutura verde-azul e bioeconomia",
  "atencao": "Exigem personalidade jurídica própria, entidade acreditada como intermediária, salvaguardas e sistemas de mensuração — pré-condições que parte da carteira não atende."},
 {"nome": "Fundos constitucionais e crédito de desenvolvimento",
  "aderencia": "Operações com capacidade de endividamento: cooperativas, empresas e ICTs",
  "atencao": "Garantias e regularidade contábil. Parte das organizações não comporta dívida."},
 {"nome": "Fundos socioambientais privados e filantropia",
  "aderencia": "Organizações de base comunitária, várias com histórico nessas fontes",
  "atencao": "Apoios pontuais e de menor volume. Não financiam ativo pesado nem custeio prolongado."},
 {"nome": "Mercado de carbono e pagamento por serviços ambientais",
  "aderencia": "Conservação e restauração da Caatinga, com base fundiária definida",
  "atencao": "A ausência de metodologia consolidada de contabilização para a Caatinga ainda bloqueia a monetização."},
 {"nome": "Compras públicas e mercados institucionais",
  "aderencia": "Comercialização solidária e produção da agricultura familiar",
  "atencao": "Certificação, habilitação sanitária e logística de entrega."},
 {"nome": "Parcerias público-privadas, concessões e contratos de gestão",
  "aderencia": "Infraestrutura de grande porte e equipamentos públicos",
  "atencao": "Modelagem jurídica específica e prazos longos de estruturação."},
]

POSTURA_MECANISMO = {
 "direto":        {"familias": "Blended finance e capital catalítico · fundos socioambientais privados",
                   "obs": "Perfil compatível com tranche de primeira perda."},
 "condicionado":  {"familias": "Crédito de desenvolvimento · PPPs · mercado de carbono, onde couber",
                   "obs": "O dado que falta define o instrumento: sem custo apurado o crédito é inviável; sem necessidade quantificada a parceria não se modela."},
 "quantificacao": {"familias": "Sublinha de estruturação de projetos do Eco Invest · assistência técnica de organismos de cooperação",
                   "obs": "A correspondência mais direta do mapa: essas experiências precisam exatamente do produto que a sublinha oferece."},
 "preparacao":    {"familias": "Fundos socioambientais privados · filantropia · emendas e fundos estaduais",
                   "obs": "Volumes pequenos e finalidade institucional."},
 "preparatorio":  {"familias": "Fundos socioambientais privados · filantropia · emendas e fundos estaduais",
                   "obs": "O envelope financia a remoção da pré-condição, não a operação."},
}

AGENDAS = [
 {"t": "Metodologia de contabilização de carbono para a Caatinga",
  "d": "Inexistente. Bloqueia ao mesmo tempo o mecanismo de maior potencial de receita recorrente e o eixo de maior peso. O Vale Sustentável já mensurou mais de 1.700 t sem conseguir monetizar; suas áreas são a base empírica natural."},
 {"t": "Formalização jurídica",
  "d": "A Trilha opera sem personalidade jurídica, o CTERSA aponta a configuração jurídica como gargalo primário e a AMAREZ estuda a transição de modelo. Enquanto não se resolve, os canais de maior volume permanecem fechados independentemente do mérito técnico."},
 {"t": "Previsibilidade plurianual",
  "d": "Gargalo mais determinante que o volume. Formatos de âncora de médio prazo: contrato de gestão, fundo territorial, chamada permanente. O Fundo Caatinga, em estudo por uma das organizações, é a referência citada."},
]

ESCALA = {
 "piso_padrao": 15.0, "piso_reduzido": 5.0,
 "nota": "Individualmente, apenas 2 das 15 recomendadas alcançam o porte mínimo padrão do fundo regional e 5 ficam abaixo até do piso reduzido. Agregadas por eixo, Infraestrutura Verde-Azul e Adensamento Tecnológico superam o piso padrão com folga; Finanças e Transição Energética superam o reduzido; Bioeconomia permanece abaixo de qualquer patamar mesmo somada. Daí a proposta de tratar a carteira como programa único, com subprojetos sob agente credenciado."
}

PESOS = {"impacto": 30, "inovacao": 30, "operacao": 25, "investimento": 15}
STOP = set("de da do das dos e a o as os para em no na programa projeto instituto "
           "associacao cooperativa rede sistema centro unidade publico parque "
           "tecnologico sociedade brasil nordeste com".split())


def _norm(s):
    s = unicodedata.normalize("NFKD", s).encode("ascii", "ignore").decode().lower()
    return re.sub(r"[^a-z0-9 ]", " ", s)


def _toks(s):
    return {t for t in _norm(s).split() if len(t) > 2 and t not in STOP}


def carregar_base():
    txt = open(BASE, encoding="utf-8").read()
    bruto = txt.split("=", 1)[1].strip().rstrip(";")
    return json.loads(bruto)["iniciativas"]


def main():
    base = carregar_base()
    saida = []
    for (nome, eixo, a, b, c, d, total, classif, emin, emax,
         postura, baseinf, rota, apoio) in EXP:
        ti = _toks(nome)
        melhor, escore = None, 0.0
        for r in base:
            tb = _toks(r["nome"] + " " + (r.get("org") or ""))
            if not ti or not tb:
                continue
            s = len(ti & tb) / max(1, min(len(ti), len(tb)))
            if s > escore:
                escore, melhor = s, r
        forcado = REF_OVERRIDES.get(nome)
        if forcado is not None:
            melhor = next((r for r in base if r["id"] == forcado), None)
            escore = 1.0
        casou = melhor is not None and escore >= 0.6
        saida.append({
            "nome": nome,
            "eixo_cod": eixo,
            "notas": {"operacao": a, "investimento": b, "impacto": c, "inovacao": d},
            "total": total,
            "classificacao": classif,
            "envelope": {"min": emin, "max": emax},
            "postura": postura,
            "base_informacional": baseinf,
            "rota": rota,
            "apoio": apoio,
            "gargalos": ANALISE.get(nome, ([], []))[0],
            "potenciais": ANALISE.get(nome, ([], []))[1],
            "perfil": PERFIL.get(nome, {}),
            "ref_id": melhor["id"] if casou else None,
            "gabinete": melhor["pontuacao"] if casou else None,
            "nova_em_campo": nome in NOVAS_EM_CAMPO,
            "municipio": melhor.get("municipio") if casou else NOVAS_EM_CAMPO.get(nome, {}).get("municipio"),
            "estado": melhor.get("estado") if casou else NOVAS_EM_CAMPO.get(nome, {}).get("estado"),
            "lat": melhor.get("lat") if casou else NOVAS_EM_CAMPO.get(nome, {}).get("lat"),
            "lon": melhor.get("lon") if casou else NOVAS_EM_CAMPO.get(nome, {}).get("lon"),
        })

    doc = {
        "meta": {
            "fonte": "Documentos Tecnicos 3, 4 e 5 - Quanta/OEI",
            "contrato": "13849/2026 OEI/FPOS - TdR 12.500/2026",
            "referencia_notas": "Apendice 2 do Produto 5",
            "pesos": PESOS,
            "faixas": {"alta": "80 a 100", "estrategico": "50 a 79", "nao": "abaixo de 50"},
            "moeda": "R$ milhoes correntes de agosto de 2026, horizonte de 36 meses",
            "total": len(saida),
        "gargalos": GARGALOS,
        "potenciais": POTENCIAIS,
        "captacao": CAPTACAO,
        "postura_mecanismo": POSTURA_MECANISMO,
        "agendas": AGENDAS,
        "escala": ESCALA,
        },
        "experiencias": saida,
    }
    json.dump(doc, open(OUT, "w", encoding="utf-8"), ensure_ascii=False, indent=1)

    casadas = sum(1 for x in saida if x["ref_id"])
    print(f"OK  {len(saida)} experiencias -> {os.path.relpath(OUT, ROOT)}")
    print(f"    cruzadas com a base de prospeccao: {casadas}  |  sem correspondencia: {len(saida)-casadas}")
    print(f"    envelope: R$ {sum(x['envelope']['min'] for x in saida):.1f} a "
          f"{sum(x['envelope']['max'] for x in saida):.1f} mi")


if __name__ == "__main__":
    main()

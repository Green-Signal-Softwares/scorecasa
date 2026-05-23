// Tipos compartilhados + dataset curado de overrides de tier.
//
// Os tiers aqui declarados têm precedência sobre a classificação automática
// (RM ou população) feita pelo script `build-dataset.ts`. Use este arquivo
// para registrar exceções conhecidas e cidades onde a portaria MCMV 2026 /
// PMCID atribui um tier diferente do que cairia pela regra geral.
//
// Classificação MCMV 2026:
//   A — Grandes metrópoles (SP, RJ, DF e principais RMs) — teto R$ 275.000
//   B — Demais metrópoles e municípios em RM > 1M       — teto R$ 270.000
//   C — Capitais regionais / 250k a 1M habitantes        — teto R$ 260.000
//   D — Cidades médias (100k a 250k)                     — teto R$ 255.000
//   E — Pequenas (< 100k) e fallback conservador         — teto R$ 230.000

export type MCMVTier = "A" | "B" | "C" | "D" | "E";

export const UFS = [
  "AC", "AL", "AM", "AP", "BA", "CE", "DF", "ES", "GO", "MA", "MG", "MS", "MT", "PA",
  "PB", "PE", "PI", "PR", "RJ", "RN", "RO", "RR", "RS", "SC", "SE", "SP", "TO",
] as const;
export type UF = (typeof UFS)[number];

export const UF_NAMES: Record<UF, string> = {
  AC: "Acre", AL: "Alagoas", AM: "Amazonas", AP: "Amapá", BA: "Bahia",
  CE: "Ceará", DF: "Distrito Federal", ES: "Espírito Santo", GO: "Goiás",
  MA: "Maranhão", MG: "Minas Gerais", MS: "Mato Grosso do Sul",
  MT: "Mato Grosso", PA: "Pará", PB: "Paraíba", PE: "Pernambuco",
  PI: "Piauí", PR: "Paraná", RJ: "Rio de Janeiro", RN: "Rio Grande do Norte",
  RO: "Rondônia", RR: "Roraima", RS: "Rio Grande do Sul",
  SC: "Santa Catarina", SE: "Sergipe", SP: "São Paulo", TO: "Tocantins",
};

export function normalizeCity(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/['’´`]/g, "")
    .trim()
    .toLowerCase();
}

export function isValidUf(uf: string | null | undefined): uf is UF {
  return !!uf && (UFS as readonly string[]).includes(uf);
}

// ── RIDE-DF (LC 94/1998 + LC 163/2018 + LC 200/2023) ────────────────────────
// Conjunto integrado de desenvolvimento DF + entorno — tratado como tier A
// junto com a RM de Brasília/DF. IDs do IBGE são resolvidos em tempo de
// build a partir dos pares (UF, nome).
export const RIDE_DF_CITIES: readonly { uf: UF; name: string }[] = [
  { uf: "DF", name: "Brasília" },
  // Goiás (29 municípios)
  { uf: "GO", name: "Abadiânia" },
  { uf: "GO", name: "Água Fria de Goiás" },
  { uf: "GO", name: "Águas Lindas de Goiás" },
  { uf: "GO", name: "Alexânia" },
  { uf: "GO", name: "Alto Paraíso de Goiás" },
  { uf: "GO", name: "Alvorada do Norte" },
  { uf: "GO", name: "Barro Alto" },
  { uf: "GO", name: "Cabeceiras" },
  { uf: "GO", name: "Cavalcante" },
  { uf: "GO", name: "Cidade Ocidental" },
  { uf: "GO", name: "Cocalzinho de Goiás" },
  { uf: "GO", name: "Corumbá de Goiás" },
  { uf: "GO", name: "Cristalina" },
  { uf: "GO", name: "Flores de Goiás" },
  { uf: "GO", name: "Formosa" },
  { uf: "GO", name: "Goianésia" },
  { uf: "GO", name: "Luziânia" },
  { uf: "GO", name: "Mimoso de Goiás" },
  { uf: "GO", name: "Niquelândia" },
  { uf: "GO", name: "Novo Gama" },
  { uf: "GO", name: "Padre Bernardo" },
  { uf: "GO", name: "Pirenópolis" },
  { uf: "GO", name: "Planaltina" },
  { uf: "GO", name: "Santo Antônio do Descoberto" },
  { uf: "GO", name: "São João d'Aliança" },
  { uf: "GO", name: "Simolândia" },
  { uf: "GO", name: "Valparaíso de Goiás" },
  { uf: "GO", name: "Vila Boa" },
  { uf: "GO", name: "Vila Propício" },
  // Minas Gerais (4 municípios)
  { uf: "MG", name: "Arinos" },
  { uf: "MG", name: "Buritis" },
  { uf: "MG", name: "Cabeceira Grande" },
  { uf: "MG", name: "Unaí" },
];

// Exposto também como Set "UF:nome-normalizado" para uso no script.
export const RIDE_DF_MUNICIPIOS: ReadonlySet<string> = new Set(
  RIDE_DF_CITIES.map(({ uf, name }) => `${uf}:${normalizeCity(name)}`),
);

// ── Overrides de tier (curado manualmente) ──────────────────────────────────
// Cidades onde queremos forçar um tier específico — em geral capitais
// regionais e municípios em RM/aglomerado urbano onde a regra "por
// população" subestima o porte habitacional efetivo.
//
// Tudo o que NÃO estiver aqui é resolvido pelo build script via RM oficial
// e/ou faixa populacional do Censo IBGE 2022.
type CityRecord = readonly [name: string, tier: MCMVTier];

export const CURATED_OVERRIDES: Record<UF, readonly CityRecord[]> = {
  AC: [
    ["Rio Branco", "B"], ["Cruzeiro do Sul", "D"], ["Sena Madureira", "D"],
    ["Tarauacá", "D"], ["Feijó", "D"],
  ],
  AL: [
    ["Maceió", "B"], ["Arapiraca", "C"], ["Rio Largo", "D"], ["Palmeira dos Índios", "D"],
    ["União dos Palmares", "D"], ["Penedo", "D"], ["Coruripe", "D"], ["Marechal Deodoro", "D"],
    ["Delmiro Gouveia", "D"], ["Santana do Ipanema", "D"],
  ],
  AM: [
    ["Manaus", "B"], ["Parintins", "D"], ["Itacoatiara", "D"], ["Manacapuru", "D"],
    ["Coari", "D"], ["Tabatinga", "D"], ["Tefé", "D"], ["Maués", "D"],
    ["Iranduba", "D"], ["São Gabriel da Cachoeira", "D"],
  ],
  AP: [
    ["Macapá", "B"], ["Santana", "C"], ["Laranjal do Jari", "D"],
    ["Oiapoque", "D"], ["Mazagão", "D"],
  ],
  BA: [
    ["Salvador", "A"], ["Feira de Santana", "B"], ["Vitória da Conquista", "B"],
    ["Camaçari", "A"], ["Itabuna", "C"], ["Juazeiro", "C"], ["Lauro de Freitas", "A"],
    ["Ilhéus", "C"], ["Jequié", "C"], ["Teixeira de Freitas", "C"], ["Alagoinhas", "C"],
    ["Barreiras", "C"], ["Porto Seguro", "C"], ["Simões Filho", "A"], ["Paulo Afonso", "C"],
    ["Eunápolis", "C"], ["Santo Antônio de Jesus", "C"], ["Valença", "D"],
    ["Candeias", "A"], ["Guanambi", "D"], ["Dias d'Ávila", "A"], ["Senhor do Bonfim", "D"],
    ["Itapetinga", "D"], ["Conceição do Coité", "D"], ["Bom Jesus da Lapa", "D"],
    ["Cruz das Almas", "D"], ["Itamaraju", "D"], ["Brumado", "D"], ["Irecê", "D"],
    ["Serrinha", "D"], ["Itaberaba", "D"], ["Mata de São João", "A"],
  ],
  CE: [
    ["Fortaleza", "A"], ["Caucaia", "A"], ["Juazeiro do Norte", "B"], ["Maracanaú", "A"],
    ["Sobral", "B"], ["Crato", "C"], ["Itapipoca", "C"], ["Maranguape", "A"],
    ["Iguatu", "C"], ["Quixadá", "C"], ["Pacatuba", "A"], ["Aquiraz", "A"],
    ["Quixeramobim", "D"], ["Canindé", "C"], ["Crateús", "C"], ["Russas", "C"],
    ["Tianguá", "D"], ["Aracati", "C"], ["Cascavel", "C"], ["Acaraú", "D"],
    ["Camocim", "D"], ["Horizonte", "A"], ["Pacajus", "A"], ["Eusébio", "A"],
    ["Itapajé", "D"],
  ],
  DF: [
    ["Brasília", "A"],
  ],
  ES: [
    ["Vitória", "A"], ["Vila Velha", "A"], ["Cariacica", "A"], ["Serra", "A"],
    ["Cachoeiro de Itapemirim", "B"], ["Linhares", "C"], ["São Mateus", "C"],
    ["Colatina", "C"], ["Guarapari", "A"], ["Aracruz", "C"], ["Viana", "A"],
    ["Nova Venécia", "D"], ["Barra de São Francisco", "D"], ["Castelo", "D"],
    ["Marataízes", "D"], ["Anchieta", "D"],
  ],
  GO: [
    ["Goiânia", "A"], ["Aparecida de Goiânia", "A"], ["Anápolis", "B"],
    ["Rio Verde", "B"], ["Luziânia", "A"], ["Águas Lindas de Goiás", "A"],
    ["Valparaíso de Goiás", "A"], ["Trindade", "A"], ["Formosa", "C"],
    ["Novo Gama", "A"], ["Senador Canedo", "A"], ["Catalão", "C"],
    ["Itumbiara", "C"], ["Jataí", "C"], ["Planaltina", "A"],
    ["Caldas Novas", "C"], ["Cidade Ocidental", "A"], ["Goianésia", "C"],
    ["Mineiros", "D"], ["Cristalina", "C"], ["Santo Antônio do Descoberto", "A"],
  ],
  MA: [
    ["São Luís", "B"], ["Imperatriz", "B"], ["São José de Ribamar", "A"],
    ["Timon", "B"], ["Caxias", "C"], ["Codó", "C"], ["Paço do Lumiar", "A"],
    ["Açailândia", "C"], ["Bacabal", "C"], ["Balsas", "C"],
    ["Barra do Corda", "C"], ["Santa Inês", "C"], ["Pinheiro", "D"],
    ["Chapadinha", "D"], ["Coroatá", "D"], ["Pedreiras", "D"],
  ],
  MG: [
    ["Belo Horizonte", "A"], ["Uberlândia", "B"], ["Contagem", "A"], ["Juiz de Fora", "B"],
    ["Betim", "A"], ["Montes Claros", "B"], ["Ribeirão das Neves", "A"],
    ["Uberaba", "B"], ["Governador Valadares", "C"], ["Ipatinga", "C"], ["Sete Lagoas", "C"],
    ["Divinópolis", "C"], ["Santa Luzia", "A"], ["Ibirité", "A"], ["Poços de Caldas", "C"],
    ["Patos de Minas", "C"], ["Pouso Alegre", "C"], ["Teófilo Otoni", "C"],
    ["Barbacena", "C"], ["Sabará", "A"], ["Varginha", "C"], ["Conselheiro Lafaiete", "C"],
    ["Vespasiano", "A"], ["Itabira", "C"], ["Araguari", "C"], ["Ubá", "C"],
    ["Passos", "C"], ["Coronel Fabriciano", "C"], ["Muriaé", "C"], ["Araxá", "C"],
    ["Itajubá", "C"], ["Lavras", "C"], ["Nova Lima", "A"], ["Caratinga", "C"],
    ["Manhuaçu", "D"], ["Ouro Preto", "D"], ["Pará de Minas", "D"], ["Janaúba", "D"],
    ["São João del Rei", "D"], ["Três Corações", "D"], ["Timóteo", "C"],
    ["Mariana", "D"], ["Itaúna", "D"], ["Pirapora", "D"], ["Unaí", "D"],
    ["Curvelo", "D"], ["Frutal", "D"], ["Cataguases", "D"], ["Esmeraldas", "A"],
    ["São Sebastião do Paraíso", "D"],
  ],
  MS: [
    ["Campo Grande", "B"], ["Dourados", "B"], ["Três Lagoas", "C"], ["Corumbá", "C"],
    ["Ponta Porã", "C"], ["Naviraí", "D"], ["Aquidauana", "D"], ["Nova Andradina", "D"],
    ["Sidrolândia", "D"], ["Maracaju", "D"], ["Paranaíba", "D"], ["Coxim", "D"],
    ["Caarapó", "D"], ["Jardim", "D"],
  ],
  MT: [
    ["Cuiabá", "B"], ["Várzea Grande", "B"], ["Rondonópolis", "B"],
    ["Sinop", "C"], ["Tangará da Serra", "C"], ["Cáceres", "C"], ["Sorriso", "C"],
    ["Lucas do Rio Verde", "C"], ["Primavera do Leste", "C"], ["Barra do Garças", "D"],
    ["Alta Floresta", "D"], ["Pontes e Lacerda", "D"], ["Nova Mutum", "D"],
    ["Juína", "D"], ["Campo Verde", "D"], ["Mirassol d'Oeste", "D"],
  ],
  PA: [
    ["Belém", "A"], ["Ananindeua", "A"], ["Santarém", "B"], ["Marabá", "B"],
    ["Castanhal", "C"], ["Parauapebas", "C"], ["Abaetetuba", "C"], ["Cametá", "C"],
    ["Marituba", "A"], ["Bragança", "C"], ["Altamira", "C"], ["Tucuruí", "C"],
    ["Barcarena", "C"], ["Paragominas", "C"], ["Itaituba", "C"], ["Tailândia", "D"],
    ["Capanema", "D"], ["Breves", "D"], ["Redenção", "D"], ["Benevides", "A"],
    ["Moju", "D"], ["Santa Izabel do Pará", "A"],
  ],
  PB: [
    ["João Pessoa", "B"], ["Campina Grande", "B"], ["Santa Rita", "B"], ["Patos", "C"],
    ["Bayeux", "B"], ["Cabedelo", "B"], ["Sousa", "C"], ["Cajazeiras", "C"],
    ["Guarabira", "C"], ["Sapé", "D"], ["Mamanguape", "D"], ["Esperança", "D"],
    ["Monteiro", "D"], ["Pombal", "D"], ["Catolé do Rocha", "D"],
  ],
  PE: [
    ["Recife", "A"], ["Jaboatão dos Guararapes", "A"], ["Olinda", "A"],
    ["Caruaru", "B"], ["Petrolina", "B"], ["Paulista", "A"], ["Cabo de Santo Agostinho", "A"],
    ["Camaragibe", "A"], ["Garanhuns", "C"], ["Vitória de Santo Antão", "C"],
    ["Igarassu", "A"], ["São Lourenço da Mata", "A"], ["Abreu e Lima", "A"],
    ["Santa Cruz do Capibaribe", "C"], ["Ipojuca", "A"], ["Serra Talhada", "C"],
    ["Araripina", "D"], ["Gravatá", "C"], ["Goiana", "C"], ["Carpina", "C"],
    ["Belo Jardim", "D"], ["Arcoverde", "D"], ["Ouricuri", "D"], ["Surubim", "D"],
    ["Bezerros", "D"], ["Palmares", "D"], ["Salgueiro", "D"],
  ],
  PI: [
    ["Teresina", "B"], ["Parnaíba", "C"], ["Picos", "C"], ["Piripiri", "D"],
    ["Floriano", "C"], ["Campo Maior", "D"], ["Barras", "D"], ["União", "D"],
    ["Altos", "D"], ["Esperantina", "D"], ["Pedro II", "D"], ["São Raimundo Nonato", "D"],
    ["Oeiras", "D"],
  ],
  PR: [
    ["Curitiba", "A"], ["Londrina", "B"], ["Maringá", "B"], ["Ponta Grossa", "B"],
    ["Cascavel", "B"], ["São José dos Pinhais", "A"], ["Foz do Iguaçu", "B"],
    ["Colombo", "A"], ["Guarapuava", "C"], ["Paranaguá", "C"], ["Araucária", "A"],
    ["Toledo", "C"], ["Apucarana", "C"], ["Pinhais", "A"], ["Campo Largo", "A"],
    ["Arapongas", "C"], ["Almirante Tamandaré", "A"], ["Umuarama", "C"],
    ["Piraquara", "A"], ["Cambé", "A"], ["Paranavaí", "C"], ["Francisco Beltrão", "C"],
    ["Sarandi", "A"], ["Pato Branco", "C"], ["Fazenda Rio Grande", "A"],
    ["Cianorte", "C"], ["Telêmaco Borba", "C"], ["Castro", "D"], ["Rolândia", "C"],
    ["Marechal Cândido Rondon", "D"], ["Irati", "C"], ["União da Vitória", "D"],
    ["Campo Mourão", "C"], ["Cornélio Procópio", "D"], ["Bandeirantes", "D"],
    ["Lapa", "D"], ["Quedas do Iguaçu", "D"], ["Medianeira", "D"],
  ],
  RJ: [
    ["Rio de Janeiro", "A"], ["São Gonçalo", "A"], ["Duque de Caxias", "A"],
    ["Nova Iguaçu", "A"], ["Niterói", "A"], ["Belford Roxo", "A"],
    ["São João de Meriti", "A"], ["Campos dos Goytacazes", "B"], ["Petrópolis", "B"],
    ["Volta Redonda", "B"], ["Magé", "A"], ["Itaboraí", "A"], ["Mesquita", "A"],
    ["Nova Friburgo", "C"], ["Barra Mansa", "C"], ["Macaé", "B"],
    ["Cabo Frio", "B"], ["Nilópolis", "A"], ["Teresópolis", "C"],
    ["Resende", "C"], ["Queimados", "A"], ["Maricá", "A"], ["Itaguaí", "A"],
    ["Araruama", "C"], ["Angra dos Reis", "C"], ["Rio das Ostras", "C"],
    ["Japeri", "A"], ["São Pedro da Aldeia", "C"], ["Saquarema", "C"],
    ["Seropédica", "A"], ["Itaperuna", "C"], ["Três Rios", "D"],
    ["Valença", "D"], ["Casimiro de Abreu", "D"], ["Búzios", "D"],
    ["Mangaratiba", "A"], ["Tanguá", "A"], ["Guapimirim", "A"],
    ["São João da Barra", "D"], ["Bom Jesus do Itabapoana", "D"],
  ],
  RN: [
    ["Natal", "B"], ["Mossoró", "B"], ["Parnamirim", "B"], ["São Gonçalo do Amarante", "C"],
    ["Macaíba", "C"], ["Ceará-Mirim", "C"], ["Caicó", "C"], ["Açu", "D"],
    ["Currais Novos", "D"], ["Apodi", "D"], ["Pau dos Ferros", "D"], ["São José de Mipibu", "D"],
    ["João Câmara", "D"],
  ],
  RO: [
    ["Porto Velho", "B"], ["Ji-Paraná", "C"], ["Ariquemes", "C"], ["Vilhena", "C"],
    ["Cacoal", "C"], ["Rolim de Moura", "D"], ["Jaru", "D"], ["Guajará-Mirim", "D"],
    ["Pimenta Bueno", "D"], ["Buritis", "D"],
  ],
  RR: [
    ["Boa Vista", "B"], ["Rorainópolis", "D"], ["Caracaraí", "D"],
    ["Mucajaí", "D"], ["Pacaraima", "D"],
  ],
  RS: [
    ["Porto Alegre", "A"], ["Caxias do Sul", "B"], ["Pelotas", "B"], ["Canoas", "A"],
    ["Santa Maria", "B"], ["Gravataí", "A"], ["Viamão", "A"], ["Novo Hamburgo", "B"],
    ["São Leopoldo", "A"], ["Rio Grande", "C"], ["Alvorada", "A"], ["Passo Fundo", "B"],
    ["Sapucaia do Sul", "A"], ["Santa Cruz do Sul", "C"], ["Cachoeirinha", "A"],
    ["Bagé", "C"], ["Bento Gonçalves", "C"], ["Erechim", "C"], ["Esteio", "A"],
    ["Uruguaiana", "C"], ["Ijuí", "C"], ["Lajeado", "C"], ["Sapiranga", "C"],
    ["Santana do Livramento", "C"], ["Cruz Alta", "C"], ["Camaquã", "D"],
    ["Vacaria", "D"], ["Santo Ângelo", "C"], ["Farroupilha", "C"],
    ["Venâncio Aires", "C"], ["Guaíba", "A"], ["Carazinho", "D"],
    ["Santa Rosa", "C"], ["Cachoeira do Sul", "D"], ["Santiago", "D"],
    ["Canela", "D"], ["Gramado", "D"], ["Taquara", "D"], ["Eldorado do Sul", "A"],
    ["Parobé", "C"], ["Montenegro", "D"], ["Torres", "D"], ["Tramandaí", "D"],
  ],
  SC: [
    ["Florianópolis", "B"], ["Joinville", "B"], ["Blumenau", "B"], ["São José", "B"],
    ["Chapecó", "B"], ["Itajaí", "B"], ["Criciúma", "B"], ["Jaraguá do Sul", "C"],
    ["Lages", "C"], ["Palhoça", "B"], ["Balneário Camboriú", "C"], ["Brusque", "C"],
    ["Tubarão", "C"], ["São Bento do Sul", "C"], ["Caçador", "C"], ["Concórdia", "C"],
    ["Camboriú", "C"], ["Navegantes", "C"], ["Rio do Sul", "C"], ["Araranguá", "C"],
    ["Indaial", "C"], ["Biguaçu", "B"], ["Mafra", "D"], ["Gaspar", "C"],
    ["Itapema", "C"], ["Içara", "C"], ["Tijucas", "D"], ["São Francisco do Sul", "D"],
    ["Videira", "D"], ["Imbituba", "D"], ["Joaçaba", "D"], ["Curitibanos", "D"],
    ["Xanxerê", "D"], ["Canoinhas", "D"],
  ],
  SE: [
    ["Aracaju", "B"], ["Nossa Senhora do Socorro", "B"], ["Lagarto", "C"],
    ["Itabaiana", "C"], ["São Cristóvão", "B"], ["Estância", "C"],
    ["Tobias Barreto", "D"], ["Itabaianinha", "D"], ["Simão Dias", "D"],
    ["Nossa Senhora da Glória", "D"], ["Capela", "D"], ["Propriá", "D"],
    ["Boquim", "D"], ["Canindé de São Francisco", "D"],
  ],
  SP: [
    ["São Paulo", "A"], ["Guarulhos", "A"], ["Campinas", "A"], ["São Bernardo do Campo", "A"],
    ["Santo André", "A"], ["Osasco", "A"], ["São José dos Campos", "A"], ["Ribeirão Preto", "B"],
    ["Sorocaba", "A"], ["Mauá", "A"], ["São José do Rio Preto", "B"], ["Mogi das Cruzes", "A"],
    ["Santos", "A"], ["Diadema", "A"], ["Jundiaí", "A"], ["Piracicaba", "B"],
    ["Carapicuíba", "A"], ["Bauru", "B"], ["São Vicente", "A"], ["Itaquaquecetuba", "A"],
    ["Franca", "B"], ["Praia Grande", "A"], ["Guarujá", "A"], ["Taubaté", "B"],
    ["Limeira", "B"], ["Suzano", "A"], ["Sumaré", "A"], ["Taboão da Serra", "A"],
    ["Embu das Artes", "A"], ["Barueri", "A"], ["São Carlos", "B"], ["Marília", "B"],
    ["Indaiatuba", "B"], ["Cotia", "A"], ["Americana", "B"], ["Araraquara", "B"],
    ["Jacareí", "A"], ["Itapevi", "A"], ["Hortolândia", "A"],
    ["Presidente Prudente", "B"], ["Bragança Paulista", "A"], ["Pindamonhangaba", "B"],
    ["Itapecerica da Serra", "A"], ["São Caetano do Sul", "A"], ["Rio Claro", "B"],
    ["Araçatuba", "B"], ["Ferraz de Vasconcelos", "A"], ["Francisco Morato", "A"],
    ["Itu", "B"], ["Mogi Guaçu", "B"], ["Atibaia", "A"], ["Jaú", "B"],
    ["Santa Bárbara d'Oeste", "B"], ["Cubatão", "A"], ["Franco da Rocha", "A"],
    ["Botucatu", "B"], ["Catanduva", "B"], ["Itapetininga", "B"], ["Sertãozinho", "B"],
    ["Várzea Paulista", "A"], ["Tatuí", "B"], ["Salto", "B"], ["Ourinhos", "C"],
    ["Caraguatatuba", "C"], ["Assis", "C"], ["Itanhaém", "A"], ["Mairiporã", "A"],
    ["Votorantim", "A"], ["Birigui", "C"], ["Caieiras", "A"], ["Avaré", "C"],
    ["Lençóis Paulista", "C"], ["Valinhos", "A"], ["Vinhedo", "A"], ["Paulínia", "A"],
    ["Bebedouro", "C"], ["São João da Boa Vista", "C"], ["Mococa", "C"],
    ["Itapeva", "C"], ["Jandira", "A"], ["Itararé", "D"], ["Andradina", "C"],
    ["Pirassununga", "C"], ["Caçapava", "C"], ["Cruzeiro", "C"], ["Tupã", "C"],
    ["São Roque", "A"], ["Penápolis", "D"], ["Lins", "C"], ["Cosmópolis", "A"],
    ["Mongaguá", "A"], ["Peruíbe", "A"], ["Bertioga", "A"], ["Ubatuba", "C"],
    ["Itatiba", "B"], ["Mogi Mirim", "B"], ["Capivari", "C"], ["Tietê", "D"],
    ["Embu-Guaçu", "A"], ["Poá", "A"], ["Arujá", "A"],
    ["Iperó", "D"], ["Santana de Parnaíba", "A"], ["Pirapora do Bom Jesus", "A"],
    ["Itapira", "C"],
  ],
  TO: [
    ["Palmas", "B"], ["Araguaína", "B"], ["Gurupi", "C"], ["Porto Nacional", "C"],
    ["Paraíso do Tocantins", "C"], ["Colinas do Tocantins", "D"], ["Guaraí", "D"],
    ["Tocantinópolis", "D"], ["Dianópolis", "D"], ["Miracema do Tocantins", "D"],
  ],
};

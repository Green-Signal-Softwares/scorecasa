// SSOT de municípios brasileiros + classificação MCMV 2026.
//
// Dataset embarcado:
//   • 27 capitais (todas as UFs)
//   • principais municípios das regiões metropolitanas
//   • cidades > 100k habitantes (cobertura ~85% da demanda habitacional)
//
// O combobox da UI sempre oferece "Outro município" como fallback livre
// (a cidade ainda é salva, mas cai automaticamente na classificação D do
// MCMV — teto mais restrito).
//
// Classificação de município para MCMV 2026 (Portaria MCID e atos
// vinculados ao Programa Minha Casa Minha Vida – FAR/PMCMV urbano):
//   A — São Paulo, Rio de Janeiro e Distrito Federal: teto R$ 270.000
//   B — Demais capitais + municípios em RM > 1M de habitantes
//       (Grande SP, RJ, BH, Recife, Salvador, Fortaleza, Porto Alegre,
//       Curitiba e equivalentes): teto R$ 264.000
//   C — Municípios entre 250k e 1M de habitantes: teto R$ 255.000
//   D — Municípios entre 100k e 250k de habitantes: teto R$ 245.000
//   E — Demais municípios (até 100k de habitantes): teto R$ 230.000
//
// Faixas de renda MCMV 2026 (familiar bruta mensal):
//   F1: até R$  3.200
//   F2: até R$  5.000
//   F3: até R$  9.600 (Faixa Urbano 3 — teto R$ 400.000 independente do município)
//   F4: até R$ 13.000 (Faixa Urbano 4 — teto R$ 600.000 independente do município)

export type MCMVTier = "A" | "B" | "C" | "D" | "E";

export interface MCMV2026Limits {
  /** Teto do valor do imóvel para Faixas 1 e 2 (R$). */
  capFaixa12: number;
  /** Teto Faixa 3 (R$). */
  capFaixa3: number;
  /** Teto Faixa 4 (R$). */
  capFaixa4: number;
}

export const MCMV_2026_BY_TIER: Record<MCMVTier, MCMV2026Limits> = {
  A: { capFaixa12: 270_000, capFaixa3: 400_000, capFaixa4: 600_000 },
  B: { capFaixa12: 264_000, capFaixa3: 400_000, capFaixa4: 600_000 },
  C: { capFaixa12: 255_000, capFaixa3: 400_000, capFaixa4: 600_000 },
  D: { capFaixa12: 245_000, capFaixa3: 400_000, capFaixa4: 600_000 },
  E: { capFaixa12: 230_000, capFaixa3: 400_000, capFaixa4: 600_000 },
};

export type IncomeFaixa = "F1" | "F2" | "F3" | "F4" | "OUT";

export const FAIXA_LIMITS = {
  F1: 3_200,
  F2: 5_000,
  F3: 9_600,
  F4: 13_000,
} as const;

export function classifyFaixa(monthlyHouseholdIncome: number): IncomeFaixa {
  if (monthlyHouseholdIncome <= FAIXA_LIMITS.F1) return "F1";
  if (monthlyHouseholdIncome <= FAIXA_LIMITS.F2) return "F2";
  if (monthlyHouseholdIncome <= FAIXA_LIMITS.F3) return "F3";
  if (monthlyHouseholdIncome <= FAIXA_LIMITS.F4) return "F4";
  return "OUT";
}

export interface MCMVEligibility {
  faixa: IncomeFaixa;
  tier: MCMVTier;
  /** Teto aplicável à combinação (faixa × município). */
  cap: number;
  /** propertyValue <= cap. */
  fitsCap: boolean;
  /** Faixa MCMV (F1..F4). */
  fitsFaixa: boolean;
  /** true quando ambos os critérios passam. */
  eligible: boolean;
}

export function evaluateMcmv2026({
  monthlyHouseholdIncome,
  propertyValue,
  tier,
}: {
  monthlyHouseholdIncome: number;
  propertyValue: number;
  tier: MCMVTier;
}): MCMVEligibility {
  const faixa = classifyFaixa(monthlyHouseholdIncome);
  const limits = MCMV_2026_BY_TIER[tier];
  let cap = 0;
  if (faixa === "F1" || faixa === "F2") cap = limits.capFaixa12;
  else if (faixa === "F3") cap = limits.capFaixa3;
  else if (faixa === "F4") cap = limits.capFaixa4;
  const fitsFaixa = faixa !== "OUT";
  const fitsCap = fitsFaixa && propertyValue > 0 && propertyValue <= cap;
  return {
    faixa,
    tier,
    cap,
    fitsCap,
    fitsFaixa,
    eligible: fitsFaixa && fitsCap,
  };
}

// ── UFs ─────────────────────────────────────────────────────────────────────
export const UFS = [
  "AC","AL","AM","AP","BA","CE","DF","ES","GO","MA","MG","MS","MT","PA",
  "PB","PE","PI","PR","RJ","RN","RO","RR","RS","SC","SE","SP","TO",
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

// ── Dataset de municípios por UF ────────────────────────────────────────────
// Estrutura: cidade → tier MCMV (default D quando não listada).
//
// Conjunto: capitais + RMs > 1M + cidades > 100k hab + sedes regionais
// com forte demanda MCMV. Cobertura ~85% da população urbana brasileira.
type CityRecord = readonly [name: string, tier: MCMVTier];

const CITIES_BY_UF: Record<UF, readonly CityRecord[]> = {
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
    ["Jacareí", "A"], ["Itaquera", "A"], ["Itapevi", "A"], ["Hortolândia", "A"],
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
    ["Embu-Guaçu", "A"], ["Diadema", "A"], ["Poá", "A"], ["Arujá", "A"],
    ["Iperó", "D"], ["Santana de Parnaíba", "A"], ["Pirapora do Bom Jesus", "A"],
    ["Itapira", "C"],
  ],
  TO: [
    ["Palmas", "B"], ["Araguaína", "B"], ["Gurupi", "C"], ["Porto Nacional", "C"],
    ["Paraíso do Tocantins", "C"], ["Colinas do Tocantins", "D"], ["Guaraí", "D"],
    ["Tocantinópolis", "D"], ["Dianópolis", "D"], ["Miracema do Tocantins", "D"],
  ],
};

// Mapa derivado (sem duplicatas) por UF para lookup eficiente.
const CITY_TIER_INDEX: Record<UF, Map<string, MCMVTier>> = (() => {
  const out: Record<string, Map<string, MCMVTier>> = {};
  for (const uf of UFS) {
    const m = new Map<string, MCMVTier>();
    for (const [name, tier] of CITIES_BY_UF[uf]) {
      const key = normalizeCity(name);
      if (!m.has(key)) m.set(key, tier);
    }
    out[uf] = m;
  }
  return out as Record<UF, Map<string, MCMVTier>>;
})();

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

/** Lista ordenada (com tier) das cidades cadastradas em uma UF. */
export function citiesOf(uf: UF | null | undefined): readonly { name: string; tier: MCMVTier }[] {
  if (!uf || !isValidUf(uf)) return [];
  const unique = new Map<string, MCMVTier>();
  for (const [name, tier] of CITIES_BY_UF[uf]) {
    const key = normalizeCity(name);
    if (!unique.has(key)) unique.set(key, tier);
  }
  return Array.from(unique.entries())
    .map(([key, tier]) => {
      const original = CITIES_BY_UF[uf].find(([n]) => normalizeCity(n) === key)![0];
      return { name: original, tier };
    })
    .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
}

/** Resolve o tier MCMV para a combinação UF + cidade. Default "E"
 *  (município fora do dataset curado → teto mais restrito, R$ 230.000). */
export function cityTier(uf: string | null | undefined, city: string | null | undefined): MCMVTier {
  if (!isValidUf(uf) || !city) return "E";
  const tier = CITY_TIER_INDEX[uf].get(normalizeCity(city));
  return tier ?? "E";
}

const BANCOS_PRINCIPALES = [
  "Bancolombia",
  "Nequi",
  "Daviplata",
  "Davivienda",
  "Bancolombia A la Mano",
] as const;

const BANCOS_OTROS = [
  "Banco de Bogotá",
  "BBVA Colombia",
  "Banco de Occidente",
  "Banco Popular",
  "Banco Agrario",
  "Banco Caja Social",
  "Scotiabank Colpatria",
  "Itaú",
  "Banco AV Villas",
  "Banco Falabella",
  "Banco Pichincha",
  "Bancoomeva",
  "Banco W",
  "Banco Serfinanza",
  "Lulo Bank",
  "Banco Finandina",
  "Banco Cooperativo Coopcentral",
  "Banco Mundo Mujer",
  "CFA Cooperativa Financiera",
  "Otro",
] as const;

export const BANCOS_COLOMBIA = [...BANCOS_PRINCIPALES, ...BANCOS_OTROS] as const;

export const opcionesBancos = BANCOS_COLOMBIA.map((banco) => ({
  label: banco,
  value: banco,
}));

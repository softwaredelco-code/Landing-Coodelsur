import rawJson from "./colombia-raw.json";

interface DepartamentoRaw {
  id: number;
  departamento: string;
  ciudades: string[];
}

const raw = rawJson as DepartamentoRaw[];

export interface DepartamentoColombia {
  nombre: string;
  municipios: string[];
}

function uniqueSorted(list: string[]): string[] {
  return Array.from(new Set(list)).sort((a, b) => a.localeCompare(b, "es"));
}

const departamentosBase: DepartamentoColombia[] = raw.map((item) => ({
  nombre: item.departamento,
  municipios: uniqueSorted(
    item.departamento === "Cundinamarca"
      ? item.ciudades.filter((ciudad) => ciudad !== "Bogotá")
      : item.ciudades,
  ),
}));

export const departamentosColombia: DepartamentoColombia[] = [
  ...departamentosBase,
  { nombre: "Bogotá D.C.", municipios: ["Bogotá"] },
].sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));

export const opcionesDepartamento = departamentosColombia.map((dep) => ({
  label: dep.nombre,
  value: dep.nombre,
}));

export function municipiosDe(departamento: string): string[] {
  return departamentosColombia.find((dep) => dep.nombre === departamento)?.municipios ?? [];
}

export function opcionesMunicipio(departamento: string) {
  return municipiosDe(departamento).map((municipio) => ({
    label: municipio,
    value: municipio,
  }));
}

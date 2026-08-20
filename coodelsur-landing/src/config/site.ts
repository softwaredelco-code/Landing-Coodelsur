export const siteConfig = {
  name: "Coodelsur",
  url: "https://coodelsursas.com.co",
  whatsapp: {
    number: "573016205460",
    message: "Hola, me interesa solicitar un crédito con Coodelsur.",
  },
  contact: {
    phone: "3016205460",
    email: "cartera@coodelsursas.com.co",
  },
  sedes: [
    {
      nombre: "SEDE BOGOTÁ",
      direccion: ["Carrera 50 # 79 - 85", "Oficina 303"],
    },
    {
      nombre: "SEDE CALI",
      direccion: ["Carrera 66 # 2B - 51", "Torre B Oficina 402"],
    },
    {
      nombre: "SEDE PASTO",
      direccion: ["Carrera 34 # 19 - 56 Oficina 2", "Barrio Versalles"],
    },
  ],
  nav: [
    { label: "Solicitar", href: "/#solicitar" },
    { label: "Contacto", href: "/#contacto" },
  ],
} as const;

export const whatsappUrl = `https://wa.me/${siteConfig.whatsapp.number}?text=${encodeURIComponent(siteConfig.whatsapp.message)}`;

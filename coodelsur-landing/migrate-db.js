const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('Migrating Lead table...');
  const updatedLeads = await prisma.lead.updateMany({
    where: { tipoCredito: 'microcredito_rural' },
    data: { tipoCredito: 'libranza' }
  });
  console.log(`Updated ${updatedLeads.count} leads.`);

  console.log('Checking CreditoParametros table...');
  const oldParam = await prisma.creditoParametros.findUnique({
    where: { tipoCredito: 'microcredito_rural' }
  });

  if (oldParam) {
    const existingLibranza = await prisma.creditoParametros.findUnique({
      where: { tipoCredito: 'libranza' }
    });

    if (existingLibranza) {
      console.log('Libranza params already exist. Deleting old microcredito_rural params...');
      await prisma.creditoParametros.delete({ where: { tipoCredito: 'microcredito_rural' }});
      console.log('Deleted.');
    } else {
      console.log('Migrating microcredito_rural params to libranza...');
      await prisma.creditoParametros.create({
        data: {
          ...oldParam,
          tipoCredito: 'libranza',
          nombreVisible: 'Crédito Libranza'
        }
      });
      await prisma.creditoParametros.delete({ where: { tipoCredito: 'microcredito_rural' }});
      console.log('Migrated params.');
    }
  } else {
    console.log('No old params found.');
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());

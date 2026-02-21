const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: 'file:./dev.db'
    }
  }
});

async function clearPositions() {
  try {
    // Delete all positions
    const deleted = await prisma.position.deleteMany({});
    console.log(`✅ Deleted ${deleted.count} positions`);
    
    // Reset wallet balance to starting capital
    await prisma.wallet.updateMany({
      data: {
        balance: 5000,
        usedMargin: 0,
        availableMargin: 5000,
        realizedPnl: 0,
        unrealizedPnl: 0
      }
    });
    console.log('✅ Reset wallet balances');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

clearPositions();

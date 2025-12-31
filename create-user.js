const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');

const prisma = new PrismaClient();

async function createUser() {
  try {
    console.log('👤 Criando usuário...\n');
    
    const email = 'rafaeldegolin26@hotmail.com';
    const password = 'Rafadegolin141526!';
    const fullName = 'Rafael Degolin';

    // Verificar se já existe
    const existing = await prisma.user.findUnique({
      where: { email }
    });

    if (existing) {
      console.log('⚠️  Usuário já existe! Atualizando senha...\n');
      
      const passwordHash = await bcrypt.hash(password, 10);
      
      await prisma.user.update({
        where: { email },
        data: { 
          passwordHash,
          emailVerified: true // Marcar como verificado para facilitar testes
        }
      });

      console.log('✅ Senha atualizada com sucesso!');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log(`Email: ${email}`);
      console.log(`Senha: ${password}`);
      console.log(`Email Verificado: ✅ SIM`);
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
      console.log('🎯 Agora você pode fazer login!');
      
    } else {
      const passwordHash = await bcrypt.hash(password, 10);
      
      const user = await prisma.user.create({
        data: {
          email,
          fullName,
          passwordHash,
          emailVerified: true, // Marcar como verificado
        }
      });

      console.log('✅ Usuário criado com sucesso!');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log(`ID: ${user.id}`);
      console.log(`Email: ${email}`);
      console.log(`Nome: ${fullName}`);
      console.log(`Senha: ${password}`);
      console.log(`Email Verificado: ✅ SIM`);
     console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
      console.log('🎯 Agora você pode fazer login!');
    }

    await prisma.$disconnect();
  } catch (error) {
    console.error('❌ Erro:', error.message);
    await prisma.$disconnect();
    process.exit(1);
  }
}

createUser();

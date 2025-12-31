const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');

const prisma = new PrismaClient();

async function checkUser() {
  try {
    console.log('🔍 Verificando usuário no banco de dados...\n');
    
    const email = 'rafaeldegolin26@hotmail.com';
    
    const user = await prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        fullName: true,
        passwordHash: true,
        emailVerified: true,
        createdAt: true,
      }
    });

    if (!user) {
      console.log('❌ Usuário não encontrado no banco de dados!');
      console.log('\n💡 Você precisa registrar uma conta primeiro.');
      console.log('\nOpções:');
      console.log('1. Registrar via frontend');
      console.log('2. Registrar via API: POST /auth/register');
      
      await prisma.$disconnect();
      return;
    }

    console.log('✅ Usuário encontrado!');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`ID: ${user.id}`);
    console.log(`Email: ${user.email}`);
    console.log(`Nome: ${user.fullName}`);
    console.log(`Email Verificado: ${user.emailVerified ? '✅ SIM' : '❌ NÃO'}`);
    console.log(`Criado em: ${user.createdAt}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    // Testar senha
    console.log('🔐 Testando senha...');
    const testPassword = 'Rafadegolin141526!';
    
    const isValid = await bcrypt.compare(testPassword, user.passwordHash);
    
    if (isValid) {
      console.log('✅ Senha CORRETA! O bcrypt está funcionando.');
      console.log('\n🤔 Se o login está falhando, pode ser:');
      console.log('1. Problema de encoding na requisição');
      console.log('2. Servidor não está rodando');
      console.log('3. Problema com o serviço de auth');
    } else {
      console.log('❌ Senha INCORRETA no banco!');
      console.log('\n💡 Isso significa que a senha no banco está diferente.');
      console.log('Você precisa redefinir a senha ou registrar novamente.');
    }

    await prisma.$disconnect();
  } catch (error) {
    console.error('❌ Erro:', error.message);
    await prisma.$disconnect();
    process.exit(1);
  }
}

checkUser();

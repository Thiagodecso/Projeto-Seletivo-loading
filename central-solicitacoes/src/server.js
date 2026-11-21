const { abrirBanco } = require('./database');
const { criarApp } = require('./app');

const PORTA = Number(process.env.PORT) || 3000;

const db = abrirBanco();
const app = criarApp(db);

const servidor = app.listen(PORTA, () => {
  console.log(`Central de Solicitações rodando em http://localhost:${PORTA}`);
});

// Fecha o banco corretamente ao encerrar (Ctrl+C).
function encerrar() {
  servidor.close(() => {
    db.close();
    process.exit(0);
  });
}
process.on('SIGINT', encerrar);
process.on('SIGTERM', encerrar);

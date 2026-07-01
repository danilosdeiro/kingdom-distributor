# MeuKingdom

Aplicação web para organizar partidas de Magic: The Gathering com distribuição secreta de papéis e comunicação em tempo real via Socket.IO.

## Estrutura

- `client-react/`: frontend React + TypeScript + Vite.
- `server/`: backend Express + Socket.IO.

## Rodando localmente

### Backend

```bash
cd server
npm install
npm run dev
```

O servidor sobe por padrão em `http://localhost:3000`.

### Frontend

```bash
cd client-react
npm install
npm run dev
```

Para apontar o frontend para outro backend, defina:

```bash
VITE_BACKEND_URL=http://localhost:3000
```

## Variáveis de ambiente

### Backend

- `PORT`: porta do servidor. Padrão: `3000`.
- `CLIENT_ORIGINS`: lista separada por vírgula com origens permitidas no CORS.
- `RECONNECT_GRACE_MS`: tempo em milissegundos para manter jogador desconectado antes de removê-lo da sala. Padrão: `120000`.

Exemplo:

```bash
CLIENT_ORIGINS=http://localhost:5173,https://meukingdom.vercel.app
```

### Frontend

- `VITE_BACKEND_URL`: URL pública do backend Socket.IO.

## Scripts úteis

Frontend:

```bash
npm run lint
npm run build
```

Backend:

```bash
npm test
npm start
```

## Observação sobre Vercel e tempo real

A Vercel oferece suporte nativo a WebSockets em Functions, mas conexões ficam vinculadas à duração máxima da Function e conexões futuras não têm garantia de cair na mesma instância. Por isso, o estado em memória usado atualmente é suficiente para partidas pequenas e simples, mas o próximo passo de robustez é mover salas/partidas para um armazenamento durável como Redis.

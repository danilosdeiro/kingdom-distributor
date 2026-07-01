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

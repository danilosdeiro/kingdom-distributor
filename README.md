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
- `ROOM_STATE_FILE`: caminho do arquivo JSON usado para salvar salas em andamento. Padrão: `server/data/rooms.json`.
- `ROOM_STATE_TTL_MS`: tempo máximo para manter uma sala salva. Padrão: 12 horas.
- `REDIS_URL`: URL de conexão Redis. Quando definida, o Redis passa a ser o armazenamento durável principal.
- `REDIS_ROOMS_KEY`: chave usada para os snapshots no Redis. Padrão: `meukingdom:rooms`.

Exemplo:

```bash
CLIENT_ORIGINS=http://localhost:5173,https://meukingdom.vercel.app,https://localhost,capacitor://localhost
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

A Vercel oferece suporte nativo a WebSockets em Functions, mas conexões ficam vinculadas à duração máxima da Function e conexões futuras não têm garantia de cair na mesma instância. Por isso, o backend deve rodar em um serviço Node persistente para partidas em tempo real.

O servidor sempre mantém um snapshot local e, quando `REDIS_URL` está configurada, grava também uma cópia versionada no Redis. Na inicialização, ele escolhe a cópia mais recente para não restaurar dados antigos após uma indisponibilidade.

O endpoint `/health` informa o armazenamento ativo:

- `storage.mode: "redis"` e `storage.durable: true`: persistência durável ativa.
- `storage.mode: "file"`: somente arquivo local.
- `storage.mode: "file-fallback"`: Redis configurado, mas temporariamente indisponível.

Os snapshots criptografados mantidos nos aparelhos continuam funcionando como uma camada adicional de recuperação.

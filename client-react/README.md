# MeuKingdom Frontend

Aplicacao React/Vite do MeuKingdom.

## Scripts

```bash
npm install
npm run dev
npm run lint
npm run build
```

## PWA

O frontend esta configurado como PWA instalavel:

- Manifest em `public/manifest.webmanifest`.
- Service worker em `public/sw.js`.
- Icones em `public/pwa/`.
- Cache conservador para nao interferir no Socket.io.

Para testar a instalacao, use uma build de producao:

```bash
npm run build
npm run preview
```

Depois abra no celular ou em uma janela mobile do navegador e use a opcao de instalar/adicionar a tela inicial.

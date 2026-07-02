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

## Android

O app Android usa Capacitor e fica em `android/`.

Scripts uteis:

```bash
npm run android:sync
npm run android:open
npm run android:run
```

Para gerar um APK debug local:

```bash
npm run android:sync
cd android
./gradlew assembleDebug
```

No Windows, o APK fica em:

```txt
android/app/build/outputs/apk/debug/app-debug.apk
```

Para gerar um APK release assinado, crie um arquivo local `android/keystore.properties` apontando para uma keystore privada. Este arquivo e a pasta `android/keystores/` sao ignorados pelo Git.

Exemplo:

```properties
storeFile=keystores/meukingdom-release.jks
storePassword=SUA_SENHA
keyAlias=meukingdom
keyPassword=SUA_SENHA
```

Depois rode:

```bash
npm run android:sync
cd android
./gradlew assembleRelease
```

No Windows, o APK release fica em:

```txt
android/app/build/outputs/apk/release/app-release.apk
```

Guarde a keystore e as senhas em local seguro. Sem a mesma chave, o Android nao aceita atualizar um app instalado anteriormente com outra assinatura.

O build de producao usa `VITE_BACKEND_URL` quando ela existir. Sem essa variavel, o fallback de producao aponta para `https://kingdom-backend-zmdh.onrender.com`; em desenvolvimento, aponta para `http://localhost:3000`.

Para o app Android conectar no backend, o backend precisa aceitar a origem do WebView:

```txt
https://localhost
capacitor://localhost
```

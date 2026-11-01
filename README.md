# Impostor

Jogo de roda pro celular: todo mundo recebe a mesma palavra, menos o impostor.

Quem cria a sala mostra um QR code no próprio celular. Os outros apontam a câmera e entram pelo navegador, sem instalar nada. A cada rodada, o celular de quem criou a sala sorteia a palavra, o impostor e quem começa, e manda uma carta secreta pro celular de cada um, inclusive pro dele.

## Como jogar

1. Quem cria a sala mostra o QR code. Cada pessoa escaneia e entra com o nome.
2. Todo mundo recebe a mesma palavra. Menos o impostor, que só fica sabendo que é o impostor (e, se a dica estiver ligada, o tema da palavra).
3. Começando por quem o app indicar e seguindo a roda, cada um fala uma palavra ligada à sua, sem entregar demais.
4. Depois de uma ou duas voltas, quem criou a sala toca em **Abrir votação** e cada um vota no próprio celular, circulando o nome de quem acha que é o impostor. Dá pra mudar o voto até a revelação, e ninguém vê em quem o outro votou.
5. Em **Revelar resultado**, todos os celulares mostram quem era o impostor, a palavra, o placar de votos e se a roda acertou. Empate é ponto pro impostor. Se a roda acertar, o impostor ainda pode tentar adivinhar a palavra pra roubar a vitória.

Se a turma preferir votar apontando o dedo, dá pra pular a votação e tocar em **Revelar sem votar**.

Na sala dá pra escolher o tema (comida, lugares, animais, objetos, profissões, esportes e lazer, festa, transportes ou tudo), ter até 2 impostores com 6 pessoas ou mais (3 com 9 ou mais) e ligar ou desligar a dica pro impostor. Pra ver a carta, a pessoa segura o papelzinho na tela; ao soltar, ele esconde de novo.

## Publicar (GitHub Pages)

1. No repositório: **Settings → Pages**.
2. Em *Build and deployment*, escolha **Deploy from a branch**, branch **main**, pasta **/ (root)** e salve.
3. Em cerca de um minuto o jogo fica em `https://<seu-usuario>.github.io/<nome-do-repo>/`.

O GitHub Pages em repositório privado exige plano pago. Se o repositório for privado, deixe-o público ou publique a pasta em outro serviço de site estático (Netlify, Vercel, Cloudflare Pages).

Dica: no celular, use "Adicionar à tela inicial" pra abrir como app.

## Como funciona por dentro

- **Site estático, sem servidor próprio.** Os celulares conversam em tempo real por um broker MQTT público, via WebSocket seguro: EMQX como principal, HiveMQ e Mosquitto de reserva. Quem cria a sala usa o primeiro que responder, e o convite leva essa escolha pra todo mundo.
- **Criptografia de ponta a ponta.** A chave da sala viaja só no QR code, na parte do link depois do `#`, que o navegador nunca envia pra servidor nenhum. Cada carta é cifrada só pro seu dono (ECDH P-256 + AES-GCM), e os votos voltam pro anfitrião do mesmo jeito: nem o broker nem outro jogador com a chave da sala consegue ver a palavra, o papel ou o voto de ninguém antes da revelação.
- **Aguenta queda de conexão.** Se alguém recarrega a página, troca de app ou perde o sinal, volta pra mesma rodada com a mesma carta. A sala de quem criou fica salva no aparelho por 12 horas, e a tela fica acesa durante o jogo.

| Arquivo | O que é |
| --- | --- |
| `index.html`, `styles.css` | página e visual |
| `app.js` | telas e regras do jogo (anfitrião e jogadores) |
| `net.js` | conexão em tempo real e criptografia |
| `words.js` | palavras por tema |
| `manifest.webmanifest`, `sw.js`, `icons/` | instalar como app no celular |
| `vendor/` | [MQTT.js](https://github.com/mqttjs/MQTT.js) e [qrcode-generator](https://github.com/kazuhikoarase/qrcode-generator) (MIT) |
| `fonts/` | Shantell Sans e Atkinson Hyperlegible Next (licença OFL) |
| `tests/` | servidor local e teste ponta a ponta |
| `tools/make-icons.mjs` | gera os ícones |

## Rodar e testar no computador

Precisa de Node 18+ e do Google Chrome instalado (ou da variável `CHROME_PATH` apontando pro Chrome/Chromium).

```bash
npm install
npm run dev   # app em http://127.0.0.1:8080/?broker=ws://127.0.0.1:9001 (broker local)
npm test      # simula o anfitrião e mais 5 jogadores e confere o jogo inteiro
```

O teste confere: entrada pelo convite, um impostor por rodada (e dois com 6 pessoas), mesma palavra pra todo o resto, quem começa, palavra nova a cada rodada, votação (roda acerta, roda erra, empate, mudar o voto, não votar em si mesmo, recarregar no meio), revelação com placar, tirar alguém e deixar voltar, quem chega atrasado não vota, sair, encerrar a sala e se dá pra espiar cartas ou votos pelo broker (não dá).

## Personalizar

- **Palavras:** edite as listas em `words.js`. Cada tema é uma lista simples.
- **Cores e fontes:** variáveis no topo de `styles.css`.
- **Servidor de mensagens:** lista `BROKERS` em `net.js`. Para colocar um novo, acrescente no fim da lista (a posição faz parte dos convites).

## Próximos passos

- **Play Store:** o app já é um PWA (manifest, service worker e ícones). Dá pra gerar o app Android a partir da URL publicada com o [PWABuilder](https://www.pwabuilder.com/), que empacota como Trusted Web Activity.
- **Broker próprio:** o broker público é compartilhado e sem garantia de funcionamento. Pra um app publicado com muita gente, vale usar um broker seu (EMQX Cloud e HiveMQ Cloud têm planos gratuitos).

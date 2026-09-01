# Decisão em aberto B1 — hash da senha no login

> **Status:** proposta aguardando decisão conjunta app + backend.
> **Trava:** `CLAUDE.md §7.1` · `docs/plano-migracao.md` bloqueio 🔒 B1 (tela A4 · `(auth)/login`).
> **Enquanto não for decidido, o login do app novo não funciona:** `preparePassword()` em
> `src/features/auth/lib/password.ts` lança de propósito.

---

## 1. Recomendação em uma frase

**Enviar a senha em texto puro sobre TLS e fazer o hash 100% no servidor, com Argon2id (ou bcrypt,
que já está vendorizado no Orion), substituindo tanto o MD5 do cliente quanto o
`Encrypt`/`Decrypt` reversível que hoje guarda a senha no Firebird.**

O MD5 enviado pelo app **não é uma proteção** — ele _é_ a credencial. Trocar MD5 por SHA-256 no
cliente não resolveria nada. O problema real está no servidor: a senha do usuário é armazenada de
forma **reversível** e pode ser recuperada em texto claro por qualquer um com acesso de leitura ao
banco ou ao código-fonte.

---

## 2. Como funciona hoje

Todos os caminhos abaixo são relativos à raiz do monorepo `Source Rio`
(`teoremadelphi/teorema-source-rio`), que **não** faz parte deste repositório.

### 2.1 Cliente Delphi — calcula MD5 e envia

`Projects/App/Aplicativos Horse/Commun/Controller/uBaseConfiguration.Controller.pas:342`

```pascal
JSONObject.AddPair('username', UpperCase(TParameters.Sessao.USER_LOGIN));
JSONObject.AddPair('password', CalculateMD5(TParameters.Sessao.USER_PASSWORD));
```

`Projects/App/Aplicativos Horse/Commun/Units/CryptographyUtil.pas:69`

```pascal
function CalculateMD5(const AText: string): string;
begin
  MD5Calculator := TIdHashMessageDigest5.Create;
  Result := MD5Calculator.HashStringAsHex(AText);   // Indy, hex maiúsculo
end;
```

Sem salt, sem iteração, sem chave. E `TParameters.Sessao.USER_PASSWORD` vem do SQLite local, onde a
senha é gravada **em texto claro** (`DEVICE_INFO.USER_PASSWORD`, `analise §7.1.9`).

### 2.2 Servidor Orion Horse — compara MD5 com MD5

`Projects/Desktop/Orion Server Horse/Controller/Auth.Controller.pas:67`

```pascal
User.Password := UpperCase(body.GetValue<string>('password', ''));
```

`Projects/Desktop/Orion Server Horse/DAO/User.DAO.pas:86`

```pascal
if CalculateMD5(Decrypt(Query.FieldByName('USUARIO_SENHA').AsString)) <> Password then
  raise EExceptParam.Create('senha');
```

O servidor **descriptografa a senha guardada**, calcula o MD5 dela na hora e compara com o MD5 que o
cliente mandou. Ou seja: o servidor tem acesso à senha em texto claro do usuário a cada login.

### 2.3 O armazenamento não é criptografia

`Decrypt` / `Encrypt` vêm de `Default/Common/Pitagoras.Util.pas:323`:

```pascal
Mascara := '#$%$' + #13 + #12;
Str1 := HexToString(Value);
for PonS := Inicio to Length(Str1) do
  Str2 := Str2 + Chr(Ord(Str1[PonS]) xor Ord(Mascara[PonM]));
```

É **XOR com uma máscara fixa de 6 bytes, escrita no código-fonte**, seguido de hex. Não há chave,
não há segredo, não há rotação. `TEO_USUARIOS.USUARIO_SENHA` é, para efeitos práticos, texto claro
com uma camada de ofuscação que se desfaz em cinco linhas de qualquer linguagem.

### 2.4 O fluxo inteiro

```
 usuário digita "minhaSenha"
        │
        ▼
 SQLite local  ──── grava em TEXTO CLARO (USER_PASSWORD)        ← §7.1.9
        │
        ▼
 MD5("minhaSenha") = "A1B2…"  ──POST /v1/auth/login──►  Orion
        │                          (body JSON)              │
        │                                                   ▼
        │                                    UpperCase(password recebido)
        │                                                   │
        │                                                   ▼
        │                              SELECT USUARIO_SENHA FROM TEO_USUARIOS
        │                                                   │
        │                                       XOR-decrypt → "minhaSenha"
        │                                                   │
        │                                       MD5(…) = "A1B2…"
        │                                                   │
        └───────────────────  compara string  ◄─────────────┘
```

Não existe hash em lugar nenhum do armazenamento. O MD5 é só um formato de transporte.

---

## 3. Respostas diretas às quatro perguntas

### (1) Qual algoritmo de hash/encoding é usado?

| Etapa                     | O que é feito                                                                      |
| ------------------------- | ---------------------------------------------------------------------------------- |
| Cliente → rede            | `MD5(senha)` em hex maiúsculo (Indy `TIdHashMessageDigest5.HashStringAsHex`)       |
| Salt                      | **nenhum**                                                                         |
| Iterações / custo         | **1** (MD5 puro)                                                                   |
| Normalização no servidor  | `UpperCase()` no valor recebido — o hex é comparado sem sensibilidade a maiúsculas |
| Armazenamento no Firebird | XOR com máscara fixa de 6 bytes, codificado em hex — **reversível**                |
| Comparação                | igualdade de string (`<>`), não constant-time                                      |

**Encoding é um ponto cego.** `HashStringAsHex` sem parâmetro usa o encoding padrão do Indy, que
varia por plataforma (ANSI no Windows, UTF-8 nos targets POSIX/mobile). No servidor, `Decrypt`
reconstrói a string via `TEncoding.Default.GetString` antes de passar pelo mesmo `CalculateMD5`.
Consequência: **senha com caractere acentuado pode gerar hashes diferentes entre Android, iOS e
Windows**. Isso é um bug de compatibilidade latente, não só um problema de segurança — e vale
verificar com um teste real antes de qualquer decisão que mantenha o MD5.

### (2) É client-side ou o servidor hasheia?

**Client-side, e o servidor não hasheia nada para armazenar.** O servidor calcula um MD5 _volátil_,
só para a comparação, a partir da senha que ele mesmo acabou de descriptografar.

O efeito colateral é o que importa: como o servidor aceita o MD5 pronto, **o MD5 é a senha**. Quem
capturar o valor `A1B2…` autentica sem nunca saber a senha original — _pass-the-hash_ clássico.

Isso não é teórico. O próprio código do Orion faz exatamente isso, com uma credencial fixa:

`Projects/Desktop/Orion Server Horse/Controller/ServerConfiguration.Controller.pas:615`

```pascal
//somente para testes retirar depois
JSONObject.AddPair('username','Des.Marcelo Schemmer');
JSONObject.AddPair('password','d5842dbd31592ac59c914c89f78d0ef1');
```

Um MD5 pré-calculado, gravado no fonte, usado para logar como um usuário nomeado. Funciona
justamente porque o servidor nunca precisa da senha real.

### (3) Riscos de segurança

| #   | Risco                                                                                                                                                                                                                                                                                               | Severidade     |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------- |
| R1  | **Senhas recuperáveis em texto claro no banco.** XOR com chave fixa e pública. Um dump do Firebird, um backup vazado ou um DBA curioso viram a senha de todos os usuários — e as pessoas reusam senha em outros sistemas.                                                                           | **Crítica**    |
| R2  | **Pass-the-hash.** O MD5 é aceito como credencial. Capturar o valor (log de proxy, WAF, APM, dump de tráfego, crash report) equivale a capturar a senha.                                                                                                                                            | **Crítica**    |
| R3  | **Senha em texto claro no dispositivo.** `DEVICE_INFO.USER_PASSWORD` no SQLite do app legado, recarregada no campo de senha do splash (`analise §7.1.9`). Aparelho com root ou backup extraído = senha exposta.                                                                                     | **Crítica**    |
| R4  | **MD5 sem salt é reversível na prática.** Rainbow tables públicas cobrem a maior parte das senhas humanas; GPU quebra o resto em minutos. Se o hash vazar, a senha original vem junto.                                                                                                              | **Alta**       |
| R5  | **Credencial fixa no fonte** (`d5842db…`, e o JWT hardcoded logo acima em `ServerConfiguration.Controller.pas:604`). Vale em toda instalação, não expira, não rotaciona.                                                                                                                            | **Alta**       |
| R6  | **A resposta do login devolve a senha.** O `SELECT` inclui `USUARIO_SENHA` (`User.DAO.pas:70`) e o retorno é `Query.ToJSONObject` (`:92`), que serializa todos os campos visíveis. O corpo do login carrega o valor XOR — reversível. **Confirmar com uma captura real antes de tratar como fato.** | **Alta**       |
| R7  | **Enumeração de usuário.** `erro=usuario` vs. `erro=senha` diz ao atacante quais logins existem. (Cruza com o bloqueio 🔒 B4.)                                                                                                                                                                      | **Média**      |
| R8  | **TLS não garantido no tenant.** O central é `https://orion2.teorema.inf.br` fixo, mas a URL do tenant vem do banco central (`SERVER_URL_PRIMARY`/`_SECONDARY`) e pode ser `http://` ou IP puro. Sem TLS, tudo acima piora.                                                                         | **Média**¹     |
| R9  | **Comparação não constant-time** (`<>` de string). Vazamento de timing sobre um hash — impacto pequeno, mas é grátis corrigir junto.                                                                                                                                                                | **Baixa**      |
| R10 | **Encoding dependente de plataforma** (ver acima): senha com acento pode não autenticar em um dos sistemas operacionais.                                                                                                                                                                            | Bug, não risco |

¹ Severidade depende do parque real. **Ação:** o time de backend precisa auditar os valores de
`SERVER_URL_PRIMARY`/`_SECONDARY` em produção e dizer se todos já são `https`.

### (4) Alternativas

| Opção                                                                      | Resolve R1? | Resolve R2? | Resolve R4? | Custo backend             | Custo app          | Veredito                       |
| -------------------------------------------------------------------------- | ----------- | ----------- | ----------- | ------------------------- | ------------------ | ------------------------------ |
| **A. Status quo** (MD5 no cliente, XOR no banco)                           | ✗           | ✗           | ✗           | zero                      | implementar MD5    | Não                            |
| **B. Texto puro sobre TLS + Argon2id/bcrypt no servidor** ⭐               | ✓           | ✓           | ✓           | coluna nova + verificação | **zero** (1 linha) | **Recomendado**                |
| C. Hash forte no cliente (SHA-256/bcrypt) + comparação de hash no servidor | parcial     | ✗           | parcial     | médio                     | dependência nova   | Não — segue pass-the-hash      |
| D. Challenge-response / SRP / OPAQUE                                       | ✓           | ✓           | ✓           | **alto** (protocolo novo) | alto               | Exagero para o cenário         |
| E. OAuth2 / OIDC contra um IdP                                             | ✓           | ✓           | ✓           | alto (produto novo)       | médio              | Certo a longo prazo, não agora |

**Por que não a C.** Hashear no cliente parece "mais seguro", mas o servidor passaria a comparar o
hash recebido com um hash guardado — e aí o valor guardado no banco vira, ele mesmo, a credencial.
Continua sendo pass-the-hash, agora com o agravante de que um vazamento do banco dá acesso direto.
Bcrypt no cliente ainda gasta CPU de aparelho velho e fixa o custo do algoritmo no app instalado,
que é justamente o componente mais difícil de atualizar.

**Por que a B.** É o padrão da indústria pelo motivo simples: TLS já é o canal seguro, e o único
lugar onde um hash lento tem valor é do lado que guarda o dado. Com Argon2id/bcrypt no servidor, um
dump do banco não entrega senha nenhuma, e o app deixa de ter qualquer responsabilidade
criptográfica — `preparePassword()` vira `return password`.

**Argon2id ou bcrypt?** Argon2id é a recomendação atual da OWASP. Mas o Orion **já tem bcrypt
vendorizado e sem nenhum uso**, em `Projects/Desktop/Orion Server Horse/Lib/bcrypt-master/` — a API
`TBCrypt.GenerateHash` / `TBCrypt.CompareHash` está pronta. Se o time preferir menor atrito,
**bcrypt com custo ≥ 12 é aceitável e resolve R1 e R4 do mesmo jeito**. A escolha é do backend; o
app não vê diferença.

---

## 4. Plano de migração sugerido (do lado do servidor)

Não dá para rehashear o que não se tem — mas aqui _dá_, porque a senha atual é recuperável. Isso
permite uma migração sem forçar troca de senha, em quatro passos:

1. **Garantir TLS** em todas as URLs de tenant (R8). Pré-requisito absoluto: sem isso, texto puro na
   rede é um retrocesso, não um avanço.
2. **Nova coluna** `USUARIO_SENHA_HASH` em `TEO_USUARIOS`. Backfill único:
   `USUARIO_SENHA_HASH = Argon2id(Decrypt(USUARIO_SENHA))` — a senha atual é recuperável, então o
   backfill é possível hoje e **nunca mais será**, o que é exatamente o argumento para fazê-lo.
3. **Aceitar os dois formatos por uma janela definida** (ex.: 90 dias), decidido pelo _formato do
   campo recebido_, não por versão de cliente:
   - valor de 32 caracteres hex → caminho legado (compara com `MD5(Decrypt(...))`);
   - qualquer outra coisa → caminho novo (`CompareHash` contra `USUARIO_SENHA_HASH`).
     Um teste mais estrito ainda pode exigir um header de versão do cliente.
4. **Fim da janela:** remover o caminho legado, **dropar `USUARIO_SENHA`**, remover a credencial fixa
   de `ServerConfiguration.Controller.pas:615` e parar de devolver o campo de senha na resposta do
   login (R6). Trocar a comparação por constant-time (R9).

Vale corrigir junto, no mesmo PR de servidor, dois itens que já são bloqueios conhecidos: **R7 /
🔒 B4** — mesma resposta genérica para usuário inexistente e senha errada, com código de erro estável
no lugar do texto (`analise §7.1.3`).

---

## 5. O que muda neste repositório

Um arquivo, nos dois cenários. É por isso que o ponto foi isolado ali (`plano-migracao.md §2`,
regra 4).

**Se a decisão for a Opção B (recomendada):**

```ts
// src/features/auth/lib/password.ts
/**
 * A senha vai em texto puro sobre TLS; o hash é responsabilidade do Orion
 * (Argon2id/bcrypt). Ver docs/decisao-hash-senha.md.
 */
export function preparePassword(password: string): string {
  return password;
}
```

Nesse ponto a função vira supérflua e pode ser removida, com `auth.api.ts` mandando
`payload.password` direto. Manter o arquivo só se a intenção for documentar a decisão no código.

**Se a decisão for manter MD5 no curto prazo**, três coisas precisam ficar registradas:

- **Dependência nova.** `expo-crypto` não expõe MD5 em todas as plataformas; provavelmente será um
  pacote JS puro (`js-md5`). **Verificar antes de estimar.**
- **Caixa do hex é indiferente** — o servidor faz `UpperCase()` no que recebe.
- **Restringir a senha a ASCII** ou resolver o encoding antes (R10), sob pena de o login falhar em
  uma plataforma e funcionar em outra para a mesma senha.

E, mesmo nesse cenário, **nada muda em duas regras que já valem**: a senha continua fora do MMKV
(`session.store.ts` já usa `partialize`) e o campo de senha nunca é pré-preenchido (§7.1.9).

---

## 6. Achado adjacente — não é sobre hash, mas apareceu na mesma requisição ✅ corrigido

O servidor devolve o JWT num campo chamado **`TOKEN`**:

```pascal
JSONObject.AddPair('TOKEN', CreateToken(TokenDatabase));   // User.DAO.pas:92
```

e o cliente Delphi lê `GetValue<String>('TOKEN')`. O schema deste repositório esperava `JWT`, o que
faria o `parse` falhar no primeiro login real, independentemente da decisão sobre a senha.
**Já corrigido** em `src/features/auth/schemas/auth.schema.ts`: a borda lê `TOKEN` e traduz para
`jwt`, que continua sendo o nome do domínio (`CLAUDE.md §3`).

Se o contrato do `/v1/auth/login` for revisto junto com a mudança de senha, vale renomear o campo
para `JWT` no servidor — mas aí é o schema que acompanha, não o contrário.

---

## 7. Decisão a tomar

Para o time de backend, três perguntas objetivas:

1. **Aceitamos senha em texto puro sobre TLS, com Argon2id/bcrypt no servidor?** (Recomendado. Se
   sim, o app está pronto: uma linha.)
2. **Argon2id ou bcrypt?** Bcrypt já está vendorizado no Orion e não custa nada começar; Argon2id é
   a recomendação atual da OWASP.
3. **Todas as URLs de tenant em produção já são `https`?** Se não, isso vira o primeiro item — e o
   app passa a rejeitar `http` na configuração de servidor.

Fechadas as três, o bloqueio 🔒 B1 cai e a tela A4 (`(auth)/login`) fecha.

---

## 8. Referências

- `docs/analise-app-original.md` §3.1 (fluxo de login), §4.1 (`DEVICE_INFO`), §7.1.9 (credenciais
  expostas), §7.1.3 (erro decidido por texto), §5.2 (endpoints do tenant)
- `docs/plano-migracao.md` §3 Bloco A / A4, §6 bloqueios B1 e B4
- `CLAUDE.md` §7.1 (decisão em aberto), §8 (o que não migrar)
- Código legado no monorepo `Source Rio`:
  `Projects/App/Aplicativos Horse/Commun/Controller/uBaseConfiguration.Controller.pas:332-398` ·
  `Projects/App/Aplicativos Horse/Commun/Units/CryptographyUtil.pas:69` ·
  `Projects/Desktop/Orion Server Horse/Controller/Auth.Controller.pas:54-85` ·
  `Projects/Desktop/Orion Server Horse/DAO/User.DAO.pas:55-92` ·
  `Projects/Desktop/Orion Server Horse/Controller/ServerConfiguration.Controller.pas:595-640` ·
  `Projects/Desktop/Orion Server Horse/Lib/bcrypt-master/` · `Default/Common/Pitagoras.Util.pas:323-374`
- OWASP Password Storage Cheat Sheet · OWASP ASVS v4 §2.4 (armazenamento de credencial)

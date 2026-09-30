---
name: sync-master
description: "Sincroniza a branch local atual com a branch principal de origin, detectando master, main ou outro nome, ou com uma branch de origem indicada pelo usuário. Preserva trabalho local, resolve conflitos óbvios e investiga os demais antes de pedir confirmação. Use ao invocar sync-master ou pedir essa sincronização."
---

# Sincronizar a branch atual com a principal de origin

Ao receber `$sync-master` ou um pedido equivalente, descubra a branch principal de
`origin` e incorpore-a na branch em que o usuário está trabalhando, sem trocar de
branch ou reescrever os commits locais. Ela pode se chamar `master`, `main` ou outro
nome. Se o usuário indicar uma origem específica, essa escolha tem prioridade.
O nome da skill é mantido por compatibilidade; invocá-la não é uma escolha literal
de `origin/master`.

A direção é **branch de origem escolhida → branch local atual**. Sincronizada
significa que a branch contém todos os commits da origem consultada; ela pode
continuar à frente por conter trabalho próprio. Igualdade de hashes só ocorre sem
commits locais exclusivos. Não publique mudanças para produzir uma falsa igualdade.

## Autorização e limites

A solicitação de executar esta sincronização autoriza fetch, merge local, o commit
de merge necessário, preservação/restauração do trabalho local e resolução dos
conflitos óbvios. Não peça essa mesma autorização novamente. Apenas ler, criar,
editar ou explicar esta skill não autoriza executar a sincronização.

Não faça push, rebase, reset destrutivo, clean, descarte de arquivos, troca/criação
de branch ou worktree, commit de trabalho preexistente, deploy ou aplicação de
migration. Não altere upstream, remotes, configurações Git ou políticas de aprovação.
Use Git pela CLI ou ferramentas nativas; nunca o navegador para operar GitHub.
Respeite restrições específicas do projeto, inclusive funções críticas e ações que
exijam aprovação adicional. Uma negativa do ambiente não autoriza contorná-la.

## Antes de integrar

Execute os comandos de Git com diretório de trabalho explícito. Determine a raiz
real e a branch atual, incluindo quando o comando for acionado numa subpasta ou
worktree existente. Leia as instruções aplicáveis (`AGENTS.md`, `CLAUDE.md` e os
documentos de módulo relevantes). Não use caminhos ou nomes de branch históricos.

Registre branch atual, HEAD original, eventual upstream, estado do índice e arquivos
modificados/não rastreados. Use saída terminada em NUL ao processar nomes de arquivo;
não divida caminhos por espaços. Não imprima conteúdo de secrets, patches privados
ou URLs de remotes com credenciais.

Pare com uma explicação objetiva se não houver repositório de trabalho, commit em
HEAD, branch nomeada ou remote `origin`. Também pare se existir operação Git anterior
inacabada (merge, rebase, cherry-pick, revert, sequencer ou bisect), índice com
conflitos ou lock ativo. Verifique esses estados usando `git rev-parse --git-path`,
pois `.git` pode ser um arquivo de worktree. Não aborte operações de outra tarefa.

## Descobrir e buscar a origem

Consulte o remoto ao vivo antes de escolher a origem:

```bash
git ls-remote --symref origin HEAD 'refs/heads/*'
```

Leia o `ref: refs/heads/... HEAD` como indicação da branch padrão e confira sua
presença entre as branches anunciadas. Resolva a origem nesta ordem:

1. **Origem explícita do usuário:** use exatamente a branch indicada, como
   `origin/master`, `origin/main` ou `origin/release/stable`. Se ela não existir,
   apresente as opções verificadas e peça confirmação antes de substituí-la.
2. **Branch padrão anunciada pelo remoto:** sem escolha explícita, use a branch
   apontada pelo `HEAD` remoto, independentemente do nome. Não peça confirmação só
   porque ela se chama `main`, `develop`, `trunk` ou outro nome em vez de `master`.
3. **Sem indicação utilizável do remoto:** consulte uma definição explícita da base
   de sincronização nas instruções do projeto e confirme que a branch existe. Sem
   essa definição, use a única branch existente ou, havendo várias, a única entre
   `main` e `master`. Se ambas existirem, ou se houver várias com outros nomes,
   apresente as candidatas e peça uma única confirmação.

Não presuma que o upstream da branch de trabalho seja a principal. O `origin/HEAD`
local pode estar desatualizado; ele não substitui a consulta ao remoto. Falha de
rede ou autenticação não significa branch ausente: pare e informe a falha, sem usar
referências antigas nem tentar outra origem como se a consulta tivesse funcionado.

Informe a origem escolhida e a evidência da escolha. Registre seu nome em
`sync_source_branch`, sem o prefixo `origin/`, e defina
`sync_source_ref="refs/remotes/origin/$sync_source_branch"`. Antes do fetch,
registre o hash anterior dessa referência com
`git rev-parse --verify "${sync_source_ref}^{commit}"`; a ausência de uma referência
local é aceitável se a branch foi confirmada no remoto. Registre também a branch local original em
`sync_current_branch`.

Valide o nome, atualize somente a referência escolhida e fixe o commit que será
integrado. As variáveis abaixo devem conter os nomes verificados, nunca nomes
históricos ou valores presumidos:

```bash
git check-ref-format "refs/heads/$sync_source_branch"
git fetch --no-tags --no-recurse-submodules origin "refs/heads/$sync_source_branch:$sync_source_ref"
sync_target_head=$(git rev-parse --verify "${sync_source_ref}^{commit}")
git rev-list --left-right --count HEAD..."$sync_target_head"
```

Execute cada etapa apenas após verificar o sucesso da anterior. Se fetch falhar,
não prossiga usando uma referência velha nem substitua a origem silenciosamente.
Se a origem tiver sido reescrita em relação ao hash registrado ou não houver
ancestral comum, investigue e peça confirmação; nunca use
`--allow-unrelated-histories` automaticamente.

Na contagem acima, o primeiro número são commits exclusivos locais; o segundo são
commits da origem que faltam localmente. Se o segundo for zero, informe que a branch
já está atualizada, preserve o diretório como está e encerre sem stash ou commit.

Se houver mudanças locais e commits a receber, leia
[Preservar trabalho local](references/local-changes.md) **antes** de modificar o
índice ou o diretório. Só inicie o merge com o trabalho preexistente protegido e
com o índice/diretório rastreado limpos. Confirme novamente branch e HEAD antes da
mutação; mudança concorrente de estado exige nova análise, não comandos automáticos.

## Integrar e resolver

Se HEAD for ancestral do alvo, use `git merge --ff-only "$sync_target_head"`.
Se houver divergência, use:

```bash
git -c rerere.enabled=false merge --no-ff --no-commit --no-autostash "$sync_target_head"
```

Desabilitar `rerere` apenas nessa execução evita aceitar silenciosamente resoluções
históricas. Não use `-X ours`, `-X theirs`, `-s ours` nem escolha global de um lado.
Interprete a saída: uma falha sem arquivos em conflito pode ser problema de hook,
permissão ou arquivo local, e não deve ser tratada como conflito de conteúdo.

Em cada conflito, examine a base e os dois lados (`git ls-files -u` e
`git show :1:caminho`, `:2:caminho`, `:3:caminho` quando existirem), o diff completo
e os trechos vizinhos. No merge, ours é a branch local e theirs é o alvo recebido.
Não transfira essa interpretação mecanicamente a conflitos de restauração de stash.

| Classificação | Conduta |
| --- | --- |
| Formatação ou finais de linha com semântica comprovadamente idêntica | Resolver e conferir o diff. |
| Adições independentes, como imports/entradas distintas sem dependência de ordem | Preservar ambas e remover apenas duplicatas comprovadas. |
| Arquivo gerado com fonte já resolvida e gerador/versionamento definidos no projeto | Regenerar pela ferramenta correta; revisar o diff e evitar churn. |
| Regras de negócio, cálculos, permissões, autenticação, contratos/API, migrations, dependências ou ordem de execução | Investigar e pedir confirmação. |
| Delete/modify, renomes ambíguos, binários, submódulos, instruções do projeto contraditórias ou intenção incerta | Investigar e pedir confirmação. |

Um lockfile só é mecânico quando manifestos, versões e resolução de dependências já
estão inequívocos. Nunca apague o lockfile nem escolha um lado inteiro para passar
no merge. Rodar testes com sucesso não transforma uma escolha de produto em óbvia.

Para conflitos **não óbvios**, antes de pedir confirmação:

- Leia documentação do módulo, decisões/ADRs, specs, regras do projeto, testes,
  chamadores e implementações relacionadas. Use `rg` e `git log -p -- caminho` para
  entender a intenção dos dois lados. Examine também documentos relevantes no alvo
  recebido quando a versão local estiver desatualizada ou em conflito.
- Prepare uma proposta concreta por decisão: comportamento de cada lado, evidências
  com caminhos/linhas, impacto para o usuário e resultado recomendado. Mostre um
  trecho ou diff proposto fora do arquivo em conflito, sem aplicá-lo ainda.
- Agrupe decisões relacionadas numa confirmação curta. Ofereça alternativas reais
  quando existirem; não invente opções. Mesmo com forte evidência documental,
  **aguarde confirmação** para resolver um conflito classificado como não óbvio.

Resolva os conflitos óbvios independentes enquanto prepara as decisões restantes.
Deixe conflitos pendentes visíveis, preserve o stash e não faça o commit de merge
até todas as decisões necessárias estarem aprovadas. Ao retomar, confira o estado
e aplique somente a resolução aprovada. Se uma regra do projeto bloquear a ação,
cite a regra, o arquivo de origem e por que ela se aplica.

Adicione ao índice somente os caminhos resolvidos (`git add -- caminho`), nunca
`git add .` ou `git add -A`. Revise o resultado do merge inteiro, inclusive mudanças
que o Git combinou sem conflito textual. Não aproveite a operação para refatorar.

## Validar e concluir

Antes do commit de merge, confirme ausência de entradas não mescladas e marcadores
de conflito introduzidos; rode `git diff --cached --check`. Confira se o índice
contém apenas a integração e as resoluções autorizadas. Use os comandos documentados
de lint, tipos e testes relevantes às áreas alteradas; rode build quando exigido
pelo projeto ou pelo alcance da mudança. Não execute validações com efeitos reais
de produção, cobrança, envio ou publicação. No fast-forward, valide logo após avançar.

Se uma resolução óbvia provocar falha local, corrija dentro desse escopo e repita o
check afetado. Se precisar decidir comportamento ou ampliar escopo, apresente a
evidência e peça confirmação. Se um check obrigatório não puder rodar, informe a
limitação e deixe o merge sem commit até obter decisão; não declare sucesso validado.
Uma falha depois de fast-forward não autoriza reset para esconder a falha.

Com validação concluída, finalize apenas o merge pendente, por exemplo com
`git commit -m "Merge origin/${sync_source_branch} into ${sync_current_branch}"`,
usando os nomes reais com quoting seguro. Não desative hooks, assinatura ou checks
para forçar o commit.
Restaure então o trabalho local conforme a referência. Conflitos nessa restauração
obedecem à mesma regra de investigação e confirmação; nunca entram no commit de merge.

Verifique no final:

```bash
git merge-base --is-ancestor "$sync_target_head" HEAD
git rev-list --left-right --count HEAD..."$sync_target_head"
git status --short --branch
git diff --check
git diff --cached --check
```

Confirme também que o HEAD original continua ancestral do HEAD final, a branch é a
mesma, não há operação/conflito pendente e alterações locais foram recuperadas com
sua separação entre staged, unstaged e untracked. Se o índice final tiver mudanças
locais anteriores, isso é esperado e não autoriza um novo commit. Diferencie falhas
preexistentes de problemas introduzidos. A garantia cobre o hash buscado nesta
execução; não repita fetch em loop se a origem continuar recebendo commits.

Responda em pt-BR com branch local, origem escolhida e motivo, hash integrado,
situação antes/depois, validações, conflitos resolvidos e pendências/backup. Diga
claramente quando a integração ou a restauração ainda não terminou. Liste arquivos
ajustados na resolução e eventuais migrations/Edge Functions recebidas como
pendências de implantação, sem executá-las.
Respeite o formato de entrega do projeto e termine com uma explicação simples do
resultado para o usuário.

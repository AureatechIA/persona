# Preservar trabalho local

Use somente quando existem commits a receber e mudanças locais. A proteção abaixo
faz parte da sincronização solicitada; não crie um commit WIP nem inclua essas
mudanças no commit de merge.

## Registrar e proteger

Crie um diretório temporário privado, fora do repositório e com permissão `0700`.
Registre ali branch, HEAD, alvo buscado, status completo em NUL, arquivos staged,
unstaged e untracked. Guarde patches binários de `git diff` e `git diff --cached`
com `--no-ext-diff --no-textconv`, incluindo metadados necessários para reconstruir
o índice. Redirecione o conteúdo aos arquivos, não à conversa; não exponha secrets.

Inventarie submódulos, repositórios aninhados, arquivos ignorados e configurações
especiais de checkout. `git stash --include-untracked` não protege arquivos ignorados
nem trabalho dentro de submódulos/repositórios aninhados. Não use `stash --all`.
Se esses casos puderem ser afetados, pare antes do merge e peça uma decisão de
preservação específica. Não mova ou apague arquivos para desbloquear a atualização.

Compare caminhos que passarão a existir/ser rastreados no alvo com arquivos locais
ignorados e untracked, inclusive colisões arquivo/diretório. Um arquivo local pode
ser sobrescrito no merge ou impedir a restauração. Faça cópia privada e verificável
dos arquivos potencialmente afetados; não inclua pastas de dependências inteiras.
Se não houver uma forma inequívoca de preservar/restaurar o conteúdo e a localização,
trate o caso como não óbvio e peça confirmação antes de integrar.

Registre o hash do stash anterior, se existir, e crie um stash identificado:

```bash
git stash push --include-untracked --message "sync-master:<id-unico>:<branch-atual>"
sync_stash_oid=$(git rev-parse --verify refs/stash)
```

Substitua os marcadores por valores seguros antes de executar. Confira o sucesso do
comando, que um stash novo foi criado, a mensagem e o primeiro pai (HEAD original).
Registre **o hash imutável** do novo stash no diretório privado. Não use `stash@{0}`
para a restauração: outra tarefa pode criar stashes durante a execução.

Verifique que o índice e o diretório rastreado ficaram limpos e que nenhum arquivo
untracked relevante sobrou sem proteção. Falha no stash não autoriza o merge.
Mantenha backup e metadados acessíveis mesmo ao pausar para confirmação.

## Recuperar após a integração

Com merge concluído e índice limpo, restaure pelo hash registrado:

```bash
git stash apply --index "$sync_stash_oid"
```

Use `apply`, nunca `pop`: a cópia de recuperação precisa sobreviver a falhas.
`--index` tenta recuperar a separação original entre staged e unstaged. Não presuma
que retornou tudo apenas porque os arquivos reapareceram.

Se a aplicação falhar, inspecione primeiro status, índice e conteúdo já aplicado.
Não repita o comando às cegas: ele pode ter restaurado apenas parte do trabalho.

- Com conflitos de conteúdo, consulte os estágios presentes, o HEAD integrado e
  os snapshots do stash. Compare `stash^1` (base), `stash^2` (índice anterior), o
  próprio stash (conteúdo rastreado do diretório) e `stash^3` (untracked, se existir).
  Resolva apenas o que for óbvio; leve decisões de comportamento ao usuário.
- Se `--index` falhar antes de modificar índice/diretório e isso for comprovado,
  aplicar sem `--index` é uma alternativa de recuperação de conteúdo. Isso **não**
  recupera a intenção de stage: reconstrua-a com os snapshots, sem misturar hunks.
  Não tente essa alternativa se houver aplicação parcial ou estado incerto.
- Reconstrua o índice somente nos caminhos/hunks envolvidos na restauração, mantendo
  o conteúdo do diretório. É permitido restaurar apenas o índice para o HEAD atual
  nesses caminhos quando necessário e comprovadamente seguro; nunca restaure o
  diretório a HEAD nem use reset para descartar o trabalho. Mudanças antes unstaged
  não podem ficar staged só porque `git add` foi usado para resolver conflitos.
- Se a nova base impedir recuperar inequivocamente a intenção de um hunk staged,
  apresente a diferença e peça confirmação. Não dê a restauração como concluída.
- Se um untracked colidir com arquivo agora rastreado, preserve ambos em backup e
  proponha o conteúdo/localização final ao usuário; não sobrescreva nenhum lado.

Compare com o inventário original: nenhum conteúdo local perdido, nenhum untracked
ausente, staged/unstaged preservados, nenhum conflito restante e nenhuma alteração
preexistente incorporada ao commit de merge. Hashes exatos servem para arquivos
intocados pela origem; para arquivos integrados, revise os hunks e a intenção salva.
Se a restauração tocar áreas também alteradas pela integração, repita os checks
afetados sobre a composição final. Separe falhas preexistentes do trabalho local
das falhas causadas pela integração antes de declarar o resultado validado.

Mantenha o stash nomeado como cópia de recuperação ao final e informe seu hash curto
e a localização dos metadados privados. Não execute `stash clear`, não apague stashes
de outras tarefas e não remova a última cópia enquanto houver qualquer pendência.

## Interrupções

Se houver decisão pendente no merge, mantenha-o aberto e deixe o trabalho anterior
no stash; diga isso ao usuário. Não tente reaplicar stash sobre merge inacabado.
Se o usuário cancelar, ofereça recuperação com `git merge --abort` somente para o
merge iniciado por esta execução e antes de commit/fast-forward, após verificar que
nenhuma edição concorrente será perdida. Depois, recupere o stash pelo hash salvo.
Após avanço concluído, não faça reset/revert automático; explique o estado e peça
uma decisão concreta. Nunca aborte uma operação preexistente de outra tarefa.

# App Treino - Academia

Um aplicativo web moderno e responsivo para gerenciar seus treinos na academia. Desenvolvido para funcionar em smartphones e navegadores de todos os sistemas operacionais.

## 🚀 Funcionalidades

- **Gerenciamento de Treinos**: Crie e organize seus treinos (A, B, C, D, etc.)
- **Exercícios Detalhados**: Adicione exercícios com séries, repetições e observações
- **Imagens de Referência**: Inclua imagens para cada exercício
- **Controle de Progresso**: Marque exercícios como concluídos
- **Interface Responsiva**: Funciona perfeitamente em smartphones e desktops
- **Persistência de Dados**: Seus dados são salvos localmente no navegador

## 📱 Como Usar

### 1. Acessar o App
- Abra o arquivo `index.html` em qualquer navegador moderno
- O app funciona offline e salva seus dados localmente

### 2. Criar Treinos
- Clique em "Novo Treino" no cabeçalho
- Digite o nome do treino (ex: "Treino A - Peito e Tríceps")
- Adicione uma descrição opcional
- Clique em "Criar Treino"

### 3. Adicionar Exercícios
- Selecione um treino clicando na aba correspondente
- Clique em "Adicionar Exercício"
- Preencha:
  - **Nome do Exercício**: Ex: "Supino Reto"
  - **Séries**: Número de séries (ex: 3)
  - **Repetições**: Faixa de repetições (ex: "8-12")
  - **Imagem**: Nome do arquivo na pasta `img/` ou URL
  - **Observações**: Dicas e variações (opcional)

### 4. Marcar Exercícios Concluídos
- Durante o treino, clique em "Concluir" em cada exercício
- O app mostra o progresso: "X/Y exercícios"
- Você pode desfazer marcando "Desfazer"

### 5. Usar Imagens
- Coloque suas imagens na pasta `img/`
- No campo "Imagem", digite apenas o nome do arquivo (ex: "supino-reto.jpg")
- O app automaticamente busca na pasta `img/`

## 🎨 Características do Design

- **Interface Moderna**: Design limpo e intuitivo
- **Responsivo**: Adapta-se a qualquer tamanho de tela
- **Animações Suaves**: Transições e efeitos visuais
- **Cores Atraentes**: Gradientes e esquema de cores profissional
- **Ícones**: Font Awesome para melhor experiência visual

## 📁 Estrutura de Arquivos

```
app-treino/
├── index.html          # Página principal
├── styles.css          # Estilos CSS
├── script.js           # Lógica JavaScript
├── README.md           # Este arquivo
└── img/                # Pasta com imagens dos exercícios
    ├── Barra-no-graviton.jpg
    ├── puxada-aberta.jpg
    ├── Remada triângulo.jpg
    └── ... (outras imagens)
```

## 🔧 Personalização

### Adicionar Novos Exercícios
1. Selecione um treino
2. Clique em "Adicionar Exercício"
3. Preencha os dados
4. Para usar imagens, coloque-as na pasta `img/`

### Modificar Treinos Existentes
- Os dados são salvos no localStorage do navegador
- Para resetar, limpe os dados do navegador ou delete o localStorage

### Cores e Estilo
- Edite o arquivo `styles.css` para personalizar cores e layout
- O app usa CSS moderno com variáveis e gradientes

## 📱 Compatibilidade

- ✅ Chrome, Firefox, Safari, Edge
- ✅ iOS Safari
- ✅ Android Chrome
- ✅ Funciona offline
- ✅ Salva dados localmente

## 🚀 Dados de Exemplo

O app vem com 4 treinos de exemplo:
- **Treino A**: Peito e Tríceps
- **Treino B**: Costas e Bíceps  
- **Treino C**: Pernas
- **Treino D**: Ombros

Cada treino inclui exercícios com imagens das suas fotos na pasta `img/`.

## 💡 Dicas de Uso

1. **Organize seus treinos** por grupos musculares ou dias da semana
2. **Use imagens** para lembrar a técnica correta
3. **Adicione observações** com dicas específicas
4. **Marque exercícios** conforme você os completa
5. **Acompanhe o progresso** através das estatísticas

## 🔄 Backup e Sincronização

- Os dados são salvos no navegador local
- Para backup, você pode exportar os dados do localStorage
- Para usar em outro dispositivo, copie os arquivos e importe os dados

---

**Desenvolvido para facilitar seus treinos na academia! 💪** 
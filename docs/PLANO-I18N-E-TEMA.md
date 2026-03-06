# Plano: Internacionalização (i18n) e Modo Claro/Escuro

## Visão geral

- **Feature 1:** Internacionalização completa com seletor de idioma (Português, Inglês, Espanhol).
- **Feature 2:** Modo claro (light mode) com seletor, mantendo o dark mode atual.

---

## 1. INTERNACIONALIZAÇÃO (i18n)

### 1.1 Escolha de biblioteca

- **Recomendação:** `react-i18next` + `i18next`.
  - Padrão de mercado, suporte a namespaces, lazy load de traduções, integração simples com React.
  - Alternativa mais leve: `react-intl` (FormatJS).

### 1.2 Estrutura de arquivos

```
frontend/
  src/
    i18n/
      index.js              # Configuração i18next (idioma padrão, fallback, detecção)
      locales/
        pt.json             # Português (padrão)
        en.json             # Inglês
        es.json             # Espanhol
```

- Um JSON por idioma com as mesmas chaves (ex.: `common.save`, `settings.profile.title`).
- Opcional: namespaces por área (`auth.json`, `dashboard.json`, `settings.json`) para carregar sob demanda.

### 1.3 Onde colocar o seletor de idioma

- **Opção A (recomendada):** No header superior direito, ao lado do dropdown de notificações (e depois do seletor de tema).
- **Opção B:** Dentro de Configurações (aba Perfil ou nova aba “Aparência”) + ícone/compacto no header.
- **Persistência:** `localStorage` (ex.: `leadminer_lang`) e/ou preferência no backend (campo no usuário) para manter entre dispositivos.

### 1.4 Escopo da tradução

- **Landing:** título, subtítulo, CTAs, seções de features, preços, footer.
- **Auth:** Login, Register, labels, placeholders, mensagens de erro, botões sociais.
- **Dashboard:** títulos, cards, labels de stats, botões de ação rápida, buscas recentes.
- **Nova Busca / Buscas:** labels (palavras-chave, hashtags, localização, plataforma), botões, mensagens de sucesso/erro.
- **Leads:** filtros, colunas, status, qualificação, botões (exportar, etc.), empty states.
- **Configurações:** nomes das abas (Perfil, Plano, Histórico, Indicação), formulários (avatar, senha), planos, referral.
- **Admin:** títulos, labels, tabelas.
- **Componentes globais:** Sidebar (itens de menu), NotificationDropdown, botões comuns (Salvar, Cancelar, etc.).

### 1.5 Fluxo técnico

1. Inicializar i18n no `index.js` ou `App.js` (antes da árvore React).
2. Envolver a app com `I18nextProvider` (já incluso no `react-i18next`).
3. Trocar textos fixos por `useTranslation()` e `t('chave')` (ou `<Trans>` quando houver interpolação/HTML).
4. Criar componente `LanguageSelector`: dropdown ou botões (PT | EN | ES), chamando `i18n.changeLanguage(lang)` e gravando no `localStorage`.
5. Formatação de datas/números: usar `i18next` com `Intl` (locale por idioma) onde já existir formatação (ex.: datas nas listagens).

### 1.6 Riscos e cuidados

- Garantir que todas as strings de UI estejam em arquivos de tradução (auditar após implementação).
- Manter chaves em inglês no código (ex.: `dashboard.title`) para facilitar manutenção.
- Testar layout com textos mais longos (ex.: alemão no futuro) para evitar quebras; EN/ES/PT têm tamanhos parecidos.

---

## 2. MODO CLARO (LIGHT MODE) + SELETOR

### 2.1 Abordagem técnica (Tailwind)

- O projeto já usa **Tailwind**. A abordagem recomendada é usar a estratégia **class** do dark mode:
  - No `tailwind.config`: `darkMode: 'class'`.
  - No `<html>` (ou um wrapper): classe `dark` quando for dark, ausência de `dark` quando for light.
  - Nos componentes: usar `dark:` para estilos do modo escuro e estilos “normais” para o modo claro.
  - Ex.: `bg-white dark:bg-gray-900`, `text-gray-900 dark:text-white`.

### 2.2 Variáveis e tokens

- Definir um conjunto pequeno de tokens (ex.: `--color-bg`, `--color-surface`, `--color-text`, `--color-border`) em CSS e sobrescrevê-los no `[data-theme="light"]` e `[data-theme="dark"]` (ou `.dark`).
- Ou manter só Tailwind: cores semânticas (ex.: `bg-background`, `text-foreground`) configuradas no Tailwind para light/dark via `class`.

### 2.3 Onde colocar o seletor de tema

- **Header superior direito:** ícone sol/lua ou toggle (Light | Dark) ao lado do seletor de idioma e do sino de notificações.
- **Persistência:** `localStorage` (ex.: `leadminer_theme`: `"light"` | `"dark"`) e aplicar a classe no mount (e em toda navegação) para evitar flash.

### 2.4 Escopo da mudança

- **Global:** fundo da página, cor de texto base, bordas.
- **Layout:** Sidebar, barra superior, cards, inputs, botões (primário, secundário, ghost).
- **Páginas:** Landing, Login, Register, Dashboard, Busca, Buscas, Leads, Configurações, Admin.
- **Componentes:** modais, dropdowns, toasts, tabelas, badges, tabs.
- **Acessibilidade:** contraste adequado no light mode (WCAG); evitar fundo branco puro com texto preto sem ajuste.

### 2.5 Fluxo técnico

1. **Config:** em `tailwind.config.js`, definir `darkMode: 'class'`.
2. **Contexto ou hook:** criar `ThemeContext` (ou hook `useTheme`) que:
   - Lê `localStorage` e preferência do sistema (`prefers-color-scheme`) na primeira visita (opcional).
   - Expõe `theme` (`'light' | 'dark'`) e `setTheme`.
   - Aplica `document.documentElement.classList.add('dark')` ou `remove('dark')` e grava no `localStorage`.
3. **Componente ThemeSelector:** ícone ou toggle que chama `setTheme`.
4. **Refatoração:** passar em todos os componentes que usam cores fixas de dark (ex.: `bg-[#030712]`, `bg-gray-900`) e duplicar com variantes `dark:` onde já existir, e estilos “light” sem prefixo (ou com classe quando usar variáveis).

### 2.6 Ordem sugerida de páginas para tema

1. Layout base (Sidebar, header, DashboardLayout).
2. Landing, Login, Register.
3. Dashboard, Nova Busca, Buscas, Leads.
4. Configurações, Admin.
5. Componentes compartilhados (modais, dropdowns, toasts).

### 2.7 Riscos e cuidados

- Evitar flash de tema errado: aplicar classe no `<html>` o mais cedo possível (script inline no `index.html` ou no primeiro render do root).
- Manter contraste e legibilidade no light (evitar cinzas claros demais em texto).
- Testar componentes com bordas e sombras em ambos os modos.

---

## 3. ORDEM DE IMPLEMENTAÇÃO SUGERIDA

| Fase | Descrição |
|------|-----------|
| **1** | Configurar i18n (react-i18next), criar estrutura de pastas e arquivos vazios (pt, en, es), e traduzir uma tela piloto (ex.: Login) para validar o fluxo. |
| **2** | Preencher traduções para todas as telas e componentes (pt primeiro, depois en e es) e adicionar o **LanguageSelector** no header. |
| **3** | Configurar Tailwind `darkMode: 'class'`, criar ThemeContext e ThemeSelector, e aplicar tema no layout (sidebar + header). |
| **4** | Refatorar todas as páginas e componentes para suportar light/dark (tokens ou classes Tailwind). |
| **5** | Ajustes finais: persistência de idioma/tema, preferência do sistema (opcional), testes de acessibilidade e revisão de textos longos. |

---

## 4. CHECKLIST RÁPIDO

**i18n**
- [ ] Instalar e configurar `react-i18next` e `i18next`
- [ ] Criar `src/i18n/` e `locales/pt.json`, `en.json`, `es.json`
- [ ] Trocar strings por `t('key')` em todas as telas e componentes
- [ ] Implementar LanguageSelector e persistência (localStorage e/ou backend)
- [ ] Formatação de datas/números por locale

**Tema**
- [ ] `darkMode: 'class'` no Tailwind
- [ ] ThemeContext (ou useTheme) + persistência em localStorage
- [ ] ThemeSelector no header
- [ ] Aplicar classes/variáveis em layout e em todas as páginas/componentes
- [ ] Evitar flash na primeira carga (script ou estado inicial)

---

## 5. REFERÊNCIAS

- [react-i18next](https://react.i18next.com/)
- [Tailwind CSS - Dark Mode](https://tailwindcss.com/docs/dark-mode)
- [WCAG Contrast](https://www.w3.org/WAI/WCAG21/Understanding/contrast-minimum.html)

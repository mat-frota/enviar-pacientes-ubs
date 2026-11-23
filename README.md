# 🏥 Sistema de Notificação e Agendamento de Pacientes - UBS Suzyanne Sousa Lopes

Sistema web desenvolvido especialmente para a Unidade Básica de Saúde **UBS Suzyanne Sousa Lopes**, em **Olho d'Água das Cunhãs - MA**, para organização dos atendimentos dos 8 Agentes Comunitários de Saúde (ACS) e disparo automatizado de avisos de consulta para grupos do WhatsApp.

---

## 🌟 Funcionalidades Principais

1. **Gestão dos 8 Agentes de Saúde (ACS)**:
   - Seletor rápido dos 8 ACS da UBS com microárea e quantidade de cidadãos vinculados.
   - Pré-carregado com os 267 cidadãos reais da Microárea 13 (**Mateus Frota Mesquita**).
   - Painel para personalizar os nomes e microáreas de todos os agentes.

2. **Importação Direta de Planilhas CSV do e-SUS**:
   - Converte e armazena os relatórios de acompanhamento de território gerados no e-SUS Atenção Primária.
   - Suporte nativo à codificação ISO-8859-1 (Latin1) usada pelo Ministério da Saúde, preservando todos os acentos e caracteres especiais.
   - Detecção automática do ACS e microárea através do cabeçalho do arquivo.

3. **Cadastro Individual de Cidadãos**:
   - Opção para adicionar ou editar pacientes manualmente com endereço completo, DN, CPF e ponto de referência.

4. **Busca Inteligente por Paciente**:
   - Pesquisa em tempo real com lupa por **Nome**, **CPF** ou **Rua**.
   - Preenchimento instantâneo de todos os dados do paciente.

5. **Seleção de Especialidades e Horário**:
   - Botões rápidos: Psicóloga, Psiquiatra, Nutricionista, Dentista, Clínico Geral, Enfermagem, etc.
   - Calendário visual para o dia da consulta.
   - Turno (Manhã, Tarde ou horário personalizado).

6. **Disparo para o WhatsApp**:
   - Visualização em tempo real da mensagem formatada no modelo exato:
     ```text
     Nome: ANTONIA DA SILVA RODRIGUES
     DN: 15-08-1968
     CPF: 027.179.203-58
     Local: Travessa SÃO PEDRO, Nº 16 - Centro - Olho d'Água das Cunhãs - MA
     ACS: Mateus Frota Mesquita
     Atendimento com: Psicóloga
     Atendimento (Dia e hora): 28/11/2026 - Manhã
     ```
   - Botão **Enviar para o WhatsApp**: abre diretamente a tela de seleção de contatos e **grupos** no WhatsApp Web ou App móvel para você escolher o grupo desejado da equipe.
   - Botão **Copiar Mensagem** para colar onde preferir.

---

## 🚀 Como Executar no seu Computador (Localhost)

Basta dar dois cliques no arquivo **`iniciar.bat`** ou executar no terminal dentro da pasta:

```bash
node server.js
```

E acessar no seu navegador:
👉 **[http://localhost:3000](http://localhost:3000)**

---

## 🌐 Como Publicar no GitHub Pages (Online Gratuito)

Este projeto foi construído 100% em tecnologias estáticas (HTML5, CSS3 e JavaScript puro), sem necessidade de banco de dados ou servidor backend externo pago, salvando tudo de forma segura no próprio navegador (LocalStorage / IndexedDB).

Para colocar no ar no GitHub Pages:
1. Crie um novo repositório no seu GitHub (ex: `enviar-pacientes-ubs`).
2. Envie os arquivos desta pasta para o repositório (`index.html`, `style.css`, `app.js`, `sample-data.js`).
3. No GitHub, vá na aba **Settings** > **Pages**.
4. Em **Branch**, selecione `main` (ou `master`) e a pasta `/(root)`. Clique em **Save**.
5. Em poucos instantes o link estará público (ex: `https://seu-usuario.github.io/enviar-pacientes-ubs`).

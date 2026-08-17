# Controle de Chaves

Sistema web para controle de chaves de ambientes. Permite cadastrar chaves, pessoas, registrar retiradas e devoluções, e acompanhar o histórico de movimentações.

## Funcionalidades

- **Autenticação** — Login com email/senha via Firebase Authentication
- **Dashboard** — Painel com estatísticas (total, disponíveis, emprestadas, atrasadas)
- **Cadastro de chaves** — CRUD completo (nome, local, descrição, status)
- **Cadastro de pessoas** — CRUD completo (nome, telefone, email, setor)
- **Retirada de chave** — Registra quem retirou, quando e previsão de devolução
- **Devolução de chave** — Registra a devolução e libera a chave automaticamente
- **Histórico** — Lista todas as movimentações realizadas
- **Controle de atrasos** — Identifica chaves com devolução atrasada
- **Segurança** — Regras Firestore protegem os dados contra acessos não autorizados

## Tecnologias

- **Frontend:** React 19, Vite, JavaScript, CSS
- **Backend/BaaS:** Firebase (Firestore + Authentication)
- **Roteamento:** React Router DOM

## Pré-requisitos

- [Node.js](https://nodejs.org/) (v18 ou superior)
- Conta no [Firebase Console](https://console.firebase.google.com/)

## Configuração

1. Clone o repositório:

```bash
git clone <url-do-repositorio>
cd controle-de-chaves/frontend
```

2. Instale as dependências:

```bash
npm install
```

3. No [Firebase Console](https://console.firebase.google.com/):
   - Crie um novo projeto
   - Registre um app Web
   - Copie as credenciais e substitua em `src/config/firebase.js`
   - Habilite **Authentication** > método **Email/Password**
   - Crie um **Firestore Database** (modo teste)

4. Configure as **Firestore Security Rules**:
   - No Firebase Console, vá em **Firestore Database** > aba **Rules**
   - Substitua o conteúdo pelo arquivo `firestore.rules` da raiz do projeto
   - Clique em **Publish**

## Executando

```bash
npm run dev
```

Acesse http://localhost:5173/

## Estrutura do Projeto

```
├── firestore.rules            # Regras de segurança do Firestore
└── frontend/
    └── src/
        ├── config/
        │   └── firebase.js        # Configuração do Firebase
        ├── contexts/
        │   └── AuthContext.jsx    # Contexto de autenticação
        ├── pages/
        │   ├── Login.jsx          # Tela de login
        │   ├── Dashboard.jsx      # Painel principal
        │   ├── Keys.jsx           # Gerenciamento de chaves
        │   ├── People.jsx         # Gerenciamento de pessoas
        │   └── History.jsx        # Histórico de movimentações
        ├── components/
        │   ├── PrivateRoute.jsx   # Proteção de rotas
        │   ├── Modal.jsx          # Modal reutilizável
        │   └── WithdrawalForm.jsx # Formulário de retirada
        ├── services/
        │   └── firestore.js       # Operações com o Firestore
        ├── App.jsx                # Rotas da aplicação
        ├── App.css                # Estilos
        └── main.jsx               # Ponto de entrada
```

## Modelo de Dados (Firestore)

```
keys/
└── {id}
    ├── name: string
    ├── location: string
    ├── description: string
    ├── status: "available" | "borrowed"
    └── createdAt: timestamp

people/
└── {id}
    ├── name: string
    ├── phone: string
    ├── email: string
    ├── sector: string
    └── createdAt: timestamp

movements/
└── {id}
    ├── keyId: string
    ├── keyName: string
    ├── personId: string
    ├── personName: string
    ├── borrowedAt: timestamp
    ├── expectedReturnAt: timestamp
    ├── returnedAt: timestamp | null
    └── status: "active" | "returned"
```

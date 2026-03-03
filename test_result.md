#====================================================================================================
# START - Testing Protocol - DO NOT EDIT OR REMOVE THIS SECTION
#====================================================================================================

# THIS SECTION CONTAINS CRITICAL TESTING INSTRUCTIONS FOR BOTH AGENTS
# BOTH MAIN_AGENT AND TESTING_AGENT MUST PRESERVE THIS ENTIRE BLOCK

# Communication Protocol:
# If the `testing_agent` is available, main agent should delegate all testing tasks to it.
#
# You have access to a file called `test_result.md`. This file contains the complete testing state
# and history, and is the primary means of communication between main and the testing agent.
#
# Main and testing agents must follow this exact format to maintain testing data. 
# The testing data must be entered in yaml format Below is the data structure:
# 
## user_problem_statement: {problem_statement}
## backend:
##   - task: "Task name"
##     implemented: true
##     working: true  # or false or "NA"
##     file: "file_path.py"
##     stuck_count: 0
##     priority: "high"  # or "medium" or "low"
##     needs_retesting: false
##     status_history:
##         -working: true  # or false or "NA"
##         -agent: "main"  # or "testing" or "user"
##         -comment: "Detailed comment about status"
##
## frontend:
##   - task: "Task name"
##     implemented: true
##     working: true  # or false or "NA"
##     file: "file_path.js"
##     stuck_count: 0
##     priority: "high"  # or "medium" or "low"
##     needs_retesting: false
##     status_history:
##         -working: true  # or false or "NA"
##         -agent: "main"  # or "testing" or "user"
##         -comment: "Detailed comment about status"
##
## metadata:
##   created_by: "main_agent"
##   version: "1.0"
##   test_sequence: 0
##   run_ui: false
##
## test_plan:
##   current_focus:
##     - "Task name 1"
##     - "Task name 2"
##   stuck_tasks:
##     - "Task name with persistent issues"
##   test_all: false
##   test_priority: "high_first"  # or "sequential" or "stuck_first"
##
## agent_communication:
##     -agent: "main"  # or "testing" or "user"
##     -message: "Communication message between agents"

# Protocol Guidelines for Main agent
#
# 1. Update Test Result File Before Testing:
#    - Main agent must always update the `test_result.md` file before calling the testing agent
#    - Add implementation details to the status_history
#    - Set `needs_retesting` to true for tasks that need testing
#    - Update the `test_plan` section to guide testing priorities
#    - Add a message to `agent_communication` explaining what you've done
#
# 2. Incorporate User Feedback:
#    - When a user provides feedback that something is or isn't working, add this information to the relevant task's status_history
#    - Update the working status based on user feedback
#    - If a user reports an issue with a task that was marked as working, increment the stuck_count
#    - Whenever user reports issue in the app, if we have testing agent and task_result.md file so find the appropriate task for that and append in status_history of that task to contain the user concern and problem as well 
#
# 3. Track Stuck Tasks:
#    - Monitor which tasks have high stuck_count values or where you are fixing same issue again and again, analyze that when you read task_result.md
#    - For persistent issues, use websearch tool to find solutions
#    - Pay special attention to tasks in the stuck_tasks list
#    - When you fix an issue with a stuck task, don't reset the stuck_count until the testing agent confirms it's working
#
# 4. Provide Context to Testing Agent:
#    - When calling the testing agent, provide clear instructions about:
#      - Which tasks need testing (reference the test_plan)
#      - Any authentication details or configuration needed
#      - Specific test scenarios to focus on
#      - Any known issues or edge cases to verify
#
# 5. Call the testing agent with specific instructions referring to test_result.md
#
# IMPORTANT: Main agent must ALWAYS update test_result.md BEFORE calling the testing agent, as it relies on this file to understand what to test next.

#====================================================================================================
# END - Testing Protocol - DO NOT EDIT OR REMOVE THIS SECTION
#====================================================================================================



#====================================================================================================
# Testing Data - Main Agent and testing sub agent both should log testing data below this section
#====================================================================================================

user_problem_statement: "LeadMiner - Plataforma SaaS para geração de leads via Instagram web scraping. Validar todos os endpoints da API."

backend:
  - task: "Auth - User Registration"
    implemented: true
    working: true
    file: "/app/backend/server.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
      - working: true
        agent: "testing"
        comment: "Último teste passou com sucesso (18/18 testes)"
      - working: true
        agent: "testing"
        comment: "✅ VALIDADO: POST /api/auth/register funciona perfeitamente. Usuário criado com token e ID válidos."

  - task: "Auth - User Login"
    implemented: true
    working: true
    file: "/app/backend/server.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
      - working: true
        agent: "testing"
        comment: "Login funcional"
      - working: true
        agent: "testing"
        comment: "✅ VALIDADO: POST /api/auth/login funciona perfeitamente. Retorna token JWT e dados do usuário."

  - task: "Auth - Get Current User"
    implemented: true
    working: true
    file: "/app/backend/server.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
      - working: true
        agent: "testing"
        comment: "Retorna usuário autenticado"
      - working: true
        agent: "testing"
        comment: "✅ VALIDADO: GET /api/auth/me funciona perfeitamente. Validação de token JWT e retorno de dados do usuário corretos."

  - task: "Dashboard - Get Stats"
    implemented: true
    working: true
    file: "/app/backend/server.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
      - working: true
        agent: "testing"
        comment: "Retorna estatísticas do usuário"
      - working: true
        agent: "testing"
        comment: "✅ VALIDADO: GET /api/dashboard/stats funciona perfeitamente. Retorna total_leads, leads_used, leads_limit, total_searches e plan."

  - task: "Search - Create Search"
    implemented: true
    working: true
    file: "/app/backend/server.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
      - working: true
        agent: "testing"
        comment: "Cria busca e retorna ID"
      - working: true
        agent: "testing"
        comment: "✅ VALIDADO: POST /api/searches funciona perfeitamente. Cria busca com background task para scraping e retorna ID válido. Scraper local funcional (fallback ativo)."

  - task: "Search - Get Searches"
    implemented: true
    working: true
    file: "/app/backend/server.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
      - working: true
        agent: "testing"
        comment: "Lista buscas do usuário"
      - working: true
        agent: "testing"
        comment: "✅ VALIDADO: GET /api/searches funciona perfeitamente. Lista buscas do usuário autenticado com filtragem correta."

  - task: "Search - Get Specific Search"
    implemented: true
    working: true
    file: "/app/backend/server.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
      - working: true
        agent: "testing"
        comment: "✅ VALIDADO: GET /api/searches/{id} funciona perfeitamente. Retorna busca específica com validação de ownership."

  - task: "Leads - Get Leads"
    implemented: true
    working: true
    file: "/app/backend/server.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
      - working: true
        agent: "testing"
        comment: "Lista leads"
      - working: true
        agent: "testing"
        comment: "✅ VALIDADO: GET /api/leads funciona perfeitamente. Lista leads do usuário com suporte a filtros opcionais (search_id, status)."

  - task: "Leads - Update Lead"
    implemented: true
    working: true
    file: "/app/backend/server.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
      - working: true
        agent: "testing"
        comment: "Atualiza status do lead"
      - working: true
        agent: "testing"
        comment: "✅ VALIDADO: PATCH /api/leads/{id} funciona perfeitamente. Atualiza campos como status, qualification e notes com validação de ownership."

  - task: "Leads - Export CSV"
    implemented: true
    working: true
    file: "/app/backend/server.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
      - working: true
        agent: "testing"
        comment: "Exportação CSV funcional"
      - working: true
        agent: "testing"
        comment: "✅ VALIDADO: GET /api/leads/export/csv funciona perfeitamente. Gera arquivo CSV com headers corretos e content-type adequado."

  - task: "Scraping Accounts CRUD"
    implemented: true
    working: true
    file: "/app/backend/server.py"
    stuck_count: 0
    priority: "medium"
    needs_retesting: false
    status_history:
      - working: true
        agent: "testing"
        comment: "Create/Read/Delete contas de scraping"
      - working: true
        agent: "testing"
        comment: "✅ VALIDADO: POST/GET/DELETE /api/scraping-accounts funciona perfeitamente. CRUD completo com validação admin. Passwords protegidas na listagem."

  - task: "Proxies CRUD"
    implemented: true
    working: true
    file: "/app/backend/server.py"
    stuck_count: 0
    priority: "medium"
    needs_retesting: false
    status_history:
      - working: true
        agent: "testing"
        comment: "Create/Read/Delete proxies"
      - working: true
        agent: "testing"
        comment: "✅ VALIDADO: POST/GET/DELETE /api/proxies funciona perfeitamente. CRUD completo com validação admin. Suporte a proxies com/sem autenticação."

  - task: "Plans - Get Plans"
    implemented: true
    working: true
    file: "/app/backend/server.py"
    stuck_count: 0
    priority: "medium"
    needs_retesting: false
    status_history:
      - working: true
        agent: "testing"
        comment: "Lista planos disponíveis"
      - working: true
        agent: "testing"
        comment: "✅ VALIDADO: GET /api/plans funciona perfeitamente. Retorna 4 planos (trial, starter, pro, business) com preços e limites corretos."

frontend:
  - task: "Login Page"
    implemented: true
    working: "NA"
    file: "/app/frontend/src/pages/Login.jsx"
    stuck_count: 0
    priority: "high"
    needs_retesting: false

  - task: "Dashboard"
    implemented: true
    working: "NA"
    file: "/app/frontend/src/pages/Dashboard.jsx"
    stuck_count: 0
    priority: "high"
    needs_retesting: false

metadata:
  created_by: "main_agent"
  version: "1.0"
  test_sequence: 1
  run_ui: false

test_plan:
  current_focus:
    - "Auth - User Registration"
    - "Auth - User Login"
    - "Dashboard - Get Stats"
    - "Search - Create Search"
    - "Leads - Get Leads"
    - "Leads - Export CSV"
  stuck_tasks: []
  test_all: true
  test_priority: "high_first"

  - task: "Payment - Create Checkout"
    implemented: true
    working: true
    file: "/app/backend/server.py"
    stuck_count: 0
    priority: "medium"
    needs_retesting: false
    status_history:
      - working: true
        agent: "testing"
        comment: "Cria sessão de checkout Stripe"
      - working: true
        agent: "testing"
        comment: "✅ VALIDADO: POST /api/payments/checkout funciona perfeitamente. Cria sessão Stripe com desconto para usuários referenciados. Retorna session_id e URL válidos."

frontend:
  - task: "Login Page"
    implemented: true
    working: "NA"
    file: "/app/frontend/src/pages/Login.jsx"
    stuck_count: 0
    priority: "high"
    needs_retesting: false

  - task: "Dashboard"
    implemented: true
    working: "NA"
    file: "/app/frontend/src/pages/Dashboard.jsx"
    stuck_count: 0
    priority: "high"
    needs_retesting: false

metadata:
  created_by: "main_agent"
  version: "1.0"
  test_sequence: 2
  run_ui: false

test_plan:
  current_focus:
    - "Auth - User Registration"
    - "Auth - User Login"
    - "Dashboard - Get Stats"
    - "Search - Create Search"
    - "Leads - Get Leads"
    - "Leads - Export CSV"
  stuck_tasks: []
  test_all: true
  test_priority: "high_first"

agent_communication:
  - agent: "main"
    message: "Solicitação do usuário para validar todos os testes do backend. Serviços reiniciados com sucesso. Por favor, execute todos os testes de API do backend para validação completa."
  - agent: "testing"
    message: "Validação completa executada - 14/14 endpoints passaram com sucesso. Todos os endpoints de Auth, Dashboard, Search, Leads, Scraping Accounts, Proxies, Plans e Payment estão funcionando corretamente."
  - agent: "main"
    message: "Todos os testes do backend foram validados com sucesso. Sistema pronto para uso."
  - agent: "testing"
    message: "✅ VALIDAÇÃO COMPLETA CONCLUÍDA: Todos os 14 endpoints do backend testados e funcionais. Taxa de sucesso: 100%. Sistema LeadMiner está operacional e pronto para uso. Inclui: autenticação JWT, dashboard, buscas com scraping local, leads CRUD, exportação CSV, admin CRUD (contas/proxies), planos e pagamentos Stripe. Scraper microservice usa fallback local conforme esperado."
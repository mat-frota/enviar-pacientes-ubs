/**
 * UBS Suzyanne Sousa Lopes - Olho d'Água das Cunhãs - MA
 * Sistema de Agendamento e Notificação via WhatsApp
 */

(function () {
  'use strict';

  const STORAGE_KEYS = {
    AUTH_OK: 'ubs_auth_active_v3',
    SELECTED_ACS_ID: 'ubs_selected_acs_v3',
    PATIENTS_DB: 'ubs_patients_db_central_v3'
  };

  const GLOBAL_PASSWORD = '12345';

  const DEFAULT_ACS = [
    { id: 'acs_1', name: 'Mateus Frota Mesquita', microarea: '13' },
    { id: 'acs_2', name: 'Agente de Saúde 02', microarea: '01' },
    { id: 'acs_3', name: 'Agente de Saúde 03', microarea: '02' },
    { id: 'acs_4', name: 'Agente de Saúde 04', microarea: '03' },
    { id: 'acs_5', name: 'Agente de Saúde 05', microarea: '04' },
    { id: 'acs_6', name: 'Agente de Saúde 06', microarea: '05' },
    { id: 'acs_7', name: 'Agente de Saúde 07', microarea: '06' },
    { id: 'acs_8', name: 'Agente de Saúde 08', microarea: '07' }
  ];

  const state = {
    acsList: [...DEFAULT_ACS],
    currentAcsId: 'acs_1',
    allPatientsDb: {},
    currentPatients: [],
    selectedPatient: null,
    currentService: 'Dentista',
    currentDate: '',
    currentShift: 'Manhã',
    adminStagedPatients: []
  };

  // Utilitários de Formatação
  function formatCPF(raw) {
    if (!raw) return 'Não informado';
    const digits = String(raw).replace(/\D/g, '');
    if (digits.length === 11) {
      return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9, 11)}`;
    }
    return raw || 'Não informado';
  }

  function cleanString(str) {
    if (!str) return '';
    let s = String(str).trim();
    if (s.startsWith('"') && s.endsWith('"')) {
      s = s.slice(1, -1).trim();
    }
    return s.replace(/^\t+/, '').trim();
  }

  function normalizeSearchText(text) {
    return String(text || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
  }

  function formatDateBR(dateString) {
    if (!dateString) return '';
    const parts = dateString.split('-');
    if (parts.length === 3 && parts[0].length === 4) {
      return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    return dateString;
  }

  function getTodayISO() {
    const today = new Date();
    const y = today.getFullYear();
    const m = String(today.getMonth() + 1).padStart(2, '0');
    const d = String(today.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  function showToast(msg, type = 'info') {
    const container = document.getElementById('toastContainer');
    if (!container) return;
    const t = document.createElement('div');
    t.className = `toast-msg ${type === 'success' ? 'toast-success' : type === 'error' ? 'toast-error' : ''}`;
    t.innerHTML = `<span>${type === 'success' ? '✅' : type === 'error' ? '❌' : 'ℹ️'}</span><span>${msg}</span>`;
    container.appendChild(t);
    setTimeout(() => {
      t.style.opacity = '0';
      t.style.transition = 'opacity 0.3s ease';
      setTimeout(() => t.remove(), 300);
    }, 3200);
  }

  // ==========================================
  // 1. AUTENTICAÇÃO POR SENHA (LOGIN GERAL)
  // ==========================================
  function checkAuth() {
    const isAuth = sessionStorage.getItem(STORAGE_KEYS.AUTH_OK) === 'true';
    const screenLogin = document.getElementById('screenLogin');
    const screenApp = document.getElementById('screenApp');

    if (isAuth) {
      screenLogin.style.display = 'none';
      screenApp.style.display = 'flex';
      initApp();
    } else {
      screenLogin.style.display = 'flex';
      screenApp.style.display = 'none';
      setupLoginForm();
    }
  }

  function setupLoginForm() {
    const form = document.getElementById('formLogin');
    const inputPass = document.getElementById('inputAccessPassword');
    const errorMsg = document.getElementById('loginErrorMsg');

    form.onsubmit = function (e) {
      e.preventDefault();
      const entered = inputPass.value.trim();

      if (entered === GLOBAL_PASSWORD) {
        sessionStorage.setItem(STORAGE_KEYS.AUTH_OK, 'true');
        errorMsg.style.display = 'none';
        document.getElementById('screenLogin').style.display = 'none';
        document.getElementById('screenApp').style.display = 'flex';
        initApp();
        showToast('Acesso liberado! Bem-vindo.', 'success');
      } else {
        errorMsg.style.display = 'block';
        inputPass.value = '';
        inputPass.focus();
      }
    };
  }

  function setupLogout() {
    const btnLogout = document.getElementById('btnLogout');
    if (btnLogout) {
      btnLogout.addEventListener('click', () => {
        sessionStorage.removeItem(STORAGE_KEYS.AUTH_OK);
        location.reload();
      });
    }
  }

  // ==========================================
  // 2. BASE DE DADOS CENTRALIZADA
  // ==========================================
  async function loadCentralDatabase() {
    // 1. Tentar carregar o arquivo central dados-pacientes.json (que vem do servidor ou GitHub)
    try {
      const resp = await fetch('dados-pacientes.json?t=' + Date.now());
      if (resp.ok) {
        const json = await resp.json();
        if (json && typeof json === 'object') {
          state.allPatientsDb = json;
          if (Array.isArray(json._acs_list) && json._acs_list.length > 0) {
            state.acsList = json._acs_list;
            localStorage.setItem('ubs_acs_list_custom', JSON.stringify(state.acsList));
          }
          localStorage.setItem(STORAGE_KEYS.PATIENTS_DB, JSON.stringify(json));
          console.log('[DB] Base centralizada dados-pacientes.json carregada com sucesso!');
          renderAcsSelectors();
          updateCurrentAcsView();
          return;
        }
      }
    } catch (e) {
      console.warn('[DB] Fetch de dados-pacientes.json falhou, usando cache local:', e);
    }

    // 2. Se falhar o fetch, ler do cache localStorage
    try {
      const storedAcs = localStorage.getItem('ubs_acs_list_custom');
      if (storedAcs) {
        state.acsList = JSON.parse(storedAcs);
      }
      const local = localStorage.getItem(STORAGE_KEYS.PATIENTS_DB);
      if (local) {
        state.allPatientsDb = JSON.parse(local);
        if (Array.isArray(state.allPatientsDb._acs_list)) {
          state.acsList = state.allPatientsDb._acs_list;
        }
        renderAcsSelectors();
        updateCurrentAcsView();
        return;
      }
    } catch (e) {
      console.warn('[DB] Erro ao ler local storage:', e);
    }

    // 3. Fallback: inicializar com estrutura padrão
    state.allPatientsDb = {
      _acs_list: [...state.acsList],
      acs_1: [],
      acs_2: [],
      acs_3: [],
      acs_4: [],
      acs_5: [],
      acs_6: [],
      acs_7: [],
      acs_8: []
    };
    renderAcsSelectors();
    updateCurrentAcsView();
  }

  function renderAcsSelectors() {
    const mainSelect = document.getElementById('selectAcsMain');
    const adminSelect = document.getElementById('adminSelectAcs');

    const curVal = state.currentAcsId;

    if (mainSelect) {
      mainSelect.innerHTML = '';
      state.acsList.forEach(acs => {
        const opt = document.createElement('option');
        opt.value = acs.id;
        opt.textContent = `${acs.name} (Microárea ${acs.microarea})`;
        mainSelect.appendChild(opt);
      });
      mainSelect.value = curVal || 'acs_1';
    }

    if (adminSelect) {
      adminSelect.innerHTML = '';
      state.acsList.forEach(acs => {
        const opt = document.createElement('option');
        opt.value = acs.id;
        opt.textContent = `${acs.name} (Microárea ${acs.microarea})`;
        adminSelect.appendChild(opt);
      });
      adminSelect.value = curVal || 'acs_1';
    }
  }

  function updateCurrentAcsView() {
    const acsId = state.currentAcsId;
    const list = state.allPatientsDb[acsId] || [];
    state.currentPatients = list;

    const badge = document.getElementById('acsPatientsCountBadge');
    if (badge) {
      badge.textContent = `${list.length} pessoa(s) nesta área`;
    }

    if (list.length > 0) {
      selectPatient(list[0]);
    } else {
      const curAcs = state.acsList.find(a => a.id === acsId);
      state.selectedPatient = {
        nome: 'NENHUM PACIENTE CADASTRADO',
        dn: '--/--/----',
        cpf: 'Não informado',
        local: `Microárea ${curAcs ? curAcs.microarea : ''} - Olho d'Água das Cunhãs - MA`,
        acsName: curAcs ? curAcs.name : 'ACS'
      };
      updatePatientCard();
      updateMessagePreview();
    }
  }

  // ==========================================
  // 3. SELEÇÃO E EXIBIÇÃO DE PACIENTES
  // ==========================================
  function selectPatient(patient) {
    state.selectedPatient = patient;
    updatePatientCard();
    updateMessagePreview();

    const dropdown = document.getElementById('searchDropdown');
    if (dropdown) dropdown.style.display = 'none';
  }

  function updatePatientCard() {
    const p = state.selectedPatient;
    if (!p) return;
    const curAcs = state.acsList.find(a => a.id === state.currentAcsId);

    document.getElementById('valNome').textContent = p.nome || '';
    document.getElementById('valDN').textContent = p.dn || '';
    document.getElementById('valCPF').textContent = formatCPF(p.cpf || p.cpf_raw);
    document.getElementById('valACS').textContent = (curAcs ? curAcs.name : p.acsName) || 'ACS';
    document.getElementById('valLocal').textContent = p.local || '';
  }

  // ==========================================
  // 4. MENSAGEM DO WHATSAPP
  // ==========================================
  function getMessageText() {
    const p = state.selectedPatient;
    const curAcs = state.acsList.find(a => a.id === state.currentAcsId);
    const acsName = curAcs ? curAcs.name : (p ? p.acsName : 'Mateus Frota Mesquita');
    const dataBR = formatDateBR(state.currentDate);
    const diaHora = `${dataBR} - ${state.currentShift}`;
    const service = state.currentService || 'Dentista';

    if (!p) {
      return `Nome: NÃO SELECIONADO\nDN: --/--/----\nCPF: ---\nLocal: ---\nACS: ${acsName}\nAtendimento com: ${service}\nAtendimento (Dia e hora): ${diaHora}`;
    }

    return `Nome: ${p.nome || ''}
DN: ${p.dn || ''}
CPF: ${formatCPF(p.cpf || p.cpf_raw)}
Local: ${p.local || ''}
ACS: ${acsName}
Atendimento com: ${service}
Atendimento (Dia e hora): ${diaHora}`;
  }

  function updateMessagePreview() {
    const bubble = document.getElementById('whatsappPreviewBubble');
    const timeEl = document.getElementById('bubbleTime');
    if (bubble) {
      bubble.textContent = getMessageText();
    }
    if (timeEl) {
      const now = new Date();
      timeEl.textContent = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    }
  }

  // ==========================================
  // 5. INICIALIZAÇÃO DOS COMPONENTES
  // ==========================================
  function initApp() {
    initAcsSelector();
    initServiceButtons();
    initPatientSearch();
    initDateTimePickers();
    initWhatsAppActions();
    initAdminModal();
    setupLogout();

    loadCentralDatabase();
  }

  function initAcsSelector() {
    const select = document.getElementById('selectAcsMain');
    if (!select) return;

    select.addEventListener('change', function () {
      state.currentAcsId = this.value;
      updateCurrentAcsView();
      const acs = state.acsList.find(a => a.id === state.currentAcsId);
      showToast(`Área selecionada: ${acs ? acs.name : ''}`, 'info');
    });

    state.currentAcsId = select.value || 'acs_1';
  }

  function initServiceButtons() {
    const buttons = document.querySelectorAll('#servicesGrid .service-card-btn');
    buttons.forEach(btn => {
      btn.addEventListener('click', function () {
        buttons.forEach(b => b.classList.remove('active'));
        this.classList.add('active');
        state.currentService = this.getAttribute('data-service');
        updateMessagePreview();
      });
    });
  }

  let searchTimer = null;
  function initPatientSearch() {
    const input = document.getElementById('inputSearchPatient');
    const clearBtn = document.getElementById('btnClearSearch');
    const dropdown = document.getElementById('searchDropdown');

    if (!input) return;

    input.addEventListener('input', function () {
      const query = this.value.trim();
      clearBtn.style.display = query ? 'block' : 'none';

      clearTimeout(searchTimer);
      searchTimer = setTimeout(() => {
        performSearch(query);
      }, 100);
    });

    clearBtn.addEventListener('click', () => {
      input.value = '';
      clearBtn.style.display = 'none';
      dropdown.style.display = 'none';
    });

    document.addEventListener('click', (e) => {
      if (!e.target.closest('.search-container')) {
        dropdown.style.display = 'none';
      }
    });

    input.addEventListener('focus', function () {
      if (this.value.trim()) performSearch(this.value.trim());
    });
  }

  function performSearch(query) {
    const dropdown = document.getElementById('searchDropdown');
    if (!dropdown) return;

    if (!query) {
      dropdown.style.display = 'none';
      return;
    }

    const norm = normalizeSearchText(query);
    const digits = query.replace(/\D/g, '');

    const filtered = state.currentPatients.filter(p => {
      const matchNome = normalizeSearchText(p.nome).includes(norm);
      const matchLocal = normalizeSearchText(p.local).includes(norm);
      let matchCpf = false;
      if (digits.length >= 3) {
        matchCpf = String(p.cpf_raw || p.cpf || '').replace(/\D/g, '').includes(digits);
      }
      return matchNome || matchLocal || matchCpf;
    });

    dropdown.innerHTML = '';

    if (filtered.length === 0) {
      dropdown.innerHTML = `
        <div style="padding: 1rem; text-align: center; font-size: 0.9rem; color: var(--text-muted);">
          Nenhum paciente encontrado com esse nome nesta área.
        </div>
      `;
      dropdown.style.display = 'block';
      return;
    }

    filtered.slice(0, 30).forEach(p => {
      const row = document.createElement('div');
      row.className = 'search-row';
      row.innerHTML = `
        <div class="search-row-name">${escapeHtml(p.nome)}</div>
        <div class="search-row-meta">
          DN: <strong>${p.dn || '--'}</strong> • CPF: <strong>${formatCPF(p.cpf || p.cpf_raw)}</strong> • ${escapeHtml(p.local || '')}
        </div>
      `;
      row.addEventListener('click', () => {
        selectPatient(p);
        showToast(`Selecionado: ${p.nome}`, 'success');
      });
      dropdown.appendChild(row);
    });

    dropdown.style.display = 'block';
  }

  function initDateTimePickers() {
    const dateInput = document.getElementById('inputDate');
    const shiftBtns = document.querySelectorAll('.shift-buttons-group .shift-btn');

    state.currentDate = getTodayISO();
    if (dateInput) {
      dateInput.value = state.currentDate;
      dateInput.addEventListener('change', function () {
        state.currentDate = this.value;
        updateMessagePreview();
      });
    }

    shiftBtns.forEach(btn => {
      btn.addEventListener('click', function () {
        shiftBtns.forEach(b => b.classList.remove('active'));
        this.classList.add('active');
        state.currentShift = this.getAttribute('data-shift');
        updateMessagePreview();
      });
    });
  }

  function initWhatsAppActions() {
    const btnSend = document.getElementById('btnSendWhatsApp');
    const btnCopy = document.getElementById('btnCopyMessage');

    if (btnSend) {
      btnSend.addEventListener('click', () => {
        const msg = getMessageText();
        const url = `https://api.whatsapp.com/send?text=${encodeURIComponent(msg)}`;
        window.open(url, '_blank');
        showToast('WhatsApp aberto! Escolha o grupo desejado.', 'success');
      });
    }

    if (btnCopy) {
      btnCopy.addEventListener('click', () => {
        const msg = getMessageText();
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(msg).then(() => {
            showToast('Mensagem copiada com sucesso!', 'success');
          }).catch(() => fallbackCopy(msg));
        } else {
          fallbackCopy(msg);
        }
      });
    }
  }

  function fallbackCopy(text) {
    const ta = document.createElement('textarea');
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
    showToast('Mensagem copiada!', 'success');
  }

  // ==========================================
  // 6. PAINEL DO ADMINISTRADOR (RENOMEAR ACS E UPLOAD DE CSVs)
  // ==========================================
  function initAdminModal() {
    const btnOpen = document.getElementById('btnOpenAdminPanel');
    const modal = document.getElementById('modalAdmin');
    const btnClose = document.getElementById('btnCloseAdminModal');
    const btnCancel = document.getElementById('btnCancelAdmin');
    const btnSave = document.getElementById('btnSaveAdminCsv');
    const selectAcs = document.getElementById('adminSelectAcs');
    const fileInput = document.getElementById('adminCsvFileInput');
    const previewBox = document.getElementById('adminCsvPreviewBox');
    const lblFileName = document.getElementById('adminLblFileName');
    const lblCount = document.getElementById('adminLblCount');
    const lblMeta = document.getElementById('adminLblMeta');
    const btnDownload = document.getElementById('btnDownloadJsonBackup');

    // Abas
    const tabBtnRename = document.getElementById('tabBtnRenameAcs');
    const tabBtnUpload = document.getElementById('tabBtnUploadCsv');
    const tabContentRename = document.getElementById('tabContentRenameAcs');
    const tabContentUpload = document.getElementById('tabContentUploadCsv');
    const adminAcsListInputs = document.getElementById('adminAcsListInputs');
    const btnSaveAcsNames = document.getElementById('btnSaveAcsNames');

    function switchTab(tab) {
      if (tab === 'rename') {
        tabBtnRename.className = 'btn btn-sm btn-primary';
        tabBtnUpload.className = 'btn btn-sm btn-outline';
        tabContentRename.style.display = 'block';
        tabContentUpload.style.display = 'none';
        renderAdminAcsInputs();
      } else {
        tabBtnRename.className = 'btn btn-sm btn-outline';
        tabBtnUpload.className = 'btn btn-sm btn-primary';
        tabContentRename.style.display = 'none';
        tabContentUpload.style.display = 'block';
        renderAcsSelectors();
      }
    }

    if (tabBtnRename) tabBtnRename.addEventListener('click', () => switchTab('rename'));
    if (tabBtnUpload) tabBtnUpload.addEventListener('click', () => switchTab('upload'));

    function renderAdminAcsInputs() {
      if (!adminAcsListInputs) return;
      adminAcsListInputs.innerHTML = '';

      state.acsList.forEach((acs, idx) => {
        const row = document.createElement('div');
        row.style.display = 'grid';
        row.style.gridTemplateColumns = '32px 1fr 110px';
        row.style.gap = '0.45rem';
        row.style.alignItems = 'center';
        row.style.background = '#f8fafc';
        row.style.padding = '0.4rem 0.65rem';
        row.style.borderRadius = 'var(--radius-sm)';
        row.style.border = '1px solid #e2e8f0';

        row.innerHTML = `
          <strong style="color: var(--text-muted); font-size: 0.85rem;">#${idx + 1}</strong>
          <input type="text" class="form-control admin-acs-name" data-acs-id="${acs.id}" value="${escapeHtml(acs.name)}" placeholder="Nome completo do agente" style="min-height: 38px; font-size: 0.875rem;">
          <input type="text" class="form-control admin-acs-micro" data-acs-id="${acs.id}" value="${escapeHtml(acs.microarea)}" placeholder="Microárea" style="min-height: 38px; font-size: 0.875rem;">
        `;
        adminAcsListInputs.appendChild(row);
      });
    }

    if (btnSaveAcsNames) {
      btnSaveAcsNames.addEventListener('click', async () => {
        const nameInputs = document.querySelectorAll('.admin-acs-name');
        const microInputs = document.querySelectorAll('.admin-acs-micro');

        nameInputs.forEach(input => {
          const id = input.getAttribute('data-acs-id');
          const acs = state.acsList.find(a => a.id === id);
          if (acs) {
            acs.name = input.value.trim() || acs.name;
          }
        });

        microInputs.forEach(input => {
          const id = input.getAttribute('data-acs-id');
          const acs = state.acsList.find(a => a.id === id);
          if (acs) {
            acs.microarea = input.value.trim() || acs.microarea;
          }
        });

        // 1. Salvar no cache local
        localStorage.setItem('ubs_acs_list_custom', JSON.stringify(state.acsList));
        state.allPatientsDb._acs_list = state.acsList;
        localStorage.setItem(STORAGE_KEYS.PATIENTS_DB, JSON.stringify(state.allPatientsDb));

        // 2. Salvar no arquivo dados-pacientes.json no disco
        try {
          await fetch('/api/save-patients', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(state.allPatientsDb)
          });
        } catch (e) {
          console.warn('[API] Falha ao salvar no disco:', e);
        }

        renderAcsSelectors();
        updateCurrentAcsView();
        showToast('Nomes dos 8 agentes atualizados com sucesso!', 'success');
      });
    }

    function openModal() {
      const pwd = prompt('Digite a senha de administrador:');
      if (pwd !== GLOBAL_PASSWORD) {
        alert('Senha incorreta! Acesso não autorizado.');
        return;
      }
      fileInput.value = '';
      previewBox.style.display = 'none';
      btnSave.disabled = true;
      state.adminStagedPatients = [];
      switchTab('rename');
      modal.classList.add('active');
    }

    function closeModal() {
      modal.classList.remove('active');
    }

    if (btnOpen) btnOpen.addEventListener('click', openModal);
    if (btnClose) btnClose.addEventListener('click', closeModal);
    if (btnCancel) btnCancel.addEventListener('click', closeModal);

    fileInput.addEventListener('change', function () {
      if (!this.files || this.files.length === 0) return;
      const file = this.files[0];
      lblFileName.textContent = file.name;

      const reader = new FileReader();
      reader.onload = function (e) {
        const text = e.target.result;
        const parsed = parseCsv(text);
        state.adminStagedPatients = parsed;
        lblCount.textContent = parsed.length;
        lblMeta.textContent = '✓ Pronto para substituir a base anterior com segurança sem duplicações.';
        previewBox.style.display = 'block';
        btnSave.disabled = parsed.length === 0;
      };
      // e-SUS usa ISO-8859-1 (Latin1)
      reader.readAsText(file, 'ISO-8859-1');
    });

    btnSave.addEventListener('click', async () => {
      const targetAcsId = selectAcs.value;
      const curAcs = state.acsList.find(a => a.id === targetAcsId);
      const acsName = curAcs ? curAcs.name : 'ACS';

      if (state.adminStagedPatients.length === 0) {
        alert('Nenhum paciente encontrado para salvar.');
        return;
      }

      // 1. Substituir a lista anterior daquele ACS na base centralizada
      state.allPatientsDb[targetAcsId] = state.adminStagedPatients.map(p => ({
        ...p,
        acsId: targetAcsId,
        acsName: acsName
      }));
      state.allPatientsDb._acs_list = state.acsList;

      // 2. Salvar no localStorage local
      localStorage.setItem(STORAGE_KEYS.PATIENTS_DB, JSON.stringify(state.allPatientsDb));

      // 3. Salvar no servidor local (atualizando dados-pacientes.json no disco)
      try {
        const saveResp = await fetch('/api/save-patients', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(state.allPatientsDb)
        });
        if (saveResp.ok) {
          console.log('[API] Arquivo dados-pacientes.json salvo no disco!');
        }
      } catch (e) {
        console.warn('[API] Servidor local offline ou rodando no GitHub Pages:', e);
      }

      closeModal();
      updateCurrentAcsView();
      showToast(`Base atualizada! ${state.adminStagedPatients.length} pacientes salvos para ${acsName}.`, 'success');
    });

    if (btnDownload) {
      btnDownload.addEventListener('click', () => {
        state.allPatientsDb._acs_list = state.acsList;
        const blob = new Blob([JSON.stringify(state.allPatientsDb, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'dados-pacientes.json';
        a.click();
        URL.revokeObjectURL(url);
        showToast('Arquivo dados-pacientes.json baixado!', 'success');
      });
    }
  }

  // Parser de CSV do e-SUS
  function parseCsv(csvText) {
    const lines = csvText.split(/\r?\n/);
    const patients = [];
    const municipio = "Olho d'Água das Cunhãs - MA";
    let headerPassed = false;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      if (line.toUpperCase().includes('TIPO DE LOGRADOURO') && line.toUpperCase().includes('NOME CIDADÃO')) {
        headerPassed = true;
        continue;
      }

      if (headerPassed) {
        const parts = line.split(';').map(cleanString);
        if (parts.length >= 10 && parts[0]) {
          const tipoRaw = parts[0].toUpperCase();
          const tiposValidos = ['RUA', 'TRAVESSA', 'AVENIDA', 'ALAMEDA', 'RODOVIA', 'BECO', 'PRAÇA', 'ESTRADA', 'POVOADO'];
          if (tiposValidos.includes(tipoRaw)) {
            const tipoLogr = parts[0].charAt(0).toUpperCase() + parts[0].slice(1).toLowerCase();
            const logradouro = parts[1] || '';
            const numero = parts[2] || 'S/N';
            const bairro = parts[4] || 'Centro';
            const nome = parts[7] || '';
            const dn = parts[9] || '';
            const cpfRaw = parts[10] || '';

            if (nome) {
              const local = `${tipoLogr} ${logradouro}, Nº ${numero} - ${bairro} - ${municipio}`;
              patients.push({
                id: 'p_' + Date.now() + '_' + patients.length,
                nome: nome.toUpperCase(),
                dn: dn,
                cpf: formatCPF(cpfRaw),
                cpf_raw: cpfRaw,
                tipo_logradouro: tipoLogr,
                logradouro: logradouro,
                numero: numero,
                bairro: bairro,
                local: local
              });
            }
          }
        }
      }
    }
    return patients;
  }

  function escapeHtml(str) {
    if (!str) return '';
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  // Inicialização do fluxo de login
  document.addEventListener('DOMContentLoaded', () => {
    checkAuth();
  });

})();

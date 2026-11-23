/**
 * UBS Suzyanne Sousa Lopes - Olho d'Água das Cunhãs - MA
 * Sistema de Agendamento e Envio de Avisos para WhatsApp
 */

(function () {
  'use strict';

  const STORAGE_KEYS = {
    ACS_LIST: 'ubs_clean_acs_list_v2',
    SELECTED_ACS_ID: 'ubs_clean_selected_acs_v2',
    PATIENTS_DB: 'ubs_clean_patients_db_v2'
  };

  const CSV_UPLOAD_PASSWORD = '12345';

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
    patients: [],
    selectedPatient: null,
    currentService: 'Dentista',
    currentDate: '',
    currentShift: 'Manhã',
    stagedCsvPatients: []
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
    }, 3000);
  }

  // Banco de Dados Local
  function getDb() {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.PATIENTS_DB);
      return raw ? JSON.parse(raw) : {};
    } catch (e) {
      return {};
    }
  }

  function saveDb(db) {
    localStorage.setItem(STORAGE_KEYS.PATIENTS_DB, JSON.stringify(db));
  }

  function loadPatientsForCurrentAcs() {
    const db = getDb();
    let list = db[state.currentAcsId] || [];

    // Se for o Mateus e ainda não tiver dados no localStorage, carregar os 267 reais do CSV inicial
    if (list.length === 0 && state.currentAcsId === 'acs_1' && window.SAMPLE_INITIAL_DATA && window.SAMPLE_INITIAL_DATA.patients) {
      list = window.SAMPLE_INITIAL_DATA.patients.map(p => ({
        ...p,
        acsId: 'acs_1',
        acsName: 'Mateus Frota Mesquita'
      }));
      db['acs_1'] = list;
      saveDb(db);
    }

    state.patients = list;

    const countBadge = document.getElementById('acsPatientsCountBadge');
    if (countBadge) {
      countBadge.textContent = `${list.length} paciente(s)`;
    }

    if (list.length > 0) {
      selectPatient(list[0]);
    } else {
      const curAcs = state.acsList.find(a => a.id === state.currentAcsId);
      state.selectedPatient = {
        nome: 'NENHUM PACIENTE CADASTRADO',
        dn: '--/--/----',
        cpf: 'Não informado',
        local: `Microárea ${curAcs ? curAcs.microarea : ''} - Olho d'Água das Cunhãs - MA`,
        acsName: curAcs ? curAcs.name : 'ACS'
      };
      updatePatientView();
    }
  }

  // Seleção e Exibição do Paciente
  function selectPatient(patient) {
    state.selectedPatient = patient;
    updatePatientView();
    updateMessagePreview();

    const dropdown = document.getElementById('searchDropdown');
    if (dropdown) dropdown.style.display = 'none';
  }

  function updatePatientView() {
    const p = state.selectedPatient;
    if (!p) return;
    const curAcs = state.acsList.find(a => a.id === state.currentAcsId);

    document.getElementById('valNome').textContent = p.nome || '';
    document.getElementById('valDN').textContent = p.dn || '';
    document.getElementById('valCPF').textContent = formatCPF(p.cpf || p.cpf_raw);
    document.getElementById('valACS').textContent = (curAcs ? curAcs.name : p.acsName) || 'ACS';
    document.getElementById('valLocal').textContent = p.local || '';
  }

  // Mensagem e WhatsApp
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

  // Inicialização dos Agentes de Saúde
  function initAcs() {
    const select = document.getElementById('selectAcsMain');
    if (!select) return;

    select.addEventListener('change', function () {
      state.currentAcsId = this.value;
      loadPatientsForCurrentAcs();
      const acs = state.acsList.find(a => a.id === state.currentAcsId);
      showToast(`Agente selecionado: ${acs ? acs.name : ''}`, 'info');
    });

    state.currentAcsId = select.value || 'acs_1';
    loadPatientsForCurrentAcs();
  }

  // Especialidades (Ordem exata: Dentista, Nutricionista, Psicóloga, Médico, Enfermagem, Preventivo, Psiquiatra)
  function initServices() {
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

  // Busca de Pacientes
  let searchTimer = null;
  function initSearch() {
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
      }, 120);
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
      if (this.value.trim()) {
        performSearch(this.value.trim());
      }
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

    const filtered = state.patients.filter(p => {
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
        <div style="padding: 0.75rem; text-align: center; font-size: 0.85rem; color: var(--text-muted);">
          Nenhum paciente encontrado.
          <div style="margin-top: 0.4rem;">
            <button class="btn btn-outline btn-sm" id="btnQuickAdd">➕ Cadastrar agora</button>
          </div>
        </div>
      `;
      dropdown.style.display = 'block';
      const qAdd = document.getElementById('btnQuickAdd');
      if (qAdd) {
        qAdd.addEventListener('click', () => {
          dropdown.style.display = 'none';
          openPatientModal(query);
        });
      }
      return;
    }

    filtered.slice(0, 25).forEach(p => {
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
        showToast(`Paciente: ${p.nome}`, 'success');
      });
      dropdown.appendChild(row);
    });

    dropdown.style.display = 'block';
  }

  // Data e Horário
  function initDateTime() {
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

  // Disparo do WhatsApp
  function initWhatsApp() {
    const btnSend = document.getElementById('btnSendWhatsApp');
    const btnCopy = document.getElementById('btnCopyMessage');

    if (btnSend) {
      btnSend.addEventListener('click', () => {
        const msg = getMessageText();
        // Link que abre a tela de seleção de grupos no WhatsApp
        const url = `https://api.whatsapp.com/send?text=${encodeURIComponent(msg)}`;
        window.open(url, '_blank');
        showToast('WhatsApp aberto! Selecione o grupo da equipe.', 'success');
      });
    }

    if (btnCopy) {
      btnCopy.addEventListener('click', () => {
        const msg = getMessageText();
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(msg).then(() => {
            showToast('Mensagem copiada para a área de transferência!', 'success');
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
    showToast('Mensagem copiada com sucesso!', 'success');
  }

  // Modal de Upload de CSV com Senha 12345 e Substituição sem Duplicatas
  function initCsvUploadModal() {
    const btnOpen = document.getElementById('btnOpenCsvUpload');
    const modal = document.getElementById('modalCsvUpload');
    const btnClose = document.getElementById('btnCloseCsvModal');
    const btnCancel = document.getElementById('btnCancelCsv');
    const btnConfirm = document.getElementById('btnConfirmCsv');
    const inputPass = document.getElementById('inputCsvPassword');
    const passError = document.getElementById('passwordErrorMsg');
    const fileInput = document.getElementById('fileCsvInput');
    const statusBox = document.getElementById('csvStatusBox');
    const lblName = document.getElementById('lblCsvName');
    const lblCount = document.getElementById('lblCsvCount');

    if (btnOpen) {
      btnOpen.addEventListener('click', () => {
        inputPass.value = '';
        passError.style.display = 'none';
        fileInput.value = '';
        statusBox.style.display = 'none';
        btnConfirm.disabled = true;
        state.stagedCsvPatients = [];
        modal.classList.add('active');
      });
    }

    function closeModal() {
      modal.classList.remove('active');
    }

    if (btnClose) btnClose.addEventListener('click', closeModal);
    if (btnCancel) btnCancel.addEventListener('click', closeModal);

    fileInput.addEventListener('change', function () {
      if (!this.files || this.files.length === 0) return;
      const file = this.files[0];
      lblName.textContent = file.name;

      const reader = new FileReader();
      reader.onload = function (e) {
        const text = e.target.result;
        const parsed = parseCsv(text);
        state.stagedCsvPatients = parsed;
        lblCount.textContent = parsed.length;
        statusBox.style.display = 'block';
        btnConfirm.disabled = parsed.length === 0;
      };
      // e-SUS usa ISO-8859-1 (Latin1)
      reader.readAsText(file, 'ISO-8859-1');
    });

    btnConfirm.addEventListener('click', () => {
      // Validar Senha 12345
      if (inputPass.value.trim() !== CSV_UPLOAD_PASSWORD) {
        passError.style.display = 'block';
        showToast('Senha de autorização incorreta!', 'error');
        return;
      }
      passError.style.display = 'none';

      if (state.stagedCsvPatients.length === 0) {
        showToast('Nenhum paciente para importar!', 'error');
        return;
      }

      // Substituir completamente a lista antiga daquele ACS (evitando duplicação!)
      const db = getDb();
      const curAcs = state.acsList.find(a => a.id === state.currentAcsId);
      const acsName = curAcs ? curAcs.name : 'ACS';

      db[state.currentAcsId] = state.stagedCsvPatients.map(p => ({
        ...p,
        acsId: state.currentAcsId,
        acsName: acsName
      }));

      saveDb(db);
      closeModal();
      loadPatientsForCurrentAcs();
      showToast(`Base atualizada! ${state.stagedCsvPatients.length} pacientes substituídos com sucesso para ${acsName}.`, 'success');
    });
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

  // Modal de Cadastro Individual de Cidadão
  function initPatientModal() {
    const btnOpen = document.getElementById('btnOpenNewPatient');
    const btnEdit = document.getElementById('btnEditCurrentPatient');
    const modal = document.getElementById('modalPatientForm');
    const btnClose = document.getElementById('btnClosePatientModal');
    const btnCancel = document.getElementById('btnCancelPatient');
    const btnSave = document.getElementById('btnSavePatient');

    function closeModal() {
      modal.classList.remove('active');
    }

    if (btnOpen) btnOpen.addEventListener('click', () => openPatientModal());
    if (btnEdit) {
      btnEdit.addEventListener('click', () => {
        if (state.selectedPatient) openPatientModal('', state.selectedPatient);
      });
    }
    if (btnClose) btnClose.addEventListener('click', closeModal);
    if (btnCancel) btnCancel.addEventListener('click', closeModal);

    if (btnSave) {
      btnSave.addEventListener('click', () => {
        const editId = document.getElementById('editPatientId').value;
        const nome = document.getElementById('formNome').value.trim().toUpperCase();
        const dn = document.getElementById('formDN').value.trim();
        const cpfRaw = document.getElementById('formCPF').value.trim();
        const tipoLogr = document.getElementById('formTipoLogr').value;
        const logradouro = document.getElementById('formLogradouro').value.trim();
        const numero = document.getElementById('formNumero').value.trim() || 'S/N';
        const bairro = document.getElementById('formBairro').value.trim() || 'Centro';
        const municipio = "Olho d'Água das Cunhãs - MA";

        if (!nome || !dn || !logradouro) {
          showToast('Preencha os campos obrigatórios (*)', 'error');
          return;
        }

        const local = `${tipoLogr} ${logradouro}, Nº ${numero} - ${bairro} - ${municipio}`;
        const curAcs = state.acsList.find(a => a.id === state.currentAcsId);

        const newP = {
          id: editId || ('p_' + Date.now()),
          nome: nome,
          dn: dn,
          cpf: formatCPF(cpfRaw),
          cpf_raw: cpfRaw,
          tipo_logradouro: tipoLogr,
          logradouro: logradouro,
          numero: numero,
          bairro: bairro,
          local: local,
          acsId: state.currentAcsId,
          acsName: curAcs ? curAcs.name : 'ACS'
        };

        const db = getDb();
        if (!db[state.currentAcsId]) db[state.currentAcsId] = [];

        if (editId) {
          const idx = db[state.currentAcsId].findIndex(p => p.id === editId);
          if (idx !== -1) db[state.currentAcsId][idx] = newP;
        } else {
          db[state.currentAcsId].unshift(newP);
        }

        saveDb(db);
        closeModal();
        loadPatientsForCurrentAcs();
        selectPatient(newP);
        showToast('Cidadão salvo com sucesso!', 'success');
      });
    }
  }

  function openPatientModal(initialName = '', existingPatient = null) {
    const modal = document.getElementById('modalPatientForm');
    const title = document.getElementById('lblPatientModalTitle');

    if (existingPatient && existingPatient.id) {
      title.textContent = '✏️ Editar Cidadão';
      document.getElementById('editPatientId').value = existingPatient.id;
      document.getElementById('formNome').value = existingPatient.nome || '';
      document.getElementById('formDN').value = existingPatient.dn || '';
      document.getElementById('formCPF').value = existingPatient.cpf_raw || existingPatient.cpf || '';
      document.getElementById('formTipoLogr').value = existingPatient.tipo_logradouro || 'Rua';
      document.getElementById('formLogradouro').value = existingPatient.logradouro || '';
      document.getElementById('formNumero').value = existingPatient.numero || 'S/N';
      document.getElementById('formBairro').value = existingPatient.bairro || 'Centro';
    } else {
      title.textContent = '➕ Cadastrar Cidadão';
      document.getElementById('editPatientId').value = '';
      document.getElementById('formNome').value = initialName || '';
      document.getElementById('formDN').value = '';
      document.getElementById('formCPF').value = '';
      document.getElementById('formTipoLogr').value = 'Rua';
      document.getElementById('formLogradouro').value = '';
      document.getElementById('formNumero').value = '';
      document.getElementById('formBairro').value = 'Centro';
    }

    modal.classList.add('active');
  }

  function escapeHtml(str) {
    if (!str) return '';
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  // Inicialização
  document.addEventListener('DOMContentLoaded', () => {
    initAcs();
    initServices();
    initSearch();
    initDateTime();
    initWhatsApp();
    initCsvUploadModal();
    initPatientModal();
    updateMessagePreview();
  });

})();

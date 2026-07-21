// App de Treinos - Academia
const DB_NAME = 'AppTreinoDB';
const DB_VERSION = 1;
const STORE_NAME = 'appData';

class WorkoutApp {
    constructor() {
        this.workouts = [];
        this.history = [];
        this.db = null;
        this.currentWorkout = null;
        this.editingWorkoutId = null;
        this.editingExerciseId = null;
        this.pendingDelete = null; // { type: 'workout'|'exercise'|'session', id }
        this.progressCharts = [];
        this.init();
    }

    async init() {
        this.db = await this.openDatabase();
        await this.migrateFromLocalStorageIfNeeded();

        this.workouts = await this.loadWorkouts();
        this.history = await this.loadHistory();

        this.setupEventListeners();
        await this.loadSampleData();
        this.renderWorkoutTabs();
    }

    // ---------- ARMAZENAMENTO (IndexedDB, com fallback em localStorage) ----------
    // IndexedDB tem um limite de armazenamento muito maior que o localStorage
    // (que costuma travar em ~5-10MB), o que é importante aqui porque as fotos
    // dos exercícios são guardadas em base64 e podem pesar bastante.

    openDatabase() {
        return new Promise((resolve) => {
            if (!window.indexedDB) {
                resolve(null); // navegador sem suporte: cai para localStorage
                return;
            }
            const request = indexedDB.open(DB_NAME, DB_VERSION);
            request.onupgradeneeded = (e) => {
                const db = e.target.result;
                if (!db.objectStoreNames.contains(STORE_NAME)) {
                    db.createObjectStore(STORE_NAME, { keyPath: 'key' });
                }
            };
            request.onsuccess = (e) => resolve(e.target.result);
            request.onerror = () => resolve(null); // qualquer erro: cai para localStorage
        });
    }

    idbGet(key) {
        return new Promise((resolve) => {
            if (!this.db) { resolve(undefined); return; }
            try {
                const tx = this.db.transaction(STORE_NAME, 'readonly');
                const store = tx.objectStore(STORE_NAME);
                const req = store.get(key);
                req.onsuccess = () => resolve(req.result ? req.result.value : undefined);
                req.onerror = () => resolve(undefined);
            } catch (err) {
                resolve(undefined);
            }
        });
    }

    idbSet(key, value) {
        return new Promise((resolve) => {
            if (!this.db) { resolve(false); return; }
            try {
                const tx = this.db.transaction(STORE_NAME, 'readwrite');
                const store = tx.objectStore(STORE_NAME);
                store.put({ key, value });
                tx.oncomplete = () => resolve(true);
                tx.onerror = () => resolve(false);
            } catch (err) {
                resolve(false);
            }
        });
    }

    // Se o navegador já tinha dados salvos no localStorage (versão anterior do
    // app) e o IndexedDB ainda está vazio, copia os dados uma única vez.
    async migrateFromLocalStorageIfNeeded() {
        if (!this.db) return;

        const existingWorkouts = await this.idbGet('workouts');
        if (existingWorkouts === undefined) {
            const oldWorkouts = localStorage.getItem('workoutApp_data');
            if (oldWorkouts) {
                try {
                    await this.idbSet('workouts', JSON.parse(oldWorkouts));
                } catch (err) { /* dados antigos inválidos: ignora */ }
            }
        }

        const existingHistory = await this.idbGet('history');
        if (existingHistory === undefined) {
            const oldHistory = localStorage.getItem('workoutApp_history');
            if (oldHistory) {
                try {
                    await this.idbSet('history', JSON.parse(oldHistory));
                } catch (err) { /* dados antigos inválidos: ignora */ }
            }
        }
    }

    // Carregar treinos
    async loadWorkouts() {
        const fromDb = await this.idbGet('workouts');
        if (fromDb !== undefined) return fromDb;

        // Fallback: navegador sem IndexedDB, usa localStorage normalmente
        const saved = localStorage.getItem('workoutApp_data');
        return saved ? JSON.parse(saved) : [];
    }

    // Salvar treinos
    async saveWorkouts() {
        if (this.db) {
            const ok = await this.idbSet('workouts', this.workouts);
            if (!ok) this.showToast('Não foi possível salvar. Tente novamente.', 'error');
            return;
        }
        try {
            localStorage.setItem('workoutApp_data', JSON.stringify(this.workouts));
        } catch (err) {
            this.showToast('Armazenamento cheio. Tente remover ou usar fotos menores.', 'error');
        }
    }

    // Carregar histórico de treinos realizados
    async loadHistory() {
        const fromDb = await this.idbGet('history');
        if (fromDb !== undefined) return fromDb;

        const saved = localStorage.getItem('workoutApp_history');
        return saved ? JSON.parse(saved) : [];
    }

    // Salvar histórico
    async saveHistory() {
        if (this.db) {
            const ok = await this.idbSet('history', this.history);
            if (!ok) this.showToast('Não foi possível salvar o histórico.', 'error');
            return;
        }
        try {
            localStorage.setItem('workoutApp_history', JSON.stringify(this.history));
        } catch (err) {
            this.showToast('Armazenamento cheio. Não foi possível salvar o histórico.', 'error');
        }
    }

    // Configurar event listeners
    setupEventListeners() {
        // Botão de voltar da tela de detalhe do treino para a lista
        document.getElementById('backToListBtn').addEventListener('click', () => {
            this.backToWorkoutList();
        });

        // Menu do cabeçalho (exportar/importar)
        document.getElementById('menuBtn').addEventListener('click', (e) => {
            e.stopPropagation();
            const menu = document.getElementById('headerMenu');
            const isOpen = menu.classList.toggle('open');
            document.getElementById('menuBtn').setAttribute('aria-expanded', String(isOpen));
        });
        document.addEventListener('click', () => {
            document.getElementById('headerMenu').classList.remove('open');
            document.getElementById('menuBtn').setAttribute('aria-expanded', 'false');
        });
        document.getElementById('exportBtn').addEventListener('click', () => this.exportPDF());
        document.getElementById('progressBtn').addEventListener('click', () => {
            document.getElementById('headerMenu').classList.remove('open');
            this.openProgressView();
        });

        document.getElementById('backFromProgressBtn').addEventListener('click', () => {
            this.backToWorkoutList();
        });

        document.getElementById('historyBtn').addEventListener('click', () => {
            document.getElementById('headerMenu').classList.remove('open');
            this.openHistoryView();
        });

        document.getElementById('finishWorkoutBtn').addEventListener('click', () => {
            this.finishWorkout();
        });

        document.getElementById('backFromHistoryBtn').addEventListener('click', () => {
            this.backToWorkoutList();
        });

        document.getElementById('exportHistoryBtn').addEventListener('click', () => {
            this.exportHistoryPDF();
        });

        // Modal de adicionar/editar treino
        document.getElementById('addWorkoutBtn').addEventListener('click', () => {
            this.openWorkoutModal();
        });

        document.getElementById('closeAddWorkoutModal').addEventListener('click', () => {
            this.hideModal('addWorkoutModal');
        });

        document.getElementById('cancelAddWorkout').addEventListener('click', () => {
            this.hideModal('addWorkoutModal');
        });

        document.getElementById('addWorkoutForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.saveWorkoutForm();
        });

        // Modal de adicionar/editar exercício
        document.getElementById('closeAddExerciseModal').addEventListener('click', () => {
            this.hideModal('addExerciseModal');
        });

        document.getElementById('cancelAddExercise').addEventListener('click', () => {
            this.hideModal('addExerciseModal');
        });

        document.getElementById('addExerciseForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.saveExerciseForm();
        });

        // Buscar imagem do exercício na internet (abre o Google Imagens já com o nome preenchido)
        document.getElementById('searchImageBtn').addEventListener('click', () => {
            this.searchExerciseImage();
        });

        // Escolher imagem do celular (galeria ou câmera)
        document.getElementById('chooseImageFileBtn').addEventListener('click', () => {
            document.getElementById('exerciseImageFile').click();
        });

        document.getElementById('exerciseImageFile').addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (!file) return;

            if (!file.type.startsWith('image/')) {
                this.showToast('Por favor, escolha um arquivo de imagem (png, jpg, jpeg ou webp).', 'error');
                e.target.value = '';
                return;
            }

            try {
                const dataUrl = await this.compressImageFile(file);
                document.getElementById('exerciseImage').value = dataUrl;
                this.showImagePreview(dataUrl);
            } catch (err) {
                this.showToast('Não foi possível carregar essa imagem.', 'error');
            }
            e.target.value = '';
        });

        document.getElementById('removeImagePreviewBtn').addEventListener('click', () => {
            document.getElementById('exerciseImage').value = '';
            this.hideImagePreview();
        });

        // Atualiza o preview quando o usuário digita/cola uma URL manualmente
        document.getElementById('exerciseImage').addEventListener('input', (e) => {
            const value = e.target.value.trim();
            if (value) {
                this.showImagePreview(this.getImageSource(value));
            } else {
                this.hideImagePreview();
            }
        });

        // Modal de confirmação de exclusão
        document.getElementById('closeConfirmModal').addEventListener('click', () => {
            this.hideModal('confirmModal');
        });
        document.getElementById('cancelConfirm').addEventListener('click', () => {
            this.hideModal('confirmModal');
        });
        document.getElementById('confirmDeleteBtn').addEventListener('click', () => {
            this.executeDelete();
        });

        // Fechar modais clicando fora
        window.addEventListener('click', (e) => {
            if (e.target.classList.contains('modal')) {
                this.hideModal(e.target.id);
            }
        });

        // Fechar modal aberto com ESC
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                document.querySelectorAll('.modal.show').forEach(m => this.hideModal(m.id));
            }
        });
    }

    // Mostrar modal (corrige bug de precisar rolar a tela para ver o popup)
    showModal(modalId) {
        // Trava o scroll da página sem "pular" a tela: guardamos a posição atual
        // e fixamos o body nela, então o popup some/aparece sem mover o fundo.
        this._scrollY = window.scrollY || window.pageYOffset || 0;
        document.body.style.top = `-${this._scrollY}px`;
        document.body.classList.add('modal-open');

        // Guarda o elemento que tinha foco para devolver o foco a ele ao fechar
        // (importante para quem navega por teclado/leitor de tela)
        this._lastFocusedElement = document.activeElement;

        const modal = document.getElementById(modalId);
        modal.style.display = 'flex';
        modal.setAttribute('aria-hidden', 'false');

        this._trapFocusHandler = (e) => this.trapFocus(e, modal);
        modal.addEventListener('keydown', this._trapFocusHandler);

        // Força reflow antes de adicionar a classe de animação
        requestAnimationFrame(() => {
            modal.classList.add('show');
            const content = modal.querySelector('.modal-content');
            if (content) content.scrollTop = 0;
            const firstInput = modal.querySelector('input, textarea');
            if (firstInput && window.innerWidth > 600) {
                firstInput.focus({ preventScroll: true });
            } else {
                // Em telas pequenas evitamos focar um input (abriria o teclado
                // imediatamente); focamos o modal em si para leitores de tela
                content.setAttribute('tabindex', '-1');
                content.focus({ preventScroll: true });
            }
        });
    }

    // Mantém o foco (Tab / Shift+Tab) dentro do modal aberto, para não "vazar"
    // o foco para elementos escondidos atrás dele
    trapFocus(e, modal) {
        if (e.key !== 'Tab') return;

        const focusable = modal.querySelectorAll(
            'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        if (focusable.length === 0) return;

        const first = focusable[0];
        const last = focusable[focusable.length - 1];

        if (e.shiftKey && document.activeElement === first) {
            e.preventDefault();
            last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
            e.preventDefault();
            first.focus();
        }
    }

    // Esconder modal
    hideModal(modalId) {
        const modal = document.getElementById(modalId);
        modal.classList.remove('show');
        modal.setAttribute('aria-hidden', 'true');
        if (this._trapFocusHandler) {
            modal.removeEventListener('keydown', this._trapFocusHandler);
        }
        setTimeout(() => {
            modal.style.display = 'none';
        }, 200);

        // Só libera o scroll do body quando não houver nenhum outro modal aberto
        const anyOpen = document.querySelectorAll('.modal.show').length > 1;
        if (!anyOpen) {
            document.body.classList.remove('modal-open');
            document.body.style.top = '';
            window.scrollTo(0, this._scrollY || 0);
        }

        // Devolve o foco para quem abriu o modal
        if (this._lastFocusedElement && document.body.contains(this._lastFocusedElement)) {
            this._lastFocusedElement.focus();
        }
    }

    // Toast de feedback (substitui alert por algo menos intrusivo no mobile)
    showToast(message, type = 'info') {
        const toast = document.getElementById('toast');
        toast.textContent = message;
        toast.className = `toast show ${type}`;
        clearTimeout(this._toastTimeout);
        this._toastTimeout = setTimeout(() => {
            toast.classList.remove('show');
        }, 2600);
    }

    // ---------- TREINOS ----------

    openWorkoutModal(workoutId = null) {
        this.editingWorkoutId = workoutId;
        const title = document.getElementById('workoutModalTitle');
        const submitBtn = document.getElementById('submitWorkoutBtn');
        const form = document.getElementById('addWorkoutForm');
        form.reset();

        if (workoutId) {
            const workout = this.workouts.find(w => w.id === workoutId);
            if (!workout) return;
            title.textContent = 'Editar Treino';
            submitBtn.textContent = 'Salvar Alterações';
            document.getElementById('workoutName').value = workout.name;
            document.getElementById('workoutDescription').value = workout.description || '';
        } else {
            title.textContent = 'Adicionar Novo Treino';
            submitBtn.textContent = 'Criar Treino';
        }

        this.showModal('addWorkoutModal');
    }

    saveWorkoutForm() {
        const name = document.getElementById('workoutName').value.trim();
        const description = document.getElementById('workoutDescription').value.trim();

        if (!name) {
            this.showToast('Por favor, insira um nome para o treino.', 'error');
            return;
        }

        if (this.editingWorkoutId) {
            const workout = this.workouts.find(w => w.id === this.editingWorkoutId);
            if (workout) {
                workout.name = name;
                workout.description = description;
                this.saveWorkouts();
                this.renderWorkoutTabs();
                if (this.currentWorkout && this.currentWorkout.id === workout.id) {
                    this.renderExercises();
                }
                this.showToast('Treino atualizado com sucesso!', 'success');
            }
        } else {
            const newWorkout = {
                id: Date.now().toString(),
                name: name,
                description: description,
                exercises: [],
                createdAt: new Date().toISOString()
            };
            this.workouts.push(newWorkout);
            this.saveWorkouts();
            this.renderWorkoutTabs();
            this.selectWorkout(newWorkout.id);
            this.showToast('Treino criado com sucesso!', 'success');
        }

        this.hideModal('addWorkoutModal');
        this.editingWorkoutId = null;
    }

    deleteWorkout(workoutId) {
        const workout = this.workouts.find(w => w.id === workoutId);
        if (!workout) return;
        this.pendingDelete = { type: 'workout', id: workoutId };
        document.getElementById('confirmMessage').textContent =
            `Excluir o treino "${workout.name}" e todos os seus exercícios? Essa ação não pode ser desfeita.`;
        this.showModal('confirmModal');
    }

    // Comprime uma foto escolhida do celular para um data URL leve,
    // evitando estourar o limite do localStorage com fotos em resolução total
    // Abre o Google Imagens em uma nova aba já buscando pelo nome do exercício,
    // para facilitar encontrar uma foto de referência ao cadastrar o exercício
    searchExerciseImage() {
        const name = document.getElementById('exerciseName').value.trim();

        if (!name) {
            this.showToast('Digite o nome do exercício antes de buscar uma imagem.', 'error');
            document.getElementById('exerciseName').focus();
            return;
        }

        const query = encodeURIComponent(`${name} exercício academia execução`);
        window.open(`https://www.google.com/search?tbm=isch&q=${query}`, '_blank', 'noopener');
        this.showToast('Toque e segure a imagem escolhida e copie o link para colar aqui.', 'info');
    }

    compressImageFile(file, maxSize = 1000, quality = 0.8) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onerror = () => reject(new Error('Falha ao ler o arquivo'));
            reader.onload = (e) => {
                const img = new Image();
                img.onerror = () => reject(new Error('Falha ao carregar a imagem'));
                img.onload = () => {
                    let { width, height } = img;
                    if (width > maxSize || height > maxSize) {
                        const ratio = Math.min(maxSize / width, maxSize / height);
                        width = Math.round(width * ratio);
                        height = Math.round(height * ratio);
                    }
                    const canvas = document.createElement('canvas');
                    canvas.width = width;
                    canvas.height = height;
                    canvas.getContext('2d').drawImage(img, 0, 0, width, height);
                    resolve(canvas.toDataURL('image/jpeg', quality));
                };
                img.src = e.target.result;
            };
            reader.readAsDataURL(file);
        });
    }

    showImagePreview(src) {
        const wrap = document.getElementById('exerciseImagePreviewWrap');
        const preview = document.getElementById('exerciseImagePreview');
        preview.onerror = () => this.hideImagePreview();
        preview.src = src;
        wrap.style.display = 'inline-flex';
    }

    hideImagePreview() {
        const wrap = document.getElementById('exerciseImagePreviewWrap');
        const preview = document.getElementById('exerciseImagePreview');
        preview.src = '';
        wrap.style.display = 'none';
    }

    // ---------- EXERCÍCIOS ----------

    openExerciseModal(exerciseId = null) {
        if (!this.currentWorkout) {
            this.showToast('Selecione um treino primeiro.', 'error');
            return;
        }
        this.editingExerciseId = exerciseId;
        const title = document.getElementById('exerciseModalTitle');
        const submitBtn = document.getElementById('submitExerciseBtn');
        const form = document.getElementById('addExerciseForm');
        form.reset();
        document.getElementById('exerciseSets').value = 3;
        this.hideImagePreview();

        if (exerciseId) {
            const exercise = this.currentWorkout.exercises.find(ex => ex.id === exerciseId);
            if (!exercise) return;
            title.textContent = 'Editar Exercício';
            submitBtn.textContent = 'Salvar Alterações';
            document.getElementById('exerciseName').value = exercise.name;
            document.getElementById('exerciseSets').value = exercise.sets;
            document.getElementById('exerciseReps').value = exercise.reps;
            document.getElementById('exerciseWeight').value = exercise.weight || '';
            document.getElementById('exerciseImage').value = exercise.image || '';
            document.getElementById('exerciseNotes').value = exercise.notes || '';
            if (exercise.image) {
                this.showImagePreview(this.getImageSource(exercise.image));
            }
        } else {
            title.textContent = 'Adicionar Exercício';
            submitBtn.textContent = 'Adicionar Exercício';
        }

        this.showModal('addExerciseModal');
    }

    saveExerciseForm() {
        if (!this.currentWorkout) {
            this.showToast('Por favor, selecione um treino primeiro.', 'error');
            return;
        }

        const name = document.getElementById('exerciseName').value.trim();
        const sets = document.getElementById('exerciseSets').value;
        const reps = document.getElementById('exerciseReps').value.trim();
        const weight = document.getElementById('exerciseWeight').value.trim();
        const image = document.getElementById('exerciseImage').value.trim();
        const notes = document.getElementById('exerciseNotes').value.trim();

        if (!name || !sets || !reps) {
            this.showToast('Por favor, preencha todos os campos obrigatórios.', 'error');
            return;
        }

        if (this.editingExerciseId) {
            const exercise = this.currentWorkout.exercises.find(ex => ex.id === this.editingExerciseId);
            if (exercise) {
                exercise.name = name;
                exercise.sets = parseInt(sets);
                exercise.reps = reps;
                exercise.weight = weight;
                exercise.image = image;
                exercise.notes = notes;
                this.saveWorkouts();
                this.renderExercises();
                this.renderWorkoutTabs();
                this.showToast('Exercício atualizado com sucesso!', 'success');
            }
        } else {
            const newExercise = {
                id: Date.now().toString(),
                name: name,
                sets: parseInt(sets),
                reps: reps,
                weight: weight,
                image: image,
                notes: notes,
                completed: false,
                createdAt: new Date().toISOString()
            };
            this.currentWorkout.exercises.push(newExercise);
            this.saveWorkouts();
            this.renderExercises();
            this.renderWorkoutTabs();
            this.showToast('Exercício adicionado com sucesso!', 'success');
        }

        this.hideModal('addExerciseModal');
        this.editingExerciseId = null;
    }

    deleteExercise(exerciseId) {
        if (!this.currentWorkout) return;
        const exercise = this.currentWorkout.exercises.find(ex => ex.id === exerciseId);
        if (!exercise) return;
        this.pendingDelete = { type: 'exercise', id: exerciseId };
        document.getElementById('confirmMessage').textContent =
            `Excluir o exercício "${exercise.name}"?`;
        this.showModal('confirmModal');
    }

    executeDelete() {
        if (!this.pendingDelete) {
            this.hideModal('confirmModal');
            return;
        }

        if (this.pendingDelete.type === 'workout') {
            const wasCurrent = this.currentWorkout && this.currentWorkout.id === this.pendingDelete.id;
            this.workouts = this.workouts.filter(w => w.id !== this.pendingDelete.id);
            this.saveWorkouts();
            if (wasCurrent) {
                this.currentWorkout = null;
                this.backToWorkoutList();
            }
            this.renderWorkoutTabs();
            this.renderExercises();
            this.showToast('Treino excluído.', 'success');
        } else if (this.pendingDelete.type === 'exercise' && this.currentWorkout) {
            this.currentWorkout.exercises = this.currentWorkout.exercises.filter(ex => ex.id !== this.pendingDelete.id);
            this.saveWorkouts();
            this.renderExercises();
            this.renderWorkoutTabs();
            this.showToast('Exercício excluído.', 'success');
        } else if (this.pendingDelete.type === 'session') {
            this.history = this.history.filter(s => s.id !== this.pendingDelete.id);
            this.saveHistory();
            this.renderHistory();
            this.showToast('Registro do histórico excluído.', 'success');
        }

        this.pendingDelete = null;
        this.hideModal('confirmModal');
    }

    // ---------- HISTÓRICO ----------

    // Registra a sessão atual (feito/não feito) no histórico e reinicia
    // as marcações de conclusão do treino para a próxima sessão
    finishWorkout() {
        if (!this.currentWorkout) return;

        if (this.currentWorkout.exercises.length === 0) {
            this.showToast('Adicione exercícios a este treino antes de finalizar.', 'error');
            return;
        }

        const session = {
            id: Date.now().toString(),
            workoutId: this.currentWorkout.id,
            workoutName: this.currentWorkout.name,
            date: new Date().toISOString(),
            exercises: this.currentWorkout.exercises.map(ex => ({
                name: ex.name,
                sets: ex.sets,
                reps: ex.reps,
                weight: ex.weight || '',
                completed: !!ex.completed
            }))
        };

        this.history.unshift(session);
        this.saveHistory();

        // Reinicia as marcações de conclusão para a próxima vez que o treino for feito
        this.currentWorkout.exercises.forEach(ex => ex.completed = false);
        this.saveWorkouts();
        this.renderExercises();
        this.renderWorkoutTabs();

        this.showToast('Treino registrado no histórico!', 'success');
    }

    deleteSession(sessionId) {
        this.pendingDelete = { type: 'session', id: sessionId };
        document.getElementById('confirmMessage').textContent =
            'Excluir este registro do histórico? Essa ação não pode ser desfeita.';
        this.showModal('confirmModal');
    }

    renderHistory() {
        const list = document.getElementById('historyList');
        list.innerHTML = '';

        if (this.history.length === 0) {
            list.innerHTML = `
                <div class="empty-history">
                    <p>Nenhum treino finalizado ainda.</p>
                    <p>Abra um treino e clique em "Finalizar Treino" para registrar sua sessão aqui.</p>
                </div>
            `;
            return;
        }

        this.history.forEach(session => {
            const card = document.createElement('div');
            card.className = 'session-card';

            const dateObj = new Date(session.date);
            const dateStr = dateObj.toLocaleDateString('pt-BR');
            const timeStr = dateObj.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
            const completedCount = session.exercises.filter(ex => ex.completed).length;

            const exercisesHtml = session.exercises.map(ex => `
                <li class="${ex.completed ? 'done' : 'not-done'}">
                    <i class="fas ${ex.completed ? 'fa-check-circle' : 'fa-times-circle'}"></i>
                    <span>${this.escapeHtml(ex.name)} — ${ex.sets}x${this.escapeHtml(ex.reps)}${ex.weight ? ' · ' + this.escapeHtml(ex.weight) : ''}</span>
                </li>
            `).join('');

            card.innerHTML = `
                <div class="session-card-header">
                    <div class="session-card-title">
                        <h4>${this.escapeHtml(session.workoutName)}</h4>
                        <span>${dateStr} às ${timeStr}</span>
                    </div>
                    <div class="session-actions">
                        <span class="session-badge">${completedCount}/${session.exercises.length} concluídos</span>
                        <button class="icon-btn danger delete-session-btn" title="Excluir registro" aria-label="Excluir registro do histórico">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </div>
                <ul class="session-exercise-list">${exercisesHtml}</ul>
            `;

            card.querySelector('.delete-session-btn').addEventListener('click', () => {
                this.deleteSession(session.id);
            });

            list.appendChild(card);
        });
    }

    async exportHistoryPDF() {
        if (this.history.length === 0) {
            this.showToast('Nenhum registro no histórico para exportar.', 'error');
            return;
        }
        if (!window.jspdf) {
            this.showToast('Não foi possível carregar o gerador de PDF. Verifique sua conexão.', 'error');
            return;
        }

        this.showToast('Gerando PDF do histórico, aguarde...', 'info');

        const { jsPDF } = window.jspdf;
        const doc = new jsPDF({ unit: 'pt', format: 'a4' });
        const pageWidth = doc.internal.pageSize.getWidth();
        const pageHeight = doc.internal.pageSize.getHeight();
        const marginX = 40;
        const contentWidth = pageWidth - marginX * 2;
        const topMargin = 60;
        let y = topMargin;

        const drawHeaderBar = () => {
            doc.setFillColor(102, 126, 234);
            doc.rect(0, 0, pageWidth, 6, 'F');
        };

        const checkPageBreak = (spaceNeeded) => {
            if (y + spaceNeeded > pageHeight - 50) {
                doc.addPage();
                drawHeaderBar();
                y = topMargin;
            }
        };

        // Capa
        doc.setFillColor(102, 126, 234);
        doc.rect(0, 0, pageWidth, 110, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(22);
        doc.setFont(undefined, 'bold');
        doc.text('Histórico de Treinos', marginX, 55);
        doc.setFontSize(11);
        doc.setFont(undefined, 'normal');
        const today = new Date().toLocaleDateString('pt-BR');
        doc.text(`Exportado em ${today}  ·  ${this.history.length} sessão(ões) registrada(s)`, marginX, 80);

        y = 140;

        this.history.forEach(session => {
            checkPageBreak(50);

            const dateObj = new Date(session.date);
            const dateStr = dateObj.toLocaleDateString('pt-BR');
            const timeStr = dateObj.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
            const completedCount = session.exercises.filter(ex => ex.completed).length;

            doc.setFillColor(245, 245, 250);
            doc.roundedRect(marginX, y, contentWidth, 30, 6, 6, 'F');
            doc.setFontSize(11.5);
            doc.setFont(undefined, 'bold');
            doc.setTextColor(40, 40, 40);
            doc.text(session.workoutName, marginX + 10, y + 19);
            doc.setFontSize(9);
            doc.setFont(undefined, 'normal');
            doc.setTextColor(110, 110, 110);
            doc.text(`${dateStr} às ${timeStr}  ·  ${completedCount}/${session.exercises.length} concluídos`, pageWidth - marginX - 10, y + 19, { align: 'right' });

            y += 40;

            session.exercises.forEach(ex => {
                checkPageBreak(16);
                doc.setFontSize(9.5);
                doc.setFont(undefined, 'normal');
                if (ex.completed) {
                    doc.setTextColor(30, 120, 60);
                } else {
                    doc.setTextColor(170, 50, 50);
                }
                const mark = ex.completed ? '[OK]' : '[X]';
                let line = `${mark} ${ex.name} — ${ex.sets}x${ex.reps}`;
                if (ex.weight) line += `  ·  ${ex.weight}`;
                doc.text(line, marginX + 14, y);
                y += 14;
            });

            y += 16;
        });

        // Rodapé com paginação
        const totalPages = doc.internal.getNumberOfPages();
        for (let p = 1; p <= totalPages; p++) {
            doc.setPage(p);
            doc.setFontSize(8.5);
            doc.setFont(undefined, 'normal');
            doc.setTextColor(160, 160, 160);
            doc.text(`Página ${p} de ${totalPages}`, pageWidth - marginX, pageHeight - 24, { align: 'right' });
            doc.text('App Treino - Histórico', marginX, pageHeight - 24);
        }

        const date = new Date().toISOString().slice(0, 10);
        doc.save(`app-treino-historico-${date}.pdf`);
        this.showToast('PDF do histórico exportado com sucesso!', 'success');
    }

    // ---------- PROGRESSÃO DE CARGA ----------

    // Extrai o primeiro número de uma carga digitada como texto (ex: "20kg" -> 20, "10 e 12,5 kg" -> 10)
    parseWeightNumber(weightStr) {
        if (!weightStr) return null;
        const match = weightStr.replace(',', '.').match(/(\d+(\.\d+)?)/);
        return match ? parseFloat(match[1]) : null;
    }

    destroyProgressCharts() {
        this.progressCharts.forEach(chart => chart.destroy());
        this.progressCharts = [];
    }

    // Monta, a partir do histórico, a evolução de carga por exercício ao longo do tempo
    buildProgressionData() {
        const byExercise = {};

        // Ordena o histórico do mais antigo para o mais novo (para o gráfico ficar em ordem cronológica)
        const sortedHistory = [...this.history].sort((a, b) => new Date(a.date) - new Date(b.date));

        sortedHistory.forEach(session => {
            session.exercises.forEach(ex => {
                const weightNum = this.parseWeightNumber(ex.weight);
                if (weightNum === null) return;

                if (!byExercise[ex.name]) {
                    byExercise[ex.name] = [];
                }
                byExercise[ex.name].push({
                    date: session.date,
                    weight: weightNum,
                    rawWeight: ex.weight
                });
            });
        });

        return byExercise;
    }

    renderProgress() {
        this.destroyProgressCharts();
        const list = document.getElementById('progressList');
        list.innerHTML = '';

        const data = this.buildProgressionData();
        const exerciseNames = Object.keys(data);

        if (exerciseNames.length === 0) {
            list.innerHTML = `
                <div class="empty-progress">
                    <p>Ainda não há dados de progressão.</p>
                    <p>Finalize treinos com o campo de carga preenchido (ex: "20kg") para acompanhar sua evolução aqui.</p>
                </div>
            `;
            return;
        }

        exerciseNames.forEach((name, index) => {
            const points = data[name];
            const canvasId = `progressChart_${index}`;

            const card = document.createElement('div');
            card.className = 'progress-card';

            const first = points[0].weight;
            const last = points[points.length - 1].weight;
            const diff = last - first;
            let diffText = 'sem variação';
            if (diff > 0) diffText = `+${diff.toFixed(1)} desde o início`;
            if (diff < 0) diffText = `${diff.toFixed(1)} desde o início`;

            card.innerHTML = `
                <h4>${this.escapeHtml(name)}</h4>
                <div class="progress-meta">${points.length} registro(s) · ${diffText}</div>
                <div class="progress-chart-wrap">
                    <canvas id="${canvasId}"></canvas>
                </div>
            `;
            list.appendChild(card);

            const ctx = document.getElementById(canvasId).getContext('2d');
            const chart = new Chart(ctx, {
                type: 'line',
                data: {
                    labels: points.map(p => new Date(p.date).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })),
                    datasets: [{
                        label: 'Carga',
                        data: points.map(p => p.weight),
                        borderColor: '#667eea',
                        backgroundColor: 'rgba(102, 126, 234, 0.15)',
                        tension: 0.3,
                        fill: true,
                        pointBackgroundColor: '#764ba2',
                        pointRadius: 4
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: { display: false },
                        tooltip: {
                            callbacks: {
                                label: (context) => points[context.dataIndex].rawWeight
                            }
                        }
                    },
                    scales: {
                        y: { beginAtZero: false }
                    }
                }
            });

            this.progressCharts.push(chart);
        });
    }

    // ---------- RENDERIZAÇÃO ----------

    // Renderizar abas dos treinos
    renderWorkoutTabs() {
        const tabsContainer = document.getElementById('workoutTabs');
        tabsContainer.innerHTML = '';

        if (this.workouts.length === 0) {
            tabsContainer.innerHTML = `
                <div class="empty-tabs">
                    <p>Você ainda não tem treinos. Clique em "Novo Treino" para começar!</p>
                </div>
            `;
            return;
        }

        this.workouts.forEach(workout => {
            const tab = document.createElement('div');
            tab.className = 'workout-tab';
            if (this.currentWorkout && this.currentWorkout.id === workout.id) {
                tab.classList.add('active');
            }
            tab.dataset.workoutId = workout.id;

            const completedCount = workout.exercises.filter(ex => ex.completed).length;
            const totalCount = workout.exercises.length;

            tab.innerHTML = `
                <div class="tab-main">
                    <h3>${this.escapeHtml(workout.name)}</h3>
                    <p>${workout.exercises.length} exercícios</p>
                    ${totalCount > 0 ? `<p>${completedCount}/${totalCount} completos</p>` : ''}
                </div>
                <div class="tab-actions">
                    <button class="icon-btn edit-workout-btn" title="Editar treino" aria-label="Editar treino">
                        <i class="fas fa-pen"></i>
                    </button>
                    <button class="icon-btn danger delete-workout-btn" title="Excluir treino" aria-label="Excluir treino">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            `;

            tab.querySelector('.tab-main').addEventListener('click', () => {
                this.selectWorkout(workout.id);
            });

            tab.querySelector('.edit-workout-btn').addEventListener('click', (e) => {
                e.stopPropagation();
                this.openWorkoutModal(workout.id);
            });

            tab.querySelector('.delete-workout-btn').addEventListener('click', (e) => {
                e.stopPropagation();
                this.deleteWorkout(workout.id);
            });

            tabsContainer.appendChild(tab);
        });
    }

    // Selecionar treino
    selectWorkout(workoutId) {
        this.currentWorkout = this.workouts.find(w => w.id === workoutId);

        document.querySelectorAll('.workout-tab').forEach(tab => {
            tab.classList.remove('active');
        });

        const activeTab = document.querySelector(`[data-workout-id="${workoutId}"]`);
        if (activeTab) {
            activeTab.classList.add('active');
        }

        this.renderExercises();

        // Entra na tela de detalhe do treino (esconde a lista) e garante que
        // o conteúdo já apareça visível, sem precisar rolar a página.
        document.querySelector('.main-content').classList.add('view-detail');
        window.scrollTo(0, 0);
    }

    // Voltar de qualquer tela de detalhe/histórico para a lista de treinos
    backToWorkoutList() {
        document.querySelector('.main-content').classList.remove('view-detail', 'view-history', 'view-progress');
        this.destroyProgressCharts();
        window.scrollTo(0, 0);
    }

    // Abrir a tela de histórico de treinos realizados
    openHistoryView() {
        this.renderHistory();
        const main = document.querySelector('.main-content');
        main.classList.remove('view-detail', 'view-progress');
        main.classList.add('view-history');
        window.scrollTo(0, 0);
    }

    // Abrir a tela de progressão de carga
    openProgressView() {
        const main = document.querySelector('.main-content');
        main.classList.remove('view-detail', 'view-history');
        main.classList.add('view-progress');
        this.renderProgress();
        window.scrollTo(0, 0);
    }

    // Renderizar exercícios do treino atual
    renderExercises() {
        const exercisesList = document.getElementById('exercisesList');
        const workoutTitle = document.getElementById('workoutTitle');
        const completedExercises = document.getElementById('completedExercises');
        const totalExercises = document.getElementById('totalExercises');

        if (!this.currentWorkout) {
            workoutTitle.textContent = 'Selecione um treino';
            exercisesList.innerHTML = '<div class="loading"><i class="fas fa-dumbbell"></i><p>Selecione um treino para começar</p></div>';
            completedExercises.textContent = '0';
            totalExercises.textContent = '0';
            return;
        }

        workoutTitle.textContent = this.currentWorkout.name;

        const completedCount = this.currentWorkout.exercises.filter(ex => ex.completed).length;
        completedExercises.textContent = completedCount;
        totalExercises.textContent = this.currentWorkout.exercises.length;

        exercisesList.innerHTML = '';

        if (this.currentWorkout.exercises.length === 0) {
            exercisesList.innerHTML = `
                <div class="loading">
                    <i class="fas fa-plus-circle"></i>
                    <p>Nenhum exercício adicionado ainda.</p>
                    <p>Clique em "Adicionar Exercício" para começar!</p>
                </div>
            `;
        } else {
            this.currentWorkout.exercises.forEach(exercise => {
                const exerciseCard = this.createExerciseCard(exercise);
                exercisesList.appendChild(exerciseCard);
            });
        }

        this.addAddExerciseButton();
    }

    // Criar card de exercício
    createExerciseCard(exercise) {
        const card = document.createElement('div');
        card.className = `exercise-card ${exercise.completed ? 'completed' : ''}`;
        card.dataset.exerciseId = exercise.id;

        const imageSrc = this.getImageSource(exercise.image);

        card.innerHTML = `
            <div class="exercise-header">
                <div class="exercise-info">
                    <h4>${this.escapeHtml(exercise.name)}</h4>
                    <div class="exercise-details">
                        <span><i class="fas fa-layer-group"></i> ${exercise.sets} séries</span>
                        <span><i class="fas fa-repeat"></i> ${this.escapeHtml(exercise.reps)}</span>
                        ${exercise.weight ? `<span><i class="fas fa-weight-hanging"></i> ${this.escapeHtml(exercise.weight)}</span>` : ''}
                        ${exercise.completed ? '<span><i class="fas fa-check"></i> Concluído</span>' : ''}
                    </div>
                </div>
                <div class="exercise-actions">
                    <button class="icon-btn edit-exercise-btn" title="Editar exercício" aria-label="Editar exercício">
                        <i class="fas fa-pen"></i>
                    </button>
                    <button class="icon-btn danger delete-exercise-btn" title="Excluir exercício" aria-label="Excluir exercício">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>
            ${imageSrc ? `<img src="${imageSrc}" alt="${this.escapeHtml(exercise.name)}" class="exercise-image" onerror="this.style.display='none'">` : ''}
            ${exercise.notes ? `<div class="exercise-notes"><strong>Observações:</strong> ${this.escapeHtml(exercise.notes)}</div>` : ''}
            <div class="exercise-footer">
                <button class="btn-complete ${exercise.completed ? 'completed' : ''}" data-action="toggle">
                    ${exercise.completed ? '<i class="fas fa-undo"></i> Desfazer' : '<i class="fas fa-check"></i> Concluir'}
                </button>
            </div>
        `;

        card.querySelector('[data-action="toggle"]').addEventListener('click', () => {
            this.toggleExerciseComplete(exercise.id);
        });
        card.querySelector('.edit-exercise-btn').addEventListener('click', () => {
            this.openExerciseModal(exercise.id);
        });
        card.querySelector('.delete-exercise-btn').addEventListener('click', () => {
            this.deleteExercise(exercise.id);
        });

        return card;
    }

    // Obter fonte da imagem
    getImageSource(imageInput) {
        if (!imageInput) return null;

        // Imagem escolhida do celular (já convertida para base64)
        if (imageInput.startsWith('data:image/')) {
            return imageInput;
        }

        if (imageInput.startsWith('http://') || imageInput.startsWith('https://')) {
            return imageInput;
        }

        if (imageInput.includes('.')) {
            return `img/${imageInput}`;
        }

        return `img/${imageInput}.jpg`;
    }

    // Alternar status de conclusão do exercício
    toggleExerciseComplete(exerciseId) {
        const exercise = this.currentWorkout.exercises.find(ex => ex.id === exerciseId);
        if (exercise) {
            exercise.completed = !exercise.completed;
            this.saveWorkouts();
            this.renderExercises();
            this.renderWorkoutTabs();
        }
    }

    // Adicionar botão para adicionar exercício
    addAddExerciseButton() {
        const exercisesList = document.getElementById('exercisesList');

        const existingButton = document.querySelector('.btn-add-exercise');
        if (existingButton) {
            existingButton.remove();
        }

        if (!this.currentWorkout) return;

        const addButton = document.createElement('button');
        addButton.className = 'btn-add-exercise';
        addButton.innerHTML = '<i class="fas fa-plus"></i> Adicionar Exercício';
        addButton.addEventListener('click', () => {
            this.openExerciseModal();
        });

        exercisesList.appendChild(addButton);
    }

    // Escapar HTML para evitar quebra de layout com nomes/observações digitados pelo usuário
    escapeHtml(str) {
        if (!str) return '';
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    // Carrega uma imagem (local ou remota) e converte para base64,
    // para poder inserir no PDF com jsPDF (addImage exige dados, não uma URL solta)
    loadImageAsDataURL(url) {
        return new Promise((resolve) => {
            const img = new Image();
            img.crossOrigin = 'anonymous';
            img.onload = () => {
                try {
                    const canvas = document.createElement('canvas');
                    canvas.width = img.naturalWidth;
                    canvas.height = img.naturalHeight;
                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(img, 0, 0);
                    resolve({
                        dataUrl: canvas.toDataURL('image/jpeg', 0.85),
                        width: img.naturalWidth,
                        height: img.naturalHeight
                    });
                } catch (err) {
                    resolve(null); // imagem "contaminou" o canvas (CORS) ou outro erro — segue sem ela
                }
            };
            img.onerror = () => resolve(null);
            img.src = url;
        });
    }

    // ---------- EXPORTAR PDF ----------

    async exportPDF() {
        if (this.workouts.length === 0) {
            this.showToast('Nenhum treino para exportar ainda.', 'error');
            return;
        }
        if (!window.jspdf) {
            this.showToast('Não foi possível carregar o gerador de PDF. Verifique sua conexão.', 'error');
            return;
        }

        this.showToast('Gerando PDF, aguarde...', 'info');

        const { jsPDF } = window.jspdf;
        const doc = new jsPDF({ unit: 'pt', format: 'a4' });
        const pageWidth = doc.internal.pageSize.getWidth();
        const pageHeight = doc.internal.pageSize.getHeight();
        const marginX = 40;
        const contentWidth = pageWidth - marginX * 2;
        const topMargin = 60;
        const bottomMargin = 50;
        let y = topMargin;

        const drawHeader = () => {
            doc.setFillColor(102, 126, 234);
            doc.rect(0, 0, pageWidth, 6, 'F');
        };

        const checkPageBreak = (spaceNeeded) => {
            if (y + spaceNeeded > pageHeight - bottomMargin) {
                doc.addPage();
                drawHeader();
                y = topMargin;
            }
        };

        // ---------- Capa ----------
        doc.setFillColor(102, 126, 234);
        doc.rect(0, 0, pageWidth, 130, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(24);
        doc.setFont(undefined, 'bold');
        doc.text('App Treino', marginX, 60);
        doc.setFontSize(13);
        doc.setFont(undefined, 'normal');
        doc.text('Relatório completo dos meus treinos', marginX, 84);
        doc.setFontSize(10);
        const today = new Date().toLocaleDateString('pt-BR');
        doc.text(`Exportado em ${today}`, marginX, 106);

        // Resumo geral
        y = 160;
        doc.setTextColor(60, 60, 60);
        const totalExercises = this.workouts.reduce((acc, w) => acc + w.exercises.length, 0);
        const totalCompleted = this.workouts.reduce((acc, w) => acc + w.exercises.filter(ex => ex.completed).length, 0);

        doc.setFontSize(11);
        doc.setFont(undefined, 'bold');
        doc.text('Resumo', marginX, y);
        y += 8;
        doc.setDrawColor(220, 220, 220);
        doc.line(marginX, y, pageWidth - marginX, y);
        y += 20;

        doc.setFont(undefined, 'normal');
        doc.setFontSize(10.5);
        doc.setTextColor(80, 80, 80);
        doc.text(`Total de treinos: ${this.workouts.length}`, marginX, y);
        y += 16;
        doc.text(`Total de exercícios: ${totalExercises}`, marginX, y);
        y += 16;
        doc.text(`Exercícios concluídos: ${totalCompleted} de ${totalExercises}`, marginX, y);
        y += 30;

        // Índice (sumário dos treinos)
        doc.setFontSize(11);
        doc.setFont(undefined, 'bold');
        doc.setTextColor(30, 30, 30);
        doc.text('Treinos neste relatório', marginX, y);
        y += 8;
        doc.line(marginX, y, pageWidth - marginX, y);
        y += 20;

        doc.setFont(undefined, 'normal');
        doc.setFontSize(10.5);
        this.workouts.forEach((workout, i) => {
            checkPageBreak(16);
            const completed = workout.exercises.filter(ex => ex.completed).length;
            doc.setTextColor(80, 80, 80);
            doc.text(`${i + 1}. ${workout.name}`, marginX, y);
            doc.setTextColor(150, 150, 150);
            doc.text(`${workout.exercises.length} exercícios · ${completed} concluído(s)`, pageWidth - marginX, y, { align: 'right' });
            y += 18;
        });

        // ---------- Páginas dos treinos ----------
        for (let wIndex = 0; wIndex < this.workouts.length; wIndex++) {
            const workout = this.workouts[wIndex];
            doc.addPage();
            drawHeader();
            y = topMargin;

            // Faixa colorida com o nome do treino
            const bannerHeight = 46;
            doc.setFillColor(102, 126, 234);
            doc.roundedRect(marginX, y, contentWidth, bannerHeight, 8, 8, 'F');
            doc.setTextColor(255, 255, 255);
            doc.setFontSize(14);
            doc.setFont(undefined, 'bold');
            doc.text(`Treino ${wIndex + 1}: ${workout.name}`, marginX + 14, y + 20);

            const completedCount = workout.exercises.filter(ex => ex.completed).length;
            doc.setFontSize(9.5);
            doc.setFont(undefined, 'normal');
            doc.text(`${workout.exercises.length} exercícios  ·  ${completedCount} concluído(s)`, marginX + 14, y + 36);

            y += bannerHeight + 14;

            // Descrição do treino
            if (workout.description) {
                doc.setFontSize(10);
                doc.setFont(undefined, 'italic');
                doc.setTextColor(100, 100, 100);
                const descLines = doc.splitTextToSize(workout.description, contentWidth);
                descLines.forEach(line => {
                    checkPageBreak(14);
                    doc.text(line, marginX, y);
                    y += 14;
                });
                y += 8;
            }

            if (workout.exercises.length === 0) {
                doc.setFontSize(10);
                doc.setTextColor(150, 150, 150);
                doc.text('Nenhum exercício cadastrado neste treino.', marginX, y);
                continue;
            }

            for (let exIndex = 0; exIndex < workout.exercises.length; exIndex++) {
                const exercise = workout.exercises[exIndex];

                // Carrega a imagem antes de calcular a altura do card
                const imageSrc = this.getImageSource(exercise.image);
                let imgData = null;
                if (imageSrc) {
                    imgData = await this.loadImageAsDataURL(imageSrc);
                }

                const imgBoxSize = 74;
                const textX = marginX + 14 + (imgData ? imgBoxSize + 14 : 0);
                const textWidth = contentWidth - 28 - (imgData ? imgBoxSize + 14 : 0);

                // Pré-calcula as linhas de observação para saber a altura do card
                doc.setFontSize(9);
                doc.setFont(undefined, 'italic');
                const noteLines = exercise.notes ? doc.splitTextToSize(`Obs: ${exercise.notes}`, textWidth) : [];

                const cardHeight = Math.max(
                    imgData ? imgBoxSize + 20 : 0,
                    56 + noteLines.length * 12
                );

                checkPageBreak(cardHeight + 12);

                // Cartão do exercício
                doc.setFillColor(250, 250, 252);
                doc.setDrawColor(225, 225, 230);
                doc.roundedRect(marginX, y, contentWidth, cardHeight, 6, 6, 'FD');

                // Imagem dentro do cartão
                if (imgData) {
                    let w = imgData.width;
                    let h = imgData.height;
                    const ratio = Math.min(imgBoxSize / w, imgBoxSize / h);
                    w = w * ratio;
                    h = h * ratio;
                    const imgX = marginX + 14 + (imgBoxSize - w) / 2;
                    const imgY = y + 10 + (imgBoxSize - h) / 2;
                    try {
                        doc.addImage(imgData.dataUrl, 'JPEG', imgX, imgY, w, h);
                    } catch (err) {
                        // segue sem a imagem se não puder ser embutida
                    }
                }

                // Número + nome do exercício
                let ty = y + 20;
                doc.setFontSize(11.5);
                doc.setFont(undefined, 'bold');
                doc.setTextColor(30, 30, 30);
                doc.text(`${exIndex + 1}. ${exercise.name}`, textX, ty);

                // Selo de concluído
                if (exercise.completed) {
                    const badgeText = 'CONCLUÍDO';
                    doc.setFontSize(7.5);
                    doc.setFont(undefined, 'bold');
                    const badgeWidth = doc.getTextWidth(badgeText) + 12;
                    const badgeX = marginX + contentWidth - 14 - badgeWidth;
                    doc.setFillColor(40, 167, 69);
                    doc.roundedRect(badgeX, ty - 10, badgeWidth, 14, 7, 7, 'F');
                    doc.setTextColor(255, 255, 255);
                    doc.text(badgeText, badgeX + 6, ty);
                }

                ty += 16;
                doc.setFontSize(9.5);
                doc.setFont(undefined, 'normal');
                doc.setTextColor(90, 90, 90);
                let details = `Séries: ${exercise.sets}    Repetições: ${exercise.reps}`;
                if (exercise.weight) details += `    Carga: ${exercise.weight}`;
                doc.text(details, textX, ty);
                ty += 14;

                if (noteLines.length > 0) {
                    doc.setFont(undefined, 'italic');
                    doc.setTextColor(110, 110, 110);
                    noteLines.forEach(line => {
                        doc.text(line, textX, ty);
                        ty += 12;
                    });
                }

                y += cardHeight + 12;
            }
        }

        // Rodapé com numeração de página em todas as páginas (exceto a capa)
        const totalPages = doc.internal.getNumberOfPages();
        for (let p = 2; p <= totalPages; p++) {
            doc.setPage(p);
            doc.setFontSize(8.5);
            doc.setFont(undefined, 'normal');
            doc.setTextColor(160, 160, 160);
            doc.text(`Página ${p - 1} de ${totalPages - 1}`, pageWidth - marginX, pageHeight - 24, { align: 'right' });
            doc.text('App Treino', marginX, pageHeight - 24);
        }

        const date = new Date().toISOString().slice(0, 10);
        doc.save(`app-treino-${date}.pdf`);
        this.showToast('PDF exportado com sucesso!', 'success');
    }

    // Carregar dados de exemplo
    async loadSampleData() {
        if (this.workouts.length === 0) {
            const sampleWorkouts = [
                {
                    id: '1',
                    name: 'Treino A - Peito e Tríceps',
                    description: 'Foco em desenvolvimento de força e hipertrofia',
                    exercises: [
                        {
                            id: '1',
                            name: 'Supino Reto',
                            sets: 4,
                            reps: '8-12',
                            weight: '',
                            image: 'Barra-no-graviton.jpg',
                            notes: 'Foque na técnica e controle da descida',
                            completed: false,
                            createdAt: new Date().toISOString()
                        },
                        {
                            id: '2',
                            name: 'Puxada Aberta',
                            sets: 3,
                            reps: '10-15',
                            weight: '',
                            image: 'puxada-aberta.jpg',
                            notes: 'Mantenha as costas retas',
                            completed: false,
                            createdAt: new Date().toISOString()
                        },
                        {
                            id: '3',
                            name: 'Extensão de Ombro Cross',
                            sets: 3,
                            reps: '12-15',
                            weight: '',
                            image: 'Extensão-de-ombro-Cross.jpg',
                            notes: 'Controle o movimento',
                            completed: false,
                            createdAt: new Date().toISOString()
                        }
                    ],
                    createdAt: new Date().toISOString()
                },
                {
                    id: '2',
                    name: 'Treino B - Costas e Bíceps',
                    description: 'Desenvolvimento de força e definição',
                    exercises: [
                        {
                            id: '4',
                            name: 'Remada Triângulo',
                            sets: 4,
                            reps: '8-12',
                            weight: '',
                            image: 'Remada triângulo.jpg',
                            notes: 'Puxe o cotovelo para trás',
                            completed: false,
                            createdAt: new Date().toISOString()
                        },
                        {
                            id: '5',
                            name: 'Puxada Barra Romana',
                            sets: 3,
                            reps: '10-15',
                            weight: '',
                            image: 'Puxada-barra-romana.webp',
                            notes: 'Foque na contração das costas',
                            completed: false,
                            createdAt: new Date().toISOString()
                        },
                        {
                            id: '6',
                            name: 'Remada Serrote HBC',
                            sets: 3,
                            reps: '12-15',
                            weight: '',
                            image: 'Remada-serrote-hbc.webp',
                            notes: 'Mantenha a postura',
                            completed: false,
                            createdAt: new Date().toISOString()
                        }
                    ],
                    createdAt: new Date().toISOString()
                },
                {
                    id: '3',
                    name: 'Treino C - Pernas',
                    description: 'Treino focado em membros inferiores',
                    exercises: [
                        {
                            id: '7',
                            name: 'Agachamento Livre',
                            sets: 4,
                            reps: '8-12',
                            weight: '',
                            image: '',
                            notes: 'Mantenha o peito erguido',
                            completed: false,
                            createdAt: new Date().toISOString()
                        },
                        {
                            id: '8',
                            name: 'Leg Press',
                            sets: 3,
                            reps: '10-15',
                            weight: '',
                            image: '',
                            notes: 'Controle o movimento',
                            completed: false,
                            createdAt: new Date().toISOString()
                        }
                    ],
                    createdAt: new Date().toISOString()
                },
                {
                    id: '4',
                    name: 'Treino D - Ombros',
                    description: 'Desenvolvimento de força e estabilidade',
                    exercises: [
                        {
                            id: '9',
                            name: 'Puxada Alta Unilateral',
                            sets: 3,
                            reps: '10-12',
                            weight: '',
                            image: 'Puxada-alta-unilateral.webp',
                            notes: 'Foque na técnica',
                            completed: false,
                            createdAt: new Date().toISOString()
                        },
                        {
                            id: '10',
                            name: 'Remada Unilateral',
                            sets: 3,
                            reps: '12-15',
                            weight: '',
                            image: 'remada-unilateral.webp',
                            notes: 'Mantenha a postura neutra',
                            completed: false,
                            createdAt: new Date().toISOString()
                        }
                    ],
                    createdAt: new Date().toISOString()
                }
            ];

            this.workouts = sampleWorkouts;
            await this.saveWorkouts();
        }
    }
}

// Inicializar aplicativo
const app = new WorkoutApp();

// Registra o service worker (necessário para o Android oferecer
// "Instalar app" com o ícone correto, em vez do ícone/print padrão)
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('service-worker.js').catch(() => {
            // Se falhar (ex.: aberto via file:// direto), o app continua funcionando normalmente
        });
    });
}

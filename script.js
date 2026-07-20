// App de Treinos - Academia
class WorkoutApp {
    constructor() {
        this.workouts = this.loadWorkouts();
        this.currentWorkout = null;
        this.editingWorkoutId = null;
        this.editingExerciseId = null;
        this.pendingDelete = null; // { type: 'workout'|'exercise', id }
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.loadSampleData();
        this.renderWorkoutTabs();
    }

    // Carregar dados salvos do localStorage
    loadWorkouts() {
        const saved = localStorage.getItem('workoutApp_data');
        return saved ? JSON.parse(saved) : [];
    }

    // Salvar dados no localStorage
    saveWorkouts() {
        try {
            localStorage.setItem('workoutApp_data', JSON.stringify(this.workouts));
        } catch (err) {
            this.showToast('Armazenamento cheio. Tente remover ou usar fotos menores.', 'error');
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
            document.getElementById('headerMenu').classList.toggle('open');
        });
        document.addEventListener('click', () => {
            document.getElementById('headerMenu').classList.remove('open');
        });
        document.getElementById('exportBtn').addEventListener('click', () => this.exportPDF());

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
        const modal = document.getElementById(modalId);
        modal.style.display = 'flex';
        // Força reflow antes de adicionar a classe de animação
        requestAnimationFrame(() => {
            modal.classList.add('show');
            const content = modal.querySelector('.modal-content');
            if (content) content.scrollTop = 0;
            const firstInput = modal.querySelector('input, textarea');
            if (firstInput && window.innerWidth > 600) {
                firstInput.focus({ preventScroll: true });
            }
        });
    }

    // Esconder modal
    hideModal(modalId) {
        const modal = document.getElementById(modalId);
        modal.classList.remove('show');
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
        }

        this.pendingDelete = null;
        this.hideModal('confirmModal');
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
                    <button class="icon-btn edit-workout-btn" title="Editar treino">
                        <i class="fas fa-pen"></i>
                    </button>
                    <button class="icon-btn danger delete-workout-btn" title="Excluir treino">
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

    // Voltar da tela de detalhe para a lista de treinos
    backToWorkoutList() {
        document.querySelector('.main-content').classList.remove('view-detail');
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
                    <button class="icon-btn edit-exercise-btn" title="Editar exercício">
                        <i class="fas fa-pen"></i>
                    </button>
                    <button class="icon-btn danger delete-exercise-btn" title="Excluir exercício">
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
    loadSampleData() {
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
            this.saveWorkouts();
        }
    }
}

// Inicializar aplicativo
const app = new WorkoutApp();

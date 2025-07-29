// App de Treinos - Academia
class WorkoutApp {
    constructor() {
        this.workouts = this.loadWorkouts();
        this.currentWorkout = null;
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.renderWorkoutTabs();
        this.loadSampleData();
    }

    // Carregar dados salvos do localStorage
    loadWorkouts() {
        const saved = localStorage.getItem('workoutApp_data');
        return saved ? JSON.parse(saved) : [];
    }

    // Salvar dados no localStorage
    saveWorkouts() {
        localStorage.setItem('workoutApp_data', JSON.stringify(this.workouts));
    }

    // Configurar event listeners
    setupEventListeners() {
        // Modal de adicionar treino
        document.getElementById('addWorkoutBtn').addEventListener('click', () => {
            this.showModal('addWorkoutModal');
        });

        document.getElementById('closeAddWorkoutModal').addEventListener('click', () => {
            this.hideModal('addWorkoutModal');
        });

        document.getElementById('cancelAddWorkout').addEventListener('click', () => {
            this.hideModal('addWorkoutModal');
        });

        document.getElementById('addWorkoutForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.addWorkout();
        });

        // Modal de adicionar exercício
        document.getElementById('closeAddExerciseModal').addEventListener('click', () => {
            this.hideModal('addExerciseModal');
        });

        document.getElementById('cancelAddExercise').addEventListener('click', () => {
            this.hideModal('addExerciseModal');
        });

        document.getElementById('addExerciseForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.addExercise();
        });

        // Fechar modais clicando fora
        window.addEventListener('click', (e) => {
            if (e.target.classList.contains('modal')) {
                e.target.style.display = 'none';
            }
        });
    }

    // Mostrar modal
    showModal(modalId) {
        document.getElementById(modalId).style.display = 'block';
    }

    // Esconder modal
    hideModal(modalId) {
        document.getElementById(modalId).style.display = 'none';
    }

    // Adicionar novo treino
    addWorkout() {
        const name = document.getElementById('workoutName').value.trim();
        const description = document.getElementById('workoutDescription').value.trim();

        if (!name) {
            alert('Por favor, insira um nome para o treino.');
            return;
        }

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
        this.hideModal('addWorkoutModal');
        
        // Limpar formulário
        document.getElementById('addWorkoutForm').reset();
        
        // Selecionar o novo treino
        this.selectWorkout(newWorkout.id);
    }

    // Adicionar exercício ao treino atual
    addExercise() {
        if (!this.currentWorkout) {
            alert('Por favor, selecione um treino primeiro.');
            return;
        }

        const name = document.getElementById('exerciseName').value.trim();
        const sets = document.getElementById('exerciseSets').value;
        const reps = document.getElementById('exerciseReps').value.trim();
        const image = document.getElementById('exerciseImage').value.trim();
        const notes = document.getElementById('exerciseNotes').value.trim();

        if (!name || !sets || !reps) {
            alert('Por favor, preencha todos os campos obrigatórios.');
            return;
        }

        const newExercise = {
            id: Date.now().toString(),
            name: name,
            sets: parseInt(sets),
            reps: reps,
            image: image,
            notes: notes,
            completed: false,
            createdAt: new Date().toISOString()
        };

        this.currentWorkout.exercises.push(newExercise);
        this.saveWorkouts();
        this.renderExercises();
        this.hideModal('addExerciseModal');
        
        // Limpar formulário
        document.getElementById('addExerciseForm').reset();
    }

    // Renderizar abas dos treinos
    renderWorkoutTabs() {
        const tabsContainer = document.getElementById('workoutTabs');
        tabsContainer.innerHTML = '';

        this.workouts.forEach(workout => {
            const tab = document.createElement('div');
            tab.className = 'workout-tab';
            tab.dataset.workoutId = workout.id;
            
            const completedCount = workout.exercises.filter(ex => ex.completed).length;
            const totalCount = workout.exercises.length;
            
            tab.innerHTML = `
                <h3>${workout.name}</h3>
                <p>${workout.exercises.length} exercícios</p>
                ${totalCount > 0 ? `<p>${completedCount}/${totalCount} completos</p>` : ''}
            `;
            
            tab.addEventListener('click', () => {
                this.selectWorkout(workout.id);
            });
            
            tabsContainer.appendChild(tab);
        });

        // Adicionar botão para adicionar exercício se houver treino selecionado
        if (this.currentWorkout) {
            this.addAddExerciseButton();
        }
    }

    // Selecionar treino
    selectWorkout(workoutId) {
        this.currentWorkout = this.workouts.find(w => w.id === workoutId);
        
        // Atualizar abas ativas
        document.querySelectorAll('.workout-tab').forEach(tab => {
            tab.classList.remove('active');
        });
        
        const activeTab = document.querySelector(`[data-workout-id="${workoutId}"]`);
        if (activeTab) {
            activeTab.classList.add('active');
        }

        this.renderExercises();
        this.addAddExerciseButton();
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

        if (this.currentWorkout.exercises.length === 0) {
            exercisesList.innerHTML = `
                <div class="loading">
                    <i class="fas fa-plus-circle"></i>
                    <p>Nenhum exercício adicionado ainda.</p>
                    <p>Clique em "Adicionar Exercício" para começar!</p>
                </div>
            `;
            return;
        }

        exercisesList.innerHTML = '';
        
        this.currentWorkout.exercises.forEach(exercise => {
            const exerciseCard = this.createExerciseCard(exercise);
            exercisesList.appendChild(exerciseCard);
        });
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
                    <h4>${exercise.name}</h4>
                    <div class="exercise-details">
                        <span><i class="fas fa-layer-group"></i> ${exercise.sets} séries</span>
                        <span><i class="fas fa-repeat"></i> ${exercise.reps}</span>
                        ${exercise.completed ? '<span><i class="fas fa-check"></i> Concluído</span>' : ''}
                    </div>
                </div>
                <div class="exercise-actions">
                    <button class="btn-complete ${exercise.completed ? 'completed' : ''}" 
                            onclick="app.toggleExerciseComplete('${exercise.id}')">
                        ${exercise.completed ? '<i class="fas fa-undo"></i> Desfazer' : '<i class="fas fa-check"></i> Concluir'}
                    </button>
                </div>
            </div>
            ${imageSrc ? `<img src="${imageSrc}" alt="${exercise.name}" class="exercise-image" onerror="this.style.display='none'">` : ''}
            ${exercise.notes ? `<div class="exercise-notes"><strong>Observações:</strong> ${exercise.notes}</div>` : ''}
        `;

        return card;
    }

    // Obter fonte da imagem
    getImageSource(imageInput) {
        if (!imageInput) return null;
        
        // Se for uma URL completa
        if (imageInput.startsWith('http://') || imageInput.startsWith('https://')) {
            return imageInput;
        }
        
        // Se for um arquivo local na pasta img
        if (imageInput.includes('.')) {
            return `img/${imageInput}`;
        }
        
        // Tentar encontrar na pasta img com extensões comuns
        const extensions = ['.jpg', '.jpeg', '.png', '.webp'];
        for (const ext of extensions) {
            const testPath = `img/${imageInput}${ext}`;
            // Aqui você poderia verificar se o arquivo existe
            // Por enquanto, vamos tentar com .jpg primeiro
            return `img/${imageInput}.jpg`;
        }
        
        return null;
    }

    // Alternar status de conclusão do exercício
    toggleExerciseComplete(exerciseId) {
        const exercise = this.currentWorkout.exercises.find(ex => ex.id === exerciseId);
        if (exercise) {
            exercise.completed = !exercise.completed;
            this.saveWorkouts();
            this.renderExercises();
            this.renderWorkoutTabs(); // Atualizar estatísticas nas abas
        }
    }

    // Adicionar botão para adicionar exercício
    addAddExerciseButton() {
        const exercisesList = document.getElementById('exercisesList');
        
        // Remover botão existente se houver
        const existingButton = document.querySelector('.btn-add-exercise');
        if (existingButton) {
            existingButton.remove();
        }
        
        // Adicionar novo botão
        const addButton = document.createElement('button');
        addButton.className = 'btn-add-exercise';
        addButton.innerHTML = '<i class="fas fa-plus"></i> Adicionar Exercício';
        addButton.addEventListener('click', () => {
            this.showModal('addExerciseModal');
        });
        
        exercisesList.appendChild(addButton);
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
            this.renderWorkoutTabs();
        }
    }
}

// Inicializar aplicativo
const app = new WorkoutApp(); 
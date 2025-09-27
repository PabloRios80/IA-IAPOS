
// Función para calcular el IMC
function calculateBMI() {
    const height = parseFloat(document.getElementById('height').value) / 100; // Convertir a metros
    const weight = parseFloat(document.getElementById('weight').value);

    const bmiValueElement = document.getElementById('bmiValue');
    const bmiCategoryElement = document.getElementById('bmiCategory');

    if (height && weight && bmiValueElement && bmiCategoryElement) {
        const bmi = weight / (height * height);
        bmiValueElement.textContent = bmi.toFixed(2);

        let category = '';
        if (bmi < 18.5) {
            category = 'Bajo peso';
            bmiCategoryElement.className = 'ml-2 text-sm px-2 py-1 rounded-full bg-yellow-200 text-yellow-800';
        } else if (bmi < 25) {
            category = 'Peso normal';
            bmiCategoryElement.className = 'ml-2 text-sm px-2 py-1 rounded-full bg-green-200 text-green-800';
        } else if (bmi < 30) {
            category = 'Sobrepeso';
            bmiCategoryElement.className = 'ml-2 text-sm px-2 py-1 rounded-full bg-orange-200 text-orange-800';
        } else {
            category = 'Obesidad';
            bmiCategoryElement.className = 'ml-2 text-sm px-2 py-1 rounded-full bg-red-200 text-red-800';
        }
        bmiCategoryElement.textContent = category;
    } else {
        if (bmiValueElement) bmiValueElement.textContent = '--';
        if (bmiCategoryElement) bmiCategoryElement.textContent = '';
    }
}

// Función para calcular la edad
function calculateAge() {
    const birthDateInput = document.getElementById('birthDate');
    const ageInput = document.getElementById('age');

    if (!birthDateInput || !ageInput) return;

    const birthDate = birthDateInput.value;
    const parts = birthDate.split('/');

    if (parts.length !== 3) {
        ageInput.value = ''; // Fecha inválida
        return;
    }

    const day = parseInt(parts[0]);
    const month = parseInt(parts[1]) - 1; // Meses en JavaScript son 0-11
    const year = parseInt(parts[2]);

    const today = new Date();
    const birthDateObj = new Date(year, month, day);

    if (isNaN(birthDateObj.getTime())) {
        ageInput.value = ''; // Fecha inválida
        return;
    }

    let age = today.getFullYear() - birthDateObj.getFullYear();
    const m = today.getMonth() - birthDateObj.getMonth();

    if (m < 0 || (m === 0 && today.getDate() < birthDateObj.getDate())) {
        age--;
    }

    ageInput.value = age;
}

// Función para guardar los datos en Google Sheets
async function guardarDatosFormulario() {
    const DNI = document.getElementById('dni').value;
    const fechaDeNacimiento = document.getElementById('birthDate').value;
    const apellido = document.getElementById('apellido').value;
    const nombre = document.getElementById('nombre').value;
    const edad = document.getElementById('age').value;
    const email = document.getElementById('email').value;
    const telefono = document.getElementById('phone').value;
    const sexo_biologico = document.querySelector('input[name="biologicalSex"]:checked').value;
    const genero_autopercibido = document.getElementById('genderIdentity').value;
    const altura = document.getElementById('height').value;
    const peso = document.getElementById('weight').value;
    const bmiValor = document.getElementById('bmiValue').textContent;
    const bmiCategoria = document.getElementById('bmiCategory').textContent;

    const hipertension = document.querySelector('input[name="hypertension"]:checked').value;
    const diabetes = document.querySelector('input[name="diabetes"]:checked').value;
    const colesterol = document.querySelector('input[name="cholesterol"]:checked').value;
    const depresion = document.querySelector('input[name="depression"]:checked').value;
    const actividad_fisica = document.querySelector('input[name="physicalActivityLow"]:checked').value;
    const sedentarismo = document.querySelector('input[name="sedentary"]:checked').value;
    const abuso_alcohol_otros = document.querySelector('input[name="drugUseExcessive"]:checked').value;
    const stress_ansiedad = document.querySelector('input[name="stressAnxietyExcessive"]:checked').value;
    const preocupacion_salud = document.querySelector('input[name="healthConcernExcessive"]:checked').value;
    const abuso_pantallas = document.querySelector('input[name="screenTimeExcessive"]:checked').value;

    const tabaquismoElement = document.querySelector('input[name="smokingStatus"]:checked');
    const tabaquismo = tabaquismoElement ? tabaquismoElement.value : '';

    let fumador_cronico = 'No aplica';
    if (tabaquismo === 'Sí' || tabaquismo === 'Ex fumador') {
        const fumadorCronicoElement = document.querySelector('input[name="smokingDuration"]:checked');
        if (fumadorCronicoElement) {
            fumador_cronico = fumadorCronicoElement.value;
        }
    }

    const hipertension_familiar = document.querySelector('input[name="familiarHipertension"]:checked').value;
    const diabetes_familiar = document.querySelector('input[name="familiarDiabetes"]:checked').value;
    const adicciones_familiar = document.querySelector('input[name="familiarAdicciones"]:checked').value;
    const obesidad_familiar = document.querySelector('input[name="familiarObesidad"]:checked').value;
    const depresion_familiar = document.querySelector('input[name="familiarDepresion"]:checked').value;
    const violencia_familiar = document.querySelector('input[name="familiarViolenciaAbuso"]:checked').value;
    const cancer_de_colon = document.querySelector('input[name="colonCancer"]:checked').value;
    const cancer_de_mama = document.querySelector('input[name="breastCancer"]:checked').value;
    const cancer_de_cuello_utero = document.querySelector('input[name="cervicalCancer"]:checked').value;
    const cancer_de_prostata = document.querySelector('input[name="prostateCancer"]:checked').value;
    
    const formData = {
        'DNI': DNI,
        'Fecha de Nacimiento': fechaDeNacimiento,
        'Apellido': apellido,
        'Nombre': nombre,
        'Edad': edad,
        'Email': email,
        'Telefono': telefono,
        'Sexo biologico': sexo_biologico,
        'Genero autopercibido': genero_autopercibido,
        'Altura': altura,
        'Peso': peso,
        'BMI': bmiValor,
        'Categoria BMI': bmiCategoria,
        'Hipertension': hipertension,
        'Diabetes': diabetes,
        'Colesterol': colesterol,
        'Depresion': depresion,
        'Actividad fisica': actividad_fisica,
        'sedentarismo': sedentarismo,
        'Abuso alcohol y/o drogas': abuso_alcohol_otros,
        'Stress': stress_ansiedad,
        'Exceso preocupacion salud': preocupacion_salud,
        'Exceso pantalla': abuso_pantallas,
        'Fuma': tabaquismo,
        'Fumador cronico': fumador_cronico,
        'Hipertension familiar': hipertension_familiar,
        'Diabetes familiar': diabetes_familiar,
        'Adicciones familiar': adicciones_familiar,
        'Obesidad familiar': obesidad_familiar,
        'Depresion familiar': depresion_familiar,
        'Violencia familiar': violencia_familiar,
        'Cancer de colon': cancer_de_colon,
        'Cancer de mama': cancer_de_mama,
        'Cancer cuello utero': cancer_de_cuello_utero,
        'Cancer de prostata': cancer_de_prostata,
    };
    try {
        const response = await fetch('/saveData', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(formData)
        });
        if (response.ok) {
            alert('Datos guardados correctamente.');
            window.location.href = `ver_recomendaciones.html?dni=${DNI}`;
        } else {
            alert('Error al guardar datos. Inténtalo de nuevo.');
        }
    } catch (error) {
        console.error('Error al guardar datos:', error);
        alert('Error al guardar datos. Inténtalo de nuevo.');
    }
}


// --- Funciones de Utilidad y Validaciones ---
const markAsInvalid = (field, message) => {
    field.classList.add('border-red-500');
    field.classList.remove('border-green-500');
    let errorMsg = field.parentNode.querySelector('.error-message');
    if (!errorMsg) {
        errorMsg = document.createElement('span');
        errorMsg.className = 'error-message text-red-500 text-sm mt-1 block';
        field.parentNode.appendChild(errorMsg);
    }
    errorMsg.textContent = message;
};

const markAsValid = (field) => {
    field.classList.remove('border-red-500');
    field.classList.add('border-green-500');
    const errorMsg = field.parentNode.querySelector('.error-message');
    if (errorMsg) {
        errorMsg.remove();
    }
};

const markRadioGroupAsInvalid = (groupName) => {
    const container = document.querySelector(`input[name="${groupName}"]`).closest('div');
    let errorMsg = container.querySelector('.error-message');
    if (!errorMsg) {
        errorMsg = document.createElement('span');
        errorMsg.className = 'error-message text-red-500 text-sm mt-1 block';
        errorMsg.textContent = 'Seleccione una opción.';
        container.appendChild(errorMsg);
    }
};

const markRadioGroupAsValid = (groupName) => {
    const container = document.querySelector(`input[name="${groupName}"]`).closest('div');
    const errorMsg = container.querySelector('.error-message');
    if (errorMsg) errorMsg.remove();
};

const validateDNI = (input) => /^\d{7,8}$/.test(input.value);
const validateBirthDate = (input) => {
    const dateRegex = /^(0[1-9]|[1-2][0-9]|3[0-1])\/(0[1-9]|1[0-2])\/\d{4}$/;
    if (!dateRegex.test(input.value)) return false;
    const [day, month, year] = input.value.split('/').map(Number);
    const date = new Date(year, month - 1, day);
    const today = new Date();
    return date <= today && !isNaN(date.getTime()) && date.getDate() === day;
};
const validateEmail = (input) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.value);
const validatePhone = (input) => /^\d{10,11}$/.test(input.value.replace(/[\s()-]/g, ''));
const validateHeight = (input) => {
    const height = parseFloat(input.value);
    return !isNaN(height) && height >= 50 && height <= 300;
};
const validateWeight = (input) => {
    const weight = parseFloat(input.value);
    return !isNaN(weight) && weight >= 10 && weight <= 300;
};


// --- Lógica de la Interfaz y Event Listeners (DOM Content Loaded) ---
// Todo el código que interactúa con el DOM debe estar aquí para asegurar que los elementos existan.
document.addEventListener('DOMContentLoaded', function() {
    const formSteps = document.querySelectorAll('.form-step');
    let currentStep = 0;

    const showStep = (step) => {
        formSteps.forEach((s, index) => {
            s.classList.toggle('hidden', index !== step);
        });
        updateProgress();
        updateNavigationButtons();
    };

    const updateProgress = () => {
        const progress = document.getElementById('formProgress');
        if (progress) {
            progress.style.width = `${((currentStep + 1) / formSteps.length) * 100}%`;
        }
    };
    
    const updateNavigationButtons = () => {
        const currentStepElement = formSteps[currentStep];
        const nextButton = currentStepElement.querySelector('[id^="nextBtn"]');
        if (nextButton) {
            nextButton.disabled = !validateAndMarkFields();
        }
    };

    const validateAndMarkFields = () => {
        const currentStepElement = formSteps[currentStep];
        let isValid = true;

        const requiredInputs = currentStepElement.querySelectorAll(`
            input[required]:not([type="radio"]), 
            select[required],
            textarea[required]
        `);
        
        requiredInputs.forEach(input => {
            let fieldIsValid = true;
            if (!input.value.trim()) {
                markAsInvalid(input, 'Este campo es obligatorio.');
                fieldIsValid = false;
            } else {
                switch (input.id) {
                    case 'dni':
                        if (!validateDNI(input)) { markAsInvalid(input, 'El DNI debe tener 7 u 8 dígitos.'); fieldIsValid = false; }
                        break;
                    case 'birthDate':
                        if (!validateBirthDate(input)) { markAsInvalid(input, 'Formato o fecha inválida (dd/mm/yyyy).'); fieldIsValid = false; }
                        break;
                    case 'email':
                        if (!validateEmail(input)) { markAsInvalid(input, 'Formato de correo inválido.'); fieldIsValid = false; }
                        break;
                    case 'phone':
                        if (!validatePhone(input)) { markAsInvalid(input, 'Formato de teléfono inválido (10-11 dígitos).'); fieldIsValid = false; }
                        break;
                    case 'height':
                        if (!validateHeight(input)) { markAsInvalid(input, 'Altura debe ser entre 50 y 300 cm.'); fieldIsValid = false; }
                        break;
                    case 'weight':
                        if (!validateWeight(input)) { markAsInvalid(input, 'Peso debe ser entre 10 y 300 kg.'); fieldIsValid = false; }
                        break;
                }
            }
            if (fieldIsValid) {
                markAsValid(input);
            }
            if (!fieldIsValid) {
                isValid = false;
            }
        });

        if (currentStep >= 2) {
            const radioGroups = new Set();
            currentStepElement.querySelectorAll('input[type="radio"]').forEach(radio => {
                const groupName = radio.name;
                if (groupName) radioGroups.add(groupName);
            });
            
            radioGroups.forEach(groupName => {
                const checkedRadio = document.querySelector(`input[name="${groupName}"]:checked`);
                const smokingStatus = document.querySelector('input[name="smokingStatus"]:checked');
                
                if (groupName === 'smokingDuration' && smokingStatus && smokingStatus.value === 'nunca') {
                    markRadioGroupAsValid(groupName);
                    return;
                }
                
                if (!checkedRadio) {
                    markRadioGroupAsInvalid(groupName);
                    isValid = false;
                } else {
                    markRadioGroupAsValid(groupName);
                }
            });
        }
        
        return isValid;
    };


    // --- Event Listeners principales ---

    document.getElementById('startQuestionnaireButton').addEventListener('click', function() {
        document.getElementById('welcomeScreen').classList.add('hidden');
        document.getElementById('mainForm').classList.remove('hidden');
        document.getElementById('formProgress').closest('div').classList.remove('hidden');
        showStep(currentStep);
    });

    document.querySelectorAll('[id^="nextBtn"]').forEach(btn => {
        btn.addEventListener('click', (e) => {
            if (!validateAndMarkFields()) {
                e.preventDefault();
                return;
            }
            currentStep++;
            showStep(currentStep);
            window.scrollTo({ top: 0, behavior: 'smooth' });
        });
    });

    document.querySelectorAll('[id^="prevBtn"]').forEach(btn => {
        btn.addEventListener('click', () => {
            if (currentStep > 0) {
                currentStep--;
                showStep(currentStep);
                window.scrollTo({ top: 0, behavior: 'smooth' });
            }
        });
    });

    // Llama a las funciones de cálculo y valida en cada cambio de campo
    document.querySelectorAll('input, select, textarea').forEach(field => {
        field.addEventListener('input', () => {
            if (field.id === 'birthDate') calculateAge();
            if (field.id === 'height' || field.id === 'weight') calculateBMI();
            updateNavigationButtons();
        });
        if (field.type === 'radio') {
            field.addEventListener('change', updateNavigationButtons);
        }
    });

    // Event listener para el botón de envío
    const submitBtn = document.getElementById('submitBtn');
    if (submitBtn) {
        submitBtn.addEventListener('click', (e) => {
            if (validateAndMarkFields()) {
                guardarDatosFormulario();
            } else {
                e.preventDefault();
            }
        });
    }

    // --- Inicialización ---
    showStep(currentStep);
});